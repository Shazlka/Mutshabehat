-- Preserve duplicate entry rows and all child data while preventing duplicate faces
-- from appearing in qiraat_export_page. Exact duplicate identity is one locus,
-- normalized reading text, variant type, and the complete set of assigned readings.
WITH variant_faces AS (
  SELECT e.id,
         e.verification_status,
         p.mushaf_page_number,
         l.surah_number,
         l.start_ayah,
         l.start_word,
         l.end_ayah,
         l.end_word,
         vd.reading_text_normalized,
         vd.variant_type,
         COALESCE((
           SELECT array_agg(DISTINCT er.reading_id ORDER BY er.reading_id)
             FROM qiraat_entry_readings er
            WHERE er.entry_id = e.id
         ), ARRAY[]::text[]) AS reading_ids
    FROM qiraat_entries e
    JOIN qiraat_pages p ON p.id = e.page_id
    JOIN qiraat_loci l ON l.id = e.locus_id
    JOIN qiraat_variant_details vd ON vd.entry_id = e.id
   WHERE e.kind = 'variant'
     AND NOT e.synthetic
     AND e.verification_status <> 'REJECTED'
), duplicate_groups AS (
  SELECT array_agg(id ORDER BY id) AS ids
    FROM variant_faces
   GROUP BY mushaf_page_number, surah_number, start_ayah, start_word,
            end_ayah, end_word, reading_text_normalized, variant_type, reading_ids
  HAVING count(*) > 1
), duplicate_rows AS (
  SELECT unnest(ids[2:]) AS id, ids[1] AS canonical_id
    FROM duplicate_groups
)
UPDATE qiraat_entries duplicate
   SET verification_status = 'REJECTED',
       notes = concat_ws(E'\n', NULLIF(duplicate.notes, ''),
                         'Exact duplicate retained for audit; canonical entry: ' || duplicate_rows.canonical_id)
  FROM duplicate_rows
 WHERE duplicate.id = duplicate_rows.id;

NOTIFY pgrst, 'reload schema';
