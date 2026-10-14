-- Rollback of 20261015100100_qiraat_subcategory.sql (restores the previous function bodies; labels already written are dropped with the column).
DROP TRIGGER IF EXISTS qiraat_variant_type_not_other ON qiraat_variant_details;
DROP FUNCTION IF EXISTS qiraat_variant_type_not_other();
ALTER TABLE qiraat_ruling_details DROP CONSTRAINT IF EXISTS qiraat_ruling_details_sub_category_fk;
CREATE OR REPLACE FUNCTION public.qiraat_to_variant_type(p_val text)
 RETURNS qiraat_variant_type
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE lower(btrim(coalesce(p_val, '')))
    WHEN 'vowel' THEN 'vowel'::qiraat_variant_type
    WHEN 'harakah' THEN 'vowel'::qiraat_variant_type
    WHEN 'تشكيل' THEN 'vowel'::qiraat_variant_type
    WHEN 'تشكيل / حركة' THEN 'vowel'::qiraat_variant_type
    WHEN 'حركة' THEN 'vowel'::qiraat_variant_type
    WHEN 'consonant' THEN 'consonant'::qiraat_variant_type
    WHEN 'letter' THEN 'consonant'::qiraat_variant_type
    WHEN 'حرف' THEN 'consonant'::qiraat_variant_type
    WHEN 'إبدال حرف' THEN 'consonant'::qiraat_variant_type
    WHEN 'إبدال' THEN 'consonant'::qiraat_variant_type
    WHEN 'addition' THEN 'addition'::qiraat_variant_type
    WHEN 'زيادة' THEN 'addition'::qiraat_variant_type
    WHEN 'زيادة حرف/كلمة' THEN 'addition'::qiraat_variant_type
    WHEN 'زيادة حرف' THEN 'addition'::qiraat_variant_type
    WHEN 'omission' THEN 'omission'::qiraat_variant_type
    WHEN 'حذف' THEN 'omission'::qiraat_variant_type
    WHEN 'حذف حرف/كلمة' THEN 'omission'::qiraat_variant_type
    WHEN 'حذف حرف' THEN 'omission'::qiraat_variant_type
    WHEN 'word_form' THEN 'word_form'::qiraat_variant_type
    WHEN 'تقديم وتأخير' THEN 'word_form'::qiraat_variant_type
    WHEN 'تقديم وتأخير / بنية الكلمة' THEN 'word_form'::qiraat_variant_type
    WHEN 'بنية الكلمة' THEN 'word_form'::qiraat_variant_type
    WHEN 'orthography' THEN 'orthography'::qiraat_variant_type
    WHEN 'رسم' THEN 'orthography'::qiraat_variant_type
    WHEN 'hamza' THEN 'hamza'::qiraat_variant_type
    WHEN 'hamz' THEN 'hamza'::qiraat_variant_type
    WHEN 'همز' THEN 'hamza'::qiraat_variant_type
    WHEN 'همزة' THEN 'hamza'::qiraat_variant_type
    WHEN 'madd' THEN 'madd'::qiraat_variant_type
    WHEN 'مد' THEN 'madd'::qiraat_variant_type
    WHEN 'idgham' THEN 'idgham'::qiraat_variant_type
    WHEN 'إدغام' THEN 'idgham'::qiraat_variant_type
    WHEN 'ishmam' THEN 'ishmam'::qiraat_variant_type
    WHEN 'إشمام' THEN 'ishmam'::qiraat_variant_type
    WHEN 'imalah' THEN 'imalah'::qiraat_variant_type
    WHEN 'إمالة' THEN 'imalah'::qiraat_variant_type
    WHEN 'taqlil' THEN 'taqlil'::qiraat_variant_type
    WHEN 'تقليل' THEN 'taqlil'::qiraat_variant_type
    WHEN 'sakt' THEN 'sakt'::qiraat_variant_type
    WHEN 'سكت' THEN 'sakt'::qiraat_variant_type
    WHEN 'naql' THEN 'naql'::qiraat_variant_type
    WHEN 'نقل' THEN 'naql'::qiraat_variant_type
    WHEN 'ikhfa' THEN 'ikhfa'::qiraat_variant_type
    WHEN 'إخفاء' THEN 'ikhfa'::qiraat_variant_type
    WHEN 'ghunnah' THEN 'ghunnah'::qiraat_variant_type
    WHEN 'غنة' THEN 'ghunnah'::qiraat_variant_type
    WHEN 'pronoun' THEN 'pronoun'::qiraat_variant_type
    WHEN 'ضمير' THEN 'pronoun'::qiraat_variant_type
    WHEN 'grammar' THEN 'grammar'::qiraat_variant_type
    WHEN 'إعراب' THEN 'grammar'::qiraat_variant_type
    WHEN 'other' THEN 'other'::qiraat_variant_type
    WHEN 'أخرى' THEN 'other'::qiraat_variant_type
    ELSE 'other'::qiraat_variant_type
  END;
