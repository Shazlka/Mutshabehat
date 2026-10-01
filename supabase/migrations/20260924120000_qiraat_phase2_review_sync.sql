-- ============================================================================
-- Qiraat DB restructure, Phase 2: review status, sync columns, edit log, D8 rules
-- ============================================================================
-- ADDITIVE changes to the V2 entries model (docs/qiraat/QIRAAT_AUDIT.md §9, decision Q1).
-- No table is renamed or dropped, and no religious data row is inserted, deleted or rewritten.
-- quran_words is not touched.
--
-- What this adds:
--   1. review_status (unreviewed | reviewed | flagged) and legacy_ref on qiraat_loci / qiraat_entries.
--   2. updated_at / deleted_at / device_id on every editable qiraat table (D6, iOS sync).
--   3. wajh_order / wajh_note on attributions and derived readings (Q13).
--   4. edit_log + capture triggers + edit_log_undo() / edit_log_undo_tx() (D7).
--   5. display_code on qiraat_authorities (Q5) with the proposed code list.
--   6. Deferred constraint triggers:
--        a. D8/Q13: Q05-R02 (Hafs) may appear in a reading only as wajh_order >= 2 with a wajh_note.
--        b. One narrator per reading per location (per kind + category) unless it is a separate wajh.
--        c. At least one reading per location.
--      They fire on writes only, so existing rows are not re-checked here. Rows marked
--      review_status = 'flagged' are the quarantine and are exempt from (a) and (b); soft-deleted
--      and REJECTED rows are ignored. qiraat_qa_phase2_violations lists every existing violation.
--   7. Indexes on (page), (surah, ayah), (kind, category).
--   8. Views variant_locations / variant_readings / variant_reading_narrators / v_page_variant_rows
--      and function v_page_variants(page) for the review table (D5, D9).
--
-- Rollback: supabase/rollbacks/20260924120000_qiraat_phase2_review_sync.down.sql
-- Apply only after a pg_dump -Fc backup:
--   docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < this.sql
-- Idempotent: safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. review_status + legacy_ref
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE qiraat_review_status AS ENUM ('unreviewed', 'reviewed', 'flagged');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE qiraat_loci
  ADD COLUMN IF NOT EXISTS review_status qiraat_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS legacy_ref    text;
ALTER TABLE qiraat_entries
  ADD COLUMN IF NOT EXISTS review_status qiraat_review_status NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS legacy_ref    text;

-- ----------------------------------------------------------------------------
-- 2. Sync columns (D6). qiraat_loci / qiraat_entries already have updated_at.
-- ----------------------------------------------------------------------------
ALTER TABLE qiraat_loci
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id  text;
ALTER TABLE qiraat_entries
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id  text;
ALTER TABLE qiraat_entry_authorities
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id  text;
ALTER TABLE qiraat_variant_details
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id  text;
ALTER TABLE qiraat_ruling_details
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id  text;
ALTER TABLE qiraat_evidence_texts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id  text;
ALTER TABLE qiraat_evidence_links
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id  text;
ALTER TABLE qiraat_notes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_id  text;

