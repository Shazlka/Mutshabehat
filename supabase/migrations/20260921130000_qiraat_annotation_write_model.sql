-- Qiraat annotation engine, phase 2: normalized overlay write model.
-- Additive only. Apply after a fresh pg_dump -Fc, in one transaction.

CREATE TABLE IF NOT EXISTS qiraat_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('WORD','RANGE','BOUNDARY')),
  start_word_id uuid NOT NULL REFERENCES quran_words(id) ON DELETE RESTRICT,
  end_word_id uuid NOT NULL REFERENCES quran_words(id) ON DELETE RESTRICT,
  start_canonical_key text NOT NULL,
  end_canonical_key text NOT NULL,
  reading_context text NOT NULL DEFAULT 'BOTH' CHECK (reading_context IN ('BOTH','WASL_ONLY','WAQF_ONLY')),
  taxonomy_id uuid NOT NULL REFERENCES qiraat_taxonomies(id) ON DELETE RESTRICT,
  target_authority_id text NOT NULL REFERENCES qiraat_authorities(id) ON DELETE RESTRICT,
  corpus_id uuid REFERENCES qiraat_corpora(id) ON DELETE RESTRICT,
  framework_id uuid REFERENCES qiraat_frameworks(id) ON DELETE RESTRICT,
  inheritance_action text NOT NULL DEFAULT 'INHERIT' CHECK (inheritance_action IN ('INHERIT','OVERRIDE','EXCLUDE')),
  applies_to_descendants boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','verified')),
  color_override text CHECK (color_override ~ '^#[0-9A-Fa-f]{6}$'),
  entry_method text NOT NULL DEFAULT 'manual' CHECK (entry_method IN ('manual','excel','json','ai','batch','migration')),
  notes text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS qiraat_annotations_anchor_idx ON qiraat_annotations (start_word_id, end_word_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS qiraat_annotations_target_idx ON qiraat_annotations (target_authority_id, framework_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION qiraat_validate_annotation_anchor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s quran_words; e quran_words;
BEGIN
  SELECT * INTO s FROM quran_words WHERE id=NEW.start_word_id;
  SELECT * INTO e FROM quran_words WHERE id=NEW.end_word_id;
  IF s.id IS NULL OR e.id IS NULL THEN RAISE EXCEPTION 'invalid canonical anchor'; END IF;
  NEW.start_canonical_key := s.canonical_key; NEW.end_canonical_key := e.canonical_key;
  IF NEW.scope_type='WORD' AND NEW.start_word_id <> NEW.end_word_id THEN RAISE EXCEPTION 'WORD scope requires identical anchors'; END IF;
  IF NEW.scope_type IN ('RANGE','BOUNDARY') AND (s.surah,s.ayah,s.word_position) >= (e.surah,e.ayah,e.word_position) THEN RAISE EXCEPTION '% scope requires ordered distinct anchors', NEW.scope_type; END IF;
  IF NEW.framework_id IS NOT NULL AND NEW.corpus_id IS NULL THEN RAISE EXCEPTION 'framework requires corpus'; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION qiraat_touch_annotation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.version:=OLD.version+1; NEW.updated_at:=now(); RETURN NEW; END $$;
CREATE TRIGGER qiraat_annotations_validate BEFORE INSERT OR UPDATE ON qiraat_annotations FOR EACH ROW EXECUTE FUNCTION qiraat_validate_annotation_anchor();
CREATE TRIGGER qiraat_annotations_touch BEFORE UPDATE ON qiraat_annotations FOR EACH ROW EXECUTE FUNCTION qiraat_touch_annotation();

CREATE TABLE IF NOT EXISTS qiraat_annotation_faces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), annotation_id uuid NOT NULL REFERENCES qiraat_annotations(id) ON DELETE CASCADE,
 face_type text NOT NULL, face_value jsonb NOT NULL, label_ar text NOT NULL, label_en text,
 preference_status text CHECK (preference_status IN ('muqaddam','secondary','equal')),
 sort_order smallint NOT NULL DEFAULT 100, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS qiraat_annotation_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), annotation_id uuid NOT NULL REFERENCES qiraat_annotations(id) ON DELETE CASCADE,
 face_id uuid REFERENCES qiraat_annotation_faces(id) ON DELETE CASCADE, canonical_word_key text NOT NULL,
 uthmanic_text text, normalized_text text, phonetic_note text, render_mode text NOT NULL DEFAULT 'editor_only', glyph_reference text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS qiraat_annotation_sources (
 annotation_id uuid NOT NULL REFERENCES qiraat_annotations(id) ON DELETE CASCADE,
 source_id text NOT NULL REFERENCES qiraat_source_documents(id) ON DELETE RESTRICT,
 chapter text, section text, bayt_number text, page text, reference_text text, notes text,
 PRIMARY KEY(annotation_id,source_id));
CREATE TABLE IF NOT EXISTS qiraat_annotation_revisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, annotation_id uuid NOT NULL REFERENCES qiraat_annotations(id) ON DELETE RESTRICT,
 revision_number integer NOT NULL, before_json jsonb, after_json jsonb NOT NULL, changed_at timestamptz NOT NULL DEFAULT now(), changed_by uuid REFERENCES auth.users(id), change_reason text,
 UNIQUE(annotation_id,revision_number));
CREATE OR REPLACE FUNCTION qiraat_annotation_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO qiraat_annotation_revisions(annotation_id,revision_number,before_json,after_json,changed_by)
 VALUES (NEW.id,NEW.version,CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,to_jsonb(NEW),NEW.updated_by); RETURN NEW; END $$;
CREATE TRIGGER qiraat_annotations_revision AFTER INSERT OR UPDATE ON qiraat_annotations FOR EACH ROW EXECUTE FUNCTION qiraat_annotation_revision();

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['qiraat_annotations','qiraat_annotation_faces','qiraat_annotation_variants','qiraat_annotation_sources','qiraat_annotation_revisions'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('DROP POLICY IF EXISTS %I ON %I',t||'_read_all',t); EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)',t||'_read_all',t); END LOOP; END $$;
GRANT SELECT ON qiraat_annotations,qiraat_annotation_faces,qiraat_annotation_variants,qiraat_annotation_sources,qiraat_annotation_revisions TO authenticated,service_role;
