-- Phase 2 DDL behaviour tests. SCRATCH DATABASE ONLY: this file commits test edits and undoes them.
-- Run after 20260924120000_qiraat_phase2_review_sync.sql. Every check prints PASS/FAIL via NOTICE.
\set ON_ERROR_STOP 1
SET client_min_messages = notice;
\pset footer off

-- Test fixtures: one variant entry without Hafs at a single-entry locus, and a locus with two
-- variant entries whose narrators do not overlap.
CREATE TEMP TABLE t AS
SELECT
  (SELECT e.id FROM qiraat_entries e
    WHERE e.kind = 'variant' AND e.verification_status = 'REVIEWED'
      AND (SELECT count(*) FROM qiraat_entries x WHERE x.locus_id = e.locus_id) = 1
      AND NOT EXISTS (SELECT 1 FROM qiraat_entry_readings r WHERE r.entry_id = e.id AND r.reading_id LIKE 'Q05%')
      AND EXISTS (SELECT 1 FROM qiraat_evidence_links el WHERE el.locus_id = e.locus_id)
    ORDER BY e.id LIMIT 1) AS e1,
  (SELECT e.id FROM qiraat_entries e
    WHERE e.kind = 'variant' AND e.verification_status = 'REVIEWED'
      AND (SELECT count(*) FROM qiraat_entries x WHERE x.locus_id = e.locus_id AND x.kind = 'variant'
             AND x.verification_status = 'REVIEWED') = 2
      AND NOT EXISTS (SELECT 1 FROM qiraat_qa_phase2_violations v WHERE v.locus_id = e.locus_id)
    ORDER BY e.id LIMIT 1) AS e2;
ALTER TABLE t ADD COLUMN l1 text, ADD COLUMN l2 text, ADD COLUMN e2b text, ADD COLUMN n2b text;
UPDATE t SET l1 = (SELECT locus_id FROM qiraat_entries WHERE id = e1),
             l2 = (SELECT locus_id FROM qiraat_entries WHERE id = e2);
UPDATE t SET e2b = (SELECT id FROM qiraat_entries WHERE locus_id = l2 AND id <> e2 AND kind = 'variant' LIMIT 1);
UPDATE t SET n2b = (SELECT reading_id FROM qiraat_entry_readings WHERE entry_id = e2b AND wajh_order = 1 LIMIT 1);
SELECT 'fixtures' AS info, * FROM t;

