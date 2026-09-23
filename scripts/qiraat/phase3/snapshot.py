"""Fixture and read-only PostgreSQL snapshot loading for Phase 3."""
import hashlib
import json
import os
from pathlib import Path

from scripts.qiraat.import_to_postgres import load_reconcile_keys, load_fixture_page_specs
from scripts.qiraat.data_variants import PAGES


def _coerce(record):
    result = dict(record)
    for field in ("ayah", "startToken", "endToken", "endAyah", "pageNumber"):
        if result.get(field) is not None:
            result[field] = int(result[field])
    return result


def load_fixtures(root):
    root = Path(root)
    variants, rulings = {}, {}
    digest = hashlib.sha256()
    for directory, destination in (("pages", variants), ("rulings", rulings)):
        base = root / "packages/qiraat-core/fixtures" / directory
        for path in sorted(base.glob("page-*.json")):
            page = int(path.stem.split("-")[1])
            raw = path.read_bytes()
            digest.update(raw)
            destination[page] = [_coerce(x) for x in json.loads(raw.decode("utf-8"))]
    return {"variants": variants, "rulings": rulings, "sha256": digest.hexdigest()}


def _rows(cur, table):
    cur.execute(f"SELECT * FROM {table} ORDER BY 1")
    columns = [item.name for item in cur.description]
    return [dict(zip(columns, row)) for row in cur.fetchall()]


def load_db_snapshot():
    import psycopg2
    dsn = os.environ.get("QIRAAT_DB_DSN")
    conn = psycopg2.connect(dsn, options="-c default_transaction_read_only=on") if dsn else psycopg2.connect(options="-c default_transaction_read_only=on")
    try:
        cur = conn.cursor()
        cur.execute("SET TRANSACTION READ ONLY")
        snapshot = {"snapshot_time": None}
        cur.execute("SELECT clock_timestamp()")
        snapshot["snapshot_time"] = cur.fetchone()[0].isoformat()
        for table in ("qiraat_pages", "qiraat_loci", "qiraat_entries", "qiraat_variant_details",
                      "qiraat_ruling_details", "qiraat_entry_authorities", "qiraat_evidence_texts",
                      "qiraat_evidence_links", "qiraat_source_documents", "qiraat_categories", "qiraat_authorities", "qiraat_qa_flags"):
            snapshot[table] = _rows(cur, table)
        cur.execute("SELECT count(*) FROM qiraat_entries")
        snapshot["entry_count"] = cur.fetchone()[0]
        snapshot["category_codes"] = {row["code"] for row in snapshot["qiraat_categories"]}
        return snapshot
    finally:
        conn.close()


def load_inputs(root):
    fixtures = load_fixtures(root)
    agy_path = Path(root) / "artifacts/qiraat-phase3-q6-agy-classification.json"
    agy = {}
    for row in json.loads(agy_path.read_text(encoding="utf-8")):
        agy[(int(row["page"]), str(row["id"]), row.get("note") or row.get("performanceNote") or "")] = row
    fixtures["agy"] = agy
    snapshot = load_db_snapshot()
    conflicts_path = Path(root) / "docs/qiraat-reader-dedupe-audit.json"
    conflicts = json.loads(conflicts_path.read_text(encoding="utf-8")).get("conflicts", [])
    duplicate_keys = load_reconcile_keys(str(root))
    specs = load_fixture_page_specs(str(root), PAGES)
    names = json.loads((Path(root) / "public/quran/surah-names.json").read_text(encoding="utf-8"))
    for spec in specs.values():
        spec["surah_name_ar"] = names.get(str(spec["surah"]), "غير محدد")
    return fixtures, snapshot, conflicts, duplicate_keys, specs
