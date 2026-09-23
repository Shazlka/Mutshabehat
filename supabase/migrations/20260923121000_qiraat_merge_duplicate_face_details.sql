-- The repeated Warsh face is displayed once, while both valid performance options
-- and both source citations remain available on the canonical entry/locus.
UPDATE qiraat_variant_details canonical_detail
   SET performance_note = concat_ws('؛ ', NULLIF(canonical_detail.performance_note, ''), duplicate_detail.performance_note)
  FROM qiraat_entries canonical_entry
  JOIN qiraat_entries duplicate_entry
    ON duplicate_entry.id = 'v-AUDIT-P536-R03380-PERF-fe7dd2d9-a58-t1'
  JOIN qiraat_variant_details duplicate_detail
    ON duplicate_detail.entry_id = duplicate_entry.id
 WHERE canonical_entry.id = 'v-AUDIT-P536-R03380-PERF-ae204faa-a58-t1'
   AND canonical_detail.entry_id = canonical_entry.id
   AND duplicate_detail.performance_note IS NOT NULL
   AND position(duplicate_detail.performance_note IN COALESCE(canonical_detail.performance_note, '')) = 0;

WITH duplicate_face AS (
  SELECT duplicate_locus.page_id,
         duplicate_locus.id AS duplicate_locus_id,
         canonical_locus.id AS canonical_locus_id
    FROM qiraat_entries duplicate_entry
    JOIN qiraat_loci duplicate_locus ON duplicate_locus.id = duplicate_entry.locus_id
    JOIN qiraat_entries canonical_entry
      ON canonical_entry.id = 'v-AUDIT-P536-R03380-PERF-ae204faa-a58-t1'
    JOIN qiraat_loci canonical_locus ON canonical_locus.id = canonical_entry.locus_id
   WHERE duplicate_entry.id = 'v-AUDIT-P536-R03380-PERF-fe7dd2d9-a58-t1'
), ordered_evidence AS (
  SELECT el.evidence_text_id,
         el.page_id,
         f.canonical_locus_id AS locus_id,
         COALESCE((SELECT max(existing.evidence_order)
                     FROM qiraat_evidence_links existing
                    WHERE existing.locus_id = f.canonical_locus_id), 0)
           + row_number() OVER (ORDER BY el.evidence_order, el.evidence_text_id)::smallint AS evidence_order,
         el.is_abbreviated
    FROM duplicate_face f
    JOIN qiraat_evidence_links el
      ON el.locus_id = f.duplicate_locus_id
)
INSERT INTO qiraat_evidence_links (evidence_text_id, page_id, locus_id, evidence_order, is_abbreviated)
SELECT evidence_text_id, page_id, locus_id, evidence_order, is_abbreviated
  FROM ordered_evidence
ON CONFLICT (evidence_text_id, page_id, locus_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
