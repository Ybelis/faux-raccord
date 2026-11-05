"""Exercise LangGraph routing, tool feedback and boundaries without a provider."""

import asyncio
import copy
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest

from agent.runner import checked_final, run_request
from agent.state import DraftStore
from agent.tools import ROOT, ToolFailure, ToolRuntime


ANNOTATIONS = json.loads(
    (ROOT / "data/controlled-script/annotations.json").read_text("utf-8")
)["entries"]


def tool_call(name, arguments, identifier="call-1"):
    return {
        "id": identifier,
        "type": "function",
        "function": {"name": name, "arguments": json.dumps(arguments)},
    }


def completion(*calls, answer=None):
    return {
        "content": json.dumps(answer) if answer is not None else "",
        "tool_calls": list(calls),
        "usage": {"calls": 1, "inputTokens": 100, "outputTokens": 30, "milliseconds": 1},
    }


def supported_answer(verdict="contradiction"):
    return {
        "answer": "The two states conflict [S001-C1] [S002-C1].",
        "verdict": verdict,
        "citations": ["S001-C1", "S002-C1"],
    }


class ScriptedController:
    """Predetermined responses test the graph, not the quality of a model."""

    def __init__(self, responses, delay=0):
        self.responses = list(responses)
        self.delay = delay
        self.inputs = []

    async def complete(self, messages, tools, max_tokens=1400):
        self.inputs.append({"messages": copy.deepcopy(messages), "tools": copy.deepcopy(tools)})
        if self.delay:
            await asyncio.sleep(self.delay)
        if not self.responses:
            raise AssertionError("The graph made an unexpected controller request.")
        return self.responses.pop(0)


class FixtureRuntime(ToolRuntime):
    """Keep real schema/consent/cache/draft controls; replace only external I/O."""

    def __init__(self, budget, *, config, allow_model, allow_draft, directory):
        super().__init__(
            budget,
            config=config,
            allow_model=allow_model,
            allow_draft=allow_draft,
            store=DraftStore(directory=directory),
            env={},
        )
        self.external_calls = []

    def metadata(self):
        return {"id": self.context.sample_id, "revision": self.context.revision}

    async def _search(self, arguments):
        self.external_calls.append(("search_passages", copy.deepcopy(arguments)))
        prop = "E02" if "notebook" in arguments["query"].lower() else "E01"
        entry = next(row for row in ANNOTATIONS if row["errorId"] == prop)
        passages = [
            {
                "id": quote["sceneId"] + "-C1",
                "sceneId": quote["sceneId"],
                "page": quote["sourcePages"][0],
                "text": quote["quote"],
            }
            for quote in (entry["before"], entry["after"])
        ]
        scope = arguments.get("scene_ids")
        if scope:
            passages = [row for row in passages if row["sceneId"] in scope]
        return {
            "script": self.metadata(),
            "passages": passages[:arguments.get("top_k", 5)],
            "model_calls": 0,
        }

    async def _action(self, name, arguments):
        self.external_calls.append((name, copy.deepcopy(arguments)))
        if not self.allow_model:
            raise ToolFailure("CONSENT_REQUIRED", "Model processing needs consent.", True)
        self.budget.record({"calls": 1, "inputTokens": 50, "outputTokens": 20})
        if name == "check_continuity":
            entry = ANNOTATIONS[0]
            return {
                "script": self.metadata(),
                "alerts": [{"evidence": [
                    {"sceneId": entry[side]["sceneId"], "quote": entry[side]["quote"]}
                    for side in ("before", "after")
                ]}],
                "usage": {"calls": 1},
            }
        return {
            "script": self.metadata(),
            "changed": True,
            "text": "INT. CAFE - DAY\nRuna holds the broken watch, still stopped.\n",
            "source_scene_text": "INT. CAFE - DAY\nRuna checks her working watch.\n",
            "summary": "The watch remains broken.",
            "usage": {"calls": 1},
        }


class AgentRunnerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="faux-raccord-runner-")
        self.addCleanup(self.temporary.cleanup)
        self.runtimes = []

    def factory(self, budget, **options):
        runtime = FixtureRuntime(budget, directory=Path(self.temporary.name), **options)
        self.runtimes.append(runtime)
        return runtime

    async def run_case(self, case, controller=None, **options):
        return await run_request(
            case, controller=controller, runtime_factory=self.factory, **options
        )

    async def test_three_workflows_use_the_named_tool_without_controller_calls(self):
        expected = {
            "R1": ("search_passages", "sources_ready"),
            "R2": ("check_continuity", "analysis_ready"),
            "R3": ("create_revision_draft", "draft_ready"),
        }
        for case, (tool, verdict) in expected.items():
            with self.subTest(request=case):
                controller = ScriptedController([])
                result = await self.run_case(case, controller, live=True, consent=True)
                self.assertEqual(result["status"], "completed")
                self.assertEqual(result["framework"], "LangGraph")
                self.assertEqual(result["mode"], "workflow")
                tool_events = [event for event in result["events"] if "tool" in event]
                self.assertEqual(tool_events[0]["tool"], tool)
                self.assertEqual(result["final"]["verdict"], verdict)
                self.assertEqual(controller.inputs, [])
                self.assertEqual(result["usage"]["controller_calls"], 0)

    async def test_investigation_returns_tool_observations_to_the_controller(self):
        controller = ScriptedController([
            completion(tool_call("search_passages", {"query": "watch"})),
            completion(answer=supported_answer()),
        ])
        result = await self.run_case("R4", controller)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["final"]["verdict"], "contradiction")
        self.assertEqual(result["usage"]["controller_calls"], 2)
        observation = controller.inputs[1]["messages"][-1]
        self.assertEqual(observation["role"], "tool")
        self.assertEqual(observation["tool_call_id"], "call-1")
        self.assertEqual(len(json.loads(observation["content"])["passages"]), 2)

    async def test_revision_investigation_saves_an_unapplied_draft_after_evidence(self):
        controller = ScriptedController([
            completion(tool_call("search_passages", {"query": "red notebook"}, "lookup")),
            completion(tool_call("create_revision_draft", {
                "scene_id": "S002", "instruction": "Keep the notebook destroyed."
            }, "proposal")),
            completion(answer=supported_answer("draft_ready")),
        ])
        result = await self.run_case("R5", controller, live=True, consent=True)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["final"]["verdict"], "draft_ready")
        self.assertEqual([e["tool"] for e in result["events"] if "tool" in e], [
            "search_passages", "create_revision_draft"
        ])
        self.assertEqual(len(result["drafts"]), 1)
        self.assertEqual(result["drafts"][0]["status"], "pending_review")
        self.assertEqual(len(list(Path(self.temporary.name).glob("draft-*.json"))), 1)

    async def test_invented_citation_becomes_an_explicit_uncertain_result(self):
        answer = {"answer": "A repair exists [S999-C1].", "verdict": "explained", "citations": ["S999-C1"]}
        result = await self.run_case("R4", ScriptedController([completion(answer=answer)]))
        self.assertEqual(result["final"]["verdict"], "uncertain")
        self.assertEqual(result["final"]["citations"], [])

    async def test_unknown_tool_and_boolean_limit_can_be_corrected_from_feedback(self):
        controller = ScriptedController([
            completion(tool_call("delete_script", {}, "unknown")),
            completion(tool_call("search_passages", {"query": "watch", "top_k": True}, "bad")),
            completion(tool_call("search_passages", {"query": "watch"}, "good")),
            completion(answer=supported_answer()),
        ])
        result = await self.run_case("R4", controller)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["final"]["verdict"], "contradiction")
        self.assertEqual(len(self.runtimes[-1].external_calls), 1)
        feedback = [json.loads(controller.inputs[index]["messages"][-1]["content"])
                    for index in (1, 2)]
        self.assertEqual([f["error"]["code"] for f in feedback], [
            "UNKNOWN_TOOL", "INVALID_ARGUMENTS"
        ])

    async def test_read_only_investigation_cannot_save_a_draft(self):
        controller = ScriptedController([
            completion(tool_call("create_revision_draft", {
                "scene_id": "S002", "instruction": "Change the watch."
            })),
            completion(answer={"answer": "No draft was created.", "verdict": "uncertain", "citations": []}),
        ])
        result = await self.run_case("R4", controller, live=True, consent=True)
        exposed = {tool["function"]["name"] for tool in controller.inputs[0]["tools"]}
        self.assertNotIn("create_revision_draft", exposed)
        tool_events = [event for event in result["events"] if "tool" in event]
        self.assertEqual(tool_events[0]["error"]["code"], "WRITE_NOT_ALLOWED")
        self.assertEqual(result["drafts"], [])
        self.assertEqual(list(Path(self.temporary.name).glob("draft-*.json")), [])

    async def test_controller_and_total_call_limits_stop_before_an_extra_request(self):
        for config in ({"max_controller_calls": 1}, {"max_total_model_calls": 1}):
            with self.subTest(config=config):
                controller = ScriptedController([
                    completion(tool_call("search_passages", {"query": "watch"}))
                ])
                result = await self.run_case("R4", controller, config=config)
                self.assertEqual(result["status"], "stopped")
                self.assertEqual(result["error"]["code"], "BUDGET_EXHAUSTED")
                self.assertEqual(len(controller.inputs), 1)
                self.assertEqual(result["usage"]["model_calls"], 1)

    async def test_new_run_does_not_inherit_evidence_or_conversation(self):
        first = await self.run_case("R4", ScriptedController([
            completion(tool_call("search_passages", {"query": "watch"})),
            completion(answer=supported_answer()),
        ]))
        second_controller = ScriptedController([completion(answer=supported_answer())])
        second = await self.run_case("R4", second_controller)
        self.assertNotEqual(first["run_id"], second["run_id"])
        self.assertEqual(second["evidence"], [])
        self.assertEqual(second["final"]["verdict"], "uncertain")
        self.assertEqual([m["role"] for m in second_controller.inputs[0]["messages"]], [
            "system", "user"
        ])

    async def test_wall_clock_limit_stops_a_slow_controller(self):
        controller = ScriptedController([completion(answer=supported_answer())], delay=0.1)
        result = await self.run_case("R4", controller, config={"max_run_seconds": 0.02})
        self.assertEqual(result["status"], "stopped")
        self.assertEqual(result["error"]["code"], "RUN_TIMEOUT")
        self.assertLessEqual(len(controller.inputs), 1)

    def test_plain_text_verdict_retains_references_from_two_observed_scenes(self):
        runtime = SimpleNamespace(
            evidence={"S001-C1": {"sceneId": "S001"}, "S002-C1": {"sceneId": "S002"}},
            drafts=[],
        )
        for verdict in ("contradiction", "uncertain"):
            with self.subTest(verdict=verdict):
                content = (
                    f"Verdict: {verdict}\n"
                    "The first state is shown in [S001-C1]; the second is in [S002-C1]."
                )
                result = checked_final(content, runtime)
                self.assertEqual(result["verdict"], verdict)
                self.assertEqual(result["answer"], content)
                self.assertEqual(result["citations"], ["S001-C1", "S002-C1"])

    def test_plain_text_guard_rejects_invented_sources_or_an_uncited_draft_summary(self):
        runtime = SimpleNamespace(
            evidence={"S001-C1": {"sceneId": "S001"}, "S002-C1": {"sceneId": "S002"}},
            drafts=[{"draft_id": "a-separate-proposal-exists"}],
        )
        replies = [
            "Verdict: contradiction\nAn invented source proves it [S999-C1].",
            "Verdict: draft_ready\nA correction draft is ready for review.",
            json.dumps({"answer": "A draft is ready.", "verdict": "draft_ready", "citations": []}),
        ]
        for content in replies:
            with self.subTest(content=content):
                result = checked_final(content, runtime)
                self.assertEqual(result["verdict"], "uncertain")
                self.assertEqual(result["citations"], [])
                self.assertIn("could not be grounded", result["answer"])
        self.assertEqual(len(runtime.drafts), 1)


if __name__ == "__main__":
    unittest.main()
