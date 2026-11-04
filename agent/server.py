"""Expose screenplay search over MCP stdio, reusing the existing JavaScript BM25."""

import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path
import shutil

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from fastmcp.tools import Tool, ToolResult
from jsonschema import Draft202012Validator
from mcp_types import ToolAnnotations


ROOT = Path(__file__).resolve().parents[1]
BRIDGE = ROOT / "agent" / "search_bridge.mjs"
CORPORA = {
    "controlled-valkaama": ROOT / "data" / "controlled-script" / "project.json",
    "valkaama": ROOT / "data" / "valkaama.json",
}
CONTRACT = next(
    tool
    for tool in json.loads((ROOT / "agent" / "tool_schemas.json").read_text("utf-8"))["tools"]
    if tool["name"] == "search_passages"
)
Draft202012Validator.check_schema(CONTRACT["parameters"])
VALIDATOR = Draft202012Validator(CONTRACT["parameters"])
MAX_INPUT_BYTES = 16 * 1024
MAX_OUTPUT_BYTES = 64 * 1024
SEARCH_TIMEOUT_SECONDS = 10


def validate_arguments(arguments):
    """Validate raw values before defaults, trimming or Python type coercion."""
    error = next(VALIDATOR.iter_errors(arguments), None)
    if error:
        field = ".".join(map(str, error.absolute_path)) or "arguments"
        rule = error.validator
        if rule == "additionalProperties":
            detail = "allowed arguments are query, scene_ids and top_k"
        elif rule == "required":
            detail = "query is required"
        else:
            detail = f"check {rule} ({error.validator_value}) against the tool schema"
        # Ne pas recopier la valeur invalide : elle peut contenir un secret.
        raise ToolError(f"INVALID_ARGUMENTS: {field}: {detail}.")
    query = arguments["query"].strip()
    if not query or "\0" in query:
        raise ToolError("INVALID_ARGUMENTS: query must contain text without NUL characters.")
    try:
        query.encode("utf-8")
    except UnicodeEncodeError:
        raise ToolError("INVALID_ARGUMENTS: query must contain valid Unicode text.") from None
    return {**arguments, "query": query}


def bridge_environment():
    """Keep OS essentials; never forward keys, NODE_OPTIONS or NODE_PATH."""
    return {
        key: os.environ[key]
        for key in ("SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL")
        if key in os.environ
    }


async def read_bounded(reader):
    output = bytearray()
    while chunk := await reader.read(4096):
        output.extend(chunk)
        if len(output) > MAX_OUTPUT_BYTES:
            raise ToolError("OUTPUT_LIMIT: search output is too large; reduce top_k.")
    return bytes(output)


class SearchPassagesTool(Tool):
    # Le contexte vient du lanceur, pas des arguments contrôlés par le modèle.
    sample_id: str
    source_revision: str
    node_executable: str

    async def run(self, arguments: dict) -> ToolResult:
        arguments = validate_arguments(arguments)
        payload = json.dumps(arguments, ensure_ascii=True).encode("ascii")
        if len(payload) > MAX_INPUT_BYTES:
            raise ToolError("INVALID_ARGUMENTS: arguments exceed the 16 KiB input limit.")
        process = None
        try:
            async with asyncio.timeout(SEARCH_TIMEOUT_SECONDS):
                # Une liste d'arguments, aucun shell ; le texte reste du JSON.
                process = await asyncio.create_subprocess_exec(
                    self.node_executable,
                    str(BRIDGE),
                    "--sample",
                    self.sample_id,
                    "--revision",
                    self.source_revision,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL,
                    cwd=ROOT,
                    env=bridge_environment(),
                )
                process.stdin.write(payload)
                await process.stdin.drain()
                process.stdin.close()
                output = await read_bounded(process.stdout)
                exit_code = await process.wait()
            result = json.loads(output)
            if not isinstance(result, dict):
                raise ToolError("SEARCH_FAILED: the search bridge returned an invalid result.")
            if exit_code:
                error = result.get("error", {})
                raise ToolError(
                    f"{error.get('code', 'SEARCH_FAILED')}: "
                    f"{error.get('message', 'Search failed.')}"
                )
            if result.get("model_calls") != 0:
                raise ToolError("SEARCH_FAILED: the search bridge returned an invalid result.")
            return ToolResult(structured_content=result)
        except TimeoutError:
            raise ToolError(
                "SEARCH_TIMEOUT: search exceeded 10 seconds; retry or use fewer scenes."
            ) from None
        except (OSError, ValueError):
            raise ToolError("SEARCH_FAILED: check the bundled corpus and Node installation.") from None
        finally:
            # Annuler le client MCP doit également arrêter le processus Node.
            if process is not None and process.returncode is None:
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
                await process.wait()


def create_server(sample="controlled-valkaama"):
    if sample not in CORPORA:
        raise ValueError("Choose controlled-valkaama or valkaama.")
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js is required; install Node.js 24 or newer and reconnect.")
    # Figer l'empreinte au démarrage empêche de mélanger deux versions lors
    # d'appels successifs. Reconnecter sélectionne la nouvelle révision.
    with CORPORA[sample].open("rb") as source:
        content = source.read(2 * 1024 * 1024 + 1)
    if len(content) > 2 * 1024 * 1024:
        raise ValueError("The bundled corpus exceeds its size limit.")
    server = FastMCP("Faux Raccord")
    server.add_tool(
        SearchPassagesTool(
            name=CONTRACT["name"],
            description=CONTRACT["description"],
            parameters=CONTRACT["parameters"],
            annotations=ToolAnnotations(
                read_only_hint=True,
                destructive_hint=False,
                idempotent_hint=True,
                open_world_hint=False,
            ),
            sample_id=sample,
            source_revision=hashlib.sha256(content).hexdigest(),
            node_executable=str(Path(node).resolve()),
        )
    )
    return server


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", choices=tuple(CORPORA), default="controlled-valkaama")
    args = parser.parse_args()
    try:
        mcp = create_server(args.sample)
    except (OSError, ValueError, RuntimeError) as error:
        parser.exit(1, f"Cannot start the MCP server: {error}\n")
    # stdout appartient au protocole MCP ; les logs vont sur stderr.
    mcp.run(transport="stdio", show_banner=False)
