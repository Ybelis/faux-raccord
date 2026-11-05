"""Check revision pinning and persistent, unapplied drafts without model calls."""

from dataclasses import FrozenInstanceError
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from agent.state import DraftStore, ScriptContext, StateError


class DraftStateTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="faux-raccord-state-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.source = self.root / "data/controlled-script/project.json"
        self.source.parent.mkdir(parents=True)
        self.source.write_text('{"text":"Original controlled screenplay."}', encoding="utf-8")
        original = self.root / "data/valkaama.json"
        original.write_text('{"text":"Original licensed screenplay."}', encoding="utf-8")
        self.context = ScriptContext.load(root=self.root)
        self.now = datetime(2026, 11, 5, 9, 0, tzinfo=timezone.utc)
        self.store = DraftStore(self.root / "drafts", clock=lambda: self.now)
        self.proposal = {
            "changed": True,
            "text": "INT. ROOM - DAY\nRuna keeps the broken watch in her pocket.",
            "summary": "The watch remains broken.",
        }

    def save(self, **changes):
        arguments = {
            "context": self.context, "scene_id": "S002",
            "instruction": "Keep the pocket watch broken.",
            "proposal": self.proposal, "operation_id": "run-1:call-1",
        }
        arguments.update(changes)
        return self.store.save(**arguments)

    def test_context_is_immutable_and_only_selects_known_corpora(self):
        with self.assertRaises(FrozenInstanceError):
            self.context.revision = "changed"
        for sample in ("../../.env", "https://example.org/script", "unknown"):
            with self.subTest(sample=sample), self.assertRaisesRegex(StateError, "UNKNOWN_SAMPLE"):
                ScriptContext.load(sample, root=self.root)

    def test_draft_is_saved_separately_with_pending_review_and_expiry(self):
        before = self.source.read_bytes()
        draft = self.save()
        self.assertEqual(self.source.read_bytes(), before)
        self.assertEqual(draft["status"], "pending_review")
        self.assertEqual(draft["source_revision"], hashlib.sha256(before).hexdigest())
        self.assertEqual(datetime.fromisoformat(draft["expires_at"]), self.now + timedelta(days=7))
        self.assertEqual(self.store.get(draft["draft_id"], self.context), draft)
        self.assertNotIn("path", draft)
        self.assertNotIn("request_fingerprint", draft)
        self.assertEqual(len(list(self.store.directory.iterdir())), 1)

    def test_retry_of_the_same_operation_returns_the_original_draft(self):
        first = self.save()
        self.now += timedelta(minutes=2)
        second = self.save()
        self.assertEqual(first, second)
        self.assertEqual(len(list(self.store.directory.glob("*.json"))), 1)
        self.assertFalse(list(self.store.directory.glob("*.tmp")))

    def test_reusing_an_operation_for_a_different_edit_cannot_overwrite(self):
        draft = self.save()
        path = self.store.directory / f"{draft['draft_id']}.json"
        before = path.read_bytes()
        with self.assertRaisesRegex(StateError, "OPERATION_CONFLICT"):
            self.save(instruction="Make the watch stop and change its owner.")
        self.assertEqual(path.read_bytes(), before)

    def test_changed_source_prevents_both_draft_creation_and_readback(self):
        draft = self.save()
        self.source.write_text('{"text":"A newer screenplay revision."}', encoding="utf-8")
        with self.assertRaisesRegex(StateError, "STALE_REVISION"):
            self.save(operation_id="another-operation")
        with self.assertRaisesRegex(StateError, "STALE_REVISION"):
            self.store.get(draft["draft_id"], self.context)
        refreshed = ScriptContext.load(root=self.root)
        with self.assertRaisesRegex(StateError, "STALE_REVISION"):
            self.store.get(draft["draft_id"], refreshed)

    def test_expired_draft_is_removed_lazily_and_never_returned(self):
        draft = self.save()
        self.now += timedelta(days=7)
        with self.assertRaisesRegex(StateError, "DRAFT_EXPIRED"):
            self.store.get(draft["draft_id"], self.context)
        self.assertFalse(list(self.store.directory.iterdir()))

    def test_a_draft_cannot_be_read_as_a_different_screenplay(self):
        draft = self.save()
        original_context = ScriptContext.load("valkaama", root=self.root)
        with self.assertRaisesRegex(StateError, "STALE_REVISION"):
            self.store.get(draft["draft_id"], original_context)

    def test_refused_or_invalid_proposals_never_create_storage(self):
        proposals = [
            {"changed": False},
            {"changed": True, "text": "UNCHANGED"},
            {"changed": True, "text": " " * 50},
            {"changed": True, "text": "x" * 14_001},
            {"changed": True, "text": "x" * 40 + "\0"},
            {"changed": True, "text": "x" * 40, "summary": "x" * 401},
        ]
        for proposal in proposals:
            with self.subTest(proposal=proposal), self.assertRaises(StateError):
                self.save(proposal=proposal)
        self.assertFalse(self.store.directory.exists())

    def test_storage_identifiers_cannot_be_used_as_paths(self):
        for draft_id in ("../../.env", "draft-../file", "https://example.org", None):
            with self.subTest(draft_id=draft_id), self.assertRaisesRegex(StateError, "INVALID_DRAFT_ID"):
                self.store.get(draft_id, self.context)

    def test_corrupted_existing_draft_is_not_silently_replaced(self):
        draft = self.save()
        path = self.store.directory / f"{draft['draft_id']}.json"
        path.write_text(json.dumps({"draft_id": draft["draft_id"]}), encoding="utf-8")
        before = path.read_bytes()
        with self.assertRaisesRegex(StateError, "DRAFT_UNAVAILABLE"):
            self.save()
        self.assertEqual(path.read_bytes(), before)

    def test_storage_failure_returns_an_actionable_error_without_a_path(self):
        with patch.object(Path, "mkdir", side_effect=PermissionError("private-path")):
            with self.assertRaisesRegex(StateError, "DRAFT_STORAGE_FAILED") as caught:
                self.save()
        self.assertNotIn("private-path", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
