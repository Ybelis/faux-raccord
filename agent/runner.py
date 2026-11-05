"""LangGraph combines explicit workflows and a bounded tool-selection loop."""

import asyncio
from datetime import datetime, timezone
import hashlib
from importlib.metadata import version
import json
import re
from typing import TypedDict
import uuid

from langgraph.graph import StateGraph, START, END

from agent.model import GroqController, ControllerError
from agent.state import StateError
from agent.tools import Budget, CONFIG, CONTRACTS, ROOT, ToolRuntime, ToolFailure


class RunState(TypedDict):
    messages: list
    pending: list
    final: dict | None


def requests():
    """Keep the five user requests in their existing, reviewed agent sheet."""
    sheet = (ROOT / 'docs/agent_sheet.md').read_text('utf-8')
    rows = re.findall(r'\|\s*(R[1-5])\s*\|\s*“(.+?)”\s*\|\s*(Workflow|Agent)', sheet)
    if len(rows) != 5:
        raise ValueError('The agent sheet must contain exactly five named requests.')
    return {key: {'goal': goal, 'decision': decision.lower()} for key, goal, decision in rows}


def uncertain(message):
    return {'answer': message, 'verdict': 'uncertain', 'citations': []}


def checked_final(content, runtime):
    try:
        try:
            result = json.loads(content)
        except ValueError:
            match = re.match(r'^\s*Verdict:\s*(contradiction|explained|uncertain|draft_ready)\b', content, re.I)
            assert match
            result = {'answer': content, 'verdict': match.group(1).lower(),
                      'citations': list(dict.fromkeys(re.findall(r'\[([^\[\]\s]+)\]', content)))}
        assert isinstance(result, dict) and isinstance(result.get('answer'), str)
        assert len(result['answer']) <= 6000
        assert result.get('verdict') in ('contradiction', 'explained', 'uncertain', 'draft_ready')
        citations = result.get('citations')
        assert isinstance(citations, list) and all(isinstance(c, str) for c in citations)
        assert len(citations) <= 20 and all(c in runtime.evidence for c in citations)
        inline = re.findall(r'\[([^\[\]\s]+)\]', result['answer'])
        assert set(inline) == set(citations)
        if result['verdict'] != 'uncertain':
            assert citations
        if result['verdict'] == 'contradiction':
            assert len({runtime.evidence[c]['sceneId'] for c in citations}) >= 2
        if result['verdict'] == 'draft_ready':
            assert runtime.drafts
        if result['verdict'] == 'explained' and runtime.drafts:
            raise AssertionError()
        return {'answer': result['answer'], 'verdict': result['verdict'],
                'citations': list(dict.fromkeys(citations))}
    except (ValueError, AssertionError, TypeError, KeyError):
        return uncertain('The model response could not be grounded in this run’s evidence; review the retrieved passages.')


