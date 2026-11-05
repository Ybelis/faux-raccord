"""Run the three reviewed tools against one pinned screenplay revision."""

from contextlib import AsyncExitStack
import asyncio
import copy
import difflib
import hashlib
import json
import os
from pathlib import Path
import shutil
import time

from fastmcp import Client
from fastmcp.client.transports import StdioTransport
from jsonschema import Draft202012Validator

from agent.state import DraftStore, ScriptContext, StateError

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'agent/config.json').read_text('utf-8'))
CONTRACTS = {
    tool['name']: tool
    for tool in json.loads((ROOT / 'agent/tool_schemas.json').read_text('utf-8'))['tools']
}


class ToolFailure(RuntimeError):
    def __init__(self, code, message, hard_stop=False):
        super().__init__(message)
        self.code = code
        self.hard_stop = hard_stop


class Budget:
    """One ledger includes the controller AND the calls inside analysis tools."""
    def __init__(self, config):
        self.config = config
        self.started = time.monotonic()
        self.controller_calls = 0
        self.tool_calls = 0
        self.model_calls = 0
        self.input_tokens = 0
        self.output_tokens = 0
        self.unmeasured_calls = 0
        self.interrupted_actions = 0

    @property
    def remaining(self):
        if self.interrupted_actions:
            return 0
        return max(0, self.config['max_total_model_calls'] - self.model_calls)

    def claim_controller(self):
        if self.controller_calls >= self.config['max_controller_calls'] or not self.remaining:
            raise ToolFailure('BUDGET_EXHAUSTED', 'The model-call limit was reached.', True)
        self.controller_calls += 1
        self.model_calls += 1

    def record(self, usage, controller=False):
        usage = usage or {}
        if not controller:
            self.model_calls += max(0, int(usage.get('calls', 0)))
        self.input_tokens += max(0, int(usage.get('inputTokens', 0)))
        self.output_tokens += max(0, int(usage.get('outputTokens', 0)))
        self.unmeasured_calls += max(0, int(usage.get('unmeasuredCalls', 0)))

    def report(self):
        return {
            'controller_calls': self.controller_calls, 'tool_calls': self.tool_calls,
            'model_calls': self.model_calls, 'input_tokens': self.input_tokens,
            'output_tokens': self.output_tokens, 'unmeasured_calls': self.unmeasured_calls,
            'interrupted_actions': self.interrupted_actions,
            'milliseconds': round((time.monotonic() - self.started) * 1000),
        }


