"""Exercise the real stdio server without a model or the web application."""

import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

from fastmcp import Client
from fastmcp.client.transports import StdioTransport


ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / "agent" / "server.py"
CONTROLLED = ROOT / "data" / "controlled-script" / "project.json"
CONTRACT = next(
    tool
    for tool in json.loads((ROOT / "agent" / "tool_schemas.json").read_text("utf-8"))["tools"]
    if tool["name"] == "search_passages"
)


def text_of(result):
    return "\n".join(getattr(item, "text", "") for item in result.content)


class MCPServerTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        node = shutil.which("node")
        if not node:
            raise unittest.SkipTest("Node.js is required to run the existing parser and BM25.")
        # Reference passages come from the same public parser, not a second
        # implementation of scene splitting in the tests.
        source = """
            import fs from 'node:fs';
            import { parseScreenplay } from './src/core/parser.js';
            const project = JSON.parse(fs.readFileSync('data/controlled-script/project.json', 'utf8'));
            const scenes = project.scenes || parseScreenplay(project.pages ? project : project.text).scenes;
            console.log(JSON.stringify(scenes));
        """
        result = subprocess.run(
            [node, "--input-type=module", "-e", source],
            cwd=ROOT,
            capture_output=True,
            encoding="utf-8",
            check=True,
            timeout=15,
        )
        cls.scenes = {scene["id"]: scene for scene in json.loads(result.stdout)}

    async def asyncSetUp(self):
        # Start outside the repository to catch accidental relative file paths.
        self.temporary = tempfile.TemporaryDirectory(prefix="faux-raccord-mcp-")
        self.addCleanup(self.temporary.cleanup)
        self.log = open(Path(self.temporary.name) / "server.log", "w", encoding="utf-8")
        self.addCleanup(self.log.close)
        self.client = await self.enterAsyncContext(self.make_client())

    def make_client(self, sample="controlled-valkaama"):
        transport = StdioTransport(
            command=sys.executable,
            args=[str(SERVER), "--sample", sample],
            cwd=self.temporary.name,
            env={"PYTHONUTF8": "1", "FASTMCP_LOG_LEVEL": "ERROR"},
            log_file=self.log,
            keep_alive=False,
        )
        return Client(transport, timeout=20)

    async def search(self, arguments):
        result = await self.client.call_tool("search_passages", arguments)
        self.assertFalse(result.is_error, text_of(result))
        data = result.structured_content
        self.assertIsInstance(data, dict)
        self.assertEqual(data["model_calls"], 0)
        return data

    async def test_discovery_matches_the_session_2_contract(self):
        tools = await self.client.list_tools()
        self.assertEqual([tool.name for tool in tools], [CONTRACT["name"]])
        tool = tools[0]
        self.assertEqual(tool.description, CONTRACT["description"])
        self.assertEqual(tool.input_schema, CONTRACT["parameters"])
        self.assertTrue(tool.annotations.read_only_hint)
        self.assertTrue(tool.annotations.idempotent_hint)
        self.assertFalse(tool.annotations.destructive_hint)
        self.assertFalse(tool.annotations.open_world_hint)

    async def test_watch_example_returns_verbatim_source_passages(self):
        data = await self.search(CONTRACT["example_arguments"])
        passages = data["passages"]
        self.assertEqual({passage["sceneId"] for passage in passages}, {"S001", "S002"})
        self.assertLessEqual(len(passages), 5)
        for passage in passages:
            scene = self.scenes[passage["sceneId"]]
            self.assertIn(passage["text"], scene["text"])
            self.assertIn(passage["page"], scene["pages"])
            self.assertLessEqual(len(passage["text"]), 1000)
            self.assertTrue(math.isfinite(passage["score"]))
            self.assertGreater(passage["score"], 0)

    async def test_scene_scope_and_result_limit_are_applied(self):
        data = await self.search(
            {"query": "brass pocket watch", "scene_ids": ["S002"], "top_k": 1}
        )
        self.assertEqual(len(data["passages"]), 1)
        self.assertEqual(data["passages"][0]["sceneId"], "S002")

    async def test_omitted_and_null_scope_both_search_the_selected_script(self):
        omitted = await self.search({"query": "brass pocket watch"})
        explicit = await self.search({"query": "brass pocket watch", "scene_ids": None})
        self.assertEqual(omitted["passages"], explicit["passages"])
        self.assertEqual(omitted["script"], explicit["script"])

    async def test_no_matches_is_a_valid_empty_result(self):
        data = await self.search({"query": "zzzxqvcontinuitynotfound73x6"})
        self.assertEqual(data["passages"], [])

    async def test_invalid_arguments_return_safe_errors(self):
        invalid = [
            {},
            {"query": "   "},
            {"query": "watch\x00"},
            {"query": "x" * 501},
            {"query": "watch", "top_k": 0},
            {"query": "watch", "top_k": 6},
            {"query": "watch", "top_k": True},
            {"query": "watch", "top_k": "5"},
            {"query": "watch", "scene_ids": []},
            {"query": "watch", "scene_ids": ["S001", "S001"]},
            {"query": "watch", "scene_ids": ["S01"]},
            {"query": "watch", "scene_ids": ["S999"]},
            {"query": "watch", "scene_ids": [f"S{i:03}" for i in range(1, 202)]},
            {"query": "watch", "approved": True},
            {"query": "watch", "api_key": "not-a-key"},
            {"query": "watch", "path": "../../.env"},
            {"query": "watch", "url": "https://example.org"},
        ]
        for arguments in invalid:
            with self.subTest(arguments=arguments):
                result = await self.client.call_tool(
                    "search_passages", arguments, raise_on_error=False
                )
                self.assertTrue(result.is_error)
                message = text_of(result)
                self.assertTrue(message.strip())
                self.assertNotIn("Traceback", message)
                self.assertNotIn(str(ROOT), message)
                self.assertNotIn('File "', message)

    async def test_unimplemented_tools_are_not_exposed(self):
        result = await self.client.call_tool(
            "check_continuity", {"scene_ids": ["S001"]}, raise_on_error=False
        )
        self.assertTrue(result.is_error)

    async def test_search_preserves_the_script_and_identifies_its_revision(self):
        before = hashlib.sha256(CONTROLLED.read_bytes()).hexdigest()
        first = await self.search(CONTRACT["example_arguments"])
        second = await self.search(CONTRACT["example_arguments"])
        self.assertEqual(before, hashlib.sha256(CONTROLLED.read_bytes()).hexdigest())
        self.assertEqual(first["script"], second["script"])
        self.assertEqual(first["script"]["id"], "controlled-valkaama")
        self.assertEqual(first["script"]["license"], "CC BY-SA 3.0")
        self.assertEqual(first["script"]["scene_count"], len(self.scenes))
        self.assertRegex(first["script"]["revision"], r"^[a-f0-9]{64}$")

    async def test_original_screenplay_is_an_explicit_startup_choice(self):
        async with self.make_client("valkaama") as client:
            result = await client.call_tool("search_passages", {"query": "Runa", "top_k": 1})
        self.assertFalse(result.is_error, text_of(result))
        data = result.structured_content
        self.assertEqual(data["script"]["id"], "valkaama")
        self.assertEqual(data["script"]["license"], "CC BY-SA 3.0")
        self.assertEqual(data["model_calls"], 0)
        self.assertEqual(len(data["passages"]), 1)


if __name__ == "__main__":
    unittest.main()
