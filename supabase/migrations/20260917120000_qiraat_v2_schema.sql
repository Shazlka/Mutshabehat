-- ============================================================================
-- Qiraat Ashr V2 — permanent architecture for all 604 Mushaf pages
-- ============================================================================
-- Status: WRITTEN, NOT APPLIED. Apply only after a pg_dump backup and an explicit
-- go-ahead (CLAUDE.md §"Applying DB DDL"):
--
--   docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     --single-transaction < supabase/migrations/20260917120000_qiraat_v2_schema.sql
--   then: NOTIFY pgrst, 'reload schema';
--
-- SUPERSEDES 20260916120000_qiraat_ashr_schema.sql (also never applied). Do not run both.
--
-- Design decisions this schema encodes (see docs/qiraat/10-v2-architecture-plan.md):
--   1. Every OCCURRENCE is its own verified row. A rule (عليهم → ضم الهاء: حمزة، يعقوب) is
--      written once in `qiraat_rules` as a canonical statement, but it is NEVER auto-applied.
--      Each of the 215 Quran-wide occurrences of عليهم must be checked against the source page
--      and stored as its own `qiraat_entries` row, because the rule genuinely does not hold
--      everywhere (وقفًا vs وصلًا, ميم الجمع before a vowel, etc.). The `rule_id` link exists
--      only so a QA view can flag an occurrence whose attribution diverges from the canonical
--      statement — divergence is a question to a human, never an automatic correction.
--   2. Authorities are ONE self-referencing tree (reader → narrator → route), because the source
--      constantly mixes levels in a single row ("أبو عمرو، ابن عامر، حفص، حمزة" — three readers
--      and one narrator). IDs stay in the already-shipped Q01 / Q01-R01 space: never a bare
--      Arabic name, and structurally incapable of confusing narrator Q06-R01 (خلف عن حمزة) with
--      reader Q10 (خلف العاشر).
--   3. Variants (which change the printed rasm) and rulings (الأصول — which do not) share one
--      parent table `qiraat_entries` and therefore ONE attribution table. "Everything marked on
--      this page for riwayah X" is a single join, and there is exactly one place where
--      "who reads this" lives.
--   4. Verbatim source attribution is preserved in `qiraat_entry_authorities`; the expanded
--      20-reading set used for rendering is DERIVED into `qiraat_entry_readings` by a function,
--      so the two can never drift and "الباقون" is resolved once at write time, not per query.
--   5. الشواهد are deduplicated. The Shatibiyyah line for عليهم appears verbatim 8 times in the
--      first 20 pages alone; stored per-occurrence it would be repeated thousands of times.
--
-- Ownership: shared reference data, same posture as automated_groups — everyone reads
-- VERIFIED/PUBLISHED rows, only the service role writes. Never per-user, never auth.uid()-scoped.