$function$
;
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
    'rulingText', rd.text_ar, 'options', to_jsonb(rd.options),
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
$function$
;
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
$function$
;
CREATE OR REPLACE FUNCTION public.qiraat_review_update_entry(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  e qiraat_entries;
  v_id text := p->>'entryId';
BEGIN
  e := qiraat_review_begin(v_id, (p->>'expectedVersion')::timestamptz, p->>'deviceId');
  IF e.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'DELETED entry %', v_id USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  IF e.review_source IS NOT NULL THEN
    UPDATE qiraat_entries
       SET review_status = 'unreviewed',
           review_source = NULL,
           review_note   = NULL
     WHERE id = v_id;
    PERFORM qiraat_review_sync_locus(e.locus_id);
  END IF;

  IF p ? 'notes' THEN
    UPDATE qiraat_entries SET notes = nullif(btrim(p->>'notes'), '') WHERE id = v_id;
  END IF;

  IF p ? 'appliesWasl' OR p ? 'appliesWaqf' THEN
    UPDATE qiraat_entries SET
      applies_wasl = CASE WHEN p ? 'appliesWasl' THEN (p->>'appliesWasl')::boolean ELSE applies_wasl END,
      applies_waqf = CASE WHEN p ? 'appliesWaqf' THEN (p->>'appliesWaqf')::boolean ELSE applies_waqf END
    WHERE id = v_id;
  END IF;

  IF p ? 'hamzahDetail' THEN
    UPDATE qiraat_entries SET
      hamzah_detail = CASE WHEN p->'hamzahDetail' = 'null'::jsonb THEN NULL ELSE p->'hamzahDetail' END
    WHERE id = v_id;
  END IF;

  -- Optional kind transition between farsh (variant) and usul (ruling)
  IF (p ? 'kind' AND p->>'kind' = 'usul' AND e.kind = 'variant') THEN
    DELETE FROM qiraat_variant_details WHERE entry_id = v_id;
    INSERT INTO qiraat_ruling_details (entry_id, category_code, text_ar)
    VALUES (
      v_id,
      coalesce(nullif(btrim(p->>'categoryCode'), ''), 'TARQIQ_RA'),
      nullif(btrim(p->>'rulingText'), '')
    )
    ON CONFLICT (entry_id) DO UPDATE SET
      category_code = EXCLUDED.category_code,
      text_ar = EXCLUDED.text_ar;
    UPDATE qiraat_entries SET kind = 'ruling' WHERE id = v_id;
    e.kind := 'ruling';
  ELSIF (p ? 'kind' AND p->>'kind' = 'farsh' AND e.kind = 'ruling') THEN
    DELETE FROM qiraat_ruling_details WHERE entry_id = v_id;
    INSERT INTO qiraat_variant_details (entry_id, reading_text, reading_text_normalized, uthmani_text, description_ar, performance_note, variant_type)
    VALUES (
      v_id,
      coalesce(nullif(btrim(p->>'readingText'), ''), 'قراءة'),
      qiraat_norm(coalesce(nullif(btrim(p->>'readingText'), ''), 'قراءة')),
      nullif(btrim(p->>'uthmaniText'), ''),
      nullif(btrim(p->>'description'), ''),
      nullif(btrim(p->>'performanceNote'), ''),
      qiraat_to_variant_type(p->>'variantType')
    )
    ON CONFLICT (entry_id) DO UPDATE SET
      reading_text = EXCLUDED.reading_text,
      reading_text_normalized = EXCLUDED.reading_text_normalized,
      uthmani_text = EXCLUDED.uthmani_text,
      description_ar = EXCLUDED.description_ar,
      performance_note = EXCLUDED.performance_note,
      variant_type = EXCLUDED.variant_type;
    UPDATE qiraat_entries SET kind = 'variant' WHERE id = v_id;
    e.kind := 'variant';
  END IF;

  IF e.kind = 'variant' THEN
    IF p ? 'readingText' AND nullif(btrim(p->>'readingText'), '') IS NOT NULL THEN
      UPDATE qiraat_variant_details SET
        reading_text            = btrim(p->>'readingText'),
        reading_text_normalized = qiraat_norm(p->>'readingText')
      WHERE entry_id = v_id;
    END IF;
    IF p ? 'uthmaniText' THEN
      UPDATE qiraat_variant_details SET uthmani_text = nullif(btrim(p->>'uthmaniText'), '') WHERE entry_id = v_id;
    END IF;
    IF p ? 'description' THEN
      UPDATE qiraat_variant_details SET description_ar = nullif(btrim(p->>'description'), '') WHERE entry_id = v_id;
    END IF;
    IF p ? 'performanceNote' THEN
      UPDATE qiraat_variant_details SET performance_note = nullif(btrim(p->>'performanceNote'), '') WHERE entry_id = v_id;
    END IF;
    IF p ? 'variantType' AND nullif(btrim(p->>'variantType'), '') IS NOT NULL THEN
      UPDATE qiraat_variant_details SET variant_type = qiraat_to_variant_type(p->>'variantType') WHERE entry_id = v_id;
    END IF;
  ELSE
    IF p ? 'categoryCode' AND nullif(btrim(p->>'categoryCode'), '') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM qiraat_categories WHERE code = p->>'categoryCode' AND code <> 'AYAH_COUNT') THEN
        RAISE EXCEPTION 'invalid category' USING ERRCODE = 'invalid_parameter_value';
      END IF;
      UPDATE qiraat_ruling_details SET category_code = p->>'categoryCode' WHERE entry_id = v_id;
    END IF;
    IF p ? 'rulingText' THEN
      UPDATE qiraat_ruling_details SET text_ar = nullif(btrim(p->>'rulingText'), '') WHERE entry_id = v_id;
    END IF;
  END IF;

  PERFORM qiraat_review_touch(v_id);
  RETURN qiraat_review_row(v_id);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.qiraat_review_create_entry(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_surah integer := (p->>'surah')::integer;
  v_start_ayah integer := (p->>'ayah')::integer;
  v_start_word integer := (p->>'startWord')::integer;
  v_end_ayah integer := coalesce((p->>'endAyah')::integer, (p->>'ayah')::integer);
  v_end_word integer := coalesce((p->>'endWord')::integer, (p->>'startWord')::integer);
  v_kind_str text := p->>'kind';
  v_kind qiraat_entry_kind;
  v_category_code text := nullif(btrim(p->>'categoryCode'), '');
  v_reading_text text := btrim(coalesce(p->>'readingText', ''));
  v_uthmani_text text := nullif(btrim(p->>'uthmaniText'), '');
  v_description text := nullif(btrim(p->>'description'), '');
  v_perf_note text := nullif(btrim(p->>'performanceNote'), '');
  v_variant_type text := coalesce(nullif(btrim(p->>'variantType'), ''), 'other');
  v_ruling_text text := nullif(btrim(p->>'rulingText'), '');
  v_notes text := nullif(btrim(p->>'notes'), '');
  v_device_id text := coalesce(nullif(btrim(p->>'deviceId'), ''), 'review-web');
  v_narrators jsonb := coalesce(p->'narrators', '[]'::jsonb);
  v_narrator_ids text[];

  v_locus_id text;
  v_entry_id text;
  v_page_id bigint;
  v_mushaf_page integer;
  v_base_text text;
  v_existing_id text;
  v_order smallint;
  v_narrator jsonb;
  v_w_order smallint;
  v_w_note text;
  v_action text;
BEGIN
  PERFORM qiraat_require_editor();
  PERFORM set_config('app.device_id', v_device_id, true);

  -- 1. Validation
  IF v_surah IS NULL OR v_start_ayah IS NULL OR v_start_word IS NULL THEN
    RAISE EXCEPTION 'surah, ayah, and startWord are required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_kind_str = 'farsh' THEN
    v_kind := 'variant';
  ELSIF v_kind_str = 'usul' THEN
    v_kind := 'ruling';
  ELSE
    RAISE EXCEPTION 'kind must be farsh or usul' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_kind = 'variant' AND v_reading_text = '' THEN
    RAISE EXCEPTION 'readingText is required for farsh entry' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_kind = 'ruling' AND (v_category_code IS NULL OR NOT EXISTS (SELECT 1 FROM qiraat_categories WHERE code = v_category_code AND code <> 'AYAH_COUNT')) THEN
    RAISE EXCEPTION 'valid categoryCode is required for usul entry' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF jsonb_typeof(v_narrators) <> 'array' OR jsonb_array_length(v_narrators) = 0 THEN
    RAISE EXCEPTION 'at least one narrator is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT coalesce(array_agg(DISTINCT elem->>'id' ORDER BY elem->>'id'), ARRAY[]::text[])
    INTO v_narrator_ids
    FROM jsonb_array_elements(v_narrators) elem;

  -- 2. Find existing locus or check duplicate. A duplicate is the same face -- same
  -- word/reading (or same usul category) AND the same set of narrators -- not merely
  -- the same reading text, since several distinct reader groups can share identical
  -- reading text at a phonetic-only locus (see 20260928130000's header comment).
  SELECT id INTO v_locus_id
    FROM qiraat_loci
   WHERE surah_number = v_surah
     AND start_ayah = v_start_ayah
     AND start_word = v_start_word
     AND end_ayah = v_end_ayah
     AND end_word = v_end_word
   LIMIT 1;

  IF v_locus_id IS NOT NULL THEN
    IF v_kind = 'variant' THEN
      SELECT e.id INTO v_existing_id
        FROM qiraat_entries e
        JOIN qiraat_variant_details vd ON vd.entry_id = e.id
       WHERE e.locus_id = v_locus_id
         AND e.deleted_at IS NULL
         AND vd.reading_text_normalized = qiraat_norm(v_reading_text)
         AND (
           SELECT coalesce(array_agg(DISTINCT ea.authority_id ORDER BY ea.authority_id), ARRAY[]::text[])
             FROM qiraat_entry_authorities ea WHERE ea.entry_id = e.id AND ea.deleted_at IS NULL
         ) = v_narrator_ids
       LIMIT 1;
    ELSE
      SELECT e.id INTO v_existing_id
        FROM qiraat_entries e
        JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
       WHERE e.locus_id = v_locus_id
         AND e.deleted_at IS NULL
         AND rd.category_code = v_category_code
         AND (
           SELECT coalesce(array_agg(DISTINCT ea.authority_id ORDER BY ea.authority_id), ARRAY[]::text[])
             FROM qiraat_entry_authorities ea WHERE ea.entry_id = e.id AND ea.deleted_at IS NULL
         ) = v_narrator_ids
       LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      RETURN qiraat_review_row(v_existing_id);
    END IF;
  END IF;

  -- 3. Resolve or create locus
  IF v_locus_id IS NULL THEN
    -- The page is the one the word is printed on: quran_words, the same source the review screen
    -- and the Mushaf use. (Before, a word whose ayah had no locus yet fell through to page 1.)
    SELECT pg.id, pg.mushaf_page_number INTO v_page_id, v_mushaf_page
      FROM quran_words w
      JOIN qiraat_pages pg ON pg.mushaf_page_number = w.page_number
     WHERE w.surah = v_surah AND w.ayah = v_start_ayah AND w.word_position = v_start_word
     LIMIT 1;

    IF v_page_id IS NULL THEN
      SELECT p.id, p.mushaf_page_number INTO v_page_id, v_mushaf_page
        FROM qiraat_pages p
       WHERE p.id = (
         SELECT page_id FROM qiraat_loci
          WHERE surah_number = v_surah AND start_ayah = v_start_ayah
          LIMIT 1
       );
    END IF;

    IF v_page_id IS NULL THEN
      SELECT id, mushaf_page_number INTO v_page_id, v_mushaf_page
        FROM qiraat_pages
       WHERE mushaf_page_number = coalesce((p->>'page')::integer, 1)
       LIMIT 1;
    END IF;

    IF v_page_id IS NULL THEN
      SELECT id, mushaf_page_number INTO v_page_id, v_mushaf_page FROM qiraat_pages ORDER BY mushaf_page_number LIMIT 1;
    END IF;

    v_base_text := coalesce(
      nullif(btrim(p->>'uthmaniText'), ''),
      nullif(btrim(p->>'hafsText'), ''),
      v_reading_text
    );

    v_locus_id := 'l-' || v_surah || '-' || v_start_ayah || '-' || v_start_word;
    IF v_end_ayah <> v_start_ayah OR v_end_word <> v_start_word THEN
      v_locus_id := v_locus_id || '-' || v_end_ayah || '-' || v_end_word;
    END IF;

    IF EXISTS (SELECT 1 FROM qiraat_loci WHERE id = v_locus_id) THEN
      v_locus_id := v_locus_id || '-' || substr(md5(random()::text), 1, 4);
    END IF;

    INSERT INTO qiraat_loci (
      id, page_id, surah_number, start_ayah, start_word, end_ayah, end_word,
      base_text, base_text_normalized, review_status, device_id
    ) VALUES (
      v_locus_id, v_page_id, v_surah, v_start_ayah, v_start_word, v_end_ayah, v_end_word,
      v_base_text, qiraat_norm(v_base_text), 'reviewed', v_device_id
    );
  ELSE
    SELECT page_id INTO v_page_id FROM qiraat_loci WHERE id = v_locus_id;
  END IF;

  -- 4. Create entry
  v_entry_id := (CASE WHEN v_kind = 'variant' THEN 'v-' ELSE 'r-' END) || v_locus_id || '-' || substr(md5(random()::text), 1, 6);
  SELECT coalesce(max(entry_order), 0) + 1 INTO v_order FROM qiraat_entries WHERE locus_id = v_locus_id;

  INSERT INTO qiraat_entries (
    id, locus_id, page_id, kind, entry_order, attribution_mode,
    verification_status, review_status, notes, device_id
  ) VALUES (
    v_entry_id, v_locus_id, v_page_id, v_kind, v_order, 'explicit',
    'VERIFIED', 'reviewed', v_notes, v_device_id
  );

  -- 5. Create details (using safe qiraat_to_variant_type)
  IF v_kind = 'variant' THEN
    INSERT INTO qiraat_variant_details (
      entry_id, reading_text, reading_text_normalized, uthmani_text,
      description_ar, variant_type, performance_note, device_id
    ) VALUES (
      v_entry_id, v_reading_text, qiraat_norm(v_reading_text), v_uthmani_text,
      v_description, qiraat_to_variant_type(v_variant_type), v_perf_note, v_device_id
    );
  ELSE
    INSERT INTO qiraat_ruling_details (
      entry_id, category_code, text_ar, device_id
    ) VALUES (
      v_entry_id, v_category_code, v_ruling_text, v_device_id
    );
  END IF;

  -- 6. Insert narrators -- into the real table, `qiraat_entry_authorities` (see
  -- qiraat_review_set_narrators for the same pattern). `qiraat_entry_readings` is a
  -- separate, trigger-derived projection and must not be written here.
  FOR v_narrator IN SELECT value FROM jsonb_array_elements(v_narrators) LOOP
    v_w_order := coalesce((v_narrator->>'wajhOrder')::smallint, 1);
    v_w_note := nullif(btrim(v_narrator->>'wajhNote'), '');
    v_action := nullif(btrim(v_narrator->>'action'), '');

    IF (v_narrator->>'id') = 'Q05-R02' AND v_w_order = 1 AND v_w_note IS NULL THEN
      RAISE EXCEPTION 'QIRAAT_D8 hafs primary' USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO qiraat_entry_authorities (
      entry_id, authority_id, action_ar, is_default, wajh_order, wajh_note, device_id
    ) VALUES (
      v_entry_id, v_narrator->>'id', v_action, v_w_order = 1, v_w_order, v_w_note, v_device_id
    );
  END LOOP;

  PERFORM qiraat_review_touch(v_entry_id);
  RETURN qiraat_review_row(v_entry_id);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.qiraat_review_copy_entry(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_source_id text := p->>'sourceEntryId';
  v_device text := coalesce(nullif(btrim(p->>'deviceId'), ''), 'review-web');
  v_surah int := (p->>'surah')::int;
  v_ayah int := (p->>'ayah')::int;
  v_word int := (p->>'startWord')::int;
  v_end_ayah int := coalesce((p->>'endAyah')::int, v_ayah);
  v_end_word int := coalesce((p->>'endWord')::int, v_word);
  e qiraat_entries; vd qiraat_variant_details; rd qiraat_ruling_details;
  v_narrators jsonb; v_payload jsonb; v_created jsonb; v_new_id text; v_pre_existing_id text;
BEGIN
  PERFORM qiraat_require_editor();
  IF v_source_id IS NULL THEN RAISE EXCEPTION 'sourceEntryId is required' USING ERRCODE = 'invalid_parameter_value'; END IF;
  SELECT * INTO e FROM qiraat_entries WHERE id = v_source_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND entry %', v_source_id USING ERRCODE = 'no_data_found'; END IF;

  -- Was an identical entry already sitting at the target locus BEFORE this call? If so, the
  -- Hamzah/Wasl/Waqf/status downgrade below must never touch it -- only a genuinely new copy
  -- created by this call may be downgraded to unreviewed/REVIEWED.
  SELECT existing.id INTO v_pre_existing_id
    FROM qiraat_loci l2
    JOIN qiraat_entries existing ON existing.locus_id = l2.id AND existing.deleted_at IS NULL AND existing.verification_status <> 'REJECTED'
   WHERE l2.surah_number = v_surah AND l2.start_ayah = v_ayah AND l2.start_word = v_word
     AND l2.end_ayah = v_end_ayah AND coalesce(l2.end_word, l2.start_word) = v_end_word AND l2.deleted_at IS NULL
     AND existing.kind = e.kind
     AND (
       (e.kind = 'variant' AND EXISTS (
          SELECT 1 FROM qiraat_variant_details vd2 JOIN qiraat_variant_details vd1 ON vd1.entry_id = e.id
           WHERE vd2.entry_id = existing.id AND vd2.reading_text_normalized = vd1.reading_text_normalized))
       OR
       (e.kind = 'ruling' AND EXISTS (
          SELECT 1 FROM qiraat_ruling_details rd2 JOIN qiraat_ruling_details rd1 ON rd1.entry_id = e.id
           WHERE rd2.entry_id = existing.id AND rd2.category_code = rd1.category_code))
     )
   LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', authority_id, 'action', action_ar, 'wajhOrder', wajh_order, 'wajhNote', wajh_note)), '[]'::jsonb)
    INTO v_narrators
    FROM qiraat_entry_authorities WHERE entry_id = v_source_id AND deleted_at IS NULL AND NOT is_exception;

  v_payload := jsonb_build_object(
    'surah', v_surah, 'ayah', v_ayah, 'startWord', v_word, 'endAyah', v_end_ayah, 'endWord', v_end_word,
    'kind', CASE e.kind WHEN 'variant' THEN 'farsh' ELSE 'usul' END,
    'notes', e.notes, 'deviceId', v_device, 'narrators', v_narrators
  );

  IF e.kind = 'variant' THEN
    SELECT * INTO vd FROM qiraat_variant_details WHERE entry_id = v_source_id;
    v_payload := v_payload || jsonb_build_object(
      'readingText', vd.reading_text, 'uthmaniText', vd.uthmani_text, 'description', vd.description_ar,
      'performanceNote', vd.performance_note, 'variantType', vd.variant_type::text);
  ELSE
    SELECT * INTO rd FROM qiraat_ruling_details WHERE entry_id = v_source_id;
    v_payload := v_payload || jsonb_build_object('categoryCode', rd.category_code, 'rulingText', rd.text_ar);
  END IF;

  v_created := qiraat_review_create_entry(v_payload);
  v_new_id := v_created->>'entryId';

  IF v_pre_existing_id IS NULL THEN
    UPDATE qiraat_entries
       SET applies_wasl = e.applies_wasl, applies_waqf = e.applies_waqf, hamzah_detail = e.hamzah_detail,
           review_status = 'unreviewed', verification_status = 'REVIEWED'
     WHERE id = v_new_id;
  END IF;

  RETURN qiraat_review_row(v_new_id);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.qiraat_review_page(p_page integer, p_include_deleted boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_rows jsonb;
BEGIN
  PERFORM qiraat_require_editor();
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 604 THEN
    RAISE EXCEPTION 'invalid page %', p_page USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT coalesce(jsonb_agg((qiraat_review_row(x.id) || jsonb_build_object('reviewSource', x.review_source, 'reviewNote', x.review_note)) ORDER BY x.ayah, x.start_word, x.kind, x.category_code NULLS FIRST, x.entry_order, x.id), '[]'::jsonb)
    INTO v_rows
    FROM (SELECT e.id, l.start_ayah AS ayah, l.start_word, e.kind, rd.category_code, e.entry_order,
                 e.review_source, e.review_note
            FROM qiraat_loci l
            JOIN quran_words sw ON sw.surah = l.surah_number AND sw.ayah = l.start_ayah AND sw.word_position = l.start_word
            JOIN qiraat_entries e ON e.locus_id = l.id
            LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
           WHERE sw.page_number = p_page
             AND e.verification_status <> 'REJECTED'
             AND rd.category_code IS DISTINCT FROM 'AYAH_COUNT'
             AND (p_include_deleted OR (e.deleted_at IS NULL AND l.deleted_at IS NULL))) x;
  RETURN jsonb_build_object(
    'page', p_page,
    'words', (SELECT jsonb_agg(jsonb_build_object('key', canonical_key, 'surah', surah, 'ayah', ayah,
                                                  'word', word_position, 'line', line_number, 'text', text_uthmani)
                               ORDER BY line_number, surah, ayah, word_position)
                FROM quran_words WHERE page_number = p_page),
    'rows', v_rows,
    'stats', (SELECT jsonb_build_object(
                'total', count(*),
                'unreviewed', count(*) FILTER (WHERE r->>'reviewStatus' = 'unreviewed' AND NOT (r->>'deleted')::boolean),
                'reviewed',   count(*) FILTER (WHERE r->>'reviewStatus' = 'reviewed'   AND NOT (r->>'deleted')::boolean),
                'flagged',    count(*) FILTER (WHERE r->>'reviewStatus' = 'flagged'    AND NOT (r->>'deleted')::boolean),
                'deleted',    count(*) FILTER (WHERE (r->>'deleted')::boolean))
                FROM jsonb_array_elements(v_rows) r),
    'narrators', (SELECT jsonb_agg(jsonb_build_object('id', id, 'code', display_code, 'nameAr', name_ar,
                                                      'parentId', parent_id, 'type', authority_type, 'color', color_hex)
                                   ORDER BY sort_order, id)
                    FROM qiraat_authorities WHERE active),
    'categories', (SELECT jsonb_agg(jsonb_build_object('code', code, 'nameAr', name_ar) ORDER BY sort_order, code)
                     FROM qiraat_categories WHERE code <> 'AYAH_COUNT'),
    'variantTypes', (SELECT jsonb_agg(v ORDER BY v) FROM unnest(enum_range(NULL::qiraat_variant_type)::text[]) v));
END;
$function$
;
ALTER TABLE qiraat_ruling_details DROP COLUMN IF EXISTS sub_category;
DROP TABLE IF EXISTS qiraat_sub_categories;
NOTIFY pgrst, 'reload schema';
