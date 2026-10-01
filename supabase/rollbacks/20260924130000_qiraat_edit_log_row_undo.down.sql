-- ROLLBACK of 20260924130000_qiraat_edit_log_row_undo.sql: restores the Phase 2 field-by-field
-- edit_log_undo_tx() and the non-deferrable (locus_id, kind, entry_order) constraint. Idempotent.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'qiraat_entries_locus_id_kind_entry_order_key' AND condeferrable) THEN
    ALTER TABLE qiraat_entries DROP CONSTRAINT qiraat_entries_locus_id_kind_entry_order_key;
    ALTER TABLE qiraat_entries ADD CONSTRAINT qiraat_entries_locus_id_kind_entry_order_key
      UNIQUE (locus_id, kind, entry_order);
  END IF;
END $$;

-- Verbatim from 20260924120000_qiraat_phase2_review_sync.sql
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

REVOKE ALL ON FUNCTION edit_log_undo_tx(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION edit_log_undo_tx(bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