-- ============================================================================
-- 0. ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE qiraat_authority_type AS ENUM ('reader', 'narrator', 'route');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qiraat_entry_kind AS ENUM ('variant', 'ruling');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- How the source expressed WHO reads this entry. Drives `qiraat_expand_entry_readings`.
--   explicit   — the source names each authority ("عاصم، الكسائي، يعقوب، خلف").
--   all_except — the source says "جميع القراء عدا X"; rows flagged is_exception are the X.
--   remainder  — the source says "الباقون"; expansion = 20 readings minus everyone claimed by
--                sibling entries at the SAME locus. Requires the locus to be fully partitioned.
DO $$ BEGIN
  CREATE TYPE qiraat_attribution_mode AS ENUM ('explicit', 'all_except', 'remainder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qiraat_variant_type AS ENUM (
    'orthography', 'vowel', 'consonant', 'hamza', 'madd', 'idgham', 'ishmam', 'imalah',
    'taqlil', 'sakt', 'naql', 'ikhfa', 'ghunnah', 'pronoun', 'grammar', 'addition',
    'omission', 'word_form', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EXTRACTED → MAPPED → REVIEWED → VERIFIED → PUBLISHED, plus two terminal-ish states.
-- NEEDS_MANUAL_REVIEW: the source wording/attribution could not be resolved confidently at all
-- (not merely "not re-checked"). REJECTED: proven wrong, kept for audit, never rendered.
DO $$ BEGIN
  CREATE TYPE qiraat_verification_status AS ENUM (
    'EXTRACTED', 'MAPPED', 'REVIEWED', 'NEEDS_MANUAL_REVIEW', 'VERIFIED', 'PUBLISHED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qiraat_mapping_status AS ENUM ('unmapped', 'auto_matched', 'verified', 'ambiguous');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qiraat_rule_scope AS ENUM ('global', 'page', 'locus');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qiraat_flag_severity AS ENUM ('info', 'warning', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qiraat_flag_status AS ENUM ('open', 'verified', 'corrected', 'ignored');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 1. AUTHORITIES — readers, narrators, routes as one tree
-- ============================================================================

CREATE TABLE IF NOT EXISTS qiraat_authorities (
  id              text PRIMARY KEY CHECK (id ~ '^Q(0[1-9]|10)(-R0[12](-T[0-9]{2})?)?$'),
  authority_type  qiraat_authority_type NOT NULL,
  parent_id       text REFERENCES qiraat_authorities(id),
  name_ar         text NOT NULL,
  -- Short display name for compact UI (pills). A FIXED value, never derived by splitting name_ar:
  -- Q10 must stay "خلف العاشر" in full, because "خلف" alone is narrator Q06-R01, a different person.
  name_ar_short   text NOT NULL,
  name_en         text NOT NULL,
  slug            text NOT NULL UNIQUE,
  color_hex       text NOT NULL CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order      smallint NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  -- A reader has no parent; a narrator's parent is its reader; a route's parent is its narrator.
  CONSTRAINT qiraat_authorities_parent_shape CHECK (
    (authority_type = 'reader'   AND parent_id IS NULL) OR
    (authority_type <> 'reader'  AND parent_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS qiraat_authorities_parent_idx ON qiraat_authorities (parent_id);
CREATE INDEX IF NOT EXISTS qiraat_authorities_type_idx   ON qiraat_authorities (authority_type, sort_order);

-- The 20 Riwayat: exactly the narrator-type authorities. A Riwayah IS a narrator's transmission,
-- so ReadingId and NarratorId share one ID space by design. This view is the canonical list.
CREATE OR REPLACE VIEW qiraat_readings AS
SELECT
  n.id                                        AS reading_id,
  r.id                                        AS reader_id,
  n.id                                        AS narrator_id,
  n.name_ar || ' عن ' || r.name_ar            AS display_name_ar,
  n.name_en || ' an ' || r.name_en            AS display_name_en,
  n.slug || '-an-' || r.slug                  AS slug,
  (n.id = 'Q05-R02')                          AS is_baseline,
  r.sort_order * 10 + n.sort_order            AS sort_order
FROM qiraat_authorities n
JOIN qiraat_authorities r ON r.id = n.parent_id
WHERE n.authority_type = 'narrator';

-- ============================================================================
-- 2. AYAH-COUNTING SCHOOLS — a SEPARATE taxonomy, never force-fit into readings
-- ============================================================================
-- عد الآي is attributed to المكي/الكوفي/المدنيان/البصري/الشامي. These are ayah-numbering schools,
-- entirely unrelated to the ten readers. Modelling them as authorities would silently corrupt
-- every "which riwayah reads this" query.

CREATE TABLE IF NOT EXISTS qiraat_count_schools (
  id          text PRIMARY KEY,
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  sort_order  smallint NOT NULL
);

-- ============================================================================
-- 3. SOURCE DOCUMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS qiraat_source_documents (
  id             text PRIMARY KEY,
  name_ar        text NOT NULL,
  name_en        text,
  document_type  text NOT NULL CHECK (document_type IN ('mushaf', 'poem', 'printed-book', 'pdf', 'academic', 'other')),
  filename       text,
  notes          text
);

-- ============================================================================
-- 4. CATEGORIES — the أصول taxonomy of the source's page table
-- ============================================================================
-- Open by design: a category met on page 300 is one INSERT, never a DDL change.
-- `is_word_anchored` drives the UI: true → drawn as a marker on the token; false → panel only.

CREATE TABLE IF NOT EXISTS qiraat_categories (
  code              text PRIMARY KEY,
  name_ar           text NOT NULL,
  name_en           text,
  is_word_anchored  boolean NOT NULL DEFAULT true,
  -- true when the category never changes the printed rasm (إمالة, ترقيق, سكت …) — these render as
  -- a ruling marker, not a text substitution, no matter which riwayah is selected.
  changes_rasm      boolean NOT NULL DEFAULT false,
  color_hex         text CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order        smallint NOT NULL DEFAULT 100
);

-- ============================================================================
-- 5. RULES — canonical statements, written ONCE, applied NEVER automatically
-- ============================================================================
-- Per the approved decision: "the rule shall be written, but checking for each word is mandatory".
-- A row here is reference text + its default attribution. It renders nothing on its own. Only a
-- `qiraat_entries` row anchored to a real locus renders.

CREATE TABLE IF NOT EXISTS qiraat_rules (
  id             text PRIMARY KEY,
  category_code  text NOT NULL REFERENCES qiraat_categories(code),
  scope          qiraat_rule_scope NOT NULL DEFAULT 'locus',
  -- The canonical statement, e.g. "ضم هاء الكناية في عليهم/إليهم/لديهم إذا سبقتها ياء ساكنة".
  statement_ar   text NOT NULL,
  -- Global أصول (المد المنفصل, ميم الجمع, نقل ورش, سكت حمزة) live here with scope='global'.
  -- They govern how any page renders for a riwayah and must NOT be buried as a note on page 2.
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qiraat_rules_category_idx ON qiraat_rules (category_code, scope);

-- The rule's DEFAULT attribution. A per-occurrence entry may legitimately differ; the QA view
-- `qiraat_qa_rule_divergence` surfaces that for a human, it is never auto-corrected.
CREATE TABLE IF NOT EXISTS qiraat_rule_authorities (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_id       text NOT NULL REFERENCES qiraat_rules(id) ON DELETE CASCADE,
  authority_id  text NOT NULL REFERENCES qiraat_authorities(id),
  -- One word can carry two DIFFERENT actions by different groups: ﴿بِٱلْهُدَىٰ﴾ is أمالها for
  -- حمزة/الكسائي/خلف but قلّلها for ورش. The action is therefore part of the identity.
  action_ar     text,
  condition_ar  text
);

CREATE UNIQUE INDEX IF NOT EXISTS qiraat_rule_authorities_uniq
  ON qiraat_rule_authorities (rule_id, authority_id, COALESCE(action_ar, ''));

-- ============================================================================
-- 6. PAGES — source page ↔ Mushaf 1441 page mapping
-- ============================================================================
-- NEVER assume the qiraat book's page number equals the Mushaf 1441 page number. Measured on the
-- first 20 pages the offset is a constant +5 (Mushaf 1 = PDF 6), but that is an observation about
-- 20 pages, not a guarantee about 604 — a single inserted plate breaks it. The mapping is data.

CREATE TABLE IF NOT EXISTS qiraat_pages (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_document_id  text NOT NULL REFERENCES qiraat_source_documents(id),
  source_page_number  integer NOT NULL,
  mushaf_page_number  smallint CHECK (mushaf_page_number BETWEEN 1 AND 604),
  surah_number        smallint NOT NULL CHECK (surah_number BETWEEN 1 AND 114),
  surah_name_ar       text NOT NULL,
  ayah_from           smallint CHECK (ayah_from >= 1),
  ayah_to             smallint CHECK (ayah_to >= ayah_from),
  extraction_status   qiraat_verification_status NOT NULL DEFAULT 'EXTRACTED',
  extracted_at        timestamptz,
  reviewed_at         timestamptz,
  notes               text,
  UNIQUE (source_document_id, source_page_number)
);

CREATE INDEX IF NOT EXISTS qiraat_pages_mushaf_idx ON qiraat_pages (mushaf_page_number);

-- Verbatim extraction payload, stored before any normalisation. The governing principle is
-- "preserve the original exactly first; normalise second; correct only after verification" — this
-- table is what makes that auditable. Every later correction can be diffed against what was read.
CREATE TABLE IF NOT EXISTS qiraat_extraction_raw (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page_id        bigint NOT NULL REFERENCES qiraat_pages(id) ON DELETE CASCADE,
  payload        jsonb NOT NULL,
  extractor      text NOT NULL,
  extracted_at   timestamptz NOT NULL DEFAULT now(),
  -- Free-text caveats from the extractor, e.g. "visual extraction at 150 dpi; the text layer was
  -- scrambled and used only for cross-checking; small-print items marked ؟ need the paper original".
  method_notes   text
);

CREATE INDEX IF NOT EXISTS qiraat_extraction_raw_page_idx ON qiraat_extraction_raw (page_id);

-- ============================================================================
-- 7. LOCI — one Quran position, token-anchored
-- ============================================================================
-- A locus may span several words and, for الإدغام الكبير across an ayah boundary
-- (﴿ٱلرَّحِيمِ ۩ مَٰلِكِ﴾ = 1:3 → 1:4), several ayat. The current TS engine cannot express that;
-- the schema must, or that whole category is unrepresentable.

CREATE TABLE IF NOT EXISTS qiraat_loci (
  id                    text PRIMARY KEY,
  page_id               bigint NOT NULL REFERENCES qiraat_pages(id) ON DELETE RESTRICT,
  surah_number          smallint NOT NULL CHECK (surah_number BETWEEN 1 AND 114),
  start_ayah            smallint NOT NULL CHECK (start_ayah >= 1),
  start_word            smallint CHECK (start_word >= 1),
  end_ayah              smallint NOT NULL CHECK (end_ayah >= start_ayah),
  end_word              smallint CHECK (end_word >= 1),
  -- The Hafs/Mushaf-1441 text of this span. MUST be derived from the real Mushaf 1441 word
  -- fixtures, never hand-typed: hand-typing silently reorders combining marks and produces spans
  -- that match nothing at render time.
  base_text             text NOT NULL,
  base_text_normalized  text NOT NULL,
  -- The source's own numbering within its page table ("١", "٢", …).
  location_order        smallint,
  -- "معًا", "جميعًا", "الأول", "الثاني" — the source's own disambiguation when a page has the
  -- same word twice.
  occurrence_note       text,
  mapping_status        qiraat_mapping_status NOT NULL DEFAULT 'unmapped',
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qiraat_loci_span_ordered CHECK (
    end_ayah > start_ayah OR start_word IS NULL OR end_word IS NULL OR end_word >= start_word
  )
);

CREATE INDEX IF NOT EXISTS qiraat_loci_page_idx     ON qiraat_loci (page_id, location_order);
CREATE INDEX IF NOT EXISTS qiraat_loci_position_idx ON qiraat_loci (surah_number, start_ayah, start_word);
CREATE INDEX IF NOT EXISTS qiraat_loci_mapping_idx  ON qiraat_loci (mapping_status)
  WHERE mapping_status <> 'verified';
CREATE INDEX IF NOT EXISTS qiraat_loci_norm_idx     ON qiraat_loci (base_text_normalized);

-- ============================================================================
-- 8. ENTRIES — the shared parent of variants and rulings
-- ============================================================================
-- A variant changes the printed rasm and carries a reading_text. A ruling (أصول) does not and
-- carries an action instead. Everything else — the locus, the attribution, verification, sources,
-- evidence, flags — is identical, so it lives once, here. "Everything marked on this page for
-- riwayah X" is then a single join rather than a union of two divergent shapes.

CREATE TABLE IF NOT EXISTS qiraat_entries (
  id                   text PRIMARY KEY,
  locus_id             text NOT NULL REFERENCES qiraat_loci(id) ON DELETE CASCADE,
  page_id              bigint NOT NULL REFERENCES qiraat_pages(id) ON DELETE RESTRICT,
  kind                 qiraat_entry_kind NOT NULL,
  entry_order          smallint NOT NULL DEFAULT 1,
  attribution_mode     qiraat_attribution_mode NOT NULL DEFAULT 'explicit',
  verification_status  qiraat_verification_status NOT NULL DEFAULT 'EXTRACTED',
  -- true only for demo/most fixtures that must never reach a reader, even in debug mode.
  synthetic            boolean NOT NULL DEFAULT false,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locus_id, kind, entry_order)
);

CREATE INDEX IF NOT EXISTS qiraat_entries_locus_idx  ON qiraat_entries (locus_id);
CREATE INDEX IF NOT EXISTS qiraat_entries_page_idx   ON qiraat_entries (page_id, kind);
CREATE INDEX IF NOT EXISTS qiraat_entries_status_idx ON qiraat_entries (verification_status);

-- --- variant detail (changes the rasm) -------------------------------------
CREATE TABLE IF NOT EXISTS qiraat_variant_details (
  entry_id                text PRIMARY KEY REFERENCES qiraat_entries(id) ON DELETE CASCADE,
  reading_text            text NOT NULL,
  reading_text_normalized text NOT NULL,
  -- The Uthmani rasm when it differs from a plain-Unicode rendering of reading_text.
  uthmani_text            text,
  -- The source's own gloss: "بألف", "بلا ألف", "بإسكان الهاء", "بإشمام كسر القاف ضمًّا".
  description_ar          text,
  variant_type            qiraat_variant_type NOT NULL DEFAULT 'other',
  -- true when this وجه is what the Mushaf 1441 baseline (Hafs) already prints. Exactly one وجه per
  -- locus should be the baseline; the engine renders nothing special for it.
  is_baseline_reading     boolean NOT NULL DEFAULT false,
  -- A phonetic-only difference: reading_text equals base_text and only the performance differs
  -- (إشمام, اختلاس, سكت). Never encoded as a fake spelling change.
  performance_note        text
);

-- --- ruling detail (does NOT change the rasm) ------------------------------
CREATE TABLE IF NOT EXISTS qiraat_ruling_details (
  entry_id       text PRIMARY KEY REFERENCES qiraat_entries(id) ON DELETE CASCADE,
  category_code  text NOT NULL REFERENCES qiraat_categories(code),
  -- The canonical rule this occurrence instantiates, when one exists. Optional: a one-off with no
  -- catalogue entry is legitimate. The link exists for QA divergence reporting, NOT for inheritance —
  -- nothing is ever derived from the rule at render time.
  rule_id        text REFERENCES qiraat_rules(id),
  -- The source's verbatim text for this occurrence, e.g. "أمالها أبو عمرو، الدوري عن الكسائي،
  -- وقلّلها ورش". Kept whole so a reviewer can always see what was actually printed.
  text_ar        text,
  -- An enumerated list of choices carrying NO reader attribution (القصر/التوسط/الإشباع) — every
  -- reader may choose among these, so there is nothing to attribute per-reading.
  options        text[]
);

-- عد الآي attribution. A link table, not an array column, so the FK is actually enforced and a
-- typo'd school id fails at write time instead of silently rendering nothing.
CREATE TABLE IF NOT EXISTS qiraat_entry_count_schools (
  entry_id         text NOT NULL REFERENCES qiraat_entries(id) ON DELETE CASCADE,
  count_school_id  text NOT NULL REFERENCES qiraat_count_schools(id),
  PRIMARY KEY (entry_id, count_school_id)
);

CREATE INDEX IF NOT EXISTS qiraat_ruling_details_category_idx ON qiraat_ruling_details (category_code);
CREATE INDEX IF NOT EXISTS qiraat_ruling_details_rule_idx     ON qiraat_ruling_details (rule_id);

-- ============================================================================
-- 9. ATTRIBUTION — verbatim (source level) and expanded (render level)
-- ============================================================================
-- Two tables on purpose:
--   `qiraat_entry_authorities` keeps EXACTLY what the source said, at the level it said it.
--     The source writes "أبو عمرو، ابن عامر، حفص، حمزة" — three readers and one narrator in one
--     row. Flattening that to 20 reading ids at write time would destroy the ability to show the
--     user what the book actually prints, and to re-verify against it.
--   `qiraat_entry_readings` is the expanded 20-reading set, DERIVED by
--     `qiraat_expand_entry_readings()`. Rendering and filtering read only this, so "does riwayah X
--     read this?" is an index hit rather than a recursive tree walk per token per page turn.

CREATE TABLE IF NOT EXISTS qiraat_entry_authorities (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id       text NOT NULL REFERENCES qiraat_entries(id) ON DELETE CASCADE,
  authority_id   text NOT NULL REFERENCES qiraat_authorities(id),
  -- What this authority DOES here. Required for rulings, where one word carries two different
  -- actions by different groups (﴿بِٱلْهُدَىٰ﴾: إمالة for حمزة/الكسائي/خلف, تقليل for ورش).
  action_ar      text,
  -- "بخلف عنه", "وقفًا", "وصلًا", "الوجه الثاني له" — the source's own qualifier, kept verbatim.
  condition_ar   text,
  -- Set with entry.attribution_mode = 'all_except': this authority is the EXCLUSION, not a reader
  -- of the entry ("جميع القراء عدا أبي جعفر").
  is_exception   boolean NOT NULL DEFAULT false,
  -- «بخلف عنه» — two equally valid وجهان for the same authority at the same locus. Rows sharing an
  -- option_group are alternatives; exactly one carries is_default. The reader UI marks such a word
  -- "ذو وجهين", renders the default, and lists both on tap. Never silently picks one.
  option_group   smallint,
  is_default     boolean NOT NULL DEFAULT true,
  alternate_note text
);

CREATE UNIQUE INDEX IF NOT EXISTS qiraat_entry_authorities_uniq
  ON qiraat_entry_authorities (entry_id, authority_id, COALESCE(action_ar, ''));
CREATE INDEX IF NOT EXISTS qiraat_entry_authorities_authority_idx
  ON qiraat_entry_authorities (authority_id);

-- Derived. Never written by hand — `qiraat_rebuild_entry_readings()` owns it.
CREATE TABLE IF NOT EXISTS qiraat_entry_readings (
  entry_id    text NOT NULL REFERENCES qiraat_entries(id) ON DELETE CASCADE,
  reading_id  text NOT NULL REFERENCES qiraat_authorities(id),
  -- '' rather than NULL so this can be a plain composite primary key (Postgres forbids an
  -- expression in a PRIMARY KEY, and a nullable column there would not enforce uniqueness).
  action_ar   text NOT NULL DEFAULT '',
  is_default  boolean NOT NULL DEFAULT true,
  PRIMARY KEY (entry_id, reading_id, action_ar)
);

CREATE INDEX IF NOT EXISTS qiraat_entry_readings_reading_idx ON qiraat_entry_readings (reading_id);

-- ============================================================================
-- 10. EVIDENCE (الشواهد) — deduplicated
-- ============================================================================
-- The Shatibiyyah line for عليهم appears verbatim 8 times in the first 20 pages. Stored per
-- occurrence it would be repeated thousands of times across 604 pages, and a transcription fix
-- would mean editing every copy. Canonical text + link is the only maintainable shape.

CREATE TABLE IF NOT EXISTS qiraat_evidence_texts (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_document_id  text NOT NULL REFERENCES qiraat_source_documents(id),
  text_ar             text NOT NULL,
  text_normalized     text NOT NULL,
  notes               text,
  UNIQUE (source_document_id, text_normalized)
);

CREATE TABLE IF NOT EXISTS qiraat_evidence_links (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  evidence_text_id   bigint NOT NULL REFERENCES qiraat_evidence_texts(id) ON DELETE CASCADE,
  page_id            bigint NOT NULL REFERENCES qiraat_pages(id) ON DELETE CASCADE,
  locus_id           text REFERENCES qiraat_loci(id) ON DELETE CASCADE,
  evidence_order     smallint,
  -- true when the source printed the line abbreviated with "…" on this page. The canonical text
  -- stays whole; this records how it appeared here.
  is_abbreviated     boolean NOT NULL DEFAULT false,
  UNIQUE (evidence_text_id, page_id, locus_id)
);

CREATE INDEX IF NOT EXISTS qiraat_evidence_links_locus_idx ON qiraat_evidence_links (locus_id);
CREATE INDEX IF NOT EXISTS qiraat_evidence_links_page_idx  ON qiraat_evidence_links (page_id);

-- ============================================================================
-- 11. NOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS qiraat_notes (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page_id       bigint REFERENCES qiraat_pages(id) ON DELETE CASCADE,
  locus_id      text REFERENCES qiraat_loci(id) ON DELETE CASCADE,
  entry_id      text REFERENCES qiraat_entries(id) ON DELETE CASCADE,
  authority_id  text REFERENCES qiraat_authorities(id),
  note_type     text NOT NULL DEFAULT 'general',
  text_ar       text NOT NULL,
  note_order    smallint,
  CONSTRAINT qiraat_notes_has_target CHECK (
    page_id IS NOT NULL OR locus_id IS NOT NULL OR entry_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS qiraat_notes_page_idx  ON qiraat_notes (page_id);
CREATE INDEX IF NOT EXISTS qiraat_notes_locus_idx ON qiraat_notes (locus_id);

-- ============================================================================
-- 12. QA FLAGS
-- ============================================================================
-- Distinct from verification_status: status is a record's lifecycle stage, a flag is one concrete
-- unresolved question about one field, with its own resolution workflow. The 20-page extraction
-- already ships ~15 "؟" markers (pages 9, 11, 16, 19) plus two internal contradictions — those
-- import as flags, not as silently-trusted data.

CREATE TABLE IF NOT EXISTS qiraat_qa_flags (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  page_id        bigint REFERENCES qiraat_pages(id) ON DELETE CASCADE,
  locus_id       text REFERENCES qiraat_loci(id) ON DELETE CASCADE,
  entry_id       text REFERENCES qiraat_entries(id) ON DELETE CASCADE,
  severity       qiraat_flag_severity NOT NULL,
  -- 'source_ambiguous' | 'contradiction' | 'unmapped_token' | 'partition_gap' |
  -- 'partition_overlap' | 'rule_divergence' | 'transcription_uncertain' | …
  flag_type      text NOT NULL,
  field_name     text,
  original_text  text,
  issue_ar       text NOT NULL,
  status         qiraat_flag_status NOT NULL DEFAULT 'open',
  resolved_note  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz
);

CREATE INDEX IF NOT EXISTS qiraat_qa_flags_open_idx ON qiraat_qa_flags (status, severity)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS qiraat_qa_flags_page_idx ON qiraat_qa_flags (page_id);

-- ============================================================================
-- 13. EXPANSION — verbatim attribution → the 20 Riwayat
-- ============================================================================

-- Every Riwayah covered by one authority: a narrator is itself, a reader is both its narrators,
-- a route is its parent narrator.
CREATE OR REPLACE FUNCTION qiraat_authority_readings(p_authority_id text)
RETURNS TABLE (reading_id text)
LANGUAGE sql STABLE AS $$
  SELECT a.id
    FROM qiraat_authorities a
   WHERE a.authority_type = 'narrator'
     AND (
       a.id = p_authority_id                                              -- narrator
       OR a.parent_id = p_authority_id                                    -- reader → its 2 narrators
       OR a.id = (SELECT parent_id FROM qiraat_authorities WHERE id = p_authority_id
                   AND authority_type = 'route')                          -- route → its narrator
     );
$$;

-- Rebuild the derived reading set for one entry. Resolves all three attribution modes:
--   explicit   — union of each named authority's readings.
--   all_except — all 20 minus the readings of the authorities flagged is_exception.
--   remainder  — "الباقون": all 20 minus every reading already claimed by a SIBLING entry at the
--                same locus. This is why remainder entries must be rebuilt after their siblings;
--                `qiraat_rebuild_locus_readings` handles the ordering.
CREATE OR REPLACE FUNCTION qiraat_rebuild_entry_readings(p_entry_id text)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_mode    qiraat_attribution_mode;
  v_locus   text;
  v_count   integer;
BEGIN
  SELECT attribution_mode, locus_id INTO v_mode, v_locus
    FROM qiraat_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'qiraat_rebuild_entry_readings: unknown entry %', p_entry_id;
  END IF;

  DELETE FROM qiraat_entry_readings WHERE entry_id = p_entry_id;

  IF v_mode = 'explicit' THEN
    INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
    SELECT DISTINCT ON (r.reading_id, COALESCE(ea.action_ar, ''))
           p_entry_id, r.reading_id, COALESCE(ea.action_ar, ''), ea.is_default
      FROM qiraat_entry_authorities ea
      CROSS JOIN LATERAL qiraat_authority_readings(ea.authority_id) r
     WHERE ea.entry_id = p_entry_id
       AND NOT ea.is_exception;

  ELSIF v_mode = 'all_except' THEN
    INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
    SELECT p_entry_id, n.id, '', true
      FROM qiraat_authorities n
     WHERE n.authority_type = 'narrator'
       AND n.id NOT IN (
         SELECT r.reading_id
           FROM qiraat_entry_authorities ea
           CROSS JOIN LATERAL qiraat_authority_readings(ea.authority_id) r
          WHERE ea.entry_id = p_entry_id AND ea.is_exception
       );

  ELSIF v_mode = 'remainder' THEN
    INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
    SELECT p_entry_id, n.id, '', true
      FROM qiraat_authorities n
     WHERE n.authority_type = 'narrator'
       AND n.id NOT IN (
         SELECT er.reading_id
           FROM qiraat_entry_readings er
           JOIN qiraat_entries e ON e.id = er.entry_id
          WHERE e.locus_id = v_locus
            AND e.id <> p_entry_id
       );
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Rebuild a whole locus in dependency order: explicit/all_except first, then remainder.
CREATE OR REPLACE FUNCTION qiraat_rebuild_locus_readings(p_locus_id text)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  v_entry text;
  v_total integer := 0;
BEGIN
  FOR v_entry IN
    SELECT id FROM qiraat_entries
     WHERE locus_id = p_locus_id
     ORDER BY (attribution_mode = 'remainder'), entry_order
  LOOP
    v_total := v_total + qiraat_rebuild_entry_readings(v_entry);
  END LOOP;
  RETURN v_total;
END;
$$;

-- Keep the derived table honest: any write to the verbatim attribution rebuilds the locus. This is
-- what guarantees the two can never drift, which is the whole reason it is safe to render from the
-- derived table.
CREATE OR REPLACE FUNCTION qiraat_entry_authorities_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_locus text;
BEGIN
  SELECT locus_id INTO v_locus FROM qiraat_entries
   WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);
  IF v_locus IS NOT NULL THEN
    PERFORM qiraat_rebuild_locus_readings(v_locus);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS qiraat_entry_authorities_sync_trg ON qiraat_entry_authorities;
CREATE TRIGGER qiraat_entry_authorities_sync_trg
  AFTER INSERT OR UPDATE OR DELETE ON qiraat_entry_authorities
  FOR EACH ROW EXECUTE FUNCTION qiraat_entry_authorities_sync();

CREATE OR REPLACE FUNCTION qiraat_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS qiraat_entries_touch ON qiraat_entries;
CREATE TRIGGER qiraat_entries_touch BEFORE UPDATE ON qiraat_entries
  FOR EACH ROW EXECUTE FUNCTION qiraat_touch_updated_at();

DROP TRIGGER IF EXISTS qiraat_loci_touch ON qiraat_loci;
CREATE TRIGGER qiraat_loci_touch BEFORE UPDATE ON qiraat_loci
  FOR EACH ROW EXECUTE FUNCTION qiraat_touch_updated_at();

-- ============================================================================
-- 14. QA VIEWS — the dataset's own linter, runnable in CI
-- ============================================================================

-- A variant locus must partition all 20 Riwayat exactly once: every reading accounted for, none
-- twice. This is what catches the two contradictions already present in the 20-page extraction
-- (page 12 ﴿لا تعبدون﴾ lists حمزة and الكسائي under BOTH أوجه; page 14 ﴿قلوبهم العجل﴾ lists خلف
-- under two). Rulings are deliberately excluded: only ورش has ترقيق, and that is not a gap.
CREATE OR REPLACE VIEW qiraat_qa_partition AS
WITH variant_loci AS (
  SELECT DISTINCT e.locus_id
    FROM qiraat_entries e
   WHERE e.kind = 'variant' AND e.verification_status <> 'REJECTED'
),
claims AS (
  SELECT e.locus_id, er.reading_id, count(*) AS claim_count
    FROM qiraat_entries e
    JOIN qiraat_entry_readings er ON er.entry_id = e.id
   WHERE e.kind = 'variant' AND e.verification_status <> 'REJECTED'
   GROUP BY e.locus_id, er.reading_id
)
SELECT
  vl.locus_id,
  l.base_text,
  l.page_id,
  20 - count(c.reading_id) FILTER (WHERE c.claim_count >= 1)        AS missing_readings,
  count(c.reading_id) FILTER (WHERE c.claim_count > 1)              AS overlapping_readings,
  array_agg(c.reading_id ORDER BY c.reading_id)
    FILTER (WHERE c.claim_count > 1)                                AS overlap_ids
FROM variant_loci vl
JOIN qiraat_loci l ON l.id = vl.locus_id
LEFT JOIN claims c ON c.locus_id = vl.locus_id
GROUP BY vl.locus_id, l.base_text, l.page_id;

-- «بخلف عنه» sanity: an authority with two أوجه at one locus must have exactly one default.
CREATE OR REPLACE VIEW qiraat_qa_alternates AS
SELECT
  e.locus_id,
  ea.authority_id,
  count(*)                                        AS wajh_count,
  count(*) FILTER (WHERE ea.is_default)           AS default_count
FROM qiraat_entry_authorities ea
JOIN qiraat_entries e ON e.id = ea.entry_id
WHERE NOT ea.is_exception
GROUP BY e.locus_id, ea.authority_id
HAVING count(*) > 1 AND count(*) FILTER (WHERE ea.is_default) <> 1;

-- A per-occurrence ruling whose attribution differs from its canonical rule's. NOT an error — the
-- rule genuinely does not hold at every occurrence, which is precisely why each one is checked by
-- hand. This is a review queue, not a failure.
CREATE OR REPLACE VIEW qiraat_qa_rule_divergence AS
SELECT
  e.id                       AS entry_id,
  e.locus_id,
  rd.rule_id,
  l.base_text,
  array_agg(DISTINCT ea.authority_id ORDER BY ea.authority_id) AS entry_authorities,
  (SELECT array_agg(DISTINCT ra.authority_id ORDER BY ra.authority_id)
     FROM qiraat_rule_authorities ra WHERE ra.rule_id = rd.rule_id) AS rule_authorities
FROM qiraat_entries e
JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
JOIN qiraat_loci l ON l.id = e.locus_id
LEFT JOIN qiraat_entry_authorities ea ON ea.entry_id = e.id
WHERE rd.rule_id IS NOT NULL
GROUP BY e.id, e.locus_id, rd.rule_id, l.base_text
HAVING array_agg(DISTINCT ea.authority_id ORDER BY ea.authority_id) IS DISTINCT FROM
       (SELECT array_agg(DISTINCT ra.authority_id ORDER BY ra.authority_id)
          FROM qiraat_rule_authorities ra WHERE ra.rule_id = rd.rule_id);

-- Anything that must never reach a reader.
CREATE OR REPLACE VIEW qiraat_qa_blocking AS
SELECT 'unmapped_locus' AS issue, l.id AS ref, l.base_text AS detail
  FROM qiraat_loci l WHERE l.mapping_status <> 'verified'
UNION ALL
SELECT 'published_without_source', e.id, l.base_text
  FROM qiraat_entries e
  JOIN qiraat_loci l ON l.id = e.locus_id
 WHERE e.verification_status IN ('VERIFIED', 'PUBLISHED')
   AND NOT EXISTS (SELECT 1 FROM qiraat_evidence_links el WHERE el.locus_id = e.locus_id)
UNION ALL
SELECT 'open_error_flag', f.id::text, f.issue_ar
  FROM qiraat_qa_flags f WHERE f.status = 'open' AND f.severity = 'error';

-- ============================================================================
-- 15. EXPORT — the whole fixture-generation pipeline, as one query
-- ============================================================================
-- Postgres is the source of truth; the app still serves build-time JSON fixtures so a page turn
-- costs no network round-trip and the reader keeps working when the Mac Mini is unreachable.
-- `scripts/export-qiraat-fixtures.mjs` calls this once per page and writes the result verbatim.
-- Set p_include_unpublished only for the developer/review build.

CREATE OR REPLACE FUNCTION qiraat_export_page(
  p_mushaf_page          smallint,
  p_include_unpublished  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH pg AS (
  SELECT * FROM qiraat_pages WHERE mushaf_page_number = p_mushaf_page
),
visible AS (
  SELECT e.*
    FROM qiraat_entries e
    JOIN pg ON pg.id = e.page_id
   WHERE NOT e.synthetic
     AND (p_include_unpublished OR e.verification_status IN ('VERIFIED', 'PUBLISHED'))
     AND e.verification_status <> 'REJECTED'
)
SELECT jsonb_build_object(
  'mushafPage', p_mushaf_page,
  'sourcePage', (SELECT source_page_number FROM pg),
  'surah',      (SELECT surah_number FROM pg),
  'ayahFrom',   (SELECT ayah_from FROM pg),
  'ayahTo',     (SELECT ayah_to FROM pg),
  'entries', COALESCE((
    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',            v.id,
      'kind',          v.kind,
      'order',         v.entry_order,
      'status',        v.verification_status,
      'notes',         v.notes,
      'locus', jsonb_build_object(
        'id',         l.id,
        'surah',      l.surah_number,
        'startAyah',  l.start_ayah,
        'startWord',  l.start_word,
        'endAyah',    l.end_ayah,
        'endWord',    l.end_word,
        'baseText',   l.base_text,
        'occurrence', l.occurrence_note,
        'mapping',    l.mapping_status
      ),
      'variant', (
        SELECT jsonb_strip_nulls(jsonb_build_object(
          'readingText',     vd.reading_text,
          'uthmaniText',     vd.uthmani_text,
          'description',     vd.description_ar,
          'variantType',     vd.variant_type,
          'isBaseline',      vd.is_baseline_reading,
          'performanceNote', vd.performance_note))
          FROM qiraat_variant_details vd WHERE vd.entry_id = v.id),
      'ruling', (
        SELECT jsonb_strip_nulls(jsonb_build_object(
          'category',     rd.category_code,
          'categoryAr',   c.name_ar,
          'ruleId',       rd.rule_id,
          'text',         rd.text_ar,
          'options',      to_jsonb(rd.options),
          'wordAnchored', c.is_word_anchored))
          FROM qiraat_ruling_details rd
          JOIN qiraat_categories c ON c.code = rd.category_code
         WHERE rd.entry_id = v.id),
      -- Verbatim, at the level the book printed it.
      'attribution', (
        SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'authorityId', ea.authority_id,
          'action',      ea.action_ar,
          'condition',   ea.condition_ar,
          'isException', NULLIF(ea.is_exception, false),
          'isDefault',   ea.is_default)) ORDER BY ea.authority_id)
          FROM qiraat_entry_authorities ea WHERE ea.entry_id = v.id),
      -- Expanded, for rendering.
      'readingIds', (
        SELECT jsonb_agg(DISTINCT er.reading_id)
          FROM qiraat_entry_readings er WHERE er.entry_id = v.id),
      -- Words the reader must mark "ذو وجهين".
      'alternates', (
        SELECT jsonb_agg(DISTINCT er.reading_id)
          FROM qiraat_entry_readings er
         WHERE er.entry_id = v.id AND NOT er.is_default),
      'countSchools', (
        SELECT jsonb_agg(ecs.count_school_id ORDER BY ecs.count_school_id)
          FROM qiraat_entry_count_schools ecs WHERE ecs.entry_id = v.id),
      'evidence', (
        SELECT jsonb_agg(jsonb_build_object(
          'source', et.source_document_id,
          'text',   et.text_ar) ORDER BY el.evidence_order)
          FROM qiraat_evidence_links el
          JOIN qiraat_evidence_texts et ON et.id = el.evidence_text_id
         WHERE el.locus_id = v.locus_id),
      'flags', (
        SELECT jsonb_agg(jsonb_build_object(
          'severity', f.severity, 'type', f.flag_type, 'issue', f.issue_ar))
          FROM qiraat_qa_flags f
         WHERE f.status = 'open' AND (f.entry_id = v.id OR f.locus_id = v.locus_id))
    )) ORDER BY l.start_ayah, l.start_word, v.entry_order)
    FROM visible v JOIN qiraat_loci l ON l.id = v.locus_id), '[]'::jsonb),
  'pageNotes', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('type', n.note_type, 'text', n.text_ar)
             ORDER BY n.note_order)
      FROM qiraat_notes n JOIN pg ON pg.id = n.page_id
     WHERE n.locus_id IS NULL AND n.entry_id IS NULL), '[]'::jsonb)
);
$$;

