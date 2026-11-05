"""Groq native tool calls for the controller, separate from the evaluated detector."""

import math
import os
import re
import time

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI


GROQ_BASE_URL = "https://api.groq.com/openai/v1"


class ControllerError(RuntimeError):
    """Expose a safe code and usage estimate, never a raw provider response."""

    def __init__(self, code, message, usage=None, *, daily_quota=False):
        super().__init__(message)
        self.code = code
        self.usage = usage or {
            "calls": 0,
            "inputTokens": 0,
            "outputTokens": 0,
            "milliseconds": 0,
        }
        self.dailyQuota = daily_quota


def field(value, name, default=None):
    return value.get(name, default) if isinstance(value, dict) else getattr(value, name, default)


def tokens(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


class GroqController:
    def __init__(self, model, temperature=0, timeout=60, client=None, env=None):
        if (
            not isinstance(model, str)
            or not re.fullmatch(r"[A-Za-z0-9._:/-]{1,100}", model)
            or ".." in model
        ):
            raise ControllerError("INVALID_MODEL", "Choose a valid Groq model identifier.")
        if (
            isinstance(temperature, bool)
            or not isinstance(temperature, (int, float))
            or not math.isfinite(temperature)
            or not 0 <= temperature <= 1
            or isinstance(timeout, bool)
            or not isinstance(timeout, (int, float))
            or not math.isfinite(timeout)
            or not 1 <= timeout <= 180
        ):
            raise ControllerError(
                "INVALID_SETTINGS", "Use temperature 0–1 and timeout 1–180 seconds."
            )
        self.model = model
        self.temperature = temperature
        self.timeout = timeout
        if client is None:
            trusted_env = os.environ if env is None else env
            key = trusted_env.get("GROQ_API_KEY")
            if not isinstance(key, str) or not key.strip():
                raise ControllerError("MISSING_KEY", "Configure GROQ_API_KEY before a live run.")
            # L'URL est fixe. Les arguments du modèle ne peuvent choisir ni
            # fournisseur, ni clé. Le lanceur charge .env, pas cet adaptateur.
            client = AsyncOpenAI(
                api_key=key.strip(),
                base_url=GROQ_BASE_URL,
                max_retries=0,
                timeout=timeout,
            )
        self.client = client

    async def complete(self, messages, tools, max_tokens=1400):
        if (
            isinstance(max_tokens, bool)
            or not isinstance(max_tokens, int)
            or not 16 <= max_tokens <= 4096
        ):
            raise ControllerError(
                "INVALID_SETTINGS", "max_tokens must be an integer from 16 to 4096."
            )
        started = time.perf_counter()

        def usage(measured=None):
            result = {
                "calls": 1,
                "inputTokens": tokens(field(measured, "prompt_tokens", 0)),
                "outputTokens": tokens(field(measured, "completion_tokens", 0)),
                "milliseconds": max(0, round((time.perf_counter() - started) * 1000)),
            }
            if measured is None:
                result["unmeasuredCalls"] = 1
            return result

        request = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_completion_tokens": max_tokens,
            "timeout": self.timeout,
        }
        if tools:
            request.update(tools=tools, tool_choice="auto", parallel_tool_calls=False)
        if "gpt-oss" in self.model:
            request["reasoning_effort"] = "low"

        try:
            response = await self.client.chat.completions.create(**request)
        except (APITimeoutError, TimeoutError):
            raise ControllerError(
                "MODEL_TIMEOUT", "Groq did not answer within the request timeout.", usage()
            ) from None
        except APIConnectionError:
            raise ControllerError(
                "MODEL_UNREACHABLE", "Groq is unreachable; check the connection.", usage()
            ) from None
        except APIStatusError as error:
            body = error.body if isinstance(error.body, dict) else {}
            details = body.get("error", body)
            details = details if isinstance(details, dict) else {}
            provider_code = str(details.get("code", ""))
            if error.status_code == 401:
                raise ControllerError(
                    "BAD_KEY", "Groq rejected the configured API key.", usage()
                ) from None
            if error.status_code == 429:
                # Lire la cause pour distinguer les quotas, sans recopier le
                # message brut qui peut contenir des informations sensibles.
                daily = bool(
                    re.search(
                        r"\b(?:TPD|RPD)\b|tokens?\s+per\s+day|requests?\s+per\s+day|daily",
                        str(details.get("message", "")),
                        re.I,
                    )
                )
                message = (
                    "The daily Groq quota is exhausted; wait for its reset."
                    if daily else "The temporary Groq rate limit was reached; retry later."
                )
                raise ControllerError("RATE_LIMIT", message, usage(), daily_quota=daily) from None
            if provider_code == "tool_use_failed":
                raise ControllerError(
                    "TOOL_USE_FAILED", "The model returned an invalid tool call.", usage()
                ) from None
            raise ControllerError("PROVIDER_ERROR", "Groq refused the request.", usage()) from None
        except Exception:
            raise ControllerError("PROVIDER_ERROR", "The Groq request failed.", usage()) from None

        choices = field(response, "choices", [])
        message = field(choices[0], "message") if choices else None
        content = field(message, "content")
        calls = field(message, "tool_calls", []) or []
        if (
            message is None
            or (content is not None and not isinstance(content, str))
            or not isinstance(calls, list)
        ):
            raise ControllerError(
                "INVALID_RESPONSE", "Groq returned an invalid controller response.", usage()
            )
        normalized = []
        for call in calls:
            function = field(call, "function")
            identifier = field(call, "id")
            name = field(function, "name")
            arguments = field(function, "arguments")
            if (
                field(call, "type") != "function"
                or not isinstance(identifier, str)
                or not identifier
                or not isinstance(name, str)
                or not name
                or not isinstance(arguments, str)
            ):
                raise ControllerError(
                    "INVALID_RESPONSE", "Groq returned a malformed tool call.", usage()
                )
            # Le JSON des arguments n'est pas exécuté ici : le répartiteur
            # vérifie le nom autorisé puis le schéma avant d'appeler un outil.
            normalized.append(
                {
                    "id": identifier,
                    "type": "function",
                    "function": {"name": name, "arguments": arguments},
                }
            )
        return {
            "content": content or "",
            "tool_calls": normalized,
            "usage": usage(field(response, "usage")),
        }

    async def asyncclose(self):
        await self.client.close()
