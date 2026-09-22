#!/usr/bin/env python3
"""Read-only reconciliation of committed Qiraat fixtures against PostgreSQL.

This is deliberately an audit/dry-run tool.  It never imports, updates, or
deletes records.  Supply a PostgreSQL DSN through ``QIRAAT_AUDIT_DSN`` (or the
usual libpq ``PG*`` variables) and it writes a deterministic JSON report.

The fixture entry keys intentionally mirror ``import_to_postgres.py``.  That
makes its ``INSERT``/``ON CONFLICT`` behaviour inspectable before any future
database operation is proposed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import psycopg2


ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "packages" / "qiraat-core" / "fixtures"
DEFAULT_OUTPUT = ROOT / "artifacts" / "qiraat-postgres-reconciliation.json"


def fixture_entry_id(kind: str, record: dict[str, Any]) -> str:
    """Return the exact stable entry key used by the existing importer."""
    if kind == "variant":
        return f"{record['id']}-a{record['ayah']}-t{record['startToken']}"
    return record["id"]


def fixture_disambiguated_id(kind: str, record: dict[str, Any], page: int) -> str:
    """Return a deterministic *proposed* identity for a new import.

    The historical importer key is intentionally preserved in
    :func:`fixture_entry_id` because it is also the key used by the existing
    PostgreSQL rows.  Several later source rows reuse one source id for
    multiple faces, however, so that legacy key is not sufficient for a new
    import.  This helper is diagnostic only: it must not be used to rename
    existing database entries without an approved migration.
    """
    if kind == "variant":
        payload = {
            "variantText": record.get("variantText"),
            "readingIds": sorted(set(record.get("readingIds", []))),
        }
    else:
        payload = {
            "category": record.get("category"),
            "text": record.get("text"),
            "options": record.get("options"),
            "readings": sorted(set(
                item["readingId"] if isinstance(item, dict) else item
                for item in record.get("readings", [])
            )),
        }
    identity = {
        "kind": kind,
        "page": page,
        "sourceId": record.get("id"),
        "surah": record.get("surah"),
        "ayah": record.get("ayah"),
        "endAyah": record.get("endAyah"),
        "startToken": record.get("startToken"),
        "endToken": record.get("endToken"),
        "payload": payload,
    }
    digest = hashlib.sha256(
        json.dumps(identity, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:16]
    return f"{fixture_entry_id(kind, record)}-h{digest}"


def load_fixture_records() -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    records: dict[str, dict[str, Any]] = {}
    duplicate_keys: list[dict[str, Any]] = []
    for page in range(1, 605):
        for directory, kind in (("pages", "variant"), ("rulings", "ruling")):
            file = FIXTURES / directory / f"page-{page:03d}.json"
            if not file.exists():
                continue
            for index, raw in enumerate(json.loads(file.read_text(encoding="utf-8"))):
                entry_id = fixture_entry_id(kind, raw)
                value = {
                    "id": entry_id,
                    "disambiguated_id": fixture_disambiguated_id(kind, raw, page),
                    "page": page,
                    "kind": kind,
                    "source_id": raw["id"],
                    "surah": raw["surah"],
                    "ayah": raw["ayah"],
                    "start_token": raw["startToken"],
                    # Match the established importer: a token range that wraps
                    # from a later token to an earlier token crosses into the
                    # next ayah when no explicit endAyah is supplied.
                    "end_ayah": raw.get("endAyah") or (raw["ayah"] + 1 if raw["endToken"] < raw["startToken"] else raw["ayah"]),
                    "end_token": raw["endToken"],
                    "fixture_file": str(file.relative_to(ROOT)),
                    "fixture_index": index,
                }
                if kind == "variant":
                    value["payload"] = {
                        "reading_text": raw["variantText"],
                        # qiraat_entry_readings has a unique entry/reading/action key;
                        # repeated source mentions are not separate database assertions.
                        "readings": sorted(set(raw.get("readingIds", []))),
                    }
                else:
                    value["payload"] = {
                        "category_code": raw["category"],
                        "text_ar": raw.get("text"),
                        "options": raw.get("options"),
                        "readings": sorted(set(
                            item["readingId"] if isinstance(item, dict) else item
                            for item in raw.get("readings", [])
                        )),
                    }
                if entry_id in records:
                    duplicate_keys.append({
                        "id": entry_id,
                        "first": {key: records[entry_id][key] for key in ("page", "kind", "fixture_file", "fixture_index", "source_id")},
                        "duplicate": {key: value[key] for key in ("page", "kind", "fixture_file", "fixture_index", "source_id")},
                        "same_payload": records[entry_id]["payload"] == value["payload"],
                        "first_disambiguated_id": records[entry_id]["disambiguated_id"],
                        "duplicate_disambiguated_id": fixture_disambiguated_id(kind, raw, page),
                    })
                    continue
                records[entry_id] = value
    return records, duplicate_keys


def load_database_records(conn: Any) -> dict[str, dict[str, Any]]:
    # A read-only transaction is a second guard against accidental database mutation.
    conn.set_session(readonly=True, autocommit=False)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT e.id, p.mushaf_page_number, e.kind::text,
                   l.surah_number, l.start_ayah, l.start_word, l.end_ayah, l.end_word,
                   vd.reading_text, rd.category_code, rd.text_ar, rd.options,
                   COALESCE(array_agg(DISTINCT er.reading_id ORDER BY er.reading_id)
                     FILTER (WHERE er.reading_id IS NOT NULL), ARRAY[]::text[]) AS readings
            FROM qiraat_entries e
            JOIN qiraat_pages p ON p.id = e.page_id
            JOIN qiraat_loci l ON l.id = e.locus_id
            LEFT JOIN qiraat_variant_details vd ON vd.entry_id = e.id
            LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
            LEFT JOIN qiraat_entry_readings er ON er.entry_id = e.id
            GROUP BY e.id, p.mushaf_page_number, e.kind, l.surah_number, l.start_ayah,
                     l.start_word, l.end_ayah, l.end_word, vd.reading_text,
                     rd.category_code, rd.text_ar, rd.options
            ORDER BY e.id
        """)
        rows = cur.fetchall()
    result = {}
    for row in rows:
        (entry_id, page, kind, surah, ayah, start, end_ayah, end, reading_text,
         category, text_ar, options, readings) = row
        payload: dict[str, Any]
        if kind == "variant":
            payload = {"reading_text": reading_text, "readings": list(readings)}
        else:
            payload = {
                "category_code": category,
                "text_ar": text_ar,
                "options": options,
                "readings": list(readings),
            }
        result[entry_id] = {
            "id": entry_id, "page": page, "kind": kind, "surah": surah,
            "ayah": ayah, "start_token": start, "end_ayah": end_ayah,
            "end_token": end, "payload": payload,
        }
    return result