-- ============================================================================
-- 16. RLS — shared reference data: everyone reads published, service role writes
-- ============================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'qiraat_authorities', 'qiraat_count_schools', 'qiraat_source_documents', 'qiraat_categories',
    'qiraat_rules', 'qiraat_rule_authorities', 'qiraat_pages', 'qiraat_extraction_raw',
    'qiraat_loci', 'qiraat_entries', 'qiraat_variant_details', 'qiraat_ruling_details',
    'qiraat_entry_count_schools', 'qiraat_entry_authorities', 'qiraat_entry_readings',
    'qiraat_evidence_texts', 'qiraat_evidence_links', 'qiraat_notes', 'qiraat_qa_flags'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Catalogue tables: public, nothing to hide.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'qiraat_authorities', 'qiraat_count_schools', 'qiraat_source_documents',
    'qiraat_categories', 'qiraat_rules', 'qiraat_rule_authorities'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_read_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', t || '_read_all', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS qiraat_pages_read_all ON qiraat_pages;
CREATE POLICY qiraat_pages_read_all ON qiraat_pages FOR SELECT USING (true);

DROP POLICY IF EXISTS qiraat_loci_read_all ON qiraat_loci;
CREATE POLICY qiraat_loci_read_all ON qiraat_loci FOR SELECT USING (true);

