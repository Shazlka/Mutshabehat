-- Rollback for 20260926100000_qiraat_review_bulk_workflow.sql

DROP FUNCTION IF EXISTS qiraat_review_bulk_apply(text, jsonb, text);
DROP FUNCTION IF EXISTS qiraat_review_find_occurrences(text);
DROP FUNCTION IF EXISTS qiraat_review_copy_entry(jsonb);
DROP FUNCTION IF EXISTS qiraat_review_find_same_word(integer, integer, integer, text);
DROP FUNCTION IF EXISTS qiraat_review_bulk_delete(jsonb, text, text);

-- Restore qiraat_review_update_entry() to its pre-migration body (no Wasl/Waqf/Hamzah fields).
CREATE OR REPLACE FUNCTION qiraat_review_update_entry(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries; v_id text := p->>'entryId';
BEGIN
  e := qiraat_review_begin(v_id, (p->>'expectedVersion')::timestamptz, p->>'deviceId');
  IF e.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'DELETED entry %', v_id USING ERRCODE = 'object_not_in_prerequisite_state'; END IF;
  IF p ? 'notes' THEN
    UPDATE qiraat_entries SET notes = nullif(btrim(p->>'notes'), '') WHERE id = v_id;
  END IF;
  IF e.kind = 'variant' THEN
    IF p ?| ARRAY['categoryCode', 'rulingText'] THEN
      RAISE EXCEPTION 'invalid field for farsh entry' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p ? 'readingText' AND nullif(btrim(p->>'readingText'), '') IS NULL THEN
      RAISE EXCEPTION 'readingText is required' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE qiraat_variant_details SET
      reading_text            = CASE WHEN p ? 'readingText' THEN btrim(p->>'readingText') ELSE reading_text END,
      reading_text_normalized = CASE WHEN p ? 'readingText' THEN qiraat_norm(p->>'readingText') ELSE reading_text_normalized END,
      uthmani_text            = CASE WHEN p ? 'uthmaniText' THEN nullif(btrim(p->>'uthmaniText'), '') ELSE uthmani_text END,
      description_ar          = CASE WHEN p ? 'description' THEN nullif(btrim(p->>'description'), '') ELSE description_ar END,
      performance_note        = CASE WHEN p ? 'performanceNote' THEN nullif(btrim(p->>'performanceNote'), '') ELSE performance_note END,
      variant_type            = CASE WHEN p ? 'variantType' THEN (p->>'variantType')::qiraat_variant_type ELSE variant_type END
    WHERE entry_id = v_id;
  ELSE
    IF p ?| ARRAY['readingText', 'uthmaniText', 'description', 'performanceNote', 'variantType'] THEN
      RAISE EXCEPTION 'invalid field for usul entry' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF p ? 'categoryCode' AND NOT EXISTS (SELECT 1 FROM qiraat_categories WHERE code = p->>'categoryCode' AND code <> 'AYAH_COUNT') THEN
      RAISE EXCEPTION 'invalid category' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    UPDATE qiraat_ruling_details SET
      category_code = CASE WHEN p ? 'categoryCode' THEN p->>'categoryCode' ELSE category_code END,
      text_ar       = CASE WHEN p ? 'rulingText' THEN nullif(btrim(p->>'rulingText'), '') ELSE text_ar END
    WHERE entry_id = v_id;
  END IF;
  PERFORM qiraat_review_touch(v_id);
  RETURN qiraat_review_row(v_id);
END;
$$;

-- Restore qiraat_review_row() to its pre-migration body (no appliesWasl/appliesWaqf/hamzahDetail).
CREATE OR REPLACE FUNCTION qiraat_review_row(p_entry_id text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;

ALTER TABLE qiraat_entries DROP CONSTRAINT IF EXISTS qiraat_entries_wasl_waqf_chk;
ALTER TABLE qiraat_entries DROP COLUMN IF EXISTS hamzah_detail;
ALTER TABLE qiraat_entries DROP COLUMN IF EXISTS applies_waqf;
ALTER TABLE qiraat_entries DROP COLUMN IF EXISTS applies_wasl;

NOTIFY pgrst, 'reload schema';
