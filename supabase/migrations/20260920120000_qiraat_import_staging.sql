-- ============================================================================
-- Qiraat bulk Excel import — staging schema
-- ============================================================================
-- Status: WRITTEN, NOT APPLIED to the self-hosted backend. Apply only after a pg_dump backup
-- and an explicit go-ahead (CLAUDE.md §"Applying DB DDL"):
--
--   docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     --single-transaction < supabase/migrations/20260920120000_qiraat_import_staging.sql
--   then: NOTIFY pgrst, 'reload schema';
--
-- REQUIRES: 20260917120000_qiraat_v2_schema.sql applied first (this migration references
-- qiraat_pages/qiraat_loci/qiraat_entries and re-runs the exact same publish logic those
-- tables already define — see qiraat_authorities(), qiraat_rebuild_locus_readings()).
--
-- Purpose: a hard wall between "Excel just got read" and "the Mushaf renders this".
-- Nothing in this file can ever be selected by qiraat_export_page() — these tables are not
-- part of that function's FROM clause, and PUBLISHING copies a row's data into the V2
-- tables rather than promoting the staging row itself. See docs/qiraat/excel-import-system.md.
--
-- Ownership: same posture as the V2 schema — shared reference data, service role writes,
-- never per-user RLS. The Excel import command runs with the service-role key precisely so
-- normal (anon/authenticated) traffic is never able to see or touch staging data at all.