-- An unverified entry is structurally invisible to the anon key, not merely hidden by application
-- logic. The developer "include reviewed" view must therefore run over the service-role client —
-- never by relaxing this policy.
DROP POLICY IF EXISTS qiraat_entries_read_published ON qiraat_entries;
CREATE POLICY qiraat_entries_read_published ON qiraat_entries FOR SELECT
  USING (verification_status IN ('VERIFIED', 'PUBLISHED') AND NOT synthetic);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'qiraat_variant_details', 'qiraat_ruling_details', 'qiraat_entry_count_schools',
    'qiraat_entry_authorities', 'qiraat_entry_readings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_read_published', t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR SELECT USING (
        EXISTS (SELECT 1 FROM qiraat_entries e
                 WHERE e.id = %I.entry_id
                   AND e.verification_status IN ('VERIFIED','PUBLISHED')
                   AND NOT e.synthetic))$f$, t || '_read_published', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS qiraat_evidence_texts_read_all ON qiraat_evidence_texts;
CREATE POLICY qiraat_evidence_texts_read_all ON qiraat_evidence_texts FOR SELECT USING (true);

DROP POLICY IF EXISTS qiraat_evidence_links_read_all ON qiraat_evidence_links;
CREATE POLICY qiraat_evidence_links_read_all ON qiraat_evidence_links FOR SELECT USING (true);

