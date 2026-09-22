"""Regression coverage for legacy and proposed fixture import identities.

This test is deliberately fixture-only.  It does not connect to PostgreSQL or
write any Qira'at data.  The legacy key remains the comparison key for the
existing database; the disambiguated key only proves that future imports can
represent multiple source faces without collapsing them.
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "qiraat"))

from audit_postgres_reconciliation import (  # noqa: E402
    fixture_disambiguated_id,
    fixture_entry_id,
)


def _records():
    fixtures = ROOT / "packages" / "qiraat-core" / "fixtures"
    for directory, kind in (("pages", "variant"), ("rulings", "ruling")):
        for path in sorted((fixtures / directory).glob("page-*.json")):
            import json

            for record in json.loads(path.read_text(encoding="utf-8")):
                yield int(path.stem.removeprefix("page-")), kind, record


def test_disambiguated_fixture_identity_is_unique_and_deterministic():
    records = list(_records())
    legacy = [fixture_entry_id(kind, record) for _, kind, record in records]
    proposed = [
        fixture_disambiguated_id(kind, record, page)
        for page, kind, record in records
    ]

    # The legacy importer key has exactly the known 25 collisions; these are
    # the records that must never be silently selected by ON CONFLICT.
    assert len(legacy) - len(set(legacy)) == 25
    assert len(proposed) == len(set(proposed))

    # Hashing canonical JSON makes the proposed identity independent of source
    # file ordering and stable across repeated audit/import planning runs.
    reversed_records = list(reversed(records))
    proposed_reversed = {
        fixture_disambiguated_id(kind, record, page)
        for page, kind, record in reversed_records
    }
    assert set(proposed) == proposed_reversed


def test_every_legacy_collision_has_distinct_proposed_id():
    by_legacy = {}
    for page, kind, record in _records():
        legacy = fixture_entry_id(kind, record)
        proposed = fixture_disambiguated_id(kind, record, page)
        by_legacy.setdefault(legacy, set()).add(proposed)

    collisions = {key: ids for key, ids in by_legacy.items() if len(ids) > 1}
    # Twenty-three legacy keys collide; two of those keys have three faces,
    # yielding twenty-five extra rows in the reconciliation report.
    assert len(collisions) == 23
    assert sum(len(ids) - 1 for ids in collisions.values()) == 25
    assert all(len(ids) > 1 for ids in collisions.values())