-- Stamp updated_at on every write, and take device_id from the session (SET LOCAL app.device_id)
-- when the writer did not supply one.
CREATE OR REPLACE FUNCTION qiraat_sync_stamp()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_device text := nullif(current_setting('app.device_id', true), '');
BEGIN
  NEW.updated_at := now();
  IF v_device IS NOT NULL THEN NEW.device_id := v_device; END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['qiraat_loci', 'qiraat_entries', 'qiraat_entry_authorities',
                           'qiraat_variant_details', 'qiraat_ruling_details', 'qiraat_evidence_texts',
                           'qiraat_evidence_links', 'qiraat_notes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_sync_stamp', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I
                      FOR EACH ROW EXECUTE FUNCTION qiraat_sync_stamp()', t || '_sync_stamp', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. wajh_order / wajh_note (Q13). wajh_order 1 = the narrator's main wajh, >= 2 = a further wajh.
--    Existing is_default = false rows become wajh_order 2; is_default stays in step via CHECK.
-- ----------------------------------------------------------------------------
ALTER TABLE qiraat_entry_authorities
  ADD COLUMN IF NOT EXISTS wajh_order smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS wajh_note  text;
ALTER TABLE qiraat_entry_readings
  ADD COLUMN IF NOT EXISTS wajh_order smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS wajh_note  text;

-- Backfill without firing the locus rebuild (the readings are updated directly, identically).
ALTER TABLE qiraat_entry_authorities DISABLE TRIGGER qiraat_entry_authorities_sync_trg;
UPDATE qiraat_entry_authorities SET wajh_order = 2 WHERE NOT is_default AND wajh_order = 1;
ALTER TABLE qiraat_entry_authorities ENABLE TRIGGER qiraat_entry_authorities_sync_trg;
UPDATE qiraat_entry_readings SET wajh_order = 2 WHERE NOT is_default AND wajh_order = 1;

DO $$ BEGIN
  ALTER TABLE qiraat_entry_authorities ADD CONSTRAINT qiraat_entry_authorities_wajh_order_check
    CHECK (wajh_order >= 1 AND is_default = (wajh_order = 1));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE qiraat_entry_readings ADD CONSTRAINT qiraat_entry_readings_wajh_order_check
    CHECK (wajh_order >= 1 AND is_default = (wajh_order = 1));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rebuild now (a) carries wajh_order / wajh_note into the derived readings, (b) ignores soft-deleted
-- attributions, and (c) never adds Hafs (Q05-R02) implicitly: under D8 a narrator who reads like
-- Hafs is implied, so "all except" / "الباقون" expansions leave Hafs out.
CREATE OR REPLACE FUNCTION qiraat_rebuild_entry_readings(p_entry_id text)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_mode    qiraat_attribution_mode;
  v_locus   text;
  v_count   integer;
BEGIN
  SELECT attribution_mode, locus_id INTO v_mode, v_locus
    FROM qiraat_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'qiraat_rebuild_entry_readings: unknown entry %', p_entry_id;
  END IF;

  DELETE FROM qiraat_entry_readings WHERE entry_id = p_entry_id;

  IF v_mode = 'explicit' THEN
    INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default, wajh_order, wajh_note)
    SELECT DISTINCT ON (r.reading_id, COALESCE(ea.action_ar, ''))
           p_entry_id, r.reading_id, COALESCE(ea.action_ar, ''), ea.is_default, ea.wajh_order, ea.wajh_note
      FROM qiraat_entry_authorities ea
      CROSS JOIN LATERAL qiraat_authority_readings(ea.authority_id) r
     WHERE ea.entry_id = p_entry_id
       AND NOT ea.is_exception
       AND ea.deleted_at IS NULL
     ORDER BY r.reading_id, COALESCE(ea.action_ar, ''), ea.wajh_order;

  ELSIF v_mode = 'all_except' THEN
    INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
    SELECT p_entry_id, n.id, '', true
      FROM qiraat_authorities n
     WHERE n.authority_type = 'narrator'
       AND n.id <> 'Q05-R02'
       AND n.id NOT IN (
         SELECT r.reading_id
           FROM qiraat_entry_authorities ea
           CROSS JOIN LATERAL qiraat_authority_readings(ea.authority_id) r
          WHERE ea.entry_id = p_entry_id AND ea.is_exception AND ea.deleted_at IS NULL
       );

  ELSIF v_mode = 'remainder' THEN
    INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
    SELECT p_entry_id, n.id, '', true
      FROM qiraat_authorities n
     WHERE n.authority_type = 'narrator'
       AND n.id <> 'Q05-R02'
       AND n.id NOT IN (
         SELECT er.reading_id
           FROM qiraat_entry_readings er
           JOIN qiraat_entries e ON e.id = er.entry_id
          WHERE e.locus_id = v_locus
            AND e.id <> p_entry_id
            AND e.deleted_at IS NULL
       );
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. edit_log (D7): one row per changed field on UPDATE, one row per INSERT / DELETE.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name  text        NOT NULL,
  row_id      text        NOT NULL,                     -- primary key rendered as text
  row_pk      jsonb       NOT NULL,                     -- {pk column: value}, used by undo
  op          text        NOT NULL CHECK (op IN ('INSERT', 'UPDATE', 'DELETE')),
  field       text,                                     -- changed column (UPDATE only)
  old_value   jsonb,                                    -- field value, or whole row for DELETE
  new_value   jsonb,                                    -- field value, or whole row for INSERT
  changed_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  device_id   text,
  actor_id    uuid,
  txid        bigint      NOT NULL DEFAULT txid_current(),
  undo_of     bigint REFERENCES edit_log(id),           -- set on rows written by an undo
  undone_at   timestamptz,                              -- set on the row that was undone
  CONSTRAINT edit_log_field_matches_op CHECK ((op = 'UPDATE') = (field IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS edit_log_row_idx  ON edit_log (table_name, row_id, id DESC);
CREATE INDEX IF NOT EXISTS edit_log_txid_idx ON edit_log (txid);
CREATE INDEX IF NOT EXISTS edit_log_time_idx ON edit_log (changed_at);

ALTER TABLE edit_log ENABLE ROW LEVEL SECURITY;          -- no policies: service role / owner only
REVOKE ALL ON edit_log FROM anon, authenticated;

-- Trigger arguments are the table's primary-key columns.
-- SET LOCAL app.edit_log = 'off' skips logging (bulk imports, which log in their own report).
CREATE OR REPLACE FUNCTION edit_log_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old    jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
  v_new    jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
  v_row    jsonb := COALESCE(v_new, v_old);
  v_pk     jsonb := '{}'::jsonb;
  v_rowid  text;
  v_col    text;
  v_device text := COALESCE(nullif(current_setting('app.device_id', true), ''), v_row->>'device_id');
  v_undo   bigint := nullif(current_setting('app.edit_log_undo_of', true), '')::bigint;
  v_actor  uuid;
BEGIN
  IF current_setting('app.edit_log', true) = 'off' THEN RETURN NULL; END IF;
  BEGIN v_actor := auth.uid(); EXCEPTION WHEN OTHERS THEN v_actor := NULL; END;

  FOREACH v_col IN ARRAY TG_ARGV LOOP
    v_pk    := v_pk || jsonb_build_object(v_col, v_row->v_col);
    v_rowid := concat_ws('|', v_rowid, v_row->>v_col);
  END LOOP;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO edit_log (table_name, row_id, row_pk, op, field, old_value, new_value, device_id, actor_id, undo_of)
    SELECT TG_TABLE_NAME, v_rowid, v_pk, 'UPDATE', n.key, v_old->n.key, n.value, v_device, v_actor, v_undo
      FROM jsonb_each(v_new) n
     WHERE n.key NOT IN ('updated_at', 'device_id')
       AND n.value IS DISTINCT FROM v_old->n.key;
  ELSE
    INSERT INTO edit_log (table_name, row_id, row_pk, op, old_value, new_value, device_id, actor_id, undo_of)
    VALUES (TG_TABLE_NAME, v_rowid, v_pk, TG_OP, v_old, v_new, v_device, v_actor, v_undo);
  END IF;
  RETURN NULL;
END;
$$;

DO $$
DECLARE r record;
BEGIN
  -- entry_readings is derived from entry_authorities (rebuilt by trigger), so it is not logged.
  FOR r IN SELECT * FROM (VALUES
      ('qiraat_loci', 'id'), ('qiraat_entries', 'id'), ('qiraat_entry_authorities', 'id'),
      ('qiraat_variant_details', 'entry_id'), ('qiraat_ruling_details', 'entry_id'),
      ('qiraat_evidence_texts', 'id'), ('qiraat_evidence_links', 'id'), ('qiraat_notes', 'id'),
      ('qiraat_authorities', 'id')) AS t(tbl, pk)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', r.tbl || '_edit_log', r.tbl);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I
                      FOR EACH ROW EXECUTE FUNCTION edit_log_capture(%L)', r.tbl || '_edit_log', r.tbl, r.pk);
  END LOOP;
END $$;

-- Undo one edit_log row. Refuses when the row was changed again since (UNDO_CONFLICT).
-- The undo itself is logged, with undo_of pointing at the row it reverses.
CREATE OR REPLACE FUNCTION edit_log_undo(p_log_id bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  l        edit_log;
  v_where  text;
  v_cur    jsonb;
  v_soft   boolean;
BEGIN
  SELECT * INTO l FROM edit_log WHERE id = p_log_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'edit_log_undo: unknown edit_log row %', p_log_id; END IF;
  IF l.undone_at IS NOT NULL THEN RAISE EXCEPTION 'edit_log_undo: row % already undone', p_log_id; END IF;

  SELECT string_agg(format('t.%I::text = %L', key, value #>> '{}'), ' AND ')
    INTO v_where FROM jsonb_each(l.row_pk);
  PERFORM set_config('app.edit_log_undo_of', p_log_id::text, true);

  IF l.op = 'UPDATE' THEN
    EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %s', l.table_name, v_where) INTO v_cur;
    IF v_cur IS NULL OR (v_cur->l.field) IS DISTINCT FROM l.new_value THEN
      RAISE EXCEPTION 'UNDO_CONFLICT %.% on % changed since edit_log %', l.table_name, l.field, l.row_id, p_log_id;
    END IF;
    EXECUTE format('UPDATE %I t SET %I = (jsonb_populate_record(NULL::%I, jsonb_build_object(%L, $1))).%I WHERE %s',
                   l.table_name, l.field, l.table_name, l.field, l.field, v_where)
      USING l.old_value;

  ELSIF l.op = 'INSERT' THEN
    -- Tables with deleted_at are soft-deleted so the removal syncs; others are deleted.
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = l.table_name AND column_name = 'deleted_at')
      INTO v_soft;
    IF v_soft THEN
      EXECUTE format('UPDATE %I t SET deleted_at = now() WHERE %s AND t.deleted_at IS NULL', l.table_name, v_where);
    ELSE
      EXECUTE format('DELETE FROM %I t WHERE %s', l.table_name, v_where);
    END IF;

  ELSE  -- DELETE: put the row back exactly as it was
    EXECUTE format('INSERT INTO %I OVERRIDING SYSTEM VALUE SELECT (jsonb_populate_record(NULL::%I, $1)).*',
                   l.table_name, l.table_name)
      USING l.old_value;
  END IF;

  UPDATE edit_log SET undone_at = clock_timestamp() WHERE id = p_log_id;
  PERFORM set_config('app.edit_log_undo_of', '', true);
END;
$$;

-- Undo every change made by one transaction: updates and inserts newest first, then deleted rows
-- parents first (so foreign keys are satisfied). Returns the number of edit_log rows undone.
CREATE OR REPLACE FUNCTION edit_log_undo_tx(p_txid bigint)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v_id bigint; v_n integer := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM edit_log
     WHERE txid = p_txid AND undone_at IS NULL AND undo_of IS NULL
     ORDER BY (op = 'DELETE'),
              CASE WHEN op <> 'DELETE' THEN -id END,
              CASE table_name WHEN 'qiraat_authorities' THEN 0 WHEN 'qiraat_evidence_texts' THEN 1
                              WHEN 'qiraat_loci' THEN 2 WHEN 'qiraat_entries' THEN 3 ELSE 4 END,
              id
  LOOP
    PERFORM edit_log_undo(v_id);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION edit_log_undo(bigint), edit_log_undo_tx(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION edit_log_undo(bigint), edit_log_undo_tx(bigint) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. display_code (Q5). Keys stay Q01 / Q01-R01; this is the human-facing code.
-- ----------------------------------------------------------------------------
ALTER TABLE qiraat_authorities ADD COLUMN IF NOT EXISTS display_code text;
DO $$ BEGIN
  ALTER TABLE qiraat_authorities ADD CONSTRAINT qiraat_authorities_display_code_format
    CHECK (display_code ~ '^[A-Z]{3}(-[A-Z]{3}){0,2}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS qiraat_authorities_display_code_key ON qiraat_authorities (display_code);

UPDATE qiraat_authorities a
   SET display_code = v.code
  FROM (VALUES
    ('Q01', 'NAF'), ('Q01-R01', 'NAF-QAL'), ('Q01-R02', 'NAF-WAR'),
    ('Q02', 'IKT'), ('Q02-R01', 'IKT-BAZ'), ('Q02-R02', 'IKT-QUN'),
    ('Q03', 'ABA'), ('Q03-R01', 'ABA-DUR'), ('Q03-R02', 'ABA-SUS'),
    ('Q04', 'IAM'), ('Q04-R01', 'IAM-HSH'), ('Q04-R02', 'IAM-IDH'),
    ('Q05', 'ASM'), ('Q05-R01', 'ASM-SHU'), ('Q05-R02', 'ASM-HAF'),
    ('Q06', 'HAM'), ('Q06-R01', 'HAM-KHL'), ('Q06-R02', 'HAM-KLD'),
    ('Q07', 'KIS'), ('Q07-R01', 'KIS-ABH'), ('Q07-R02', 'KIS-DUR'),
    ('Q08', 'AJF'), ('Q08-R01', 'AJF-IWR'), ('Q08-R02', 'AJF-IJM'),
    ('Q09', 'YAQ'), ('Q09-R01', 'YAQ-RWS'), ('Q09-R02', 'YAQ-RWH'),
    ('Q10', 'KHF'), ('Q10-R01', 'KHF-ISH'), ('Q10-R02', 'KHF-IDR')
  ) AS v(id, code)
 WHERE a.id = v.id AND a.display_code IS DISTINCT FROM v.code;

-- ----------------------------------------------------------------------------
-- 6. Deferred rule checks. Each check reads the committed-to-be state, so the delete-then-insert
--    rebuild of qiraat_entry_readings inside one transaction is fine.
--    "Live" entry = not soft-deleted, not REJECTED. Flagged entries are exempt from 6a and 6b.
-- ----------------------------------------------------------------------------

-- 6a. D8 + Q13: Hafs appears only as a further wajh, with a note.
CREATE OR REPLACE FUNCTION qiraat_assert_entry_hafs_rule(p_entry_id text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM qiraat_entry_readings er
      JOIN qiraat_entries e ON e.id = er.entry_id
     WHERE er.entry_id = p_entry_id
       AND er.reading_id = 'Q05-R02'
       AND e.deleted_at IS NULL
       AND e.verification_status <> 'REJECTED'
       AND e.review_status <> 'flagged'
       AND NOT (er.wajh_order >= 2 AND nullif(btrim(er.wajh_note), '') IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'QIRAAT_D8: entry % lists Hafs (Q05-R02) as a main reading; Hafs is the baseline and may only appear with wajh_order >= 2 and a wajh_note', p_entry_id
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- 6b. A narrator has one main wajh per location, per kind (فرش / أصول) and per أصول category.
--     Further appearances must carry wajh_order >= 2.
CREATE OR REPLACE FUNCTION qiraat_assert_locus_unique_narrators(p_locus_id text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(format('%s (%s%s)', reading_id, kind, COALESCE('/' || category_code, '')), ', ')
    INTO v_bad
    FROM (
      SELECT er.reading_id, e.kind, rd.category_code
        FROM qiraat_entries e
        JOIN qiraat_entry_readings er ON er.entry_id = e.id
        LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
       WHERE e.locus_id = p_locus_id
         AND e.deleted_at IS NULL
         AND e.verification_status <> 'REJECTED'
         AND e.review_status <> 'flagged'
         AND er.wajh_order = 1
       GROUP BY er.reading_id, e.kind, rd.category_code
      HAVING count(*) > 1
    ) d;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'QIRAAT_NARRATOR_TWICE: locus % has a narrator in two readings without a separate wajh: %', p_locus_id, v_bad
      USING ERRCODE = 'unique_violation';
  END IF;
END;
$$;

-- 6c. A live location has at least one reading (count-school entries such as AYAH_COUNT count).
CREATE OR REPLACE FUNCTION qiraat_assert_locus_has_reading(p_locus_id text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM qiraat_loci WHERE id = p_locus_id AND deleted_at IS NULL)
     AND NOT EXISTS (
       SELECT 1
         FROM qiraat_entries e
        WHERE e.locus_id = p_locus_id
          AND e.deleted_at IS NULL
          AND e.verification_status <> 'REJECTED'
          AND (EXISTS (SELECT 1 FROM qiraat_entry_readings er WHERE er.entry_id = e.id)
               OR EXISTS (SELECT 1 FROM qiraat_entry_count_schools cs WHERE cs.entry_id = e.id)))
  THEN
    RAISE EXCEPTION 'QIRAAT_EMPTY_LOCUS: location % has no reading', p_locus_id
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- The checks run as definer so row-level security never hides rows from them.
REVOKE ALL ON FUNCTION qiraat_assert_entry_hafs_rule(text), qiraat_assert_locus_unique_narrators(text),
  qiraat_assert_locus_has_reading(text) FROM PUBLIC, anon, authenticated;

-- Trigger adapters: find the affected entry / locus and run the checks.
CREATE OR REPLACE FUNCTION qiraat_check_rules_from_reading()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_row qiraat_entry_readings := COALESCE(NEW, OLD); v_locus text;
BEGIN
  SELECT locus_id INTO v_locus FROM qiraat_entries WHERE id = v_row.entry_id;
  IF v_locus IS NULL THEN RETURN NULL; END IF;       -- entry itself was deleted
  IF TG_OP <> 'DELETE' THEN
    PERFORM qiraat_assert_entry_hafs_rule(v_row.entry_id);
    PERFORM qiraat_assert_locus_unique_narrators(v_locus);
  END IF;
  PERFORM qiraat_assert_locus_has_reading(v_locus);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION qiraat_check_rules_from_entry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'DELETE' THEN
    PERFORM qiraat_assert_entry_hafs_rule(NEW.id);
    PERFORM qiraat_assert_locus_unique_narrators(NEW.locus_id);
    PERFORM qiraat_assert_locus_has_reading(NEW.locus_id);
  END IF;
  IF TG_OP <> 'INSERT' THEN
    PERFORM qiraat_assert_locus_has_reading(OLD.locus_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION qiraat_check_rules_from_ruling_detail()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_locus text;
BEGIN
  SELECT locus_id INTO v_locus FROM qiraat_entries WHERE id = NEW.entry_id;
  IF v_locus IS NOT NULL THEN PERFORM qiraat_assert_locus_unique_narrators(v_locus); END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION qiraat_check_rules_from_locus()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM qiraat_assert_locus_has_reading(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS qiraat_entry_readings_rules ON qiraat_entry_readings;
CREATE CONSTRAINT TRIGGER qiraat_entry_readings_rules
  AFTER INSERT OR UPDATE OR DELETE ON qiraat_entry_readings
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION qiraat_check_rules_from_reading();

DROP TRIGGER IF EXISTS qiraat_entries_rules ON qiraat_entries;
CREATE CONSTRAINT TRIGGER qiraat_entries_rules
  AFTER INSERT OR UPDATE OF locus_id, kind, review_status, deleted_at, verification_status OR DELETE ON qiraat_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION qiraat_check_rules_from_entry();

DROP TRIGGER IF EXISTS qiraat_ruling_details_rules ON qiraat_ruling_details;
CREATE CONSTRAINT TRIGGER qiraat_ruling_details_rules
  AFTER INSERT OR UPDATE OF category_code ON qiraat_ruling_details
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION qiraat_check_rules_from_ruling_detail();

DROP TRIGGER IF EXISTS qiraat_loci_rules ON qiraat_loci;
CREATE CONSTRAINT TRIGGER qiraat_loci_rules
  AFTER INSERT OR UPDATE OF deleted_at ON qiraat_loci
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION qiraat_check_rules_from_locus();

-- ----------------------------------------------------------------------------
-- 7. Indexes: (page), (surah, ayah), (kind, category), review queue
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS qiraat_loci_live_page_idx
  ON qiraat_loci (page_id, location_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS qiraat_loci_live_surah_ayah_idx
  ON qiraat_loci (surah_number, start_ayah) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS qiraat_entries_live_kind_idx
  ON qiraat_entries (kind, locus_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS qiraat_ruling_details_category_entry_idx
  ON qiraat_ruling_details (category_code, entry_id);
CREATE INDEX IF NOT EXISTS qiraat_entries_review_idx
  ON qiraat_entries (review_status) WHERE review_status <> 'reviewed' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS qiraat_entries_updated_idx ON qiraat_entries (updated_at);
CREATE INDEX IF NOT EXISTS qiraat_loci_updated_idx    ON qiraat_loci (updated_at);

-- ----------------------------------------------------------------------------
-- 8. Views. security_invoker keeps the base tables' RLS (published-only for anon) in force.
-- ----------------------------------------------------------------------------

-- A location with its exact Hafs text taken from quran_words (never retyped) and its true
-- Madani page (the page of its first word).
CREATE OR REPLACE VIEW variant_locations WITH (security_invoker = true) AS
SELECT
  l.id                       AS location_id,
  sw.page_number             AS page,
  l.surah_number             AS surah,
  l.start_ayah               AS ayah,
  l.start_word,
  l.end_ayah,
  COALESCE(l.end_word, l.start_word) AS end_word,
  sw.id                      AS word_start_id,
  ew.id                      AS word_end_id,
  sw.canonical_key           AS start_canonical_key,
  ew.canonical_key           AS end_canonical_key,
  (SELECT string_agg(qw.text_uthmani, ' ' ORDER BY qw.ayah, qw.word_position)
     FROM quran_words qw
    WHERE qw.surah = l.surah_number
      AND (qw.ayah, qw.word_position) >= (l.start_ayah, l.start_word)
      AND (qw.ayah, qw.word_position) <= (l.end_ayah, COALESCE(l.end_word, l.start_word))
  )                          AS hafs_text,
  l.base_text,
  l.location_order,
  l.review_status,
  l.legacy_ref,
  l.notes,
  l.updated_at,
  l.device_id
FROM qiraat_loci l
LEFT JOIN quran_words sw ON sw.surah = l.surah_number AND sw.ayah = l.start_ayah AND sw.word_position = l.start_word
LEFT JOIN quran_words ew ON ew.surah = l.surah_number AND ew.ayah = l.end_ayah
                        AND ew.word_position = COALESCE(l.end_word, l.start_word)
WHERE l.deleted_at IS NULL;

-- One reading (وجه) at a location: فرش = variant entries, أصول = ruling entries.
CREATE OR REPLACE VIEW variant_readings WITH (security_invoker = true) AS
SELECT
  e.id                  AS reading_id,
  e.locus_id            AS location_id,
  CASE e.kind WHEN 'variant' THEN 'farsh' ELSE 'usul' END AS kind,
  rd.category_code,
  c.name_ar             AS category_name_ar,
  vd.reading_text,                                -- فرش form; أصول actions are per narrator
  COALESCE(vd.description_ar, rd.text_ar)        AS description_ar,
  vd.variant_type,
  vd.performance_note,
  rd.options,
  e.entry_order,
  e.verification_status,
  e.review_status,
  e.legacy_ref,
  e.notes,
  e.updated_at,
  e.device_id
FROM qiraat_entries e
LEFT JOIN qiraat_variant_details vd ON vd.entry_id = e.id
LEFT JOIN qiraat_ruling_details  rd ON rd.entry_id = e.id
LEFT JOIN qiraat_categories      c  ON c.code = rd.category_code
WHERE e.deleted_at IS NULL
  AND e.verification_status <> 'REJECTED';

CREATE OR REPLACE VIEW variant_reading_narrators WITH (security_invoker = true) AS
SELECT
  er.entry_id           AS reading_id,
  er.reading_id         AS narrator_id,
  a.display_code,
  a.name_ar,
  a.parent_id           AS reader_id,
  er.action_ar,
  er.wajh_order,
  er.wajh_note
FROM qiraat_entry_readings er
JOIN qiraat_authorities a ON a.id = er.reading_id;

-- Rows for the page review table (D5/D9). Narrators who read like Hafs are implied, not listed.
-- AYAH_COUNT (count schools) stays out of the review table.
CREATE OR REPLACE VIEW v_page_variant_rows WITH (security_invoker = true) AS
SELECT
  vl.page,
  vl.location_id,
  vr.reading_id,
  vl.surah,
  vl.ayah,
  vl.start_word,
  vl.end_ayah,
  vl.end_word,
  vl.start_canonical_key,
  vl.end_canonical_key,
  vl.hafs_text,
  vr.kind,
  vr.category_code,
  vr.category_name_ar,
  vr.reading_text,
  vr.description_ar,
  vr.performance_note,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', n.narrator_id, 'code', n.display_code, 'nameAr', n.name_ar,
             'action', nullif(n.action_ar, ''), 'wajhOrder', n.wajh_order, 'wajhNote', n.wajh_note)
           ORDER BY n.narrator_id, n.wajh_order)
      FROM variant_reading_narrators n WHERE n.reading_id = vr.reading_id), '[]'::jsonb) AS narrators,
  vr.verification_status,
  vr.review_status,
  vl.review_status      AS location_review_status,
  COALESCE(vr.legacy_ref, vl.legacy_ref) AS legacy_ref,
  greatest(vr.updated_at, vl.updated_at) AS updated_at,
  COALESCE(vl.location_order, 0) AS location_order,
  vr.entry_order
FROM variant_locations vl
JOIN variant_readings vr ON vr.location_id = vl.location_id
WHERE vr.category_code IS DISTINCT FROM 'AYAH_COUNT';

CREATE OR REPLACE FUNCTION v_page_variants(p_page integer)
RETURNS SETOF v_page_variant_rows
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT *
    FROM v_page_variant_rows
   WHERE page = p_page
   ORDER BY ayah, start_word, kind, category_code NULLS FIRST, entry_order, reading_id;
$$;

-- Every existing row that breaks a Phase 2 rule. Phase 3 must bring this to zero (flagged rows
-- are listed but are allowed to remain while under review).
CREATE OR REPLACE VIEW qiraat_qa_phase2_violations WITH (security_invoker = true) AS
SELECT 'D8_HAFS_MAIN_READING'::text AS rule, e.locus_id, e.id AS entry_id, e.review_status,
       'Q05-R02'::text AS detail
  FROM qiraat_entries e
  JOIN qiraat_entry_readings er ON er.entry_id = e.id
 WHERE er.reading_id = 'Q05-R02'
   AND e.deleted_at IS NULL AND e.verification_status <> 'REJECTED'
   AND NOT (er.wajh_order >= 2 AND nullif(btrim(er.wajh_note), '') IS NOT NULL)
UNION ALL
SELECT 'NARRATOR_TWICE', d.locus_id, NULL, NULL,
       d.reading_id || ' ' || d.kind || COALESCE('/' || d.category_code, '')
  FROM (
    SELECT e.locus_id, er.reading_id, e.kind::text AS kind, rd.category_code
      FROM qiraat_entries e
      JOIN qiraat_entry_readings er ON er.entry_id = e.id
      LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
     WHERE e.deleted_at IS NULL AND e.verification_status <> 'REJECTED' AND er.wajh_order = 1
     GROUP BY e.locus_id, er.reading_id, e.kind, rd.category_code
    HAVING count(*) > 1) d
UNION ALL
SELECT 'EMPTY_LOCATION', l.id, NULL, l.review_status, l.base_text
  FROM qiraat_loci l
 WHERE l.deleted_at IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM qiraat_entries e
      WHERE e.locus_id = l.id AND e.deleted_at IS NULL AND e.verification_status <> 'REJECTED'
        AND (EXISTS (SELECT 1 FROM qiraat_entry_readings er WHERE er.entry_id = e.id)
             OR EXISTS (SELECT 1 FROM qiraat_entry_count_schools cs WHERE cs.entry_id = e.id)));

GRANT SELECT ON variant_locations, variant_readings, variant_reading_narrators, v_page_variant_rows
  TO anon, authenticated, service_role;
REVOKE ALL ON qiraat_qa_phase2_violations FROM anon, authenticated;
GRANT SELECT ON qiraat_qa_phase2_violations TO service_role;
GRANT EXECUTE ON FUNCTION v_page_variants(integer) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
