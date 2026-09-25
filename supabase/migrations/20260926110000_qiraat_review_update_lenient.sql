-- ============================================================================
-- Qiraat Review: lenient entry update & optional kind transition
-- ============================================================================
-- Fixes "invalid field for farsh entry" / "invalid field for usul entry" by:
--   1. Permitting update payloads to omit or include extraneous/null fields
--      without raising exceptions (lenient update).
--   2. Supporting switching kind between 'farsh' (variant) and 'usul' (ruling)
--      if requested by the editor.
--
-- Rollback: supabase/rollbacks/20260926110000_qiraat_review_update_lenient.down.sql
-- Idempotent: CREATE OR REPLACE throughout.
-- ============================================================================

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
      coalesce(nullif(btrim(p->>'variantType'), '')::qiraat_variant_type, 'other')
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
      UPDATE qiraat_variant_details SET variant_type = (p->>'variantType')::qiraat_variant_type WHERE entry_id = v_id;
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

REVOKE ALL ON FUNCTION qiraat_review_update_entry(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qiraat_review_update_entry(jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
