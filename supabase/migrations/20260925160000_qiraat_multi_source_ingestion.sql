-- Migration: 20260925160000_qiraat_multi_source_ingestion.sql
-- Purpose: Schema extensions supporting multi-source ingestion from BOOK_27159_1.pdf
-- Decisions: Q1 (staging clone), Q2 (split multi-word imala), Q3 (additive conflict flag), Q4 (pilot promotion)

BEGIN;

-- 1. Register new source document if not exists
INSERT INTO qiraat_source_documents (id, name_ar, name_en, document_type, filename, notes)
VALUES (
  'SRC-BOOK-27159',
  'مصحف القراءات العشر المتواترة بالألوان الميسرة',
  'Facilitated Color-Coded Ten Readings Mushaf',
  'pdf',
  'BOOK_27159_1.pdf',
  'المصدر الجديد للقراءات العشر المتواترة بالألوان الميسرة'
)
ON CONFLICT (id) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  filename = EXCLUDED.filename;

-- 2. Add tracking columns to qiraat_loci
ALTER TABLE qiraat_loci
  ADD COLUMN IF NOT EXISTS pdf_page integer NULL,
  ADD COLUMN IF NOT EXISTS source_token_raw text NULL;

-- 3. Add tracking and conflict columns to qiraat_entries
ALTER TABLE qiraat_entries
  ADD COLUMN IF NOT EXISTS pdf_page integer NULL,
  ADD COLUMN IF NOT EXISTS source_token_raw text NULL,
  ADD COLUMN IF NOT EXISTS is_conflict boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conflict_diff jsonb NULL;

-- 4. Create qiraat_entry_sources for multi-source attribution
CREATE TABLE IF NOT EXISTS qiraat_entry_sources (
  id bigserial PRIMARY KEY,
  entry_id text NOT NULL REFERENCES qiraat_entries(id) ON DELETE CASCADE,
  source_document_id text NOT NULL REFERENCES qiraat_source_documents(id) ON DELETE CASCADE,
  pdf_page integer NULL,
  source_reference text NULL,
  source_text text NULL,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_entry_source UNIQUE (entry_id, source_document_id)
);

CREATE INDEX IF NOT EXISTS idx_qiraat_entry_sources_entry_id ON qiraat_entry_sources(entry_id);
CREATE INDEX IF NOT EXISTS idx_qiraat_entry_sources_doc_id ON qiraat_entry_sources(source_document_id);

ALTER TABLE qiraat_entry_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY qiraat_entry_sources_read ON qiraat_entry_sources FOR SELECT USING (true);

-- 5. Create qiraat_page_ingestion_status for tracking progress across all 604 pages
CREATE TABLE IF NOT EXISTS qiraat_page_ingestion_status (
  page_number smallint PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'done', 'done-empty', 'flagged', 'missing'
  variant_count smallint NOT NULL DEFAULT 0,
  rule_count smallint NOT NULL DEFAULT 0,
  conflict_count smallint NOT NULL DEFAULT 0,
  unmatched_count smallint NOT NULL DEFAULT 0,
  corroborated_count smallint NOT NULL DEFAULT 0,
  gap_filled_count smallint NOT NULL DEFAULT 0,
  last_ingested_at timestamptz NULL,
  notes text NULL
);

ALTER TABLE qiraat_page_ingestion_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY qiraat_page_ingestion_status_read ON qiraat_page_ingestion_status FOR SELECT USING (true);

-- Initialize all 604 pages if empty
INSERT INTO qiraat_page_ingestion_status (page_number, status)
SELECT p, 'pending'
FROM generate_series(1, 604) AS p
ON CONFLICT (page_number) DO NOTHING;

COMMIT;
