# Faux Raccord — Agent sheet

## Purpose

Faux Raccord helps screenplay writers and editors review prop continuity. The
planned assistant investigates a specific continuity doubt, explains its
recommendation with source passages and prepares corrections for review.

The requests below define the intended behaviour. The current application
already provides fixed analysis and editing workflows; the investigation loop
remains to be implemented and evaluated.

## Five user requests

The examples use the [controlled Valkaama adaptation](../data/controlled-script/),
where the watch and notebook inconsistencies were deliberately inserted; they
are not claims about the original screenplay.

| ID  | User request                                                                                                                                                         | Decision | Justification                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | “Show me both source passages behind the watch alert between scenes S001 and S002.”                                                                                  | Workflow | The alert already identifies the passages, so a fixed sequence can retrieve and display them.                                                                |
| R2  | “Check prop continuity in scenes S001–S012 and show the source passages for each alert.”                                                                             | Workflow | The scene range is explicit and the existing extraction, retrieval and comparison pipeline determines the steps.                                             |
| R3  | “In scene S002, keep Runa’s watch broken and change as little else as possible; show me the proposed text before applying it.”                                       | Workflow | The target scene and requested change are specified, so a fixed draft-and-review process is sufficient.                                                      |
| R4  | “I am not convinced by this watch alert: investigate whether the script explains the change before recommending that I keep or dismiss it.”                          | Agent    | The model chooses follow-up searches and passages to inspect from the evidence it finds, then returns a supported recommendation or an explicit uncertainty. |
| R5  | “Lasse’s red notebook is destroyed and later appears intact: find the least intrusive way to resolve this inconsistency and prepare a correction for me to approve.” | Agent    | The model inspects the context, chooses which scene to change and decides what further checks the proposed correction needs before presenting a draft.       |

These decisions describe our chosen implementation: a workflow fixes the steps
in code, while an agent chooses its next tool calls from observed results. The
number of model calls alone does not determine the classification.

## Boundaries and success

Investigations stay within the selected screenplay and have limits enforced by
the code. A useful result gives a recommendation with verifiable passages, or
states what remains uncertain; an unsuccessful search does not establish that
no explanation exists. A correction succeeds only if the approved change
addresses the identified issue without altering unrelated content. Applying a
draft requires human approval and preserves the original version.

## Tool contracts — Session 2

The three [tool schemas](../agent/tool_schemas.json) define names, descriptions,
parameters and access levels, with one example call each. `parameters` contains
the JSON Schema; `access` and `example_arguments` are repository metadata, not
arguments sent by the model. The host can adapt these definitions to native
function calling or MCP.

| Tool                    | Access                          | Parameters                                                                                       | Existing code to reuse                                                                             |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `search_passages`       | Read                            | `query` (1–500 characters), optional `scene_ids` (up to 200), optional `top_k` (1–5, default 5). | `retrieve()` in `src/core/retrieval.js`.                                                           |
| `check_continuity`      | Read; consumes model quota      | `scene_ids` (1–12 unique identifiers).                                                           | `analyze()` in `src/core/pipeline.js`.                                                             |
| `create_revision_draft` | Write; creates a separate draft | `scene_id`, `instruction` (3–800 characters).                                                    | `editScene()` in `src/core/scene-edit.js` for generation; draft storage remains to be implemented. |

`search_passages` is implemented by the Session 3 MCP server below; the other
two tools remain contracts for planned adapters. The host binds every call to
one selected, validated screenplay snapshot;
custom projects currently live in browser storage and must be supplied
explicitly. Project paths, URLs, API keys, model settings and consent are not
model-controlled parameters.

Schema validation rejects unknown arguments, wrong types, invalid identifier
formats and out-of-range values. Before execution, the host must also check
that identifiers exist, trim text and recheck lengths, reject blank or
NUL-containing input, restore screenplay order, and enforce the selected text
and execution budgets.
Analysis is limited to 120,000 characters in addition to the twelve-scene cap;
search passages retain the existing 1,000-character maximum. An empty search
is a valid result; invalid input, a missing scene, refused consent, stale
revision or model failure must produce an actionable error rather than a
fabricated result. Read access describes project effects, not inference cost.

Model calls require consent supplied by the application. The draft adapter must
save a separate proposal to qualify as a write operation; it must validate the
returned single-scene structure, leave the original and review decisions intact,
and return no draft when the model refuses or produces invalid text. Retries
reuse a host-managed operation identity to avoid duplicate drafts. Applying a
draft requires approval of that exact proposal against the unchanged source
revision; the model cannot provide its own approval.

## MCP server — Session 3

[server.py](../agent/server.py) exposes `search_passages` over stdio with the
exact S2 description and parameter schema. A fixed
[Node bridge](../agent/search_bridge.mjs) calls the existing parser and BM25;
the search logic is not duplicated in Python. No web server, model or API key is
needed. Launch and replay instructions are in the [README](../README.md#serveur-mcp).

```text
Session 3 notebook → MCP client → server.py → search_bridge.mjs → retrieve()
                    ← referenced screenplay passages ←
```

The launcher chooses the controlled Valkaama adaptation by default, or the
original with `--sample valkaama`. Only these two bundled corpora are exposed;
browser projects and arbitrary files are not connected yet. A SHA-256 hash pins
the source revision at startup, and subsequent calls reject a changed source.
The bridge runs without a shell or inherited API keys, has a ten-second timeout,
and limits JSON input to 16 KiB and output to 64 KiB. These are application
controls; stdio still runs as a local process with the user's OS permissions.

The executed [Session 3 project notebook](../agent/session3.ipynb) discovers the
tool, checks its description and schema against S2, and retrieves the two watch
passages in S001 and S002. It also records a valid empty search and rejected
requests for an unknown scene and an excessive result limit. These are real
MCP calls with zero model calls; they do not measure LLM quality. Python stdio
tests and Node bridge tests cover these boundaries independently of the web UI.
