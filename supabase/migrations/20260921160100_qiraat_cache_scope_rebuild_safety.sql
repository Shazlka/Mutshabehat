-- A moved annotation can leave an old anchor entirely. Re-resolve only the old
-- scope after clearing it so other annotations at that anchor stay visible.
CREATE OR REPLACE FUNCTION qiraat_rebuild_cache_scope(p_start_key text, p_end_key text, p_framework_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE annotation_id uuid;
BEGIN
  FOR annotation_id IN
    SELECT id FROM qiraat_annotations
    WHERE deleted_at IS NULL
      AND framework_id IS NOT DISTINCT FROM p_framework_id
      AND (start_canonical_key IN (p_start_key,p_end_key) OR end_canonical_key IN (p_start_key,p_end_key))
  LOOP
    PERFORM qiraat_rebuild_annotation_cache(annotation_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION qiraat_annotation_cache_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM qiraat_clear_annotation_cache(OLD.target_authority_id, OLD.start_canonical_key, OLD.end_canonical_key, OLD.framework_id);
    PERFORM qiraat_rebuild_cache_scope(OLD.start_canonical_key, OLD.end_canonical_key, OLD.framework_id);
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    PERFORM qiraat_clear_annotation_cache(OLD.target_authority_id, OLD.start_canonical_key, OLD.end_canonical_key, OLD.framework_id);
    PERFORM qiraat_rebuild_cache_scope(OLD.start_canonical_key, OLD.end_canonical_key, OLD.framework_id);
  END IF;
  PERFORM qiraat_rebuild_annotation_cache(NEW.id);
  RETURN NULL;
END $$;
