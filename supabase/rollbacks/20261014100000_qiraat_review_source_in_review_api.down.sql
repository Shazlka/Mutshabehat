-- Rollback: Restore qiraat_review_page, qiraat_review_set_status, and qiraat_review_update_entry to previous definitions
-- Reverts migration: supabase/migrations/20261014100000_qiraat_review_source_in_review_api.sql

-- 1. Restore qiraat_review_page from 20260925120000_qiraat_phase4_review_api.sql
CREATE OR REPLACE FUNCTION qiraat_review_page(p_page integer, p_include_deleted boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows jsonb;
BEGIN
  PERFORM qiraat_require_editor();
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 604 THEN
    RAISE EXCEPTION 'invalid page %', p_page USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT coalesce(jsonb_agg(qiraat_review_row(x.id) ORDER BY x.ayah, x.start_word, x.kind, x.category_code NULLS FIRST, x.entry_order, x.id), '[]'::jsonb)
    INTO v_rows
    FROM (SELECT e.id, l.start_ayah AS ayah, l.start_word, e.kind, rd.category_code, e.entry_order
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
$$;

-- 2. Restore qiraat_review_set_status from 20260925120000_qiraat_phase4_review_api.sql
CREATE OR REPLACE FUNCTION qiraat_review_set_status(p_entry_id text, p_status qiraat_review_status,
                                                    p_expected timestamptz, p_note text DEFAULT NULL,
                                                    p_device_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries;
BEGIN
  e := qiraat_review_begin(p_entry_id, p_expected, p_device_id);
  IF e.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'DELETED entry %', p_entry_id USING ERRCODE = 'object_not_in_prerequisite_state'; END IF;
  UPDATE qiraat_entries SET review_status = p_status WHERE id = p_entry_id;
  IF p_status = 'reviewed' THEN
    UPDATE qiraat_qa_flags f
       SET status = CASE WHEN EXISTS (
                      SELECT 1 FROM edit_log l
                       WHERE l.actor_id IS NOT NULL AND l.changed_at > f.created_at
                         AND ((l.table_name IN ('qiraat_entries', 'qiraat_variant_details', 'qiraat_ruling_details') AND l.row_id = p_entry_id AND coalesce(l.field, '') <> 'review_status')
                              OR (l.table_name = 'qiraat_entry_authorities' AND coalesce(l.new_value, l.old_value)->>'entry_id' = p_entry_id)))
                    THEN 'corrected' ELSE 'verified' END::qiraat_flag_status,
           resolved_note = nullif(btrim(p_note), ''),
           resolved_at = now()
     WHERE f.entry_id = p_entry_id AND f.status = 'open';
  ELSIF p_status = 'flagged' AND nullif(btrim(p_note), '') IS NOT NULL THEN
    INSERT INTO qiraat_qa_flags (page_id, locus_id, entry_id, severity, flag_type, issue_ar, status)
    VALUES (e.page_id, e.locus_id, e.id, 'warning', 'MANUAL', btrim(p_note), 'open');
  END IF;
  PERFORM qiraat_review_sync_locus(e.locus_id);
  RETURN qiraat_review_row(p_entry_id);
END;
$$;

-- 3. Restore qiraat_review_update_entry from 20260927100000_qiraat_review_safe_variant_type.sql
CREATE OR REPLACE FUNCTION qiraat_review_update_entry(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e qiraat_entries;
  v_id text := p->>'entryId';
BEGIN
  e := qiraat_review_begin(v_id, (p->>'expectedVersion')::timestamptz, p->>'deviceId');
  IF e.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'DELETED entry %', v_id USING ERRCODE = 'object_not_in_prerequisite_state';
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
$$;

REVOKE ALL ON FUNCTION qiraat_review_page(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qiraat_review_page(integer, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION qiraat_review_set_status(text, qiraat_review_status, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qiraat_review_set_status(text, qiraat_review_status, timestamptz, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION qiraat_review_update_entry(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qiraat_review_update_entry(jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
