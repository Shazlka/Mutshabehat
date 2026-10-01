-- ============================================================================
-- ROLLBACK of 20260924120000_qiraat_phase2_review_sync.sql
-- ============================================================================
-- Returns the V2 entries model to its pre-Phase-2 shape. Idempotent.
-- DATA LOSS WARNING: drops review_status, legacy_ref, deleted_at, device_id, wajh_order/wajh_note,
-- display_code and the whole edit_log. Take a pg_dump -Fc first. Soft-deleted rows become live again
-- (deleted_at is dropped), so hard-delete or restore them before rolling back if that matters.
-- is_default is kept, so the main/further-wajh distinction survives the rollback.
-- ============================================================================

-- 8. Views and review function
DROP FUNCTION IF EXISTS v_page_variants(integer);
DROP VIEW IF EXISTS qiraat_qa_phase2_violations;
DROP VIEW IF EXISTS v_page_variant_rows;
DROP VIEW IF EXISTS variant_reading_narrators;
DROP VIEW IF EXISTS variant_readings;
DROP VIEW IF EXISTS variant_locations;

-- 7. Indexes
DROP INDEX IF EXISTS qiraat_loci_live_page_idx;
DROP INDEX IF EXISTS qiraat_loci_live_surah_ayah_idx;
DROP INDEX IF EXISTS qiraat_entries_live_kind_idx;
DROP INDEX IF EXISTS qiraat_ruling_details_category_entry_idx;
DROP INDEX IF EXISTS qiraat_entries_review_idx;
DROP INDEX IF EXISTS qiraat_entries_updated_idx;
DROP INDEX IF EXISTS qiraat_loci_updated_idx;

-- 6. Rule triggers
DROP TRIGGER IF EXISTS qiraat_entry_readings_rules ON qiraat_entry_readings;
DROP TRIGGER IF EXISTS qiraat_entries_rules        ON qiraat_entries;
DROP TRIGGER IF EXISTS qiraat_ruling_details_rules ON qiraat_ruling_details;
DROP TRIGGER IF EXISTS qiraat_loci_rules           ON qiraat_loci;
DROP FUNCTION IF EXISTS qiraat_check_rules_from_reading();
DROP FUNCTION IF EXISTS qiraat_check_rules_from_entry();
DROP FUNCTION IF EXISTS qiraat_check_rules_from_ruling_detail();
DROP FUNCTION IF EXISTS qiraat_check_rules_from_locus();
DROP FUNCTION IF EXISTS qiraat_assert_entry_hafs_rule(text);
DROP FUNCTION IF EXISTS qiraat_assert_locus_unique_narrators(text);
DROP FUNCTION IF EXISTS qiraat_assert_locus_has_reading(text);

-- 5. display_code
DROP INDEX IF EXISTS qiraat_authorities_display_code_key;
ALTER TABLE qiraat_authorities DROP CONSTRAINT IF EXISTS qiraat_authorities_display_code_format;

-- 4. edit_log (triggers first, so dropping columns below is not logged)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['qiraat_loci', 'qiraat_entries', 'qiraat_entry_authorities',
                           'qiraat_variant_details', 'qiraat_ruling_details', 'qiraat_evidence_texts',
                           'qiraat_evidence_links', 'qiraat_notes', 'qiraat_authorities'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_edit_log', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_sync_stamp', t);
  END LOOP;
END $$;
DROP FUNCTION IF EXISTS edit_log_undo_tx(bigint);
DROP FUNCTION IF EXISTS edit_log_undo(bigint);
DROP FUNCTION IF EXISTS edit_log_capture();
DROP TABLE IF EXISTS edit_log;
DROP FUNCTION IF EXISTS qiraat_sync_stamp();
ALTER TABLE qiraat_authorities DROP COLUMN IF EXISTS display_code;

-- 3. Original rebuild function (verbatim from 20260917120000_qiraat_v2_schema.sql), then wajh columns
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
    INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
    SELECT DISTINCT ON (r.reading_id, COALESCE(ea.action_ar, ''))
           p_entry_id, r.reading_id, COALESCE(ea.action_ar, ''), ea.is_default
      FROM qiraat_entry_authorities ea
      CROSS JOIN LATERAL qiraat_authority_readings(ea.authority_id) r
     WHERE ea.entry_id = p_entry_id
       AND NOT ea.is_exception;

  ELSIF v_mode = 'all_except' THEN
    INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
    SELECT p_entry_id, n.id, '', true
      FROM qiraat_authorities n
     WHERE n.authority_type = 'narrator'
       AND n.id NOT IN (
         SELECT r.reading_id
           FROM qiraat_entry_authorities ea
           CROSS JOIN LATERAL qiraat_authority_readings(ea.authority_id) r
          WHERE ea.entry_id = p_entry_id AND ea.is_exception
       );

  ELSIF v_mode = 'remainder' THEN
    INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
    SELECT p_entry_id, n.id, '', true
      FROM qiraat_authorities n
     WHERE n.authority_type = 'narrator'
       AND n.id NOT IN (
         SELECT er.reading_id
           FROM qiraat_entry_readings er
           JOIN qiraat_entries e ON e.id = er.entry_id
          WHERE e.locus_id = v_locus
            AND e.id <> p_entry_id
       );
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER TABLE qiraat_entry_readings    DROP CONSTRAINT IF EXISTS qiraat_entry_readings_wajh_order_check;
ALTER TABLE qiraat_entry_authorities DROP CONSTRAINT IF EXISTS qiraat_entry_authorities_wajh_order_check;
ALTER TABLE qiraat_entry_readings    DROP COLUMN IF EXISTS wajh_order, DROP COLUMN IF EXISTS wajh_note;
ALTER TABLE qiraat_entry_authorities DROP COLUMN IF EXISTS wajh_order, DROP COLUMN IF EXISTS wajh_note;

-- 2. Sync columns (qiraat_loci / qiraat_entries keep their original updated_at)
ALTER TABLE qiraat_loci    DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS device_id;
ALTER TABLE qiraat_entries DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS device_id;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['qiraat_entry_authorities', 'qiraat_variant_details', 'qiraat_ruling_details',
                           'qiraat_evidence_texts', 'qiraat_evidence_links', 'qiraat_notes'] LOOP
    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS updated_at, DROP COLUMN IF EXISTS deleted_at,
                    DROP COLUMN IF EXISTS device_id', t);
  END LOOP;
END $$;

-- 1. review_status + legacy_ref
ALTER TABLE qiraat_loci    DROP COLUMN IF EXISTS review_status, DROP COLUMN IF EXISTS legacy_ref;
ALTER TABLE qiraat_entries DROP COLUMN IF EXISTS review_status, DROP COLUMN IF EXISTS legacy_ref;
DROP TYPE IF EXISTS qiraat_review_status;

NOTIFY pgrst, 'reload schema';