DROP POLICY IF EXISTS qiraat_notes_read_all ON qiraat_notes;
CREATE POLICY qiraat_notes_read_all ON qiraat_notes FOR SELECT USING (true);

-- Review-pipeline internals: service role only. No SELECT policy = no anon access at all.
-- (qiraat_extraction_raw and qiraat_qa_flags intentionally have none.)

-- ============================================================================
-- 17. SEED — the permanent catalogue
-- ============================================================================
-- Mirrors packages/qiraat-core/{readers,narrators}.ts EXACTLY. IDs, colors and sort order are
-- permanent: never renumber, never re-colour, never key anything by an Arabic name.

INSERT INTO qiraat_authorities
  (id, authority_type, parent_id, name_ar, name_ar_short, name_en, slug, color_hex, sort_order)
VALUES
  ('Q01', 'reader', NULL, 'نافع المدني', 'نافع', 'Nafi al-Madani', 'nafi-al-madani', '#2563EB', 1),
  ('Q02', 'reader', NULL, 'ابن كثير المكي', 'ابن كثير', 'Ibn Kathir al-Makki', 'ibn-kathir-al-makki', '#16A34A', 2),
  ('Q03', 'reader', NULL, 'أبو عمرو البصري', 'أبو عمرو', 'Abu Amr al-Basri', 'abu-amr-al-basri', '#0891B2', 3),
  ('Q04', 'reader', NULL, 'ابن عامر الشامي', 'ابن عامر', 'Ibn Amir ash-Shami', 'ibn-amir-ash-shami', '#7C3AED', 4),
  ('Q05', 'reader', NULL, 'عاصم الكوفي', 'عاصم', 'Asim al-Kufi', 'asim-al-kufi', '#EA580C', 5),
  ('Q06', 'reader', NULL, 'حمزة الكوفي', 'حمزة', 'Hamzah al-Kufi', 'hamzah-al-kufi', '#DC2626', 6),
  ('Q07', 'reader', NULL, 'الكسائي الكوفي', 'الكسائي', 'Al-Kisai', 'al-kisai', '#DB2777', 7),
  ('Q08', 'reader', NULL, 'أبو جعفر المدني', 'أبو جعفر', 'Abu Jafar al-Madani', 'abu-jafar-al-madani', '#CA8A04', 8),
  ('Q09', 'reader', NULL, 'يعقوب الحضرمي', 'يعقوب', 'Yaqub al-Hadrami', 'yaqub-al-hadrami', '#B45309', 9),
  ('Q10', 'reader', NULL, 'خلف العاشر', 'خلف العاشر', 'Khalaf al-Ashir', 'khalaf-al-ashir', '#475569', 10),
  ('Q01-R01', 'narrator', 'Q01', 'قالون', 'قالون', 'Qalun', 'qalun', '#60A5FA', 1),
  ('Q01-R02', 'narrator', 'Q01', 'ورش', 'ورش', 'Warsh', 'warsh', '#1D4ED8', 2),
  ('Q02-R01', 'narrator', 'Q02', 'البزي', 'البزي', 'Al-Bazzi', 'al-bazzi', '#4ADE80', 1),
  ('Q02-R02', 'narrator', 'Q02', 'قنبل', 'قنبل', 'Qunbul', 'qunbul', '#15803D', 2),
  ('Q03-R01', 'narrator', 'Q03', 'الدوري عن أبي عمرو', 'الدوري عن أبي عمرو', 'Al-Duri (an Abi Amr)', 'al-duri-an-abi-amr', '#67E8F9', 1),
  ('Q03-R02', 'narrator', 'Q03', 'السوسي', 'السوسي', 'Al-Susi', 'al-susi', '#0E7490', 2),
  ('Q04-R01', 'narrator', 'Q04', 'هشام', 'هشام', 'Hisham', 'hisham', '#A78BFA', 1),
  ('Q04-R02', 'narrator', 'Q04', 'ابن ذكوان', 'ابن ذكوان', 'Ibn Dhakwan', 'ibn-dhakwan', '#6D28D9', 2),
  ('Q05-R01', 'narrator', 'Q05', 'شعبة', 'شعبة', 'Shu''bah', 'shubah', '#FB923C', 1),
  ('Q05-R02', 'narrator', 'Q05', 'حفص', 'حفص', 'Hafs', 'hafs', '#C2410C', 2),
  ('Q06-R01', 'narrator', 'Q06', 'خلف', 'خلف', 'Khalaf', 'khalaf-an-hamzah', '#F87171', 1),
  ('Q06-R02', 'narrator', 'Q06', 'خلاد', 'خلاد', 'Khallad', 'khallad', '#B91C1C', 2),
  ('Q07-R01', 'narrator', 'Q07', 'أبو الحارث', 'أبو الحارث', 'Abu al-Harith', 'abu-al-harith', '#F472B6', 1),
  ('Q07-R02', 'narrator', 'Q07', 'الدوري عن الكسائي', 'الدوري عن الكسائي', 'Al-Duri (an al-Kisai)', 'al-duri-an-al-kisai', '#BE185D', 2),
  ('Q08-R01', 'narrator', 'Q08', 'ابن وردان', 'ابن وردان', 'Ibn Wardan', 'ibn-wardan', '#FACC15', 1),
  ('Q08-R02', 'narrator', 'Q08', 'ابن جماز', 'ابن جماز', 'Ibn Jammaz', 'ibn-jammaz', '#A16207', 2),
  ('Q09-R01', 'narrator', 'Q09', 'رويس', 'رويس', 'Ruways', 'ruways', '#F59E0B', 1),
  ('Q09-R02', 'narrator', 'Q09', 'روح', 'روح', 'Rawh', 'rawh', '#92400E', 2),
  ('Q10-R01', 'narrator', 'Q10', 'إسحاق', 'إسحاق', 'Ishaq', 'ishaq', '#94A3B8', 1),
  ('Q10-R02', 'narrator', 'Q10', 'إدريس', 'إدريس', 'Idris', 'idris', '#334155', 2)
