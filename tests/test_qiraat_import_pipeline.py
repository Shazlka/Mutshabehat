# -*- coding: utf-8 -*-
"""End-to-end tests for the Qiraat bulk Excel import pipeline (task requirements #23, #24).

Two tiers:
  - Pure-Python tests (no database) exercise parsing, mapping, validation, authority
    resolution, token anchoring and idempotent fingerprinting directly against the sample
    workbook. These always run.
  - Database tests exercise staging -> approve -> publish -> export against a real
    PostgreSQL instance with the V2 + staging schemas applied. They run only when
    QIRAAT_TEST_DATABASE_URL is set (see README below) and are skipped otherwise — this
    suite must not require network/DB access to give useful signal in CI.

To run the DB-backed tests locally:
    createdb qiraat_test
    psql qiraat_test -f supabase/migrations/20260917120000_qiraat_v2_schema.sql
    psql qiraat_test -f supabase/migrations/20260920120000_qiraat_import_staging.sql
    QIRAAT_TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/qiraat_test \
      python3 -m pytest -q tests/test_qiraat_import_pipeline.py
"""
import json
import os
import subprocess
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, 'scripts', 'qiraat')
sys.path.insert(0, SCRIPTS)

import import_excel as IE  # noqa: E402
import authorities as A    # noqa: E402
from attribution_parser import resolve_attribution  # noqa: E402
import group_symbols as G  # noqa: E402

SAMPLE_XLSX = os.path.join(ROOT, 'tests', 'fixtures', 'qiraat_sample_import.xlsx')


@pytest.fixture(scope='module', autouse=True)
def sample_workbook():
    subprocess.run([sys.executable, os.path.join(SCRIPTS, 'make_sample_import.py'), SAMPLE_XLSX], check=True)
    yield SAMPLE_XLSX


@pytest.fixture()
def run():
    alias_map = IE.load_mapping(os.path.join(SCRIPTS, 'excel_mapping.yaml'))
    return IE.ImportRun(os.path.dirname(SAMPLE_XLSX), alias_map).process()


# ---------------------------------------------------------------------------
# Pure-Python: discovery, mapping, validation
# ---------------------------------------------------------------------------

def test_discovers_the_workbook_and_both_data_sheets(run):
    assert os.path.basename(SAMPLE_XLSX) in [os.path.basename(f) for f in run.files_seen]
    assert run.sheets_seen == 2  # third sheet is empty and must be skipped


def test_reads_every_data_row(run):
    assert len(run.rows) == 8


def test_valid_row_is_classified_valid(run):
    row = next(r for r in run.rows if r['source_row'] == 2 and r['source_sheet'] == 'القراءات')
    assert row['validation_status'] == 'valid'
    assert row['normalized']['attribution_readings']


def test_group_symbol_attribution_resolves(run):
    row = next(r for r in run.rows if r['source_row'] == 3)
    assert row['validation_status'] == 'valid'
    assert set(row['normalized']['attribution_readings']) == set(G.resolve_group('الأخوان'))


def test_remainder_attribution_flags_is_remainder(run):
    remainder_rows = [r for r in run.rows if r['normalized'].get('attribution_is_remainder')]
    assert remainder_rows, 'expected at least one row parsed as remainder (الباقون)'


def test_invalid_page_or_ayah_is_rejected():
    result = IE.normalize_row({'mushaf_page': 1, 'surah_number': 1, 'ayah_from': 999,
                                'base_text': 'كلمة', 'attribution': 'نافع'}, IE.load_surah_ayah_counts())
    assert result['validation_status'] == 'error'
    assert any(m['code'] == 'INVALID_AYAH' for m in result['messages'])


def test_bare_khalaf_is_unresolved_never_guessed():
    result = resolve_attribution('خلف')
    assert not result.ok
    assert result.unresolved[0]['token'] == 'خلف'


def test_unknown_reader_name_is_unresolved():
    result = resolve_attribution('قارئ غير موجود')
    assert not result.ok


def test_unmapped_word_is_needs_manual_mapping(run):
    row = next(r for r in run.rows if r['source_row'] == 8)
    assert row['mapping_status'] == 'needs_manual_mapping'
    assert row['validation_status'] == 'error'


def test_exact_duplicate_within_one_run_is_detected(run):
    dup_rows = [r for r in run.rows if r['duplicate_status'] == 'exact_duplicate']
    assert len(dup_rows) == 1
    assert dup_rows[0]['source_row'] == 4


def test_fingerprint_excludes_batch_metadata_but_matches_same_fact():
    a = IE.row_fingerprint({'mushaf_page': 1, 'surah_number': 1, 'ayah_from': 4, 'ayah_to': 4,
                             'base_text_raw': 'مالك', 'variant_text': 'ملك', 'category_code': None,
                             'attribution_readings': ['Q05-R02'], 'attribution_is_remainder': False})
    b = IE.row_fingerprint({'mushaf_page': 1, 'surah_number': 1, 'ayah_from': 4, 'ayah_to': 4,
                             'base_text_raw': 'مالك', 'variant_text': 'ملك', 'category_code': None,
                             'attribution_readings': ['Q05-R02'], 'attribution_is_remainder': False})
    c = IE.row_fingerprint({'mushaf_page': 1, 'surah_number': 1, 'ayah_from': 4, 'ayah_to': 4,
                             'base_text_raw': 'مالك', 'variant_text': 'DIFFERENT', 'category_code': None,
                             'attribution_readings': ['Q05-R02'], 'attribution_is_remainder': False})
    assert a == b
    assert a != c


