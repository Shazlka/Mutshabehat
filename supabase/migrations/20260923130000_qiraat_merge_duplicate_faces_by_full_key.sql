-- Consolidate only identical Qiraat faces. Reader assignments are intentionally
-- excluded from the key and unioned below; distinct Uthmani text, description, or
-- performance notes remain separate faces.

-- Correct the earlier overly broad page-536 classification. Those two Warsh rows
-- are distinct performance faces and must both remain visible.
UPDATE qiraat_variant_details
   SET performance_note = 'إبدال الهمزة الثانية ألفاً ممدودة ست حركات'
 WHERE entry_id = 'v-AUDIT-P536-R03380-PERF-ae204faa-a58-t1'
   AND performance_note = 'إبدال الهمزة الثانية ألفاً ممدودة ست حركات؛ تسهيل الهمزة الثانية مع مد ست حركات';

UPDATE qiraat_entries
   SET verification_status = 'REVIEWED',
       notes = concat_ws(E'\n', NULLIF(notes, ''),
                         'Prior duplicate flag reversed: distinct performance face retained; details remain on this row.')
 WHERE id = 'v-AUDIT-P536-R03380-PERF-fe7dd2d9-a58-t1'
   AND verification_status = 'REJECTED'
   AND notes = 'Exact duplicate retained for audit; canonical entry: v-AUDIT-P536-R03380-PERF-ae204faa-a58-t1';

CREATE TEMP TABLE qiraat_face_merge_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT e.id,
         e.locus_id,
         e.page_id,
         row_number() OVER face_order AS face_rank,
         first_value(e.id) OVER face_order AS canonical_entry_id,
         first_value(e.locus_id) OVER face_order AS canonical_locus_id
    FROM qiraat_entries e
    JOIN qiraat_pages p ON p.id = e.page_id
    JOIN qiraat_loci l ON l.id = e.locus_id
    JOIN qiraat_variant_details vd ON vd.entry_id = e.id
   WHERE e.kind = 'variant'
     AND NOT e.synthetic
     AND e.verification_status <> 'REJECTED'
  WINDOW face_order AS (
    PARTITION BY p.mushaf_page_number,
                 l.surah_number, l.start_ayah, l.start_word, l.end_ayah, l.end_word,
                 vd.reading_text, vd.variant_type,
                 COALESCE(NULLIF(btrim(vd.uthmani_text), ''), ''),
                 COALESCE(NULLIF(btrim(vd.description_ar), ''), ''),
                 COALESCE(NULLIF(btrim(vd.performance_note), ''), '')
    ORDER BY CASE e.verification_status
               WHEN 'VERIFIED' THEN 0
               WHEN 'PUBLISHED' THEN 0
               WHEN 'REVIEWED' THEN 1
               ELSE 2
             END,
             e.created_at,
             e.id
  )
)
SELECT id AS duplicate_entry_id,
       locus_id AS duplicate_locus_id,
       page_id,
       canonical_entry_id,
       canonical_locus_id
  FROM ranked
 WHERE face_rank > 1;

-- Preserve every reading assertion on the canonical entry.
INSERT INTO qiraat_entry_readings (entry_id, reading_id, action_ar, is_default)
SELECT DISTINCT m.canonical_entry_id, r.reading_id, r.action_ar, r.is_default
  FROM qiraat_face_merge_map m
  JOIN qiraat_entry_readings r ON r.entry_id = m.duplicate_entry_id
ON CONFLICT DO NOTHING;

-- Preserve the source-level authorities and their conditions/options.
INSERT INTO qiraat_entry_authorities (
  entry_id, authority_id, action_ar, condition_ar, is_exception,
  option_group, is_default, alternate_note
)
SELECT DISTINCT m.canonical_entry_id, a.authority_id, a.action_ar, a.condition_ar,
       a.is_exception, a.option_group, a.is_default, a.alternate_note
  FROM qiraat_face_merge_map m
  JOIN qiraat_entry_authorities a ON a.entry_id = m.duplicate_entry_id
ON CONFLICT DO NOTHING;

