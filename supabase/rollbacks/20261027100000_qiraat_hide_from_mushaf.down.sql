-- Rollback of 20261027100000_qiraat_hide_from_mushaf.sql: restores the previous export/row functions, drops the toggle RPC and the column (hidden flags are lost).
CREATE OR REPLACE FUNCTION public.qiraat_review_row(p_entry_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'entryId', e.id, 'locationId', l.id, 'version', e.updated_at,
    'kind', CASE e.kind WHEN 'variant' THEN 'farsh' ELSE 'usul' END,
    'categoryCode', rd.category_code, 'categoryNameAr', c.name_ar,
    'surah', l.surah_number, 'ayah', l.start_ayah, 'startWord', l.start_word,
    'endAyah', l.end_ayah, 'endWord', coalesce(l.end_word, l.start_word),
    'startKey', sw.canonical_key, 'endKey', ew.canonical_key,
    'page', sw.page_number,
    'hafsText', (SELECT string_agg(qw.text_uthmani, ' ' ORDER BY qw.ayah, qw.word_position)
                   FROM quran_words qw
                  WHERE qw.surah = l.surah_number
                    AND (qw.ayah, qw.word_position) >= (l.start_ayah, l.start_word)
                    AND (qw.ayah, qw.word_position) <= (l.end_ayah, coalesce(l.end_word, l.start_word))),
    'readingText', vd.reading_text, 'uthmaniText', vd.uthmani_text, 'description', vd.description_ar,
    'performanceNote', vd.performance_note, 'variantType', vd.variant_type,
    'rulingText', rd.text_ar, 'subCategory', rd.sub_category, 'options', to_jsonb(rd.options),
    'notes', e.notes, 'reviewStatus', e.review_status, 'locationReviewStatus', l.review_status,
    'verificationStatus', e.verification_status, 'legacyRef', e.legacy_ref,
    'entryOrder', e.entry_order, 'deleted', e.deleted_at IS NOT NULL,
    'appliesWasl', e.applies_wasl, 'appliesWaqf', e.applies_waqf, 'hamzahDetail', e.hamzah_detail,
    'narrators', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'code', a.display_code, 'nameAr', a.name_ar,
                                          'action', ea.action_ar, 'wajhOrder', ea.wajh_order, 'wajhNote', ea.wajh_note)
                       ORDER BY a.sort_order, a.id, ea.wajh_order)
        FROM qiraat_entry_authorities ea JOIN qiraat_authorities a ON a.id = ea.authority_id
       WHERE ea.entry_id = e.id AND ea.deleted_at IS NULL AND NOT ea.is_exception), '[]'::jsonb),
    'flags', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', f.id, 'type', f.flag_type, 'issueAr', f.issue_ar,
                                          'status', f.status, 'createdAt', f.created_at,
                                          'resolvedNote', f.resolved_note, 'resolvedAt', f.resolved_at)
                       ORDER BY f.status <> 'open', f.id)
        FROM qiraat_qa_flags f WHERE f.entry_id = e.id), '[]'::jsonb))
  FROM qiraat_entries e
  JOIN qiraat_loci l ON l.id = e.locus_id
  LEFT JOIN quran_words sw ON sw.surah = l.surah_number AND sw.ayah = l.start_ayah AND sw.word_position = l.start_word
  LEFT JOIN quran_words ew ON ew.surah = l.surah_number AND ew.ayah = l.end_ayah AND ew.word_position = coalesce(l.end_word, l.start_word)
  LEFT JOIN qiraat_variant_details vd ON vd.entry_id = e.id
  LEFT JOIN qiraat_ruling_details  rd ON rd.entry_id = e.id
  LEFT JOIN qiraat_categories c ON c.code = rd.category_code
  WHERE e.id = p_entry_id;
$function$;

CREATE OR REPLACE FUNCTION public.qiraat_export_page(p_mushaf_page smallint, p_include_unpublished boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
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
          'subCategory',  rd.sub_category,
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
          'isDefault',   ea.is_default,
          'wajhOrder',   ea.wajh_order,
          'wajhNote',    ea.wajh_note)) ORDER BY ea.authority_id, ea.id)
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
$function$;

DROP FUNCTION IF EXISTS qiraat_review_set_hidden(text, boolean, timestamptz, text);
ALTER TABLE qiraat_entries DROP COLUMN IF EXISTS hidden_from_mushaf;
NOTIFY pgrst, 'reload schema';
