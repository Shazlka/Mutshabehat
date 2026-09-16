-- ============================================================
-- Qiraat Ashr (ten canonical Quran readings) — reference schema
-- ============================================================
-- Status: WRITTEN, NOT YET APPLIED to the self-hosted backend as of 2026-09-16.
-- This session has no Tailscale connectivity to the Mac Mini, and per HANDOFF.md/CLAUDE.md,
-- production DDL requires an explicit pg_dump backup + the user's approval first. The working
-- prototype in this branch reads from fixture-backed
-- `packages/qiraat-core/repository.ts` (FixtureQiraatRepository) instead — same pattern already
-- used for the 604 Mushaf page-word fixtures. Applying this migration and swapping in a
-- `SupabaseQiraatRepository` implementing the same `QiraatRepository` interface is the only
-- change needed to move off fixtures; nothing above the repository interface changes.
--
-- Apply with (see CLAUDE.md §"Applying DB DDL"):
--   docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     --single-transaction < supabase/migrations/20260916120000_qiraat_ashr_schema.sql
--   then: NOTIFY pgrst, 'reload schema';
--
-- Shared reference data (like automated_groups): everyone reads, only the service role writes.
-- Never per-user, never RLS-scoped by auth.uid() — Qiraat variants are the same for every reader
-- of the app. Canonical reader/narrator/reading IDs mirror packages/qiraat-core/types.ts exactly
-- — keep them in sync if either side changes.

