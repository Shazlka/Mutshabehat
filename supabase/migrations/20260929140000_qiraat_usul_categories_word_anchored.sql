-- The review editor lets a reviewer attach USUL_MIM_JAM / USUL_MADD / USUL_SAKT to a specific word,
-- but these three were seeded as is_word_anchored = false ("panel only"), so the Mushaf never drew
-- a marker on the word and nothing appeared in the sidebar. Mark them word-anchored.
-- Rollback: supabase/rollbacks/20260929140000_qiraat_usul_categories_word_anchored.down.sql
UPDATE qiraat_categories SET is_word_anchored = true
 WHERE code IN ('USUL_MIM_JAM', 'USUL_MADD', 'USUL_SAKT');

NOTIFY pgrst, 'reload schema';
