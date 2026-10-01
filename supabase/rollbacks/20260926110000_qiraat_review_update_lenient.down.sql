-- Restore qiraat_review_update_entry() to previous version from 20260926100000_qiraat_review_bulk_workflow.sql
CREATE OR REPLACE FUNCTION qiraat_review_update_entry(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries; v_id text := p->>'entryId';
BEGIN
  e := qiraat_review_begin(v_id, (p->>'expectedVersion')::timestamptz, p->>'deviceId');
  IF e.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'DELETED entry %', v_id USING ERRCODE = 'object_not_in_prerequisite_state'; END IF;
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
    UPDATE qiraat_entries SET hamzah_detail = CASE WHEN p->'hamzahDetail' = 'null'::jsonb THEN NULL ELSE p->'hamzahDetail' END
    WHERE id = v_id;
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

NOTIFY pgrst, 'reload schema';
