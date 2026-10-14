-- Fill the Hafs word(s) of every live locus whose base_text is empty, from the Mushaf words themselves (quran_words).
-- Never overwrites a non-empty base_text. Single-ayah loci only (a locus spanning ayahs is reported, not filled).
BEGIN;
SELECT set_config('app.device_id','auto-review',true);
WITH words AS (
  SELECT l.id,
         string_agg(q.text_uthmani, ' ' ORDER BY q.word_position) AS txt,
         count(*) AS found,
         (coalesce(l.end_word, l.start_word) - l.start_word + 1) AS wanted
    FROM qiraat_loci l
    JOIN quran_words q ON q.surah = l.surah_number AND q.ayah = l.start_ayah
                      AND q.word_position BETWEEN l.start_word AND coalesce(l.end_word, l.start_word)
   WHERE l.deleted_at IS NULL AND btrim(l.base_text) = '' AND l.start_ayah = l.end_ayah
     AND EXISTS (SELECT 1 FROM qiraat_entries e WHERE e.locus_id = l.id AND e.deleted_at IS NULL)
   GROUP BY l.id, l.start_word, l.end_word
)
UPDATE qiraat_loci l
   SET base_text = w.txt, base_text_normalized = qiraat_norm(w.txt)
  FROM words w
 WHERE l.id = w.id AND w.found = w.wanted AND btrim(w.txt) <> '';
SELECT count(*) AS still_empty FROM qiraat_loci l
 WHERE l.deleted_at IS NULL AND btrim(l.base_text) = ''
   AND EXISTS (SELECT 1 FROM qiraat_entries e WHERE e.locus_id = l.id AND e.deleted_at IS NULL);
COMMIT;
