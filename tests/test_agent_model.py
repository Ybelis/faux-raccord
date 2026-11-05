"""Verify native tool messages and safe controller errors without contacting Groq."""

from types import SimpleNamespace as Namespace
import unittest
from unittest.mock import AsyncMock, patch

import httpx2
from openai import APIConnectionError, APIStatusError, APITimeoutError

from agent.model import ControllerError, GROQ_BASE_URL, GroqController


def response(content=None, tool_calls=None, usage=True):
    return Namespace(
        choices=[Namespace(message=Namespace(content=content, tool_calls=tool_calls))],
        usage=Namespace(prompt_tokens=110, completion_tokens=35) if usage else None,
    )


def fake_client(*, value=None, error=None):
    return Namespace(
        chat=Namespace(completions=Namespace(create=AsyncMock(return_value=value, side_effect=error))),
        close=AsyncMock(),
    )


def status_error(status, body):
    request = httpx2.Request("POST", GROQ_BASE_URL + "/chat/completions")
    return APIStatusError(
        "provider detail containing private-token",
        response=httpx2.Response(status, request=request),
        body=body,
    )


class ControllerModelTests(unittest.IsolatedAsyncioTestCase):
    async def test_native_tool_calls_preserve_the_message_roles_and_identifiers(self):
        call = Namespace(
            id="call-1", type="function",
            function=Namespace(name="search_passages", arguments='{"query":"watch"}'),
        )
        client = fake_client(value=response(tool_calls=[call]))
        controller = GroqController("openai/gpt-oss-120b", client=client)
        messages = [
            {"role": "system", "content": "Use the tools."},
            {"role": "user", "content": "Find the watch."},
            {"role": "assistant", "tool_calls": [{"id": "previous-call", "type": "function", "function": {"name": "search_passages", "arguments": "{}"}}]},
            {"role": "tool", "tool_call_id": "previous-call", "content": "No matches."},
        ]
        tools = [{"type": "function", "function": {"name": "search_passages", "parameters": {"type": "object"}}}]
        result = await controller.complete(messages, tools, max_tokens=900)
        kwargs = client.chat.completions.create.await_args.kwargs
        self.assertEqual(kwargs["messages"], messages)
        self.assertEqual(kwargs["tools"], tools)
        self.assertFalse(kwargs["parallel_tool_calls"])
        self.assertEqual(kwargs["max_completion_tokens"], 900)
        self.assertEqual(kwargs["reasoning_effort"], "low")
        self.assertNotIn("response_format", kwargs)
        self.assertEqual(result["content"], "")
        self.assertEqual(result["tool_calls"][0]["id"], "call-1")
        self.assertEqual(result["tool_calls"][0]["function"]["arguments"], '{"query":"watch"}')
        self.assertEqual(result["usage"]["inputTokens"], 110)
        self.assertEqual(result["usage"]["outputTokens"], 35)
        self.assertNotIn("unmeasuredCalls", result["usage"])

    async def test_text_only_completion_omits_tool_parameters_and_model_specific_settings(self):
        client = fake_client(value=response(content="A supported answer."))
        controller = GroqController("llama-3.3-70b-versatile", client=client)
        result = await controller.complete([], [])
        kwargs = client.chat.completions.create.await_args.kwargs
        self.assertEqual(result["content"], "A supported answer.")
        self.assertEqual(result["tool_calls"], [])
        self.assertNotIn("tools", kwargs)
        self.assertNotIn("reasoning_effort", kwargs)
        await controller.asyncclose()
        client.close.assert_awaited_once()

    async def test_missing_provider_usage_is_explicitly_unmeasured(self):
        controller = GroqController("openai/gpt-oss-120b", client=fake_client(value=response(content="Done", usage=False)))
        result = await controller.complete([], [])
        self.assertEqual(result["usage"]["unmeasuredCalls"], 1)

    async def test_provider_errors_have_safe_codes_and_no_raw_secrets(self):
        request = httpx2.Request("POST", GROQ_BASE_URL + "/chat/completions")
        cases = [
            (status_error(401, {"error": {"message": "private-token"}}), "BAD_KEY", False),
            (status_error(429, {"error": {"message": "TPD daily quota private-token"}}), "RATE_LIMIT", True),
            (status_error(429, {"error": {"message": "tokens per minute private-token"}}), "RATE_LIMIT", False),
            (status_error(400, {"error": {"code": "tool_use_failed", "failed_generation": "private-token"}}), "TOOL_USE_FAILED", False),
            (status_error(503, {"error": {"message": "private-token"}}), "PROVIDER_ERROR", False),
            (APITimeoutError(request), "MODEL_TIMEOUT", False),
            (APIConnectionError(request=request), "MODEL_UNREACHABLE", False),
            (RuntimeError("private-token"), "PROVIDER_ERROR", False),
        ]
        for error, expected_code, daily in cases:
            with self.subTest(code=expected_code, daily=daily):
                controller = GroqController("openai/gpt-oss-120b", client=fake_client(error=error))
                with self.assertRaises(ControllerError) as caught:
                    await controller.complete([], [])
                result = caught.exception
                self.assertEqual(result.code, expected_code)
                self.assertEqual(result.dailyQuota, daily)
                self.assertEqual(result.usage["calls"], 1)
                self.assertEqual(result.usage["unmeasuredCalls"], 1)
                self.assertEqual(result.usage["inputTokens"], 0)
                self.assertNotIn("private-token", str(result))
                self.assertIsNone(result.__cause__)

    async def test_malformed_tool_call_is_not_silently_repaired(self):
        call = Namespace(id="call-1", type="function", function=Namespace(name="search_passages", arguments={"query": "watch"}))
        controller = GroqController("openai/gpt-oss-120b", client=fake_client(value=response(tool_calls=[call])))
        with self.assertRaises(ControllerError) as caught:
            await controller.complete([], [])
        self.assertEqual(caught.exception.code, "INVALID_RESPONSE")

    async def test_constructor_uses_the_fixed_groq_endpoint_without_sdk_retries(self):
        client = fake_client()
        with patch("agent.model.AsyncOpenAI", return_value=client) as constructor:
            controller = GroqController("openai/gpt-oss-120b", timeout=45, env={"GROQ_API_KEY": "test-only-key", "OPENAI_BASE_URL": "https://example.org"})
        self.assertEqual(constructor.call_args.kwargs["base_url"], GROQ_BASE_URL)
        self.assertEqual(constructor.call_args.kwargs["max_retries"], 0)
        self.assertEqual(constructor.call_args.kwargs["timeout"], 45)
        await controller.asyncclose()

    async def test_missing_key_or_unbounded_settings_fail_before_a_request(self):
        with self.assertRaises(ControllerError) as caught:
            GroqController("openai/gpt-oss-120b", env={})
        self.assertEqual(caught.exception.code, "MISSING_KEY")
        for settings in [{"timeout": 0}, {"timeout": 181}, {"temperature": True}, {"temperature": float("nan")}]:
            with self.subTest(settings=settings), self.assertRaises(ControllerError):
                GroqController("openai/gpt-oss-120b", client=fake_client(), **settings)
        client = fake_client()
        controller = GroqController("openai/gpt-oss-120b", client=client)
        with self.assertRaises(ControllerError):
            await controller.complete([], [], max_tokens=100_000)
        client.chat.completions.create.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
