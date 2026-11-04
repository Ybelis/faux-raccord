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
