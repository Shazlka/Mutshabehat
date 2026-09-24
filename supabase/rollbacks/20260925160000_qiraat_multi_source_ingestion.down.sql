-- Rollback: 20260925160000_qiraat_multi_source_ingestion.down.sql
BEGIN;

DROP TABLE IF EXISTS qiraat_page_ingestion_status CASCADE;
DROP TABLE IF EXISTS qiraat_entry_sources CASCADE;

ALTER TABLE qiraat_entries
  DROP COLUMN IF EXISTS conflict_diff,
  DROP COLUMN IF EXISTS is_conflict,
  DROP COLUMN IF EXISTS source_token_raw,
  DROP COLUMN IF EXISTS pdf_page;

ALTER TABLE qiraat_loci
  DROP COLUMN IF EXISTS source_token_raw,
  DROP COLUMN IF EXISTS pdf_page;

DELETE FROM qiraat_source_documents WHERE id = 'SRC-BOOK-27159';

COMMIT;