def build_graph(runtime, budget, controller, case, run_id):
    def route(state):
        prompt = (ROOT / 'agent/prompts/controller_v1.txt').read_text('utf-8')
        context = {'sample': runtime.context.sample_id, 'source_revision': runtime.context.revision}
        if case.get('id') == 'R4':
            context['selected_alert'] = {'prop': 'brass pocket watch', 'scene_ids': ['S001', 'S002']}
        return {'messages': [
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': json.dumps({'request': case['goal'], 'context': context})},
        ], 'pending': [], 'final': None}

    async def workflow(state):
        name = {'R1': 'search_passages', 'R2': 'check_continuity', 'R3': 'create_revision_draft'}[case['id']]
        args = CONTRACTS[name]['example_arguments']
        result = await runtime.call(name, args, run_id + ':workflow')
        citations = list(runtime.evidence)
        if name == 'search_passages':
            answer = '\n\n'.join(f"[{p['id']}] {p['text']}" for p in result['passages'])
            final = {'answer': answer or 'No source passage was found.', 'verdict': 'sources_ready', 'citations': citations}
        elif name == 'check_continuity':
            final = {'answer': f"Analysis returned {len(result.get('alerts', []))} candidate alerts across {len(args['scene_ids'])} scenes. Review their source pairs; this is not a guarantee of complete detection.", 'verdict': 'analysis_ready', 'citations': citations}
        else:
            final = ({'answer': 'A separate correction draft is ready for human review; the original is unchanged.',
                      'verdict': 'draft_ready', 'citations': []} if runtime.drafts else
                     uncertain('No valid changed scene was proposed; no draft was saved.'))
        return {'final': final}

    async def model_node(state):
        if controller is None:
            raise ToolFailure('CONSENT_REQUIRED', 'Live model processing requires --live --consent.', True)
        tools = [
            {'type': 'function', 'function': {key: tool[key] for key in ('name', 'description', 'parameters')}}
            for tool in CONTRACTS.values()
            if runtime.allow_draft or tool['access'] == 'read'
        ]
        response = None
        for attempt in range(2):
            budget.claim_controller()
            try:
                response = await controller.complete(state['messages'], tools,
                                                    max_tokens=runtime.config['max_controller_output_tokens'])
                budget.record(response['usage'], controller=True)
                break
            except ControllerError as error:
                budget.record(error.usage, controller=True)
                runtime.events.append({'event': 'controller_error', 'code': error.code,
                                       'usage': error.usage})
                if error.code == 'TOOL_USE_FAILED' and not attempt:
                    state['messages'] = state['messages'] + [{
                        'role': 'user',
                        'content': 'Host feedback: the provider rejected your previous tool call; no tool was executed. Use only the listed functions. If finished, write an ordinary assistant message beginning with Verdict:, not a JSON function call.',
                    }]
                    continue
                if error.code != 'RATE_LIMIT' or getattr(error, 'dailyQuota', False) or attempt:
                    raise
                # Reprise d'infrastructure comptée, jamais une nouvelle tentative
                # pour remplacer une réponse de contenu qui ne nous plaît pas.
                runtime.events.append({'event': 'rate_limit_wait', 'seconds': 60})
                await asyncio.sleep(60)
        calls = response['tool_calls']
        runtime.events.append({'event': 'controller_response', 'tool_calls': calls,
                               'content': response['content'], 'usage': response['usage']})
        message = {'role': 'assistant', 'content': response['content'] or ''}
        if calls:
            message['tool_calls'] = calls
        messages = state['messages'] + [message]
        return {'messages': messages, 'pending': calls,
                'final': None if calls else checked_final(response['content'], runtime)}

    async def tools_node(state):
        messages = list(state['messages'])
        for call in state['pending']:
            name = call['function']['name']
            try:
                raw = call['function']['arguments']
                if len(raw) > 16 * 1024:
                    raise ValueError()
                args = json.loads(raw)
                result = await runtime.call(name, args, run_id + ':' + call['id'], require_evidence=True)
            except (ValueError, StateError) as error:
                result = {'error': {'code': 'INVALID_ARGUMENTS', 'message': 'Check arguments and the selected source revision.'}}
                runtime.events.append({'tool': name, 'error': result['error']})
            except ToolFailure as error:
                runtime.events.append({'tool': name, 'error': {'code': error.code, 'message': str(error)}})
                if error.hard_stop:
                    raise
                result = {'error': {'code': error.code, 'message': str(error)}}
            messages.append({'role': 'tool', 'tool_call_id': call['id'],
                             'content': json.dumps(result, ensure_ascii=True)})
        return {'messages': messages, 'pending': []}

    graph = StateGraph(RunState)
    graph.add_node('route', route)
    graph.add_node('workflow', workflow)
    graph.add_node('controller', model_node)
    graph.add_node('tools', tools_node)
    graph.add_edge(START, 'route')
    graph.add_conditional_edges('route', lambda state: 'workflow' if case['decision'] == 'workflow' else 'controller')
    graph.add_edge('workflow', END)
    graph.add_conditional_edges('controller', lambda state: 'tools' if state['pending'] else END)
    graph.add_edge('tools', 'controller')
    return graph.compile()


async def run_request(request_id=None, *, goal=None, live=False, consent=False,
                      allow_draft=False, config=None, controller=None, runtime_factory=ToolRuntime):
    config = {**CONFIG, **(config or {})}
    case = ({'id': request_id, **requests()[request_id]} if request_id else
            {'id': 'custom', 'goal': goal, 'decision': 'agent'})
    if not isinstance(case['goal'], str) or not 3 <= len(case['goal']) <= 2000 or '\0' in case['goal']:
        raise ValueError('A request must contain 3 to 2000 characters without NUL.')
    run_id = uuid.uuid4().hex
    budget = Budget(config)
    runtime = runtime_factory(budget, config=config, allow_model=live and consent,
                              allow_draft=request_id in ('R3', 'R5') or allow_draft)
    owned_controller = False
    status, error, final = 'completed', None, None
    try:
        if case['decision'] == 'agent' and controller is None and live and consent:
            controller = GroqController(config['model'], temperature=config['temperature'])
            owned_controller = True
        async with runtime:
            graph = build_graph(runtime, budget, controller, case, run_id)
            async with asyncio.timeout(config['max_run_seconds']):
                state = await graph.ainvoke({'messages': [], 'pending': [], 'final': None},
                                           config={'recursion_limit': 30})
            final = state['final']
    except TimeoutError:
        status, error = 'stopped', {'code': 'RUN_TIMEOUT', 'message': 'The run exceeded its five-minute limit.'}
    except (ToolFailure, ControllerError, StateError) as failure:
        status = 'stopped' if getattr(failure, 'hard_stop', False) else 'error'
        error = {'code': getattr(failure, 'code', 'STATE_ERROR'), 'message': str(failure)}
    finally:
        if owned_controller:
            await controller.asyncclose()
    return {
        'run_id': run_id, 'request_id': case['id'], 'request': case['goal'], 'mode': case['decision'],
        'framework': 'LangGraph', 'profile': config['version'], 'model': config['model'],
        'framework_version': version('langgraph'),
        'config': config,
        'controller_prompt_sha256': hashlib.sha256((ROOT / 'agent/prompts/controller_v1.txt').read_bytes()).hexdigest(),
        'sample': runtime.context.sample_id, 'source_revision': runtime.context.revision,
        'completed_at': datetime.now(timezone.utc).isoformat(), 'status': status, 'error': error,
        'final': final or uncertain(error['message'] if error else 'No grounded result was produced.'),
        'usage': budget.report(), 'events': runtime.events,
        'evidence': list(runtime.evidence.values()), 'drafts': runtime.drafts,
    }
