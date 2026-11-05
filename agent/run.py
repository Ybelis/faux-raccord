"""Run a live request or replay recorded evidence, without changing the screenplay."""

import argparse
import asyncio
import json
import os
from pathlib import Path
import re
import sys

from dotenv import load_dotenv

from agent.runner import requests, run_request
from agent.state import DraftStore, ScriptContext, StateError
from agent.tools import ROOT

EVIDENCE = ROOT / 'agent/evidence/session5.json'


def show_results(document, recorded=False):
    print('Recorded replay: zero model calls now.\n' if recorded else 'Live execution results.\n')
    for report in document['runs']:
        print(f"{report['request_id']} — {report['mode']} — {report['status']}")
        print(report['final']['answer'])
        for draft in report['drafts']:
            print(f"Draft: {draft['draft_id']} · {draft['scene_id']} · {draft['status']}")
            print(f"Review the saved proposal with --show-draft {draft['draft_id']}.")
        usage = report['usage']
        print(f"Recorded usage: {usage['model_calls']} model calls; {usage['input_tokens']} input / {usage['output_tokens']} output tokens; {usage['milliseconds'] / 1000:.1f} s.")
        if report['error']:
            print('Error:', report['error']['code'])
        print()


def redact(value):
    if isinstance(value, dict):
        return {key: redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, str):
        return re.sub(r'gsk_[A-Za-z0-9]+|sk-[A-Za-z0-9]{20,}', '[REDACTED]', value)
    return value


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--request', choices=list(requests()))
    group.add_argument('--all', action='store_true')
    group.add_argument('--goal')
    group.add_argument('--replay', action='store_true')
    group.add_argument('--show-draft')
    parser.add_argument('--live', action='store_true', help='Allow actual model requests.')
    parser.add_argument('--consent', action='store_true', help='Confirm that the selected screenplay may be sent to Groq.')
    parser.add_argument('--allow-draft', action='store_true', help='Allow a custom request to save an unapplied draft.')
    parser.add_argument('--record', action='store_true', help='Save these actual run results as versioned session evidence.')
    parser.add_argument('--json', action='store_true', help='Print the complete machine-readable trace instead of a short summary.')
    args = parser.parse_args()
    if args.replay:
        if not EVIDENCE.exists():
            parser.error('No recorded session evidence exists yet.')
        data = json.loads(EVIDENCE.read_text('utf-8'))
        if args.json:
            print(json.dumps({'mode': 'recorded replay; no model calls now', 'recording': data}, ensure_ascii=False, indent=2))
        else:
            # Tous les essais, dont les échecs, restent dans la trace JSON.
            # La vue de démonstration affiche le dernier essai de chaque cas.
            latest = {run['request_id']: run for run in data['runs']}
            print(f"{len(data['runs'])} recorded attempts; showing the latest per request.\n")
            show_results({'runs': [latest[key] for key in sorted(latest)]}, recorded=True)
        return
    if args.show_draft:
        print(json.dumps(DraftStore().get(args.show_draft, ScriptContext.load()), ensure_ascii=False, indent=2))
        return
    if args.record and not args.live:
        parser.error('Recording session evidence requires an explicit --live run.')
    if args.live and not args.consent:
        parser.error('Add --consent after confirming that these scenes may be sent to Groq.')
    # Lire le secret côté hôte ; il n'entre ni dans les messages ni dans les rapports.
    load_dotenv(ROOT / '.env', override=False)
    selected = list(requests()) if args.all else [args.request]
    results = []
    for request_id in selected:
        print(f"Running {request_id or 'custom request'}…", file=sys.stderr, flush=True)
        report = await run_request(request_id, goal=args.goal, live=args.live,
                                   consent=args.consent, allow_draft=args.allow_draft)
        results.append(redact(report))
        print(f"{report['request_id']}: {report['status']}; {report['usage']['model_calls']} model calls", file=sys.stderr, flush=True)
    document = {'kind': 'real task executions, not a quality benchmark', 'runs': results}
    if args.record:
        EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
        # Compléter des cas distincts ne remplace pas les essais précédents.
        previous = json.loads(EVIDENCE.read_text('utf-8')) if EVIDENCE.exists() else {'runs': []}
        document['runs'] = previous['runs'] + results
        EVIDENCE.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.json:
        print(json.dumps(document, ensure_ascii=False, indent=2))
    else:
        show_results({'runs': results})


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (StateError, ValueError) as error:
        raise SystemExit(str(error)) from None
