-- Rollback for 20260925140000_qiraat_export_page_deterministic_order.sql
-- Restores qiraat_export_page to its pre-migration definition from 20260917120000_qiraat_v2_schema.sql.

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
          'isDefault',   ea.is_default)) ORDER BY ea.authority_id)
          FROM qiraat_entry_authorities ea WHERE ea.entry_id = v.id),
      -- Expanded, for rendering.
      'readingIds', (
        SELECT jsonb_agg(DISTINCT er.reading_id)
          FROM qiraat_entry_readings er WHERE er.entry_id = v.id),
      -- Words the reader must mark "ذو وجهين".
      'alternates', (
        SELECT jsonb_agg(DISTINCT er.reading_id)
          FROM qiraat_entry_readings er
         WHERE er.entry_id = v.id AND NOT er.is_default),
      'countSchools', (
        SELECT jsonb_agg(ecs.count_school_id ORDER BY ecs.count_school_id)
          FROM qiraat_entry_count_schools ecs WHERE ecs.entry_id = v.id),
      'evidence', (
        SELECT jsonb_agg(jsonb_build_object(
          'source', et.source_document_id,
          'text',   et.text_ar) ORDER BY el.evidence_order)
          FROM qiraat_evidence_links el
          JOIN qiraat_evidence_texts et ON et.id = el.evidence_text_id
         WHERE el.locus_id = v.locus_id),
      'flags', (
        SELECT jsonb_agg(jsonb_build_object(
          'severity', f.severity, 'type', f.flag_type, 'issue', f.issue_ar))
          FROM qiraat_qa_flags f
         WHERE f.status = 'open' AND (f.entry_id = v.id OR f.locus_id = v.locus_id))
    )) ORDER BY l.start_ayah, l.start_word, v.entry_order)
    FROM visible v JOIN qiraat_loci l ON l.id = v.locus_id), '[]'::jsonb),
  'pageNotes', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('type', n.note_type, 'text', n.text_ar)
             ORDER BY n.note_order)
      FROM qiraat_notes n JOIN pg ON pg.id = n.page_id
     WHERE n.locus_id IS NULL AND n.entry_id IS NULL), '[]'::jsonb)
);
$$;

NOTIFY pgrst, 'reload schema';