CREATE TABLE IF NOT EXISTS qiraat_readers (
  id          text PRIMARY KEY CHECK (id ~ '^Q(0[1-9]|10)$'),
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  slug        text NOT NULL UNIQUE,
  color       text NOT NULL,
  sort_order  smallint NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS qiraat_narrators (
  id          text PRIMARY KEY CHECK (id ~ '^Q(0[1-9]|10)-R0[12]$'),
  reader_id   text NOT NULL REFERENCES qiraat_readers(id),
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  slug        text NOT NULL,
  color       text NOT NULL,
  sort_order  smallint NOT NULL,
  UNIQUE (reader_id, sort_order)
);

-- A Riwayah = reader + narrator, 1:1 with qiraat_narrators (Part 35: ReadingId and NarratorId
-- are the same ID space by design). Kept as its own table anyway, matching the spec's Part 8
-- schema, so display names/slugs/baseline flag have one obvious home.
CREATE TABLE IF NOT EXISTS qiraat_readings (
  id                text PRIMARY KEY REFERENCES qiraat_narrators(id),
  reader_id         text NOT NULL REFERENCES qiraat_readers(id),
  narrator_id       text NOT NULL REFERENCES qiraat_narrators(id),
  display_name_ar   text NOT NULL,
  display_name_en   text NOT NULL,
  slug              text NOT NULL UNIQUE,
  is_baseline       boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS qiraat_readings_single_baseline
  ON qiraat_readings ((is_baseline)) WHERE is_baseline;

-- Canonical Quran token identity. Only needed if/when Qiraat data moves off the Mushaf-1441
-- page-word fixtures (packages/quran-data/mushaf1441/fixtures/page-words/*.json), which already
-- carry this exact shape (MushafWord) today — see docs/qiraat/00-existing-architecture.md. This
-- table lets `qiraat_variants` reference tokens even for a Quran-wide (non-Mushaf-1441) surface
-- later without duplicating the Mushaf1441 fixtures into Postgres.
CREATE TABLE IF NOT EXISTS quran_tokens (
  id                text PRIMARY KEY,
  surah             smallint NOT NULL CHECK (surah BETWEEN 1 AND 114),
  ayah              smallint NOT NULL CHECK (ayah >= 1),
  token_index       smallint NOT NULL CHECK (token_index >= 1),
  word_index        smallint,
  base_text         text NOT NULL,
  uthmani_text      text,
  page_1441         smallint CHECK (page_1441 BETWEEN 1 AND 604),
  line_1441         smallint CHECK (line_1441 BETWEEN 1 AND 15),
  UNIQUE (surah, ayah, token_index)
);

CREATE TYPE qiraat_variant_operation AS ENUM (
  'KEEP', 'REPLACE', 'INSERT', 'DELETE', 'MERGE', 'SPLIT', 'DIACRITIC_CHANGE', 'ORTHOGRAPHIC_CHANGE'
);

CREATE TYPE qiraat_difference_type AS ENUM (
  'HARAKAH', 'LETTER', 'ADDITION', 'OMISSION', 'MADD', 'HAMZ',
  'IMALAH', 'IDGHAM', 'WAQF', 'NAQL', 'SILAH', 'ORTHOGRAPHY', 'OTHER'
);

CREATE TYPE qiraat_verification_status AS ENUM (
  'EXTRACTED', 'MAPPED', 'REVIEWED', 'VERIFIED', 'PUBLISHED'
);

CREATE TABLE IF NOT EXISTS qiraat_variants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surah                 smallint NOT NULL CHECK (surah BETWEEN 1 AND 114),
  ayah                  smallint NOT NULL CHECK (ayah >= 1),
  start_token           smallint NOT NULL CHECK (start_token >= 1),
  end_token             smallint NOT NULL CHECK (end_token >= start_token),
  operation             qiraat_variant_operation NOT NULL,
  hafs_text             text NOT NULL,
  variant_text          text NOT NULL,
  uthmani_text          text,
  difference_type       qiraat_difference_type NOT NULL,
  notes                 text,
  verification_status   qiraat_verification_status NOT NULL DEFAULT 'EXTRACTED',
  synthetic             boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qiraat_variants_position_idx ON qiraat_variants (surah, ayah, start_token, end_token);
CREATE INDEX IF NOT EXISTS qiraat_variants_status_idx ON qiraat_variants (verification_status);

-- Many-to-many attribution: one variant can be read by many Riwayat without duplicating the
-- variant row per Riwayah (Part 4/8's explicit "don't store 20 full Qurans").
CREATE TABLE IF NOT EXISTS qiraat_variant_readings (
  variant_id   uuid NOT NULL REFERENCES qiraat_variants(id) ON DELETE CASCADE,
  reading_id   text NOT NULL REFERENCES qiraat_readings(id),
  PRIMARY KEY (variant_id, reading_id)
);

CREATE TABLE IF NOT EXISTS qiraat_sources (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id           uuid NOT NULL REFERENCES qiraat_variants(id) ON DELETE CASCADE,
  source_name          text NOT NULL,
  source_type          text NOT NULL CHECK (source_type IN ('manuscript', 'printed-book', 'pdf', 'academic', 'other')),
  pdf_filename         text,
  pdf_page             integer,
  source_reference     text NOT NULL,
  source_text          text,
  verification_notes   text
);

CREATE INDEX IF NOT EXISTS qiraat_sources_variant_idx ON qiraat_sources (variant_id);

CREATE OR REPLACE FUNCTION qiraat_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qiraat_variants_touch_updated_at ON qiraat_variants;
CREATE TRIGGER qiraat_variants_touch_updated_at
  BEFORE UPDATE ON qiraat_variants
  FOR EACH ROW EXECUTE FUNCTION qiraat_touch_updated_at();

-- RLS: shared reference data, same policy shape as automated_groups. Everyone (including
-- anonymous/anon-key requests) reads; only the service role writes (import pipeline / admin).
ALTER TABLE qiraat_readers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiraat_narrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiraat_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quran_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiraat_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiraat_variant_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiraat_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qiraat_readers_read_all" ON qiraat_readers;
CREATE POLICY "qiraat_readers_read_all" ON qiraat_readers FOR SELECT USING (true);

DROP POLICY IF EXISTS "qiraat_narrators_read_all" ON qiraat_narrators;
CREATE POLICY "qiraat_narrators_read_all" ON qiraat_narrators FOR SELECT USING (true);

DROP POLICY IF EXISTS "qiraat_readings_read_all" ON qiraat_readings;
CREATE POLICY "qiraat_readings_read_all" ON qiraat_readings FOR SELECT USING (true);

DROP POLICY IF EXISTS "quran_tokens_read_all" ON quran_tokens;
CREATE POLICY "quran_tokens_read_all" ON quran_tokens FOR SELECT USING (true);

-- Ordinary (anon-key) readers only ever see VERIFIED/PUBLISHED variants (Part 9's lifecycle) —
-- earlier-stage rows are for the service-role-only import/review pipeline. The app's own
-- "?debug=1" admin toggle (src/app/api/mushaf-1441/qiraat/route.ts) must therefore run over the
-- service-role client, exactly like other server-only routes, not the anon client.
DROP POLICY IF EXISTS "qiraat_variants_read_published" ON qiraat_variants;
CREATE POLICY "qiraat_variants_read_published" ON qiraat_variants
  FOR SELECT USING (verification_status IN ('VERIFIED', 'PUBLISHED'));

DROP POLICY IF EXISTS "qiraat_variant_readings_read_all" ON qiraat_variant_readings;
CREATE POLICY "qiraat_variant_readings_read_all" ON qiraat_variant_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM qiraat_variants v
      WHERE v.id = qiraat_variant_readings.variant_id
        AND v.verification_status IN ('VERIFIED', 'PUBLISHED')
    )
  );

DROP POLICY IF EXISTS "qiraat_sources_read_all" ON qiraat_sources;
CREATE POLICY "qiraat_sources_read_all" ON qiraat_sources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM qiraat_variants v
      WHERE v.id = qiraat_sources.variant_id
        AND v.verification_status IN ('VERIFIED', 'PUBLISHED')
    )
  );

-- Seed the 10 readers / 20 narrators / 20 readings — fixed, permanent IDs (Part 1/2/35). Mirrors
-- packages/qiraat-core/{readers,narrators,readings}.ts exactly.
INSERT INTO qiraat_readers (id, name_ar, name_en, slug, color, sort_order) VALUES
  ('Q01', 'نافع المدني', 'Nafi al-Madani', 'nafi-al-madani', '#2563EB', 1),
  ('Q02', 'ابن كثير المكي', 'Ibn Kathir al-Makki', 'ibn-kathir-al-makki', '#16A34A', 2),
  ('Q03', 'أبو عمرو البصري', 'Abu Amr al-Basri', 'abu-amr-al-basri', '#0891B2', 3),
  ('Q04', 'ابن عامر الشامي', 'Ibn Amir ash-Shami', 'ibn-amir-ash-shami', '#7C3AED', 4),
  ('Q05', 'عاصم الكوفي', 'Asim al-Kufi', 'asim-al-kufi', '#EA580C', 5),
  ('Q06', 'حمزة الكوفي', 'Hamzah al-Kufi', 'hamzah-al-kufi', '#DC2626', 6),
  ('Q07', 'الكسائي الكوفي', 'Al-Kisai', 'al-kisai', '#DB2777', 7),
  ('Q08', 'أبو جعفر المدني', 'Abu Jafar al-Madani', 'abu-jafar-al-madani', '#CA8A04', 8),
  ('Q09', 'يعقوب الحضرمي', 'Yaqub al-Hadrami', 'yaqub-al-hadrami', '#B45309', 9),
  ('Q10', 'خلف العاشر', 'Khalaf al-Ashir', 'khalaf-al-ashir', '#475569', 10)
ON CONFLICT (id) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
  slug = EXCLUDED.slug, color = EXCLUDED.color, sort_order = EXCLUDED.sort_order;

INSERT INTO qiraat_narrators (id, reader_id, name_ar, name_en, slug, color, sort_order) VALUES
  ('Q01-R01', 'Q01', 'قالون', 'Qalun', 'qalun', '#60A5FA', 1),
  ('Q01-R02', 'Q01', 'ورش', 'Warsh', 'warsh', '#1D4ED8', 2),
  ('Q02-R01', 'Q02', 'البزي', 'Al-Bazzi', 'al-bazzi', '#4ADE80', 1),
  ('Q02-R02', 'Q02', 'قنبل', 'Qunbul', 'qunbul', '#15803D', 2),
  ('Q03-R01', 'Q03', 'الدوري عن أبي عمرو', 'Al-Duri (an Abi Amr)', 'al-duri-an-abi-amr', '#67E8F9', 1),
  ('Q03-R02', 'Q03', 'السوسي', 'Al-Susi', 'al-susi', '#0E7490', 2),
  ('Q04-R01', 'Q04', 'هشام', 'Hisham', 'hisham', '#A78BFA', 1),
  ('Q04-R02', 'Q04', 'ابن ذكوان', 'Ibn Dhakwan', 'ibn-dhakwan', '#6D28D9', 2),
  ('Q05-R01', 'Q05', 'شعبة', 'Shu''bah', 'shubah', '#FB923C', 1),
  ('Q05-R02', 'Q05', 'حفص', 'Hafs', 'hafs', '#C2410C', 2),
  ('Q06-R01', 'Q06', 'خلف', 'Khalaf', 'khalaf-an-hamzah', '#F87171', 1),
  ('Q06-R02', 'Q06', 'خلاد', 'Khallad', 'khallad', '#B91C1C', 2),
  ('Q07-R01', 'Q07', 'أبو الحارث', 'Abu al-Harith', 'abu-al-harith', '#F472B6', 1),
  ('Q07-R02', 'Q07', 'الدوري عن الكسائي', 'Al-Duri (an al-Kisai)', 'al-duri-an-al-kisai', '#BE185D', 2),
  ('Q08-R01', 'Q08', 'ابن وردان', 'Ibn Wardan', 'ibn-wardan', '#FACC15', 1),
  ('Q08-R02', 'Q08', 'ابن جماز', 'Ibn Jammaz', 'ibn-jammaz', '#A16207', 2),
  ('Q09-R01', 'Q09', 'رويس', 'Ruways', 'ruways', '#F59E0B', 1),
  ('Q09-R02', 'Q09', 'روح', 'Rawh', 'rawh', '#92400E', 2),
  ('Q10-R01', 'Q10', 'إسحاق', 'Ishaq', 'ishaq', '#94A3B8', 1),
  ('Q10-R02', 'Q10', 'إدريس', 'Idris', 'idris', '#334155', 2)
ON CONFLICT (id) DO UPDATE SET reader_id = EXCLUDED.reader_id, name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en, slug = EXCLUDED.slug, color = EXCLUDED.color, sort_order = EXCLUDED.sort_order;

INSERT INTO qiraat_readings (id, reader_id, narrator_id, display_name_ar, display_name_en, slug, is_baseline)
SELECT
  n.id,
  n.reader_id,
  n.id,
  n.name_ar || ' عن ' || r.name_ar,
  n.name_en || ' an ' || r.name_en,
  n.slug || '-an-' || r.slug,
  n.id = 'Q05-R02'
FROM qiraat_narrators n
JOIN qiraat_readers r ON r.id = n.reader_id
ON CONFLICT (id) DO UPDATE SET display_name_ar = EXCLUDED.display_name_ar,
  display_name_en = EXCLUDED.display_name_en, slug = EXCLUDED.slug, is_baseline = EXCLUDED.is_baseline;
