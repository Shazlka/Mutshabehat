-- ============================================================================
-- Qiraat Phase 4.1: VERSION_CONFLICT must not use SQLSTATE 40001
-- ============================================================================
-- Incident 2026-09-23 (end-to-end test): qiraat_review_begin raised VERSION_CONFLICT with
-- ERRCODE serialization_failure (40001). PostgREST automatically RETRIES transactions that fail
-- with 40001, so a stale-version save never returned: PostgREST looped (~4,000 tx/s, DB ~123% CPU)
-- until the PostgREST container was restarted. No data was changed (the check fails before any
-- write). Fix: raise it with PostgREST's custom SQLSTATE PT409, which PostgREST returns as HTTP 409
-- and never retries. The API maps errors by message, so nothing else changes.
-- Rollback: supabase/rollbacks/20260925130000_qiraat_review_version_conflict_code.down.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION qiraat_review_begin(p_entry_id text, p_expected timestamptz, p_device_id text)
RETURNS qiraat_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries;
BEGIN
  PERFORM qiraat_require_editor();
  PERFORM set_config('app.device_id', coalesce(nullif(btrim(p_device_id), ''), 'review-web'), true);
  SELECT * INTO e FROM qiraat_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND entry %', p_entry_id USING ERRCODE = 'no_data_found'; END IF;
  IF p_expected IS NULL OR e.updated_at IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'VERSION_CONFLICT entry %', p_entry_id USING ERRCODE = 'PT409';
  END IF;
  RETURN e;
END;
$$;

NOTIFY pgrst, 'reload schema';
