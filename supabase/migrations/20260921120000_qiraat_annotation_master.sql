-- Qiraat annotation engine, phase 1: additive canonical identity and master catalogue.
--
-- Safety:
--   * This migration does not alter Quran fixture files, qiraat_entries, or mushaf_annotations.
--   * Apply only after a pg_dump -Fc backup, in one transaction:
--       docker exec -i mutshabehat-db psql -U postgres -d postgres \
--         -v ON_ERROR_STOP=1 --single-transaction < this-file
--   * Then run scripts/qiraat/seed-canonical-words.ts and NOTIFY pgrst, 'reload schema'.
-- Recovery: restore the named pre-apply dump; all objects here are additive.

CREATE TABLE IF NOT EXISTS quran_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surah smallint NOT NULL CHECK (surah BETWEEN 1 AND 114),
  ayah smallint NOT NULL CHECK (ayah >= 1),
  word_position smallint NOT NULL CHECK (word_position >= 1),
  canonical_key text GENERATED ALWAYS AS (
    lpad(surah::text, 3, '0') || ':' || lpad(ayah::text, 3, '0') || ':' || lpad(word_position::text, 3, '0')
  ) STORED,
  current_mushaf_word_id text NOT NULL UNIQUE,
  page_number smallint NOT NULL CHECK (page_number BETWEEN 1 AND 604),
  line_number smallint NOT NULL CHECK (line_number BETWEEN 1 AND 15),
  text_uthmani text NOT NULL,
  source_revision text NOT NULL DEFAULT 'mushaf1441-page-fixtures-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (surah, ayah, word_position),
  UNIQUE (canonical_key)
);

CREATE INDEX IF NOT EXISTS quran_words_page_idx ON quran_words (page_number, line_number);
CREATE INDEX IF NOT EXISTS quran_words_ayah_idx ON quran_words (surah, ayah, word_position);

CREATE TABLE IF NOT EXISTS qiraat_corpora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qiraat_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_id uuid NOT NULL REFERENCES qiraat_corpora(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (corpus_id, code)
);

-- Existing qiraat_authorities is the authoritative Reader -> Narrator -> Route entity table.
-- The closure table makes hierarchy reads indexable and avoids page-read recursion.
CREATE TABLE IF NOT EXISTS qiraat_authority_closure (
  ancestor_id text NOT NULL REFERENCES qiraat_authorities(id) ON DELETE CASCADE,
  descendant_id text NOT NULL REFERENCES qiraat_authorities(id) ON DELETE CASCADE,
  depth smallint NOT NULL CHECK (depth >= 0),
  PRIMARY KEY (ancestor_id, descendant_id)
);
CREATE INDEX IF NOT EXISTS qiraat_authority_closure_descendant_idx
  ON qiraat_authority_closure (descendant_id, depth, ancestor_id);

CREATE OR REPLACE FUNCTION qiraat_rebuild_authority_closure()
RETURNS void LANGUAGE sql AS $$
  WITH RECURSIVE tree AS (
    SELECT id AS ancestor_id, id AS descendant_id, 0::smallint AS depth
    FROM qiraat_authorities
    UNION ALL
    SELECT tree.ancestor_id, child.id, (tree.depth + 1)::smallint
    FROM tree
    JOIN qiraat_authorities child ON child.parent_id = tree.descendant_id
  )
  INSERT INTO qiraat_authority_closure (ancestor_id, descendant_id, depth)
  SELECT ancestor_id, descendant_id, depth FROM tree
  ON CONFLICT (ancestor_id, descendant_id) DO UPDATE SET depth = EXCLUDED.depth;
$$;

CREATE OR REPLACE FUNCTION qiraat_authorities_closure_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM qiraat_authority_closure;
  PERFORM qiraat_rebuild_authority_closure();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS qiraat_authorities_closure_sync_trg ON qiraat_authorities;
CREATE TRIGGER qiraat_authorities_closure_sync_trg
AFTER INSERT OR UPDATE OF parent_id OR DELETE ON qiraat_authorities
FOR EACH STATEMENT EXECUTE FUNCTION qiraat_authorities_closure_sync();
SELECT qiraat_rebuild_authority_closure();

