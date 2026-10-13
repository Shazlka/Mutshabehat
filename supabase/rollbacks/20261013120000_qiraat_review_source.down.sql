-- Rollback: remove review_source and review_note from qiraat_entries
-- Migration: supabase/migrations/20261013120000_qiraat_review_source.sql

DROP INDEX IF EXISTS qiraat_entries_review_source_idx;

ALTER TABLE qiraat_entries
  DROP COLUMN IF EXISTS review_source,
  DROP COLUMN IF EXISTS review_note;

NOTIFY pgrst, 'reload schema';
