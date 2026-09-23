-- Phase 4 review API tests. SCRATCH ONLY. Emulates PostgREST: SET ROLE authenticated + JWT claims.
\set ON_ERROR_STOP 1
\pset footer off
SET client_min_messages = notice;

-- A second, non-editor account (scratch only).
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES ('11111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'scratch-non-editor@example.invalid', now(), now())
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;
CREATE OR REPLACE FUNCTION pg_temp.expect(p_name text, p_sql text, p_error text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'NO_ERROR';
  EXCEPTION WHEN OTHERS THEN
    IF p_error IS NULL AND SQLERRM = 'NO_ERROR' THEN RAISE NOTICE 'PASS %', p_name;
    ELSIF p_error IS NOT NULL AND SQLERRM LIKE p_error || '%' THEN RAISE NOTICE 'PASS % (%)', p_name, left(SQLERRM, 90);
    ELSE RAISE NOTICE 'FAIL %: %', p_name, SQLERRM; END IF;
  END;
  SET CONSTRAINTS ALL DEFERRED;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon;

-- Normaliser parity with scripts/qiraat/tokens.py norm() (values were written by Python).
RESET ROLE;
SELECT CASE WHEN count(*) FILTER (WHERE qiraat_norm(base_text) <> base_text_normalized) = 0
            THEN 'PASS N1 qiraat_norm matches Python norm on ' || count(*) || ' locations'
            ELSE 'FAIL N1 ' || count(*) FILTER (WHERE qiraat_norm(base_text) <> base_text_normalized) || ' mismatches' END
  FROM qiraat_loci;
SET ROLE authenticated;
RESET ROLE;
SELECT CASE WHEN count(*) FILTER (WHERE qiraat_norm(reading_text) <> reading_text_normalized) = 0
            THEN 'PASS N2 qiraat_norm matches on ' || count(*) || ' reading texts'
            ELSE 'FAIL N2 ' || count(*) FILTER (WHERE qiraat_norm(reading_text) <> reading_text_normalized) || ' mismatches' END
  FROM qiraat_variant_details;
SET ROLE authenticated;

RESET ROLE;
-- Pick test entries.
CREATE TEMP TABLE t AS SELECT
  (SELECT e.id FROM qiraat_entries e JOIN qiraat_qa_flags f ON f.entry_id = e.id AND f.flag_type = 'Q6_AMBIGUOUS' AND f.status = 'open'
    WHERE e.deleted_at IS NULL AND e.review_status = 'flagged'
      AND (SELECT count(*) FROM qiraat_entries x WHERE x.locus_id = e.locus_id AND x.deleted_at IS NULL) = 1
      AND NOT EXISTS (SELECT 1 FROM qiraat_entry_readings r WHERE r.entry_id = e.id AND r.reading_id = 'Q05-R02')
      AND NOT EXISTS (SELECT 1 FROM qiraat_qa_flags g WHERE g.entry_id = e.id AND g.flag_type <> 'Q6_AMBIGUOUS')
    ORDER BY e.id LIMIT 1) AS q6,
  (SELECT e.id FROM qiraat_entries e JOIN qiraat_qa_flags f ON f.entry_id = e.id AND f.flag_type = 'D8_HAFS_KEPT'
    WHERE e.deleted_at IS NULL ORDER BY e.id LIMIT 1) AS d8,
  (SELECT e.id FROM qiraat_entries e WHERE e.kind = 'variant' AND e.review_status = 'unreviewed' AND e.deleted_at IS NULL
      AND (SELECT count(*) FROM qiraat_entries x WHERE x.locus_id = e.locus_id AND x.deleted_at IS NULL) = 1
    ORDER BY e.id LIMIT 1) AS v1;
GRANT SELECT ON t TO authenticated;
CREATE TEMP TABLE t_pages AS
SELECT e.id AS entry_id, qw.page_number AS page FROM qiraat_entries e JOIN qiraat_loci l ON l.id = e.locus_id
  JOIN quran_words qw ON qw.surah = l.surah_number AND qw.ayah = l.start_ayah AND qw.word_position = l.start_word, t
 WHERE e.id IN (t.q6, t.d8, t.v1);
GRANT SELECT ON t_pages TO authenticated;
-- The version a client holds: read from the page payload (qiraat_review_page), never from the table.
CREATE OR REPLACE FUNCTION pg_temp.ver(p_entry text) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT (x->>'version')::timestamptz FROM t_pages tp, jsonb_array_elements(qiraat_review_page(tp.page, true)->'rows') x
   WHERE tp.entry_id = p_entry AND x->>'entryId' = p_entry;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.ver(text) TO authenticated;
CREATE OR REPLACE FUNCTION pg_temp.row_of(p_entry text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT x FROM t_pages tp, jsonb_array_elements(qiraat_review_page(tp.page, true)->'rows') x
   WHERE tp.entry_id = p_entry AND x->>'entryId' = p_entry;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.row_of(text) TO authenticated;
SELECT 'fixtures' AS info, * FROM t;

-- ---------------------------------------------------------------- access control
SET ROLE anon;
SELECT pg_temp.expect('A1 anon cannot call review RPCs', 'SELECT qiraat_review_page(3)', 'permission denied');
RESET ROLE;
SET ROLE authenticated;
SELECT pg_temp.as_user('11111111-1111-4111-8111-111111111111');
SELECT pg_temp.expect('A2 non-editor refused: review page', 'SELECT qiraat_review_page(3)', 'unauthorized');
SELECT pg_temp.expect('A3 non-editor refused: annotation editor create',
  $q$SELECT qiraat_editor_create_annotation('{"startCanonicalKey":"001:002:002","taxonomyId":"7aed6225-50c0-4245-aab8-dc626d788f38","targetAuthorityId":"Q01-R02"}'::jsonb)$q$, 'unauthorized');
SELECT pg_temp.expect('A4 non-editor refused: undo', 'SELECT qiraat_review_undo(1)', 'unauthorized');
RESET ROLE;
SELECT CASE WHEN NOT qiraat_review_is_editor() THEN 'PASS A5 is_editor false for non-editor' ELSE 'FAIL A5' END;
SET ROLE authenticated;
SELECT pg_temp.expect('A6 non-editor cannot read allowlist', 'SELECT count(*) FROM qiraat_editors', 'permission denied');

SELECT pg_temp.as_user('ec34e9cc-7c98-4180-86ce-2b80ac34646e');
RESET ROLE;
SELECT CASE WHEN qiraat_review_is_editor() THEN 'PASS A7 is_editor true for owner' ELSE 'FAIL A7' END;
SET ROLE authenticated;
SELECT pg_temp.expect('A8 editor can use annotation editor catalog', 'SELECT qiraat_editor_catalog()', NULL);

-- ---------------------------------------------------------------- page payload
RESET ROLE;
SELECT CASE WHEN (p->'words') IS NOT NULL AND jsonb_array_length(p->'words') > 100
             AND jsonb_array_length(p->'rows') = (p->'stats'->>'total')::int AND jsonb_array_length(p->'rows') > 0
             AND jsonb_array_length(p->'narrators') = 30
            THEN 'PASS P1 page 3: ' || jsonb_array_length(p->'words') || ' words, ' || jsonb_array_length(p->'rows') || ' rows'
            ELSE 'FAIL P1 ' || left(p::text, 200) END
  FROM (SELECT qiraat_review_page(3) AS p) x;
SET ROLE authenticated;
SELECT CASE WHEN jsonb_array_length(o) = 604 AND (SELECT sum((x->>'total')::int) FROM jsonb_array_elements(o) x) > 15000
            THEN 'PASS P3 overview covers 604 pages' ELSE 'FAIL P3 ' || jsonb_array_length(o) END
  FROM (SELECT qiraat_review_overview() AS o) y;
SELECT pg_temp.expect('P2 invalid page rejected', 'SELECT qiraat_review_page(605)', 'invalid page');

-- ---------------------------------------------------------------- writes (each its own transaction, like one HTTP call)
SELECT pg_temp.expect('W1 stale version rejected',
  format($q$SELECT qiraat_review_set_status(%L, 'reviewed', '2000-01-01'::timestamptz, NULL, 'scratch')$q$, q6), 'VERSION_CONFLICT') FROM t;
SELECT pg_temp.expect('W2 un-flagging a Hafs-positive reading is blocked by D8',
  format($q$SELECT qiraat_review_set_status(%L, 'reviewed', pg_temp.ver(%L), NULL, 'scratch')$q$, d8, d8), 'QIRAAT_D8') FROM t;
SELECT pg_temp.expect('W3 adding Hafs as a main reading is blocked by D8',
  format($q$SELECT qiraat_review_set_narrators(%L, '[{"id":"Q05-R02"}]'::jsonb, pg_temp.ver(%L), 'scratch')$q$, v1, v1), 'QIRAAT_D8') FROM t;
SELECT pg_temp.expect('W4 non-narrator id rejected',
  format($q$SELECT qiraat_review_set_narrators(%L, '[{"id":"Q01"}]'::jsonb, pg_temp.ver(%L), 'scratch')$q$, v1, v1), 'invalid narrator') FROM t;
SELECT pg_temp.expect('W5 farsh entry rejects usul fields',
  format($q$SELECT qiraat_review_update_entry(jsonb_build_object('entryId', %L, 'expectedVersion', pg_temp.ver(%L), 'categoryCode', 'SAKT'))$q$, v1, v1), 'invalid field') FROM t;

-- W6: a Q6-flagged reading, marked reviewed without edits → flag resolved 'verified'.
SELECT qiraat_review_set_status(q6, 'reviewed', pg_temp.ver(q6), 'checked against source', 'scratch-ipad') ->> 'reviewStatus' AS w6 FROM t;
RESET ROLE;
SELECT CASE WHEN (SELECT bool_and(status = 'verified' AND resolved_note = 'checked against source') FROM qiraat_qa_flags f, t WHERE f.entry_id = t.q6)
             AND (SELECT l.review_status FROM qiraat_loci l JOIN qiraat_entries e ON e.locus_id = l.id, t WHERE e.id = t.q6) = 'reviewed'
            THEN 'PASS W6 reviewed → flags verified with note, location reviewed' ELSE 'FAIL W6' END;
SET ROLE authenticated;

-- W7: edit text then review → flag 'corrected'; edit_log carries the device id and actor.
SELECT qiraat_review_set_status(v1, 'flagged', pg_temp.ver(v1), 'يحتاج مراجعة النص', 'scratch-ipad') ->> 'reviewStatus' FROM t;
SELECT qiraat_review_update_entry(jsonb_build_object('entryId', v1, 'expectedVersion', pg_temp.ver(v1),
       'description', 'وصف مصحح', 'deviceId', 'scratch-ipad')) ->> 'description' FROM t;
SELECT qiraat_review_set_status(v1, 'reviewed', pg_temp.ver(v1), NULL, 'scratch-ipad') ->> 'reviewStatus' FROM t;
RESET ROLE;
SELECT CASE WHEN (SELECT status FROM qiraat_qa_flags f, t WHERE f.entry_id = t.v1 AND f.flag_type = 'MANUAL') = 'corrected'
             AND EXISTS (SELECT 1 FROM edit_log l, t WHERE l.row_id = t.v1 AND l.field = 'description_ar' AND l.device_id = 'scratch-ipad'
                          AND l.actor_id = 'ec34e9cc-7c98-4180-86ce-2b80ac34646e')
            THEN 'PASS W7 manual flag raised, edit logged with device+actor, review → corrected' ELSE 'FAIL W7' END;
SET ROLE authenticated;

-- W8: narrators round trip with a second wajh.
SELECT jsonb_array_length(qiraat_review_set_narrators(v1,
         (SELECT jsonb_agg(jsonb_build_object('id', n->>'id', 'action', n->>'action', 'wajhOrder', n->'wajhOrder', 'wajhNote', n->>'wajhNote'))
            FROM jsonb_array_elements(pg_temp.row_of(v1)->'narrators') n)
         || '[{"id":"Q03-R02","wajhOrder":2,"wajhNote":"بخلف عنه"}]'::jsonb,
         pg_temp.ver(v1), 'scratch-ipad') -> 'narrators') AS w8_count FROM t;
RESET ROLE;
SELECT CASE WHEN EXISTS (SELECT 1 FROM qiraat_entry_readings r, t WHERE r.entry_id = t.v1 AND r.reading_id = 'Q03-R02' AND r.wajh_order = 2 AND r.wajh_note = 'بخلف عنه')
            THEN 'PASS W8 second wajh saved and derived into readings' ELSE 'FAIL W8' END;
SET ROLE authenticated;

-- W9: delete the only reading → location soft-deleted too; restore brings both back.
SELECT qiraat_review_delete_entry(v1, pg_temp.ver(v1), 'اختبار', 'scratch-ipad') ->> 'deleted' FROM t;
RESET ROLE;
SELECT CASE WHEN (SELECT l.deleted_at IS NOT NULL FROM qiraat_loci l JOIN qiraat_entries e ON e.locus_id = l.id, t WHERE e.id = t.v1)
            THEN 'PASS W9a deleting the last reading soft-deletes its location' ELSE 'FAIL W9a' END;
SET ROLE authenticated;
SELECT qiraat_review_restore_entry(v1, pg_temp.ver(v1), 'scratch-ipad') ->> 'deleted' FROM t;
RESET ROLE;
SELECT CASE WHEN (SELECT l.deleted_at IS NULL AND e.deleted_at IS NULL FROM qiraat_loci l JOIN qiraat_entries e ON e.locus_id = l.id, t WHERE e.id = t.v1)
            THEN 'PASS W9b restore brings back reading and location' ELSE 'FAIL W9b' END;
SET ROLE authenticated;

-- ---------------------------------------------------------------- history + undo
RESET ROLE;
SELECT CASE WHEN jsonb_array_length(h) >= 6 THEN 'PASS H1 history lists ' || jsonb_array_length(h) || ' review transactions'
            ELSE 'FAIL H1 ' || left(h::text, 200) END
  FROM (SELECT qiraat_review_history((SELECT page FROM t_pages, t WHERE entry_id = t.v1), 50) AS h) x;
SET ROLE authenticated;
-- Undo newest-first: restore, delete, narrators, reviewed, description, flagged → back to original.
CREATE TEMP TABLE undo_list AS
SELECT (x->>'txid')::bigint AS txid, (x->>'at')::timestamptz AS at
  FROM jsonb_array_elements(qiraat_review_history((SELECT page FROM t_pages, t WHERE entry_id = t.v1), 50)) x
 WHERE x->>'entryId' = (SELECT v1 FROM t);
SELECT count(qiraat_review_undo(txid, 'scratch-ipad')) AS undone FROM (SELECT txid FROM undo_list ORDER BY at DESC) s;
RESET ROLE;
SELECT CASE WHEN (SELECT e.review_status = 'unreviewed' AND e.deleted_at IS NULL FROM qiraat_entries e, t WHERE e.id = t.v1)
             AND NOT EXISTS (SELECT 1 FROM qiraat_entry_readings r, t WHERE r.entry_id = t.v1 AND r.reading_id = 'Q03-R02')
             AND (SELECT description_ar FROM qiraat_variant_details d, t WHERE d.entry_id = t.v1) IS DISTINCT FROM 'وصف مصحح'
            THEN 'PASS U1 undoing the review transactions restores status, narrators and text'
            ELSE 'FAIL U1' END;
SET ROLE authenticated;
RESET ROLE;
CREATE TEMP TABLE p3tx AS SELECT min(txid) AS txid FROM edit_log WHERE device_id = 'phase3-migration';
GRANT SELECT ON p3tx TO authenticated;
SET ROLE authenticated;
SELECT pg_temp.expect('U2 the Phase 3 import cannot be undone from the review screen',
  format('SELECT qiraat_review_undo(%s)', (SELECT txid FROM p3tx)), 'UNDO_REFUSED');
RESET ROLE;