-- Expect-error helper: runs SQL, forces deferred checks, and always rolls the change back.
CREATE OR REPLACE FUNCTION pg_temp.expect(p_name text, p_sql text, p_error_prefix text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'NO_ERROR';
  EXCEPTION WHEN OTHERS THEN
    IF p_error_prefix IS NULL AND SQLERRM = 'NO_ERROR' THEN
      RAISE NOTICE 'PASS %: accepted', p_name;
    ELSIF p_error_prefix IS NOT NULL AND SQLERRM LIKE p_error_prefix || '%' THEN
      RAISE NOTICE 'PASS %: rejected (%)', p_name, left(SQLERRM, 110);
    ELSE
      RAISE NOTICE 'FAIL %: %', p_name, SQLERRM;
    END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;
END $$;

-- ---------------------------------------------------------------- D8 / Q13
SELECT pg_temp.expect('T1 D8 Hafs as main reading is rejected',
  format($q$INSERT INTO qiraat_entry_authorities (entry_id, authority_id) VALUES (%L, 'Q05-R02')$q$, e1), 'QIRAAT_D8') FROM t;
SELECT pg_temp.expect('T2 D8 reader-level Asim (expands to Hafs) is rejected',
  format($q$INSERT INTO qiraat_entry_authorities (entry_id, authority_id) VALUES (%L, 'Q05')$q$, e1), 'QIRAAT_D8') FROM t;
SELECT pg_temp.expect('T3 Q13 Hafs as wajh 2 without a note is rejected',
  format($q$INSERT INTO qiraat_entry_authorities (entry_id, authority_id, is_default, wajh_order) VALUES (%L, 'Q05-R02', false, 2)$q$, e1), 'QIRAAT_D8') FROM t;
SELECT pg_temp.expect('T4 Q13 Hafs as wajh 2 with a note is accepted',
  format($q$INSERT INTO qiraat_entry_authorities (entry_id, authority_id, is_default, wajh_order, wajh_note) VALUES (%L, 'Q05-R02', false, 2, 'وجه ثانٍ لحفص')$q$, e1), NULL) FROM t;
SELECT pg_temp.expect('T5 wajh_order/is_default mismatch is rejected',
  format($q$INSERT INTO qiraat_entry_authorities (entry_id, authority_id, is_default, wajh_order) VALUES (%L, 'Q05-R01', true, 2)$q$, e1), 'new row for relation "qiraat_entry_authorities" violates check constraint') FROM t;
SELECT pg_temp.expect('T6 flagged entry may keep Hafs (quarantine)',
  format($q$UPDATE qiraat_entries SET review_status = 'flagged' WHERE id = %L;
            INSERT INTO qiraat_entry_authorities (entry_id, authority_id) VALUES (%L, 'Q05-R02')$q$, e1, e1), NULL) FROM t;
SELECT pg_temp.expect('T7 un-flagging an entry that lists Hafs is rejected',
  format($q$UPDATE qiraat_entries SET review_status = 'flagged' WHERE id = %L;
            INSERT INTO qiraat_entry_authorities (entry_id, authority_id) VALUES (%L, 'Q05-R02');
            SET CONSTRAINTS ALL IMMEDIATE; SET CONSTRAINTS ALL DEFERRED;
            UPDATE qiraat_entries SET review_status = 'reviewed' WHERE id = %L$q$, e1, e1, e1), 'QIRAAT_D8') FROM t;

-- ---------------------------------------------------------------- one narrator per location
SELECT pg_temp.expect('T8 same narrator in two readings at one location is rejected',
  format($q$INSERT INTO qiraat_entry_authorities (entry_id, authority_id) VALUES (%L, %L)$q$, e2, n2b), 'QIRAAT_NARRATOR_TWICE') FROM t;
SELECT pg_temp.expect('T9 same narrator as a separate wajh is accepted',
  format($q$INSERT INTO qiraat_entry_authorities (entry_id, authority_id, is_default, wajh_order, wajh_note) VALUES (%L, %L, false, 2, 'بخلف عنه')$q$, e2, n2b), NULL) FROM t;

-- ---------------------------------------------------------------- at least one reading
SELECT pg_temp.expect('T10 removing every reading of a location is rejected',
  format($q$DELETE FROM qiraat_entry_authorities WHERE entry_id = %L$q$, e1), 'QIRAAT_EMPTY_LOCUS') FROM t;
SELECT pg_temp.expect('T11 soft-deleting the only entry of a location is rejected',
  format($q$UPDATE qiraat_entries SET deleted_at = now() WHERE id = %L$q$, e1), 'QIRAAT_EMPTY_LOCUS') FROM t;
SELECT pg_temp.expect('T12 soft-deleting the entry and its location together is accepted',
  format($q$UPDATE qiraat_entries SET deleted_at = now() WHERE id = %L; UPDATE qiraat_loci SET deleted_at = now() WHERE id = %L$q$, e1, l1), NULL) FROM t;
SELECT pg_temp.expect('T13 a new location with no reading is rejected',
  format($q$INSERT INTO qiraat_loci (id, page_id, surah_number, start_ayah, start_word, end_ayah, end_word, base_text, base_text_normalized)
            SELECT 'TEST-EMPTY', page_id, surah_number, start_ayah, start_word, end_ayah, end_word, base_text, base_text_normalized FROM qiraat_loci WHERE id = %L$q$, l1), 'QIRAAT_EMPTY_LOCUS') FROM t;

-- ---------------------------------------------------------------- remainder never adds Hafs
DO $$
DECLARE v_e text := (SELECT e1 FROM t); v_n int; v_hafs int;
BEGIN
  BEGIN
    UPDATE qiraat_entries SET attribution_mode = 'remainder' WHERE id = v_e;
    PERFORM qiraat_rebuild_locus_readings((SELECT l1 FROM t));
    SELECT count(*), count(*) FILTER (WHERE reading_id = 'Q05-R02') INTO v_n, v_hafs
      FROM qiraat_entry_readings WHERE entry_id = v_e;
    IF v_n = 19 AND v_hafs = 0 THEN RAISE NOTICE 'PASS T14 remainder rebuild: 19 narrators, Hafs implied';
    ELSE RAISE NOTICE 'FAIL T14 remainder rebuild: % narrators, hafs=%', v_n, v_hafs; END IF;
    RAISE EXCEPTION 'ROLLBACK';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'ROLLBACK' THEN RAISE NOTICE 'FAIL T14: %', SQLERRM; END IF;
  END;
END $$;

-- ---------------------------------------------------------------- edit_log + undo (committed)
-- Stored readings can drift from what the rebuild derives (legacy importer wrote them directly), so
-- first bring the test location to its derived state; the snapshot then compares like with like.
SELECT qiraat_rebuild_locus_readings(l1) AS canonicalised FROM t;
CREATE TEMP TABLE snap AS
SELECT 'entry' AS k, to_jsonb(e) - 'updated_at' - 'device_id' AS v FROM qiraat_entries e, t WHERE e.id = t.e1
UNION ALL SELECT 'variant', to_jsonb(v) - 'updated_at' - 'device_id' FROM qiraat_variant_details v, t WHERE v.entry_id = t.e1
UNION ALL SELECT 'readings', jsonb_agg(to_jsonb(r) ORDER BY r.reading_id, r.action_ar) FROM qiraat_entry_readings r, t WHERE r.entry_id = t.e1
UNION ALL SELECT 'evidence', jsonb_agg(to_jsonb(el) - 'updated_at' - 'device_id' ORDER BY el.id) FROM qiraat_evidence_links el, t WHERE el.locus_id = t.l1;

BEGIN;
SET LOCAL app.device_id = 'scratch-ipad-01';
UPDATE qiraat_entries SET notes = 'edited in test', review_status = 'reviewed' FROM t WHERE qiraat_entries.id = t.e1;
UPDATE qiraat_variant_details SET description_ar = 'وصف تجريبي' FROM t WHERE entry_id = t.e1;
INSERT INTO qiraat_entry_authorities (entry_id, authority_id)
SELECT t.e1, (SELECT a.id FROM qiraat_authorities a
               WHERE a.authority_type = 'narrator' AND a.id <> 'Q05-R02'
                 AND NOT EXISTS (SELECT 1 FROM qiraat_entry_readings r WHERE r.entry_id = t.e1 AND r.reading_id = a.id)
               ORDER BY a.id LIMIT 1) FROM t;
DELETE FROM qiraat_evidence_links WHERE id = (SELECT min(el.id) FROM qiraat_evidence_links el, t WHERE el.locus_id = t.l1);
CREATE TEMP TABLE tx AS SELECT txid_current() AS id;
COMMIT;

SELECT 'edit_log rows' AS info, op, table_name, field, device_id, left(coalesce(new_value, old_value)::text, 60) AS value
  FROM edit_log WHERE txid = (SELECT id FROM tx) ORDER BY id;
DO $$ BEGIN
  IF (SELECT count(*) FROM edit_log WHERE txid = (SELECT id FROM tx) AND device_id = 'scratch-ipad-01') >= 5
  THEN RAISE NOTICE 'PASS T15 every edit wrote edit_log rows with device_id';
  ELSE RAISE NOTICE 'FAIL T15 edit_log rows missing'; END IF;
END $$;

SELECT edit_log_undo_tx((SELECT id FROM tx)) AS undone_rows;

DO $$
DECLARE v_bad int; v_parts text;
BEGIN
  SELECT count(*), string_agg(s.k, ',') INTO v_bad, v_parts FROM snap s WHERE s.v IS DISTINCT FROM (
    CASE s.k
      WHEN 'entry'    THEN (SELECT to_jsonb(e) - 'updated_at' - 'device_id' FROM qiraat_entries e, t WHERE e.id = t.e1)
      WHEN 'variant'  THEN (SELECT to_jsonb(v) - 'updated_at' - 'device_id' FROM qiraat_variant_details v, t WHERE v.entry_id = t.e1)
      WHEN 'readings' THEN (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.reading_id, r.action_ar) FROM qiraat_entry_readings r, t WHERE r.entry_id = t.e1)
      WHEN 'evidence' THEN (SELECT jsonb_agg(to_jsonb(el) - 'updated_at' - 'device_id' ORDER BY el.id) FROM qiraat_evidence_links el, t WHERE el.locus_id = t.l1)
    END);
  IF v_bad = 0 THEN RAISE NOTICE 'PASS T16 undo of the whole transaction restored entry, detail, readings and evidence exactly';
  ELSE RAISE NOTICE 'FAIL T16 % snapshot parts differ after undo: %', v_bad, v_parts; END IF;
  IF (SELECT count(*) FROM edit_log WHERE txid = (SELECT id FROM tx) AND undone_at IS NULL) = 0
  THEN RAISE NOTICE 'PASS T17 original edit_log rows marked undone; undo rows written: %',
         (SELECT count(*) FROM edit_log WHERE undo_of IN (SELECT id FROM edit_log WHERE txid = (SELECT id FROM tx)));
  ELSE RAISE NOTICE 'FAIL T17 rows not marked undone'; END IF;
