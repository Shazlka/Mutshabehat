-- ROLLBACK of 20260925130000: restores the Phase 4 body (40001). Do not use on a PostgREST-served DB.

CREATE OR REPLACE FUNCTION qiraat_review_begin(p_entry_id text, p_expected timestamptz, p_device_id text)
RETURNS qiraat_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries;
BEGIN
  PERFORM qiraat_require_editor();
  PERFORM set_config('app.device_id', coalesce(nullif(btrim(p_device_id), ''), 'review-web'), true);
  SELECT * INTO e FROM qiraat_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND entry %', p_entry_id USING ERRCODE = 'no_data_found'; END IF;
  IF p_expected IS NULL OR e.updated_at IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'VERSION_CONFLICT entry %', p_entry_id USING ERRCODE = 'serialization_failure';
  END IF;
  RETURN e;
END;
$$;

NOTIFY pgrst, 'reload schema';
