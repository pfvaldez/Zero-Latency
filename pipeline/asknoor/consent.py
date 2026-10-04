"""Consent gate (CLAUDE.md non-negotiable 10): never clone or dub a person's voice without their
explicit, written consent. The build refuses any AI-dubbed audio whose consent row in
docs/CONSENT.md is not exactly `confirmed`. Rows are `pending` until the captain confirms."""

from __future__ import annotations

import re
from pathlib import Path

CONFIRMED = "confirmed"


class ConsentError(Exception):
    pass


def read_rows(consent_md: Path) -> list[dict[str, str]]:
    """The table rows of docs/CONSENT.md as dicts keyed by the lower-cased header cells."""
    rows: list[dict[str, str]] = []
    header: list[str] | None = None
    for line in consent_md.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith("|"):
            header = None  # a new table starts after any other line, with its own header
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if set("".join(cells)) <= set("-: "):
            continue  # the |---|---| separator
        if header is None:
            header = [c.lower() for c in cells]
            continue
        if len(cells) == len(header):
            rows.append(dict(zip(header, cells, strict=True)))
    return rows


# A row that says what the person did NOT agree to must never count as consent.
_NEGATION = re.compile(r"\b(not|no|never|without|except|revoked|withdrawn)\b", re.IGNORECASE)


def _covers(what: str, scope: str) -> bool:
    return bool(re.search(rf"\b{re.escape(scope)}\b", what, re.IGNORECASE))


def require_confirmed(consent_md: Path, person: str, scope: str = "dubbing") -> None:
    """Raise unless `person` has at least one row about `scope` and every such row's status is
    exactly `confirmed`. A person with no row, a pending row or a row that reads as a refusal
    stops the build. `scope` is a whole word in the row's "what they consented to" cell."""
    matching = [
        r
        for r in read_rows(consent_md)
        if r.get("person", "").lower() == person.lower() and _covers(r.get("what they consented to", ""), scope)
    ]
    if not matching:
        raise ConsentError(f"no consent row for {person} ({scope}) in {consent_md.name}")
    for row in matching:
        if _NEGATION.search(row.get("what they consented to", "")):
            raise ConsentError(f"the consent row for {person} ({scope}) reads as a refusal or a limit: check it by hand")
        if row.get("status") != CONFIRMED:
            raise ConsentError(
                f"consent for {person} ({scope}) is '{row.get('status')}', not '{CONFIRMED}': "
                f"nothing that needs {scope} consent can be used"
            )