class ToolRuntime:
    def __init__(self, budget, *, sample=None, allow_model=False, allow_draft=False,
                 config=None, store=None, env=None):
        self.config = config or CONFIG
        self.budget = budget
        self.context = ScriptContext.load(sample or self.config['sample'])
        self.allow_model = allow_model
        self.allow_draft = allow_draft
        self.store = store or DraftStore(ttl_days=self.config['draft_retention_days'])
        self.env = dict(os.environ if env is None else env)
        self.node = shutil.which('node')
        self.cache = {}
        self.evidence = {}
        self.drafts = []
        self.events = []
        self._stack = AsyncExitStack()
        self._client = None

    async def __aenter__(self):
        await self._stack.__aenter__()
        return self

    async def __aexit__(self, *exc):
        return await self._stack.__aexit__(*exc)

    async def _search(self, args):
        if self._client is None:
            directory = ROOT / '.local/agent'
            directory.mkdir(parents=True, exist_ok=True)
            log = self._stack.enter_context((directory / 'mcp.log').open('a', encoding='utf-8'))
            import sys
            transport = StdioTransport(
                command=sys.executable,
                args=[str(ROOT / 'agent/server.py'), '--sample', self.context.sample_id],
                cwd=str(ROOT), log_file=log, keep_alive=False,
                env={'PYTHONUTF8': '1', 'FASTMCP_LOG_LEVEL': 'ERROR'},
            )
            self._client = await self._stack.enter_async_context(Client(transport, timeout=20))
            tools = await self._client.list_tools()
            expected = CONTRACTS['search_passages']
            if (len(tools) != 1 or tools[0].name != expected['name']
                    or tools[0].description != expected['description']
                    or tools[0].input_schema != expected['parameters']):
                raise ToolFailure('CONTRACT_CHANGED', 'Review the MCP contract before use.', True)
        result = await self._client.call_tool('search_passages', args, raise_on_error=False)
        if result.is_error:
            message = ''.join(getattr(c, 'text', '') for c in result.content)
            raise ToolFailure('SEARCH_REJECTED', message)
        return result.structured_content

    async def _action(self, name, args):
        if not self.allow_model:
            raise ToolFailure('CONSENT_REQUIRED', 'Model processing requires explicit user consent.', True)
        if not self.node or not self.env.get('GROQ_API_KEY'):
            raise ToolFailure('MISSING_KEY', 'Configure GROQ_API_KEY in the local .env file.', True)
        if not self.budget.remaining:
            raise ToolFailure('BUDGET_EXHAUSTED', 'No model calls remain.', True)
        allowed = {'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL'}
        environment = {key: value for key, value in self.env.items() if key.upper() in allowed}
        environment.update(GROQ_API_KEY=self.env['GROQ_API_KEY'],
                           AGENT_TOOL_MODEL=self.config['model'])
        process = None
        received = False
        try:
            process = await asyncio.create_subprocess_exec(
                str(Path(self.node).resolve()), str(ROOT / 'agent/action_bridge.mjs'),
                '--sample', self.context.sample_id, '--revision', self.context.revision,
                '--tool', name, '--max-model-calls', str(self.budget.remaining),
                cwd=ROOT, env=environment, stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
            )
            process.stdin.write(json.dumps(args, ensure_ascii=True).encode('ascii'))
            await process.stdin.drain()
            process.stdin.close()
            output = bytearray()
            while chunk := await process.stdout.read(4096):
                output.extend(chunk)
                if len(output) > 256 * 1024:
                    raise ToolFailure('OUTPUT_LIMIT', 'Tool output exceeded its size limit.', True)
            await process.wait()
            data = json.loads(output)
            self.budget.record(data.get('usage', {}))
            received = True
            if 'error' in data:
                error = data['error']
                code = error.get('code', 'TOOL_FAILED')
                hard = error.get('daily_quota', False) or code in ('BUDGET_EXHAUSTED', 'MODEL_CALL_LIMIT', 'BAD_KEY')
                self.events.append({'tool': name, 'error': error, 'usage': data.get('usage', {}),
                                    'warnings': data.get('warnings', [])})
                raise ToolFailure(code, error.get('message', 'The tool failed.'), hard)
            return data
        except (OSError, ValueError):
            raise ToolFailure('TOOL_FAILED', 'The local action process did not return a valid result.', True) from None
        finally:
            if process is not None and process.returncode is None:
                process.kill()
                await process.wait()
            if process is not None and not received:
                # Le quota exact du processus interrompu est inconnu : arrêter
                # le run, plutôt que réutiliser un budget supposé disponible.
                self.budget.interrupted_actions += 1

    def _collect_evidence(self, result):
        for source in result.get('passages', []):
            self.evidence[source['id']] = source
        for alert in result.get('alerts', []):
            for source in alert.get('evidence', []):
                reference = source['sceneId'] + '-E' + hashlib.sha256(
                    source['quote'].encode('utf-8')).hexdigest()[:12]
                source['id'] = reference
                self.evidence[reference] = source

    async def call(self, name, args, operation_id, require_evidence=False):
        if name not in CONTRACTS:
            raise ToolFailure('UNKNOWN_TOOL', 'Choose one of the three reviewed tools.')
        if self.budget.tool_calls >= self.config['max_tool_calls']:
            raise ToolFailure('BUDGET_EXHAUSTED', 'The tool-call limit was reached.', True)
        self.budget.tool_calls += 1
        validator = Draft202012Validator(CONTRACTS[name]['parameters'])
        if not validator.is_valid(args):
            raise ToolFailure('INVALID_ARGUMENTS', 'Arguments do not match the reviewed tool schema.')
        if name == 'create_revision_draft':
            if not self.allow_draft:
                raise ToolFailure('WRITE_NOT_ALLOWED', 'This request allows read tools only.')
            if require_evidence and len({e['sceneId'] for e in self.evidence.values()}) < 2:
                raise ToolFailure('EVIDENCE_REQUIRED', 'Inspect passages from both scenes before proposing a correction.')
        self.context.assert_current()
        key = name + ':' + json.dumps(args, sort_keys=True)
        if name != 'create_revision_draft' and key in self.cache:
            result = copy.deepcopy(self.cache[key])
            result.update(cache_hit=True, usage={'calls': 0})
        else:
            result = await (self._search(args) if name == 'search_passages' else self._action(name, args))
            self.context.assert_current()
            if result.get('script', {}).get('revision') != self.context.revision:
                raise ToolFailure('STALE_REVISION', 'Tool output belongs to another source revision.', True)
            self._collect_evidence(result)
            if name == 'create_revision_draft' and result.get('changed'):
                draft = self.store.save(self.context, args['scene_id'], args['instruction'], result, operation_id)
                self.drafts.append(draft)
                original = result.pop('source_scene_text', '')
                proposed = result.pop('text')
                changes = '\n'.join(difflib.unified_diff(original.splitlines(), proposed.splitlines(),
                                    fromfile=args['scene_id']+' original', tofile=args['scene_id']+' draft', lineterm=''))
                result.update(draft_id=draft['draft_id'], status=draft['status'],
                              expires_at=draft['expires_at'], proposed_changes=changes[:6000],
                              diff_truncated=len(changes) > 6000)
            elif name == 'create_revision_draft':
                result.pop('source_scene_text', None)
            else:
                self.cache[key] = copy.deepcopy(result)
        self.events.append({'tool': name, 'arguments': args, 'result': result})
        return result