-- Evidence is locus-scoped. Copy it to the canonical locus and keep every original link.
WITH source_links AS (
  SELECT DISTINCT m.canonical_locus_id, el.evidence_text_id, el.page_id,
                  el.evidence_order, el.is_abbreviated
    FROM qiraat_face_merge_map m
    JOIN qiraat_evidence_links el ON el.locus_id = m.duplicate_locus_id
), ordered_links AS (
  SELECT s.evidence_text_id,
         s.page_id,
         s.canonical_locus_id AS locus_id,
         COALESCE((SELECT max(existing.evidence_order)
                     FROM qiraat_evidence_links existing
                    WHERE existing.locus_id = s.canonical_locus_id), 0)
           + row_number() OVER (PARTITION BY s.canonical_locus_id
                                ORDER BY s.evidence_order, s.evidence_text_id)::smallint AS evidence_order,
         s.is_abbreviated
    FROM source_links s
)
INSERT INTO qiraat_evidence_links (evidence_text_id, page_id, locus_id, evidence_order, is_abbreviated)
SELECT evidence_text_id, page_id, locus_id, evidence_order, is_abbreviated
  FROM ordered_links
ON CONFLICT (evidence_text_id, page_id, locus_id) DO NOTHING;

-- Copy entry/locus notes, remapping only their duplicate targets.
INSERT INTO qiraat_notes (page_id, locus_id, entry_id, authority_id, note_type, text_ar, note_order)
SELECT DISTINCT n.page_id,
       CASE WHEN n.locus_id = m.duplicate_locus_id THEN m.canonical_locus_id ELSE n.locus_id END,
       CASE WHEN n.entry_id = m.duplicate_entry_id THEN m.canonical_entry_id ELSE n.entry_id END,
       n.authority_id, n.note_type, n.text_ar, n.note_order
  FROM qiraat_face_merge_map m
  JOIN qiraat_notes n
    ON n.entry_id = m.duplicate_entry_id OR n.locus_id = m.duplicate_locus_id
 WHERE NOT EXISTS (
   SELECT 1
     FROM qiraat_notes existing
    WHERE existing.page_id IS NOT DISTINCT FROM n.page_id
      AND existing.locus_id IS NOT DISTINCT FROM
          CASE WHEN n.locus_id = m.duplicate_locus_id THEN m.canonical_locus_id ELSE n.locus_id END
      AND existing.entry_id IS NOT DISTINCT FROM
          CASE WHEN n.entry_id = m.duplicate_entry_id THEN m.canonical_entry_id ELSE n.entry_id END
      AND existing.authority_id IS NOT DISTINCT FROM n.authority_id
      AND existing.note_type = n.note_type
      AND existing.text_ar = n.text_ar
      AND existing.note_order IS NOT DISTINCT FROM n.note_order
 );

INSERT INTO qiraat_entry_count_schools (entry_id, count_school_id)
SELECT DISTINCT m.canonical_entry_id, ecs.count_school_id
  FROM qiraat_face_merge_map m
  JOIN qiraat_entry_count_schools ecs ON ecs.entry_id = m.duplicate_entry_id
ON CONFLICT DO NOTHING;

-- The free-text entry note is also retained on the canonical row.
WITH notes_to_keep AS (
  SELECT m.canonical_entry_id, e.notes
    FROM qiraat_face_merge_map m
    JOIN qiraat_entries e ON e.id IN (m.canonical_entry_id, m.duplicate_entry_id)
   WHERE NULLIF(btrim(e.notes), '') IS NOT NULL
), merged_notes AS (
  SELECT canonical_entry_id,
         string_agg(DISTINCT notes, E'\n' ORDER BY notes) AS notes
    FROM notes_to_keep
   GROUP BY canonical_entry_id
)
UPDATE qiraat_entries canonical
   SET notes = merged_notes.notes
  FROM merged_notes
 WHERE canonical.id = merged_notes.canonical_entry_id;

-- Do not reassign locus_id or entry_order: each historical row stays intact and the
-- qiraat_entries(locus_id, kind, entry_order) unique constraint remains unaffected.
UPDATE qiraat_entries duplicate
   SET verification_status = 'REJECTED',
       notes = concat_ws(E'\n', NULLIF(duplicate.notes, ''),
                         'Duplicate face merged into ' || m.canonical_entry_id)
  FROM qiraat_face_merge_map m
 WHERE duplicate.id = m.duplicate_entry_id;

SELECT count(*) AS duplicate_entry_rows_merged FROM qiraat_face_merge_map;
NOTIFY pgrst, 'reload schema';
