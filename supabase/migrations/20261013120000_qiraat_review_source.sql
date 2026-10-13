-- Migration: Add review_source and review_note to qiraat_entries
-- Distinguishes automatic approval («معتمد آليًا») from human approval:
--   NULL = human approval
--   'auto:nquran' = tier A1 (only nquran agrees)
--   'auto:nquran+book' = tier A2 (nquran and printed-book extraction agree)
-- Rollback: supabase/rollbacks/20261013120000_qiraat_review_source.down.sql

ALTER TABLE qiraat_entries
  ADD COLUMN IF NOT EXISTS review_source text,
  ADD COLUMN IF NOT EXISTS review_note text;

CREATE INDEX IF NOT EXISTS qiraat_entries_review_source_idx
  ON qiraat_entries (review_source)
  WHERE review_source IS NOT NULL;

NOTIFY pgrst, 'reload schema';