-- ============================================================================
-- 0. ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE qiraat_import_batch_status AS ENUM (
    'UPLOADED', 'PARSED', 'VALIDATED', 'REVIEWING', 'APPROVED', 'PUBLISHED', 'FAILED', 'ROLLED_BACK'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qiraat_import_validation_status AS ENUM ('valid', 'warning', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qiraat_import_review_status AS ENUM (
    'pending', 'approved', 'rejected', 'needs_correction', 'needs_mapping', 'published'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qiraat_import_duplicate_status AS ENUM (
    'none', 'exact_duplicate', 'possible_duplicate', 'conflicting_record', 'production_conflict'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 1. BATCHES
-- ============================================================================

CREATE TABLE IF NOT EXISTS qiraat_import_batches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_dir            text NOT NULL,
  files                 text[] NOT NULL DEFAULT '{}',
  status                qiraat_import_batch_status NOT NULL DEFAULT 'UPLOADED',
  files_count           integer NOT NULL DEFAULT 0,
  sheets_count          integer NOT NULL DEFAULT 0,
  rows_total            integer NOT NULL DEFAULT 0,
  rows_valid            integer NOT NULL DEFAULT 0,
  rows_warning          integer NOT NULL DEFAULT 0,
  rows_error            integer NOT NULL DEFAULT 0,
  rows_duplicate        integer NOT NULL DEFAULT 0,
  rows_unresolved       integer NOT NULL DEFAULT 0,
  rows_needs_mapping    integer NOT NULL DEFAULT 0,
  rows_approved         integer NOT NULL DEFAULT 0,
  rows_rejected         integer NOT NULL DEFAULT 0,
  rows_published        integer NOT NULL DEFAULT 0,
  dry_run               boolean NOT NULL DEFAULT false,
  imported_by           text,
  mapping_config        jsonb,
  error_message         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz
);

-- ============================================================================
-- 2. ROWS — one per Excel data row, fully traceable to FILE → SHEET → ROW
-- ============================================================================

CREATE TABLE IF NOT EXISTS qiraat_import_rows (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_id              uuid NOT NULL REFERENCES qiraat_import_batches(id) ON DELETE CASCADE,
  source_file           text NOT NULL,
  source_sheet          text NOT NULL,
  source_row            integer NOT NULL,
  imported_at           timestamptz NOT NULL DEFAULT now(),
  -- Original cell values exactly as read, header -> value. Never edited afterwards.
  raw_row               jsonb NOT NULL,
  -- Deterministic fingerprint used for idempotent re-import (see §6).
  fingerprint           text NOT NULL,
  -- Canonical-field values after column-mapping + normalization (authority resolution,
  -- token anchoring, category mapping). This is what validation and review operate on.
  normalized            jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Manual corrections made in the review UI, layered ON TOP of `normalized`. The raw row is
  -- never touched (task requirement #11.G: "Never modify the original raw Excel payload.").
  manual_edits          jsonb,
  unmapped_columns      text[] NOT NULL DEFAULT '{}',
  unresolved_authorities text[] NOT NULL DEFAULT '{}',
  mapping_status        text NOT NULL DEFAULT 'ok',    -- 'ok' | 'needs_manual_mapping'
  validation_status     qiraat_import_validation_status NOT NULL DEFAULT 'error',
  validation_messages   jsonb NOT NULL DEFAULT '[]'::jsonb,
  duplicate_status      qiraat_import_duplicate_status NOT NULL DEFAULT 'none',
  duplicate_of_row_id   bigint REFERENCES qiraat_import_rows(id),
  production_conflict   jsonb,  -- {existingEntryId, existingValue, importedValue} when set
  review_status         qiraat_import_review_status NOT NULL DEFAULT 'pending',
  reviewed_by           text,
  reviewed_at           timestamptz,
  reviewer_note         text,
  -- Set once this row is copied into the live V2 schema (§ Publish workflow below).
  published_locus_id    text,
  published_entry_id    text,
  published_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qiraat_import_rows_batch_idx      ON qiraat_import_rows (batch_id);
CREATE INDEX IF NOT EXISTS qiraat_import_rows_validation_idx ON qiraat_import_rows (validation_status);
CREATE INDEX IF NOT EXISTS qiraat_import_rows_review_idx     ON qiraat_import_rows (review_status);
CREATE INDEX IF NOT EXISTS qiraat_import_rows_fingerprint_idx ON qiraat_import_rows (fingerprint);
CREATE INDEX IF NOT EXISTS qiraat_import_rows_source_idx     ON qiraat_import_rows (source_file, source_sheet, source_row);
-- Filtering surfaces the review UI needs (page/surah), pulled out of `normalized` for speed.
CREATE INDEX IF NOT EXISTS qiraat_import_rows_page_idx
  ON qiraat_import_rows (((normalized->>'mushaf_page')::int));
CREATE INDEX IF NOT EXISTS qiraat_import_rows_surah_idx
  ON qiraat_import_rows (((normalized->>'surah_number')::int));

DROP TRIGGER IF EXISTS qiraat_import_rows_touch ON qiraat_import_rows;
CREATE TRIGGER qiraat_import_rows_touch BEFORE UPDATE ON qiraat_import_rows
  FOR EACH ROW EXECUTE FUNCTION qiraat_touch_updated_at();

DROP TRIGGER IF EXISTS qiraat_import_batches_touch ON qiraat_import_batches;
CREATE TRIGGER qiraat_import_batches_touch BEFORE UPDATE ON qiraat_import_batches
  FOR EACH ROW EXECUTE FUNCTION qiraat_touch_updated_at();

-- ============================================================================
-- 3. AUDIT TRAIL — every state transition, every manual edit
-- ============================================================================

CREATE TABLE IF NOT EXISTS qiraat_import_row_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  row_id        bigint NOT NULL REFERENCES qiraat_import_rows(id) ON DELETE CASCADE,
  event_type    text NOT NULL,  -- 'imported' | 'edited' | 'approved' | 'rejected' |
                                 -- 'needs_correction' | 'needs_mapping' | 'reset' | 'published'
  actor         text,
  before_value  jsonb,
  after_value   jsonb,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qiraat_import_row_events_row_idx ON qiraat_import_row_events (row_id, created_at);

-- ============================================================================
-- 4. MAPPING OVERRIDES — persisted alias resolutions the reviewer confirms
-- ============================================================================
-- When a row is UNRESOLVED_AUTHORITY or NEEDS_MANUAL_MAPPING and the reviewer manually
-- resolves it, the resolution can be saved here so the SAME source phrase never needs to be
-- resolved by hand again in a later batch.

CREATE TABLE IF NOT EXISTS qiraat_import_mappings (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mapping_kind    text NOT NULL,   -- 'column_header' | 'authority_name' | 'category_name'
  source_value    text NOT NULL,
  resolved_field  text,            -- for column_header: the canonical field name
  resolved_value  text,            -- for authority/category: the canonical id/code
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mapping_kind, source_value)
);

-- ============================================================================
-- 5. RLS — staging is never public, never per-user; service role only
-- ============================================================================

ALTER TABLE qiraat_import_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiraat_import_rows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiraat_import_row_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiraat_import_mappings   ENABLE ROW LEVEL SECURITY;

-- No policies are created for anon/authenticated: default-deny. The admin review UI and the
-- Python importer both use the service-role key, which bypasses RLS by design (same posture
-- Supabase uses for every other admin-only table in this project).

-- ============================================================================
-- 6. FINGERPRINT — deterministic idempotency key
-- ============================================================================
-- Re-running the importer on the same files must not create duplicate rows. The fingerprint
-- is a hash of the fields that identify "the same reported fact": source document + page +
-- surah + ayah span + base text + variant/ruling text + attribution — NOT the batch id, NOT
-- the import timestamp, so two imports of an unchanged spreadsheet fingerprint identically.
-- Computed in Python (scripts/qiraat/import_excel.py: `row_fingerprint()`) and stored as-is;
-- kept here only as a documented column + index, not recomputed in SQL, so there is exactly
-- one implementation of the hashing rule.

-- Deliberately NOT a unique index: every Excel row is always inserted and kept (task
-- requirement #27, "keep raw source forever" — a row is data, never rejected at the SQL
-- layer). Re-importing the same file therefore inserts a new `qiraat_import_rows` row again,
-- but the Python importer looks up this fingerprint against every PRIOR row first and marks
-- the new one `duplicate_status = 'exact_duplicate'` before it is ever eligible for
-- publishing — see `scripts/qiraat/import_excel.py: detect_duplicates()`. Publishing only
-- ever processes `validation_status = 'valid' AND review_status = 'approved'`, and a review
-- action can never move an `exact_duplicate` row to `approved` without an explicit override
-- logged in `qiraat_import_row_events`.