CREATE TABLE IF NOT EXISTS qiraat_framework_authorities (
  framework_id uuid NOT NULL REFERENCES qiraat_frameworks(id) ON DELETE CASCADE,
  authority_id text NOT NULL REFERENCES qiraat_authorities(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  evidence_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (framework_id, authority_id)
);

CREATE TABLE IF NOT EXISTS qiraat_taxonomies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES qiraat_taxonomies(id) ON DELETE RESTRICT,
  category_type text NOT NULL CHECK (category_type IN ('USUL', 'FARSH')),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qiraat_taxonomies_parent_idx ON qiraat_taxonomies (parent_id, sort_order);

CREATE TABLE IF NOT EXISTS qiraat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_id uuid REFERENCES qiraat_corpora(id) ON DELETE RESTRICT,
  framework_id uuid REFERENCES qiraat_frameworks(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (framework_id IS NULL OR corpus_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS qiraat_group_members (
  group_id uuid NOT NULL REFERENCES qiraat_groups(id) ON DELETE CASCADE,
  authority_id text NOT NULL REFERENCES qiraat_authorities(id) ON DELETE RESTRICT,
  sort_order smallint NOT NULL DEFAULT 100,
  PRIMARY KEY (group_id, authority_id)
);

CREATE TABLE IF NOT EXISTS qiraat_authority_colors (
  authority_id text PRIMARY KEY REFERENCES qiraat_authorities(id) ON DELETE CASCADE,
  default_color text NOT NULL CHECK (default_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Existing source documents are retained as the canonical evidence catalogue; these nullable
-- fields make them usable by the future annotation-source relation without duplicating sources.
ALTER TABLE qiraat_source_documents ADD COLUMN IF NOT EXISTS author text;
ALTER TABLE qiraat_source_documents ADD COLUMN IF NOT EXISTS framework_id uuid REFERENCES qiraat_frameworks(id) ON DELETE SET NULL;
ALTER TABLE qiraat_source_documents ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO qiraat_corpora (code, name_ar, name_en, metadata)
VALUES ('ashr-sughra', 'العشر الصغرى', 'Al-Ashr Al-Sughra', '{"seed_basis":"mission-brief"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en;

INSERT INTO qiraat_frameworks (corpus_id, code, name_ar, name_en, metadata)
SELECT c.id, v.code, v.name_ar, v.name_en, '{"seed_basis":"mission-brief"}'::jsonb
FROM qiraat_corpora c
CROSS JOIN (VALUES
  ('shatibiyya', 'الشاطبية', 'Al-Shatibiyya'),
  ('durra', 'الدرة', 'Al-Durra')
) AS v(code, name_ar, name_en)
WHERE c.code = 'ashr-sughra'
ON CONFLICT (corpus_id, code) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en;

INSERT INTO qiraat_taxonomies (category_type, code, name_ar, name_en, sort_order, metadata)
VALUES
  ('USUL', 'USUL', 'الأصول', 'Usul', 1, '{"seed_basis":"mission-brief","is_root":true}'::jsonb),
  ('FARSH', 'FARSH', 'فرش الحروف', 'Farsh', 2, '{"seed_basis":"mission-brief","is_root":true}'::jsonb)
ON CONFLICT (code) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en;

INSERT INTO qiraat_authority_colors (authority_id, default_color)
SELECT id, color_hex FROM qiraat_authorities
ON CONFLICT (authority_id) DO UPDATE SET default_color = EXCLUDED.default_color, updated_at = now();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'quran_words', 'qiraat_corpora', 'qiraat_frameworks', 'qiraat_authority_closure',
    'qiraat_framework_authorities', 'qiraat_taxonomies', 'qiraat_groups',
    'qiraat_group_members', 'qiraat_authority_colors'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_read_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', t || '_read_all', t);
  END LOOP;
END $$;

GRANT SELECT ON quran_words, qiraat_corpora, qiraat_frameworks, qiraat_authority_closure,
  qiraat_framework_authorities, qiraat_taxonomies, qiraat_groups, qiraat_group_members,
  qiraat_authority_colors TO authenticated, service_role;
