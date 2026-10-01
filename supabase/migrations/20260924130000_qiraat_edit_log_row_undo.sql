-- ============================================================================
-- Qiraat Phase 2.1: undo a transaction row by row (fix for edit_log_undo_tx)
-- ============================================================================
-- Found while testing Phase 3 on scratch: edit_log_undo_tx() restored one FIELD per statement.
-- A row whose coupled fields changed together (is_default + wajh_order, bound by
-- qiraat_entry_authorities_wajh_order_check) failed its CHECK halfway, and swapped entry_order
-- values collided on qiraat_entries_locus_id_kind_entry_order_key.
--
-- Changes:
--   1. edit_log_undo_tx() now restores all fields a transaction changed on a row in ONE update
--      (earliest old value per field; conflict check against the latest new value per field).
--   2. qiraat_entries (locus_id, kind, entry_order) is re-created DEFERRABLE INITIALLY IMMEDIATE,
--      so an undo (or a reorder) may swap orders inside one transaction. Nothing uses it as an
--      ON CONFLICT arbiter. Normal statements still check it immediately.
-- Rollback: supabase/rollbacks/20260924130000_qiraat_edit_log_row_undo.down.sql
-- Idempotent.
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'qiraat_entries_locus_id_kind_entry_order_key' AND NOT condeferrable) THEN
    ALTER TABLE qiraat_entries DROP CONSTRAINT qiraat_entries_locus_id_kind_entry_order_key;
    ALTER TABLE qiraat_entries ADD CONSTRAINT qiraat_entries_locus_id_kind_entry_order_key
      UNIQUE (locus_id, kind, entry_order) DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION edit_log_undo_tx(p_txid bigint)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  g        record;
  v_where  text;
  v_set    text;
  v_cur    jsonb;
  v_id     bigint;
  v_n      integer := 0;
BEGIN
  SET CONSTRAINTS qiraat_entries_locus_id_kind_entry_order_key DEFERRED;

  -- 1. Updates: one statement per row, newest row first.
  FOR g IN
    WITH f AS (
      SELECT table_name, row_id, row_pk, field,
             (array_agg(old_value ORDER BY id))[1]      AS first_old,
             (array_agg(new_value ORDER BY id DESC))[1] AS last_new,
             max(id)                                    AS last_id,
             array_agg(id)                              AS ids
        FROM edit_log
       WHERE txid = p_txid AND op = 'UPDATE' AND undone_at IS NULL AND undo_of IS NULL
       GROUP BY table_name, row_id, row_pk, field
    )
    SELECT table_name, row_id, row_pk,
           jsonb_object_agg(field, first_old) AS old_values,
           jsonb_object_agg(field, last_new)  AS new_values,
           max(last_id)                       AS last_id,
           array_agg(DISTINCT i)              AS ids
      FROM f, unnest(f.ids) AS i
     GROUP BY table_name, row_id, row_pk
     ORDER BY max(last_id) DESC
  LOOP
    SELECT string_agg(format('t.%I::text = %L', key, value #>> '{}'), ' AND ')
      INTO v_where FROM jsonb_each(g.row_pk);
    EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %s', g.table_name, v_where) INTO v_cur;
    IF v_cur IS NULL OR EXISTS (SELECT 1 FROM jsonb_each(g.new_values) n
                                 WHERE (v_cur -> n.key) IS DISTINCT FROM n.value) THEN
      RAISE EXCEPTION 'UNDO_CONFLICT % row % changed since transaction %', g.table_name, g.row_id, p_txid;
    END IF;
    SELECT string_agg(format('%I = r.%I', k, k), ', ') INTO v_set FROM jsonb_object_keys(g.old_values) k;
    PERFORM set_config('app.edit_log_undo_of', g.last_id::text, true);
    EXECUTE format('UPDATE %I t SET %s FROM jsonb_populate_record(NULL::%I, $1) r WHERE %s',
                   g.table_name, v_set, g.table_name, v_where)
      USING g.old_values;
    UPDATE edit_log SET undone_at = clock_timestamp() WHERE id = ANY (g.ids);
    v_n := v_n + cardinality(g.ids);
  END LOOP;
  PERFORM set_config('app.edit_log_undo_of', '', true);

  -- 2. Inserts newest first, then 3. deleted rows re-inserted parents first.
  FOR v_id IN
    SELECT id FROM edit_log
     WHERE txid = p_txid AND undone_at IS NULL AND undo_of IS NULL AND op IN ('INSERT', 'DELETE')
     ORDER BY (op = 'DELETE'),
              CASE WHEN op = 'INSERT' THEN -id END,
              CASE table_name WHEN 'qiraat_authorities' THEN 0 WHEN 'qiraat_evidence_texts' THEN 1
                              WHEN 'qiraat_loci' THEN 2 WHEN 'qiraat_entries' THEN 3 ELSE 4 END,
              id
  LOOP
    PERFORM edit_log_undo(v_id);
    v_n := v_n + 1;
  END LOOP;

  SET CONSTRAINTS qiraat_entries_locus_id_kind_entry_order_key IMMEDIATE;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION edit_log_undo_tx(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION edit_log_undo_tx(bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
