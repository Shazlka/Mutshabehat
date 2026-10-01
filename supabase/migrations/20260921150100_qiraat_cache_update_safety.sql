-- Phase 4 safety correction: an UPDATE can move an annotation to a new scope
-- or authority.  Clear the old flattened projection before rebuilding the new
-- one; page reads remain cache-only.
CREATE OR REPLACE FUNCTION qiraat_clear_annotation_cache(
  p_target_authority_id text,
  p_start_key text,
  p_end_key text,
  p_framework_id uuid
) RETURNS void LANGUAGE sql AS $$
  DELETE FROM resolved_qiraat_cache c
  USING qiraat_authority_closure ac
  WHERE ac.ancestor_id = p_target_authority_id
    AND ac.descendant_id = c.target_authority_id
    AND c.canonical_word_key IN (p_start_key, p_end_key)
    AND c.framework_id IS NOT DISTINCT FROM p_framework_id;
$$;

CREATE OR REPLACE FUNCTION qiraat_annotation_cache_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM qiraat_clear_annotation_cache(
      OLD.target_authority_id, OLD.start_canonical_key, OLD.end_canonical_key, OLD.framework_id
    );
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM qiraat_clear_annotation_cache(
      OLD.target_authority_id, OLD.start_canonical_key, OLD.end_canonical_key, OLD.framework_id
    );
  END IF;

  PERFORM qiraat_rebuild_annotation_cache(NEW.id);
  RETURN NULL;
END $$;