ON CONFLICT (id) DO UPDATE SET
  authority_type = EXCLUDED.authority_type, parent_id = EXCLUDED.parent_id,
  name_ar = EXCLUDED.name_ar, name_ar_short = EXCLUDED.name_ar_short,
  name_en = EXCLUDED.name_en, slug = EXCLUDED.slug,
  color_hex = EXCLUDED.color_hex, sort_order = EXCLUDED.sort_order;

-- Ayah-counting schools — a separate taxonomy. "المدنيان" in the source means both Madani schools.
INSERT INTO qiraat_count_schools (id, name_ar, name_en, sort_order) VALUES
  ('CS-MADANI-1', 'المدني الأول', 'First Madani', 1),
  ('CS-MADANI-2', 'المدني الأخير', 'Last Madani', 2),
  ('CS-MAKKI',    'المكي',        'Makki',       3),
  ('CS-KUFI',     'الكوفي',       'Kufi',        4),
  ('CS-BASRI',    'البصري',       'Basri',       5),
  ('CS-SHAMI',    'الشامي',       'Shami',       6)
ON CONFLICT (id) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
  sort_order = EXCLUDED.sort_order;

INSERT INTO qiraat_source_documents (id, name_ar, name_en, document_type, filename, notes) VALUES
  ('SRC-MUSHAF-10', 'مصحف القراءات العشر', 'Mushaf of the Ten Readings', 'pdf',
   'مصحف القراءات العشر-1.pdf',
   'Primary source. Mushaf page N appears on PDF page N+5 across pages 1-20; verify per page, never assume.'),
  ('SH', 'حرز الأماني ووجه التهاني (الشاطبية)', 'Al-Shatibiyyah', 'poem', NULL,
   'Evidence for the seven readers. Cited as "ش" in the source page tables.'),
  ('D',  'الدرة المضية', 'Al-Durrah al-Mudiyyah', 'poem', NULL,
   'Evidence for the three completing the ten. Cited as "د".'),
  ('T',  'طيبة النشر', 'Tayyibat al-Nashr', 'poem', NULL,
   'Not present in the first 20 pages; seeded so a later citation needs no schema change.')
