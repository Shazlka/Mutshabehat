-- Deterministic ordering for qiraat_export_page.
--
-- Previously, qiraat_export_page used ORDER BY l.start_ayah, l.start_word, v.entry_order.
-- Because entry_order is scoped per (locus_id, kind), distinct loci sharing the same
-- start word (e.g. single-word vs multi-word spans at the same token) both had entry_order=1,
-- leaving their relative order in jsonb_agg non-deterministic across query plans/scans.
-- Similarly, readingIds, alternates, and flags sub-aggregations had no ORDER BY clauses.
--
-- This migration updates qiraat_export_page to use deterministic ordering throughout:
-- 1. Outer entries: ORDER BY l.start_ayah, l.start_word, l.end_ayah, l.end_word,
--                   v.kind, rd.category_code NULLS FIRST, v.entry_order, v.id
--    (matching the ordering used by qiraat_review_page and v_page_variants).
-- 2. readingIds & alternates: ORDER BY er.reading_id
-- 3. attribution: ORDER BY ea.authority_id, ea.id
-- 4. evidence: ORDER BY el.evidence_order, el.id
-- 5. flags: ORDER BY f.id
-- 6. pageNotes: ORDER BY n.note_order, n.id
-- 7. Filters soft-deleted rows (deleted_at IS NULL) on entries, loci, authorities, evidence, and notes.

CREATE OR REPLACE FUNCTION qiraat_export_page(
  p_mushaf_page          smallint,
  p_include_unpublished  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql STABLE AS $$
WITH pg AS (
  SELECT * FROM qiraat_pages WHERE mushaf_page_number = p_mushaf_page
),
visible AS (
  SELECT e.*
    FROM qiraat_entries e
    JOIN pg ON pg.id = e.page_id
   WHERE NOT e.synthetic
     AND e.deleted_at IS NULL
     AND (p_include_unpublished OR e.verification_status IN ('VERIFIED', 'PUBLISHED'))
     AND e.verification_status <> 'REJECTED'
)
SELECT jsonb_build_object(
  'mushafPage', p_mushaf_page,
  'sourcePage', (SELECT source_page_number FROM pg),
  'surah',      (SELECT surah_number FROM pg),
  'ayahFrom',   (SELECT ayah_from FROM pg),
  'ayahTo',     (SELECT ayah_to FROM pg),
  'entries', COALESCE((
    SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',            v.id,
      'kind',          v.kind,
      'order',         v.entry_order,
      'status',        v.verification_status,
      'notes',         v.notes,
      'locus', jsonb_build_object(
        'id',         l.id,
        'surah',      l.surah_number,
        'startAyah',  l.start_ayah,
        'startWord',  l.start_word,
        'endAyah',    l.end_ayah,
        'endWord',    l.end_word,
        'baseText',   l.base_text,
        'occurrence', l.occurrence_note,
        'mapping',    l.mapping_status
      ),
      'variant', (
        SELECT jsonb_strip_nulls(jsonb_build_object(
          'readingText',     vd.reading_text,
          'uthmaniText',     vd.uthmani_text,
          'description',     vd.description_ar,
          'variantType',     vd.variant_type,
          'isBaseline',      vd.is_baseline_reading,
          'performanceNote', vd.performance_note))
          FROM qiraat_variant_details vd WHERE vd.entry_id = v.id),
      'ruling', (
        SELECT jsonb_strip_nulls(jsonb_build_object(
          'category',     rd.category_code,
          'categoryAr',   c.name_ar,
          'ruleId',       rd.rule_id,
          'text',         rd.text_ar,
          'options',      to_jsonb(rd.options),
          'wordAnchored', c.is_word_anchored))
          FROM qiraat_ruling_details rd
          JOIN qiraat_categories c ON c.code = rd.category_code
         WHERE rd.entry_id = v.id),
      -- Verbatim, at the level the book printed it.
      'attribution', (
        SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'authorityId', ea.authority_id,
          'action',      ea.action_ar,
          'condition',   ea.condition_ar,
          'isException', NULLIF(ea.is_exception, false),
          'isDefault',   ea.is_default)) ORDER BY ea.authority_id, ea.id)
          FROM qiraat_entry_authorities ea WHERE ea.entry_id = v.id AND ea.deleted_at IS NULL),
      -- Expanded, for rendering.
      'readingIds', (
        SELECT jsonb_agg(DISTINCT er.reading_id ORDER BY er.reading_id)
          FROM qiraat_entry_readings er WHERE er.entry_id = v.id),
      -- Words the reader must mark "ذو وجهين".
      'alternates', (
        SELECT jsonb_agg(DISTINCT er.reading_id ORDER BY er.reading_id)
          FROM qiraat_entry_readings er
         WHERE er.entry_id = v.id AND NOT er.is_default),
      'countSchools', (
        SELECT jsonb_agg(ecs.count_school_id ORDER BY ecs.count_school_id)
          FROM qiraat_entry_count_schools ecs WHERE ecs.entry_id = v.id),
      'evidence', (
        SELECT jsonb_agg(jsonb_build_object(
          'source', et.source_document_id,
          'text',   et.text_ar) ORDER BY el.evidence_order, el.id)
          FROM qiraat_evidence_links el
          JOIN qiraat_evidence_texts et ON et.id = el.evidence_text_id
         WHERE el.locus_id = v.locus_id AND el.deleted_at IS NULL AND et.deleted_at IS NULL),
      'flags', (
        SELECT jsonb_agg(jsonb_build_object(
          'severity', f.severity, 'type', f.flag_type, 'issue', f.issue_ar)
          ORDER BY f.id)
          FROM qiraat_qa_flags f
         WHERE f.status = 'open' AND (f.entry_id = v.id OR f.locus_id = v.locus_id))
    )) ORDER BY l.start_ayah, l.start_word, l.end_ayah, l.end_word, v.kind, rd.category_code NULLS FIRST, v.entry_order, v.id)
    FROM visible v
    JOIN qiraat_loci l ON l.id = v.locus_id
    LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = v.id
   WHERE l.deleted_at IS NULL), '[]'::jsonb),
  'pageNotes', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('type', n.note_type, 'text', n.text_ar)
             ORDER BY n.note_order, n.id)
      FROM qiraat_notes n JOIN pg ON pg.id = n.page_id
     WHERE n.locus_id IS NULL AND n.entry_id IS NULL AND n.deleted_at IS NULL), '[]'::jsonb)
);
$$;

NOTIFY pgrst, 'reload schema';