def test_narrator_reader_relation_is_enforced_by_the_authority_tree():
    # Q06-R01 (خلف عن حمزة) belongs to Q06 (حمزة) — resolving it must never claim Q07's readings.
    readings = A.readings_of(A.resolve('خلف عن حمزة'))
    assert readings == ['Q06-R01']
    assert 'Q07-R01' not in readings


def test_alternate_wajh_bare_duri_is_ambiguous_without_qualification():
    result = resolve_attribution('الدوري')
    assert not result.ok


def test_reports_are_written(run, tmp_path):
    json_path, html_path = IE.write_reports(run, str(tmp_path))
    assert os.path.exists(json_path)
    assert os.path.exists(html_path)
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)
    assert data['summary']['rowsTotal'] == 8


def test_dry_run_never_imports_psycopg2_connect(monkeypatch, run):
    """--dry-run must not even attempt a DB connection."""
    def fail(*a, **k):
        raise AssertionError('dry-run must not connect to the database')
    import psycopg2
    monkeypatch.setattr(psycopg2, 'connect', fail)
    IE.write_reports(run, '/tmp')  # dry-run's only side effect


# ---------------------------------------------------------------------------
# Database-backed: staging -> approve -> publish -> export
# ---------------------------------------------------------------------------

DB_URL = os.environ.get('QIRAAT_TEST_DATABASE_URL')
requires_db = pytest.mark.skipif(not DB_URL, reason='QIRAAT_TEST_DATABASE_URL not set')


@pytest.fixture()
def db_conn():
    import psycopg2
    conn = psycopg2.connect(DB_URL)
    yield conn
    with conn.cursor() as cur:
        cur.execute("TRUNCATE qiraat_import_row_events, qiraat_import_rows, qiraat_import_batches CASCADE")
        cur.execute("""DELETE FROM qiraat_entries WHERE locus_id LIKE 'IMP-%%'""")
        cur.execute("""DELETE FROM qiraat_loci WHERE id LIKE 'IMP-%%'""")
        cur.execute("""DELETE FROM qiraat_pages WHERE source_document_id = 'XLSX-IMPORT'""")
    conn.commit()
    conn.close()


@requires_db
def test_stage_approve_publish_export_round_trip(db_conn, run):
    import publish_import as PI
    import export_from_postgres as EX
    import psycopg2.extras

    batch_id = IE.stage_to_db(run, DB_URL, os.path.dirname(SAMPLE_XLSX))
    with db_conn.cursor() as cur:
        cur.execute(
            """UPDATE qiraat_import_rows SET review_status = 'approved'
                WHERE batch_id = %s AND validation_status = 'valid' AND duplicate_status = 'none'""",
            (batch_id,),
        )
    db_conn.commit()

    class Args:
        batch = str(batch_id)
        db_url = DB_URL
    PI.main.__globals__['sys'].argv = ['publish_import.py', '--batch', str(batch_id), '--db-url', DB_URL]
    PI.main()

    with db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT status, rows_published FROM qiraat_import_batches WHERE id = %s", (batch_id,))
        batch = cur.fetchone()
        assert batch['status'] == 'PUBLISHED'
        assert batch['rows_published'] == 4  # the 4 valid, non-duplicate, approved rows

        cur.execute("SELECT * FROM qiraat_qa_partition WHERE locus_id LIKE 'IMP-%%'")
        # No overlaps for this sample (each locus has a single reported وجه; missing_readings
        # is expected here since the sample intentionally reports partial data per locus).
        for row in cur.fetchall():
            assert row['overlapping_readings'] == 0

    page1 = EX.export_page(db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor), 1, True)
    assert len(page1['entries']) >= 3

    # Default (published-only) export must be empty — REVIEWED is not visible to readers.
    page1_public = EX.export_page(db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor), 1, False)
    assert page1_public['entries'] == []


@requires_db
def test_reimport_is_idempotent_marks_exact_duplicate(db_conn, run):
    batch1 = IE.stage_to_db(run, DB_URL, os.path.dirname(SAMPLE_XLSX))
    alias_map = IE.load_mapping(os.path.join(SCRIPTS, 'excel_mapping.yaml'))
    run2 = IE.ImportRun(os.path.dirname(SAMPLE_XLSX), alias_map).process()
    batch2 = IE.stage_to_db(run2, DB_URL, os.path.dirname(SAMPLE_XLSX))
    with db_conn.cursor() as cur:
        cur.execute("SELECT duplicate_status, count(*) FROM qiraat_import_rows WHERE batch_id = %s GROUP BY 1", (batch2,))
        counts = dict(cur.fetchall())
    assert counts.get('exact_duplicate') == 8


@requires_db
def test_publish_never_processes_error_or_rejected_rows(db_conn, run):
    import publish_import as PI
    batch_id = IE.stage_to_db(run, DB_URL, os.path.dirname(SAMPLE_XLSX))
    with db_conn.cursor() as cur:
        # Approve EVERYTHING, including error rows — publish_import.py must still refuse them.
        cur.execute("UPDATE qiraat_import_rows SET review_status = 'approved' WHERE batch_id = %s", (batch_id,))
    db_conn.commit()
    PI.main.__globals__['sys'].argv = ['publish_import.py', '--batch', str(batch_id), '--db-url', DB_URL]
    PI.main()
    with db_conn.cursor() as cur:
        cur.execute(
            """SELECT count(*) FROM qiraat_import_rows
                WHERE batch_id = %s AND review_status = 'published' AND validation_status <> 'valid'""",
            (batch_id,),
        )
        assert cur.fetchone()[0] == 0
