-- Manual verification script for supabase/migrations/20260926100000_qiraat_review_bulk_workflow.sql.
-- Run against a SCRATCH copy of the live database (never production directly), signed in as an
-- allowlisted editor, after the migration has been applied. This file is NOT wired into any npm
-- script and was not executed in this sandbox (no database connectivity) -- run it by hand with
-- psql before/after applying to a scratch restore, per CLAUDE.md's migration process.

-- 0. Baseline: quran_words must be byte-identical before and after every check below.
SELECT count(*) AS quran_words_count, md5(string_agg(text_uthmani, '' ORDER BY canonical_key)) AS quran_words_checksum
  FROM quran_words;

-- 1. Wasl/Waqf: both false must be rejected by the CHECK constraint.
-- Expect: ERROR violates check constraint "qiraat_entries_wasl_waqf_chk"
-- UPDATE qiraat_entries SET applies_wasl = false, applies_waqf = false WHERE id = '<some entry id>';

-- 2. qiraat_review_row() carries the new fields.
-- SELECT qiraat_review_row('<some entry id>') -> jsonb should include appliesWasl, appliesWaqf, hamzahDetail.

-- 3. Bulk delete is all-or-nothing on a stale version.
-- SELECT qiraat_review_bulk_delete(
--   '[{"entryId":"<id1>","expectedVersion":"<real updated_at>"},
--     {"entryId":"<id2>","expectedVersion":"2000-01-01T00:00:00Z"}]'::jsonb,
--   'test', 'scratch-device');
-- Expect: the whole call raises VERSION_CONFLICT and id1 is NOT deleted.

-- 4. Same-word lookup returns only 'reviewed' entries elsewhere with the same normalized word.
-- SELECT qiraat_review_find_same_word('<entry id whose word repeats elsewhere>');

-- 5. Copy creates an INDEPENDENT entry (different id) at the target, starts unreviewed/REVIEWED.
-- SELECT qiraat_review_copy_entry(jsonb_build_object(
--   'sourceEntryId', '<source id>', 'surah', <n>, 'ayah', <n>, 'startWord', <n>));
-- Then: SELECT review_status, verification_status FROM qiraat_entries WHERE id = '<returned entryId>';
-- Expect: review_status = 'unreviewed', verification_status = 'REVIEWED', entryId <> sourceId.

-- 6. Bulk apply never writes quran_words, and skips exact-equivalent existing entries.
-- SELECT count(*) AS quran_words_count_after, md5(string_agg(text_uthmani, '' ORDER BY canonical_key)) AS quran_words_checksum_after
--   FROM quran_words;
-- Compare against step 0's baseline: must be identical count and checksum.
-- Re-running qiraat_review_bulk_apply with the same source/targets a second time must report the
-- first run's additions back in "skipped" (exact-equivalent), not add duplicates.
