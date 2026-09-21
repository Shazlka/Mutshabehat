-- Qiraat annotation engine, phase 3: write-time resolver and page read projection.
CREATE TABLE IF NOT EXISTS resolved_qiraat_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_word_key text NOT NULL, word_id uuid NOT NULL REFERENCES quran_words(id) ON DELETE CASCADE,
  page_number smallint NOT NULL CHECK (page_number BETWEEN 1 AND 604),
  target_authority_id text NOT NULL REFERENCES qiraat_authorities(id) ON DELETE CASCADE,
  corpus_id uuid REFERENCES qiraat_corpora(id), framework_id uuid REFERENCES qiraat_frameworks(id),
  resolved_annotation_id uuid NOT NULL REFERENCES qiraat_annotations(id) ON DELETE CASCADE,
  resolved_face_count smallint NOT NULL DEFAULT 0, has_multiple_faces boolean NOT NULL DEFAULT false,
  resolved_variant jsonb, resolved_color text, reading_context text NOT NULL,
  source_version integer NOT NULL, resolved_revision bigint NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(canonical_word_key,target_authority_id,framework_id,reading_context)
);
CREATE INDEX IF NOT EXISTS resolved_qiraat_cache_page_idx ON resolved_qiraat_cache(page_number,target_authority_id,framework_id);

CREATE OR REPLACE FUNCTION qiraat_rebuild_annotation_cache(p_annotation uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a qiraat_annotations; BEGIN
 SELECT * INTO a FROM qiraat_annotations WHERE id=p_annotation; IF a.id IS NULL THEN RETURN; END IF;
 DELETE FROM resolved_qiraat_cache c USING qiraat_authority_closure ac
 WHERE ac.ancestor_id=a.target_authority_id AND ac.descendant_id=c.target_authority_id
 AND c.canonical_word_key IN (a.start_canonical_key,a.end_canonical_key) AND c.framework_id IS NOT DISTINCT FROM a.framework_id;
 INSERT INTO resolved_qiraat_cache(canonical_word_key,word_id,page_number,target_authority_id,corpus_id,framework_id,resolved_annotation_id,resolved_face_count,has_multiple_faces,resolved_color,reading_context,source_version)
 SELECT x.key,x.word_id,x.page_number,x.target_authority_id,x.corpus_id,x.framework_id,x.id,x.face_count,x.face_count>1,coalesce(x.color_override,x.default_color),x.reading_context,x.version
 FROM (SELECT DISTINCT ON (w.canonical_key,target.descendant_id,coalesce(q.framework_id,'00000000-0000-0000-0000-000000000000'::uuid),q.reading_context)
   w.canonical_key AS key,w.id AS word_id,w.page_number,target.descendant_id AS target_authority_id,q.corpus_id,q.framework_id,q.id,q.color_override,col.default_color,q.reading_context,q.version,
   (SELECT count(*) FROM qiraat_annotation_faces f WHERE f.annotation_id=q.id)::smallint AS face_count,q.inheritance_action
  FROM qiraat_annotations q JOIN qiraat_authority_closure target ON target.ancestor_id=q.target_authority_id
  JOIN quran_words w ON w.canonical_key IN(q.start_canonical_key,q.end_canonical_key)
  LEFT JOIN qiraat_authority_colors col ON col.authority_id=q.target_authority_id
  WHERE q.deleted_at IS NULL AND q.framework_id IS NOT DISTINCT FROM a.framework_id
    AND w.canonical_key IN(a.start_canonical_key,a.end_canonical_key) AND (q.applies_to_descendants OR target.depth=0)
  ORDER BY w.canonical_key,target.descendant_id,coalesce(q.framework_id,'00000000-0000-0000-0000-000000000000'::uuid),q.reading_context,target.depth ASC,q.updated_at DESC,q.id) x
 WHERE x.inheritance_action <> 'EXCLUDE';
END $$;
CREATE OR REPLACE FUNCTION qiraat_annotation_cache_sync() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM qiraat_rebuild_annotation_cache(COALESCE(NEW.id,OLD.id)); RETURN NULL; END $$;
DROP TRIGGER IF EXISTS qiraat_annotations_cache_sync ON qiraat_annotations;
CREATE TRIGGER qiraat_annotations_cache_sync AFTER INSERT OR UPDATE OR DELETE ON qiraat_annotations FOR EACH ROW EXECUTE FUNCTION qiraat_annotation_cache_sync();
ALTER TABLE resolved_qiraat_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resolved_qiraat_cache_read_all ON resolved_qiraat_cache;
CREATE POLICY resolved_qiraat_cache_read_all ON resolved_qiraat_cache FOR SELECT USING(true);
GRANT SELECT ON resolved_qiraat_cache TO authenticated,service_role;
