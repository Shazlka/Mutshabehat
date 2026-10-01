-- Phase 2.1 tests (SCRATCH ONLY): undo of coupled fields and of an entry_order swap.
\set ON_ERROR_STOP 1
\pset footer off
SET client_min_messages = notice;
CREATE TEMP TABLE u AS
SELECT ea.id AS ea_id, ea.entry_id FROM qiraat_entry_authorities ea JOIN qiraat_entries e ON e.id = ea.entry_id
 WHERE ea.wajh_order = 1 AND ea.deleted_at IS NULL AND ea.authority_id <> 'Q05-R02' AND e.kind = 'variant'
 ORDER BY ea.id LIMIT 1;
CREATE TEMP TABLE sw AS
SELECT a.id AS a_id, b.id AS b_id, a.entry_order AS a_ord, b.entry_order AS b_ord
  FROM qiraat_entries a JOIN qiraat_entries b ON b.locus_id = a.locus_id AND b.kind = a.kind AND b.id > a.id
 ORDER BY a.id LIMIT 1;
-- Legacy stored readings can drift from what the rebuild derives; start from the derived state.
SELECT qiraat_rebuild_locus_readings(e.locus_id) IS NOT NULL AS canonicalised FROM qiraat_entries e, u WHERE e.id = u.entry_id;
CREATE TEMP TABLE before AS
SELECT (SELECT to_jsonb(x) - 'updated_at' - 'device_id' FROM qiraat_entry_authorities x WHERE x.id = u.ea_id) AS ea,
       (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.reading_id, r.action_ar) FROM qiraat_entry_readings r WHERE r.entry_id = u.entry_id) AS rd,
       (SELECT jsonb_agg(jsonb_build_object('id', id, 'o', entry_order) ORDER BY id) FROM qiraat_entries WHERE id IN (sw.a_id, sw.b_id)) AS ord
  FROM u, sw;

BEGIN;   -- one editor action: demote a narrator to a second wajh (two coupled fields)
UPDATE qiraat_entry_authorities SET is_default = false, wajh_order = 2, wajh_note = 'بخلف عنه' FROM u WHERE id = u.ea_id;
CREATE TEMP TABLE tx1 AS SELECT txid_current() AS id;
COMMIT;
BEGIN;   -- one editor action: swap two readings' order
SET CONSTRAINTS qiraat_entries_locus_id_kind_entry_order_key DEFERRED;
UPDATE qiraat_entries e SET entry_order = CASE WHEN e.id = sw.a_id THEN sw.b_ord ELSE sw.a_ord END FROM sw WHERE e.id IN (sw.a_id, sw.b_id);
CREATE TEMP TABLE tx2 AS SELECT txid_current() AS id;
COMMIT;

SELECT 'undo swap' AS step, edit_log_undo_tx((SELECT id FROM tx2)) AS undone;
SELECT 'undo wajh' AS step, edit_log_undo_tx((SELECT id FROM tx1)) AS undone;

SELECT CASE WHEN b.ea = (SELECT to_jsonb(x) - 'updated_at' - 'device_id' FROM qiraat_entry_authorities x, u WHERE x.id = u.ea_id)
             AND b.rd = (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.reading_id, r.action_ar) FROM qiraat_entry_readings r, u WHERE r.entry_id = u.entry_id)
            THEN 'PASS U1 coupled is_default+wajh_order edit undone as one row' ELSE 'FAIL U1' END FROM before b;
SELECT CASE WHEN b.ord = (SELECT jsonb_agg(jsonb_build_object('id', id, 'o', entry_order) ORDER BY id) FROM qiraat_entries, sw WHERE id IN (sw.a_id, sw.b_id))
            THEN 'PASS U2 entry_order swap undone (deferrable unique key)' ELSE 'FAIL U2' END FROM before b;
SELECT CASE WHEN (SELECT condeferrable AND NOT condeferred FROM pg_constraint WHERE conname = 'qiraat_entries_locus_id_kind_entry_order_key')
            THEN 'PASS U3 order key is DEFERRABLE INITIALLY IMMEDIATE' ELSE 'FAIL U3' END;
DO $$ BEGIN
  BEGIN
    UPDATE qiraat_entries e SET entry_order = sw.b_ord FROM sw WHERE e.id = sw.a_id;
    RAISE NOTICE 'FAIL U4 duplicate order accepted immediately';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS U4 duplicate order still rejected immediately by default';
  END;
END $$;