ON CONFLICT (id) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
  document_type = EXCLUDED.document_type, filename = EXCLUDED.filename, notes = EXCLUDED.notes;

-- The أصول taxonomy observed across the first 20 pages. `is_word_anchored` decides whether the
-- reader draws a marker on the token or lists the rule in the side panel only.
INSERT INTO qiraat_categories (code, name_ar, name_en, is_word_anchored, changes_rasm, sort_order) VALUES
  ('AYAH_COUNT',      'عد الآي',                  'Ayah counting',          false, false,  10),
  ('SILAT_HA',        'صلة هاء الكناية',          'Ha al-kinayah silah',    true,  false,  20),
  ('TARQIQ_RA',       'ترقيق الراءات',            'Ra tarqiq',              true,  false,  30),
  ('TAGHLIZ_LAM',     'تغليظ اللامات',            'Lam taghliz',            true,  false,  40),
  ('MADD_BADAL',      'مد البدل',                 'Madd al-badal',          true,  false,  50),
  ('MADD_LIN',        'مد اللين المهموز',         'Madd al-lin',            true,  false,  60),
  ('IMALAH_TAQLIL',   'الممال والمقلل',           'Imalah and taqlil',      true,  false,  70),
  ('IDGHAM_SAGHIR',   'المدغم الصغير',            'Small idgham',           true,  false,  80),
  ('IDGHAM_KABIR',    'المدغم الكبير',            'Great idgham',           true,  false,  90),
  ('TAGHYIR_HAMZ',    'تغيير الهمز',              'Hamz alteration',        true,  false, 100),
  ('HAMZATAN_KALIMA', 'الهمزتان من كلمة',         'Two hamzas, one word',   true,  false, 110),
  ('HAMZATAN_KALIMATAYN','الهمزتان من كلمتين',    'Two hamzas, two words',  true,  false, 120),
  ('TARK_GHUNNA',     'ترك الغنة',                'Dropping ghunnah',       true,  false, 130),
  ('IKHFA',           'الإخفاء',                  'Ikhfa',                  true,  false, 140),
  ('WAQF_HAMZA',      'وقف حمزة',                 'Hamzah pausal',          true,  false, 150),
  ('WAQF_RASM',       'الوقف على مرسوم الخط',     'Pausing on the rasm',    true,  false, 160),
  ('YAAT_IDAFA',      'ياءات الإضافة',            'Yaat al-idafah',         true,  false, 170),
  ('YAAT_ZAWAID',     'ياءات الزوائد',            'Yaat al-zawaid',         true,  false, 180),
  ('BAYN_SURATAYN',   'الأوجه بين السورتين',      'Between two surahs',     false, false, 190),
  ('MADD_QABL_IDGHAM','المد قبل الإدغام الكبير',  'Madd before great idgham', true, false, 200),
  ('USUL_MADD',       'أصول المد',                'Madd conventions',       false, false, 210),
  ('USUL_MIM_JAM',    'ميم الجمع',                'Plural mim',             false, false, 220),
  ('USUL_NAQL',       'النقل',                    'Naql',                   false, false, 230),
  ('USUL_SAKT',       'السكت',                    'Sakt',                   false, false, 240)