def count_by(records: list[dict[str, Any]], field: str) -> dict[str, int]:
    return dict(sorted(Counter(str(record[field]) for record in records).items()))


def page_ranges(pages: list[int]) -> list[str]:
    if not pages:
        return []
    ranges: list[str] = []
    start = previous = pages[0]
    for page in pages[1:]:
        if page == previous + 1:
            previous = page
            continue
        ranges.append(str(start) if start == previous else f"{start}-{previous}")
        start = previous = page
    ranges.append(str(start) if start == previous else f"{start}-{previous}")
    return ranges


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dsn", default=os.environ.get("QIRAAT_AUDIT_DSN"), help="PostgreSQL DSN; defaults to QIRAAT_AUDIT_DSN/libpq variables")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    fixture, duplicate_keys = load_fixture_records()
    conn = psycopg2.connect(args.dsn) if args.dsn else psycopg2.connect()
    try:
        database = load_database_records(conn)
    finally:
        conn.rollback()
        conn.close()

    fixture_only = [fixture[key] for key in sorted(fixture.keys() - database.keys())]
    database_only = [database[key] for key in sorted(database.keys() - fixture.keys())]
    mismatches = []
    conflict_classes: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for key in sorted(fixture.keys() & database.keys()):
        left, right = fixture[key], database[key]
        fields = [field for field in ("page", "kind", "surah", "ayah", "start_token", "end_ayah", "end_token") if left[field] != right[field]]
        if left["payload"] != right["payload"]:
            fields.append("payload")
        if fields:
            mismatch = {"id": key, "fields": fields, "fixture": left, "database": right}
            mismatches.append(mismatch)
            if left["kind"] == "ruling" and left["payload"].get("category_code") != right["payload"].get("category_code"):
                conflict_classes["DATA_EXISTS_NORMALIZATION_MISSING"].append(mismatch)
            elif left["payload"].get("readings") != right["payload"].get("readings"):
                conflict_classes["DATA_EXISTS_WRONG_ASSOCIATION"].append(mismatch)
            else:
                conflict_classes["DATA_CONFLICT"].append(mismatch)

    fixture_only_pages = sorted({item["page"] for item in fixture_only})
    report = {
        "report_type": "READ_ONLY_DRY_RUN",
        "database_mutated": False,
        "fixture": {
            "raw_records": len(fixture) + len(duplicate_keys),
            "unique_import_keys": len(fixture),
            "duplicate_import_keys": len(duplicate_keys),
            "pages": len({item["page"] for item in fixture.values()}),
            "page_ranges": page_ranges(sorted({item["page"] for item in fixture.values()})),
            "by_kind": count_by(list(fixture.values()), "kind"),
        },
        "database": {
            "entries": len(database),
            "pages": len({item["page"] for item in database.values()}),
            "page_ranges": page_ranges(sorted({item["page"] for item in database.values()})),
            "by_kind": count_by(list(database.values()), "kind"),
        },
        "classification": {
            "DATA_EXISTS_MAPPING_MISSING": {
                "count": len(fixture_only),
                "pages": fixture_only_pages,
                "page_ranges": page_ranges(fixture_only_pages),
                "by_kind": count_by(fixture_only, "kind"),
                "meaning": "Committed fixture data exists but has no matching database entry key; no religious data insertion is proposed by this audit.",
            },
            "DATA_DUPLICATE": {
                "count": len(duplicate_keys),
                "meaning": "Multiple fixture records resolve to the same import key; importer ON CONFLICT would collapse them, so they require source-level review before a database import.",
            },
            **{
                classification: {
                    "count": len(items),
                    "pages": sorted({item["fixture"]["page"] for item in items}),
                    "meaning": {
                        "DATA_EXISTS_NORMALIZATION_MISSING": "Fixture and database agree on the record key but not its canonical category; preserve the raw source label and review the normalization mapping before any update.",
                        "DATA_EXISTS_WRONG_ASSOCIATION": "Fixture and database agree on the record key but not its reader/rawi assertions; never auto-reassign a reading.",
                        "DATA_CONFLICT": "Fixture and database use the same key with another different locator or payload value; never update automatically.",
                    }[classification],
                }
                for classification, items in sorted(conflict_classes.items())
            },
            "DATABASE_ONLY_REQUIRES_REVIEW": {
                "count": len(database_only),
                "meaning": "Database entry has no committed fixture counterpart; never delete automatically.",
            },
        },
        "fixture_only": fixture_only,
        "duplicate_import_keys": duplicate_keys,
        "conflicts": mismatches,
        "conflicts_by_classification": dict(sorted(conflict_classes.items())),
        "database_only": database_only,
        "recommended_next_step": "Use only a new explicitly approved, backup-first, idempotent importer after duplicate keys and conflicts are resolved; import in page batches and re-run this audit after every batch.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = {
        "fixture_unique_keys": len(fixture), "database_entries": len(database),
        "fixture_only": len(fixture_only), "duplicate_keys": len(duplicate_keys),
        "conflicts": len(mismatches), "database_only": len(database_only),
        "output": str(args.output.relative_to(ROOT)),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1 if mismatches or database_only else 0


if __name__ == "__main__":
    raise SystemExit(main())
