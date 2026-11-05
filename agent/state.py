"""Pin one screenplay revision and retain unapplied revision drafts locally."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile


ROOT = Path(__file__).resolve().parents[1]
CORPORA = {
    "controlled-valkaama": Path("data/controlled-script/project.json"),
    "valkaama": Path("data/valkaama.json"),
}
MAX_SOURCE_BYTES = 2 * 1024 * 1024
MAX_DRAFT_BYTES = 64 * 1024
PUBLIC_FIELDS = (
    "draft_id", "sample_id", "source_revision", "scene_id", "instruction",
    "text", "summary", "status", "created_at", "expires_at",
)


class StateError(ValueError):
    """A stale source, invalid proposal or unavailable draft prevents the action."""


def _source_revision(path):
    try:
        with path.open("rb") as source:
            content = source.read(MAX_SOURCE_BYTES + 1)
    except OSError:
        raise StateError("SOURCE_UNAVAILABLE: cannot read the selected screenplay.") from None
    if len(content) > MAX_SOURCE_BYTES:
        raise StateError("SOURCE_LIMIT: the selected screenplay exceeds its size limit.")
    return hashlib.sha256(content).hexdigest()


@dataclass(frozen=True)
class ScriptContext:
    sample_id: str
    source_path: Path
    revision: str

    @classmethod
    def load(cls, sample="controlled-valkaama", root=ROOT):
        if sample not in CORPORA:
            raise StateError("UNKNOWN_SAMPLE: choose controlled-valkaama or valkaama.")
        source = Path(root).resolve() / CORPORA[sample]
        return cls(sample, source, _source_revision(source))

    def assert_current(self):
        if _source_revision(self.source_path) != self.revision:
            raise StateError("STALE_REVISION: the screenplay changed; start a new run.")


def _text(value, minimum, maximum, field):
    if not isinstance(value, str) or "\0" in value or not minimum <= len(value) <= maximum:
        raise StateError(f"INVALID_DRAFT: {field} has an invalid type, length or NUL character.")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise StateError(f"INVALID_DRAFT: {field} must contain valid Unicode text.") from None
    return value


class DraftStore:
    """Write separate proposals; this class never edits or applies a screenplay."""

    def __init__(self, directory=ROOT / ".local/agent/drafts", ttl_days=7, clock=None):
        if not isinstance(ttl_days, int) or isinstance(ttl_days, bool) or ttl_days < 1:
            raise StateError("INVALID_RETENTION: ttl_days must be a positive integer.")
        self.directory = Path(directory).resolve()
        self.retention = timedelta(days=ttl_days)
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def _path(self, draft_id):
        if not isinstance(draft_id, str) or not re.fullmatch(r"draft-[a-f0-9]{64}", draft_id):
            raise StateError("INVALID_DRAFT_ID: use an identifier returned by the draft tool.")
        return self.directory / f"{draft_id}.json"

    def _load(self, draft_id, context):
        context.assert_current()
        path = self._path(draft_id)
        try:
            with path.open("rb") as source:
                content = source.read(MAX_DRAFT_BYTES + 1)
            if len(content) > MAX_DRAFT_BYTES:
                raise ValueError()
            data = json.loads(content)
            expires = datetime.fromisoformat(data["expires_at"])
            if not isinstance(data, dict) or any(key not in data for key in PUBLIC_FIELDS):
                raise ValueError()
            if expires.tzinfo is None or data["draft_id"] != draft_id:
                raise ValueError()
        except (OSError, ValueError, KeyError, TypeError):
            raise StateError("DRAFT_UNAVAILABLE: the draft is missing or invalid.") from None
        # L'expiration est contrôlée à la lecture ; aucun nettoyage en arrière-plan.
        if self.clock() >= expires:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
            raise StateError("DRAFT_EXPIRED: the draft passed its retention period.")
        if data["sample_id"] != context.sample_id or data["source_revision"] != context.revision:
            raise StateError("STALE_REVISION: the draft belongs to a different screenplay revision.")
        return data

    def get(self, draft_id, context):
        data = self._load(draft_id, context)
        return {key: data[key] for key in PUBLIC_FIELDS}

    def save(self, context, scene_id, instruction, proposal, operation_id):
        context.assert_current()
        if not isinstance(scene_id, str) or not re.fullmatch(r"S[0-9]{3}", scene_id):
            raise StateError("INVALID_DRAFT: scene_id must identify a screenplay scene.")
        operation_id = _text(operation_id, 1, 200, "operation_id")
        instruction = _text(instruction, 3, 800, "instruction").strip()
        if len(instruction) < 3:
            raise StateError("INVALID_DRAFT: instruction is too short after trimming.")
        if not isinstance(proposal, dict) or proposal.get("changed") is not True:
            raise StateError("NO_DRAFT: the model did not propose a changed scene.")
        text = _text(proposal.get("text"), 30, 14_000, "text")
        summary = _text(proposal.get("summary", ""), 0, 400, "summary")
        if not text.strip():
            raise StateError("INVALID_DRAFT: the proposed scene is blank.")
        draft_id = "draft-" + hashlib.sha256(operation_id.encode("utf-8")).hexdigest()
        payload = {
            "draft_id": draft_id, "sample_id": context.sample_id,
            "source_revision": context.revision, "scene_id": scene_id,
            "instruction": instruction, "text": text, "summary": summary,
        }
        # Le même appel accepté garde son résultat ; une identité réutilisée
        # avec un autre contenu est refusée plutôt que d'écraser le brouillon.
        fingerprint = hashlib.sha256(
            json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
        ).hexdigest()
        now = self.clock()
        data = {
            **payload, "status": "pending_review", "created_at": now.isoformat(),
            "expires_at": (now + self.retention).isoformat(), "request_fingerprint": fingerprint,
        }
        encoded = (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        if len(encoded) > MAX_DRAFT_BYTES:
            raise StateError("DRAFT_LIMIT: the draft exceeds its storage limit.")
        try:
            self.directory.mkdir(parents=True, exist_ok=True)
            descriptor, temporary = tempfile.mkstemp(
                prefix=".draft-", suffix=".tmp", dir=self.directory
            )
        except OSError:
            raise StateError("DRAFT_STORAGE_FAILED: cannot save a separate draft.") from None
        try:
            with os.fdopen(descriptor, "wb") as target:
                target.write(encoded)
                target.flush()
                os.fsync(target.fileno())
            try:
                # Le lien rend le contenu complet visible atomiquement et
                # échoue si la destination existe déjà, y compris un lien.
                os.link(temporary, self._path(draft_id))
            except FileExistsError:
                existing = self._load(draft_id, context)
                if existing.get("request_fingerprint") != fingerprint:
                    raise StateError(
                        "OPERATION_CONFLICT: this operation already has a different draft."
                    ) from None
                return {key: existing[key] for key in PUBLIC_FIELDS}
        except OSError:
            raise StateError("DRAFT_STORAGE_FAILED: cannot save a separate draft.") from None
        finally:
            Path(temporary).unlink(missing_ok=True)
        return {key: data[key] for key in PUBLIC_FIELDS}