ON CONFLICT (code) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
  is_word_anchored = EXCLUDED.is_word_anchored, changes_rasm = EXCLUDED.changes_rasm,
  sort_order = EXCLUDED.sort_order;

-- Global أصول, written once. These govern how ANY page renders for a riwayah and would be lost if
-- filed as a note on page 2. They are still never auto-applied to a token: an occurrence renders
-- only when a `qiraat_entries` row anchors it.
INSERT INTO qiraat_rules (id, category_code, scope, statement_ar, notes) VALUES
  ('RULE-MADD-MUNFASIL', 'USUL_MADD', 'global',
   'المد المنفصل: القصر لقالون والدوري عن أبي عمرو (بخلف عنهما) وابن كثير والسوسي وأبي جعفر ويعقوب، والتوسط لقالون والدوري عن أبي عمرو (الوجه الثاني) وابن عامر وعاصم والكسائي وخلف، والإشباع لورش وحمزة.',
   'Source: page 2 notes. Governs every page.'),
  ('RULE-MADD-MUTTASIL', 'USUL_MADD', 'global',
   'المد المتصل: الإشباع لورش وحمزة، والتوسط لباقي القراء.',
   'Source: page 2 notes.'),
  ('RULE-MIM-JAM', 'USUL_MIM_JAM', 'global',
   'ميم الجمع إذا جاء بعدها متحرك: يصل ضمها قالون (بخلف عنه) وابن كثير وأبو جعفر، ويصلها ورش إذا جاء بعدها همزة قطع، ويسكنها الباقون.',
   'Source: page 1 notes. Note the بخلف عنه for قالون.'),
  ('RULE-NAQL-WARSH', 'USUL_NAQL', 'global',
   'نقل ورش: ينقل حركة همزة القطع إلى الساكن قبلها ويحذف الهمزة، متصلًا رسمًا أو منفصلًا، ولا ينقل إلى حروف المد أو ميم الجمع.',
   'Source: page 2 notes.'),
  ('RULE-SAKT-HAMZA', 'USUL_SAKT', 'global',
   'سكت حمزة على الهمز وصلًا: لخلف السكت على (أل) وعلى شيء/شيئًا قولًا واحدًا، وعلى الساكن المفصول بخلف عنه؛ ولخلّاد السكت على (أل) وشيء بخلف عنه، ولا سكت له على الساكن المفصول.',
   'Source: page 2 notes. Differs between the two narrators of حمزة.'),
  ('RULE-HA-KINAYAH-DAMM', 'SILAT_HA', 'locus',
   'ضم هاء الكناية في (عليهم، إليهم، لديهم) بعد ياء ساكنة: حمزة ويعقوب؛ والباقون بالكسر.',
   'The canonical statement ONLY. Each of the ~215 Quran-wide occurrences of عليهم must still be checked against its own source page and stored as its own entry — the rule does not hold identically everywhere (وقفًا vs وصلًا, before a following sakin).')
ON CONFLICT (id) DO UPDATE SET category_code = EXCLUDED.category_code, scope = EXCLUDED.scope,
  statement_ar = EXCLUDED.statement_ar, notes = EXCLUDED.notes;

INSERT INTO qiraat_rule_authorities (rule_id, authority_id, action_ar) VALUES
  ('RULE-HA-KINAYAH-DAMM', 'Q06', 'ضم الهاء'),
  ('RULE-HA-KINAYAH-DAMM', 'Q09', 'ضم الهاء')
ON CONFLICT DO NOTHING;