END $$;

-- Undo conflict: a later edit to the same field blocks undoing the earlier one.
BEGIN; UPDATE qiraat_entries SET notes = 'first'  FROM t WHERE id = t.e1; SELECT max(id) AS first_log FROM edit_log \gset
COMMIT;
BEGIN; UPDATE qiraat_entries SET notes = 'second' FROM t WHERE id = t.e1; COMMIT;
SELECT pg_temp.expect('T18 undo of a field that changed again is refused', format('SELECT edit_log_undo(%s)', :first_log), 'UNDO_CONFLICT');
SELECT edit_log_undo(max(id)) FROM edit_log WHERE table_name = 'qiraat_entries' AND field = 'notes' AND undo_of IS NULL AND undone_at IS NULL;
SELECT edit_log_undo(:first_log);
DO $$ BEGIN
  IF (SELECT e.notes IS NOT DISTINCT FROM (s.v->>'notes') FROM qiraat_entries e, t, snap s WHERE e.id = t.e1 AND s.k = 'entry')
  THEN RAISE NOTICE 'PASS T19 undo newest then oldest restores the original value';
  ELSE RAISE NOTICE 'FAIL T19'; END IF;
END $$;

-- ---------------------------------------------------------------- access control
SET ROLE anon;
SELECT pg_temp.expect('T20 anon cannot read edit_log', 'SELECT count(*) FROM edit_log', 'permission denied');
DO $$ BEGIN
  IF (SELECT count(*) FROM v_page_variant_rows) = 0
  THEN RAISE NOTICE 'PASS T21 anon sees no unpublished rows through the review view (RLS kept)';
  ELSE RAISE NOTICE 'FAIL T21 anon sees unpublished rows'; END IF;
END $$;
SELECT pg_temp.expect('T22 anon cannot run undo', 'SELECT edit_log_undo(1)', 'permission denied');
RESET ROLE;

-- ---------------------------------------------------------------- review view
SELECT 'v_page_variants(3)' AS info, surah, ayah, start_word, kind, category_code, hafs_text, reading_text,
       (SELECT string_agg(n->>'code', ' ') FROM jsonb_array_elements(narrators) n) AS narrators, review_status
  FROM v_page_variants(3) LIMIT 12;
SELECT 'review rows' AS info, count(*) AS rows, count(DISTINCT page) AS pages,
       count(*) FILTER (WHERE hafs_text IS NULL) AS no_hafs_text,
       count(*) FILTER (WHERE kind = 'farsh') AS farsh, count(*) FILTER (WHERE kind = 'usul') AS usul
  FROM v_page_variant_rows;
SELECT 'phase2 violations (existing data)' AS info, rule, count(*) FROM qiraat_qa_phase2_violations GROUP BY rule ORDER BY rule;
