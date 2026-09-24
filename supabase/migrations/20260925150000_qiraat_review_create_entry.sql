-- ============================================================================
-- Qiraat Review: create entry RPC (for adding missing Qiraat to plain words)
-- ============================================================================
-- Allows authorized editors to add a missing Qiraat variant or ruling from
-- any word on the Mushaf review screen.
--
-- Security:
--   - SECURITY DEFINER, editor-only (checks qiraat_require_editor()).
--   - Sets app.device_id for edit_log capture and sync stamp.
--   - Full undo support via edit_log and qiraat_review_undo.
-- Duplicate prevention:
--   - If an active entry at the locus with identical normalized reading text (farsh)
--     or identical category_code (usul) already exists, returns that row without
--     creating a duplicate.
-- Rollback: supabase/rollbacks/20260925150000_qiraat_review_create_entry.down.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION qiraat_review_create_entry(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- 2. Find existing locus or check duplicate
  SELECT id INTO v_locus_id
    FROM qiraat_loci
   WHERE surah_number = v_surah
     AND start_ayah = v_start_ayah
     AND start_word = v_start_word
     AND end_ayah = v_end_ayah
     AND coalesce(end_word, start_word) = v_end_word
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_locus_id IS NOT NULL THEN
    IF v_kind = 'variant' THEN
      SELECT e.id INTO v_existing_id
        FROM qiraat_entries e
        JOIN qiraat_variant_details vd ON vd.entry_id = e.id
       WHERE e.locus_id = v_locus_id
         AND e.kind = 'variant'
         AND e.deleted_at IS NULL
         AND vd.reading_text_normalized = qiraat_norm(v_reading_text)
       LIMIT 1;
    ELSE
      SELECT e.id INTO v_existing_id
        FROM qiraat_entries e
        JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
       WHERE e.locus_id = v_locus_id
         AND e.kind = 'ruling'
         AND e.deleted_at IS NULL
         AND rd.category_code = v_category_code
       LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      RETURN qiraat_review_row(v_existing_id);
    END IF;
  END IF;

  -- 3. If no locus exists, create one anchored to quran_words
  IF v_locus_id IS NULL THEN
    SELECT qw.page_number INTO v_mushaf_page
      FROM quran_words qw
     WHERE qw.surah = v_surah AND qw.ayah = v_start_ayah AND qw.word_position = v_start_word;

    IF v_mushaf_page IS NULL THEN
      RAISE EXCEPTION 'invalid quran word position %:%:%', v_surah, v_start_ayah, v_start_word USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT id INTO v_page_id
      FROM qiraat_pages
     WHERE mushaf_page_number = v_mushaf_page
     LIMIT 1;

    SELECT string_agg(qw.text_uthmani, ' ' ORDER BY qw.ayah, qw.word_position)
      INTO v_base_text
      FROM quran_words qw
     WHERE qw.surah = v_surah
       AND (qw.ayah, qw.word_position) >= (v_start_ayah, v_start_word)
       AND (qw.ayah, qw.word_position) <= (v_end_ayah, v_end_word);

    v_locus_id := 'L-' || lpad(v_surah::text, 3, '0') || '-' || lpad(v_start_ayah::text, 3, '0') || '-' || lpad(v_start_word::text, 3, '0') || '-' || substr(md5(random()::text), 1, 8);

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

  -- 5. Create details
  IF v_kind = 'variant' THEN
    INSERT INTO qiraat_variant_details (
      entry_id, reading_text, reading_text_normalized, uthmani_text,
      description_ar, variant_type, performance_note, device_id
    ) VALUES (
      v_entry_id, v_reading_text, qiraat_norm(v_reading_text), v_uthmani_text,
      v_description, v_variant_type::qiraat_variant_type, v_perf_note, v_device_id
    );
  ELSE
    INSERT INTO qiraat_ruling_details (
      entry_id, category_code, text_ar, device_id
    ) VALUES (
      v_entry_id, v_category_code, v_ruling_text, v_device_id
    );
  END IF;

  -- 6. Insert narrators
  FOR v_narrator IN SELECT value FROM jsonb_array_elements(v_narrators) LOOP
    v_w_order := coalesce((v_narrator->>'wajhOrder')::smallint, 1);
    v_w_note := nullif(btrim(v_narrator->>'wajhNote'), '');
    v_action := nullif(btrim(v_narrator->>'action'), '');

    INSERT INTO qiraat_entry_authorities (
      entry_id, authority_id, action_ar, is_default, wajh_order, wajh_note, device_id
    ) VALUES (
      v_entry_id,
      v_narrator->>'id',
      v_action,
      (v_w_order = 1),
      v_w_order,
      v_w_note,
      v_device_id
    );
  END LOOP;

  PERFORM qiraat_review_sync_locus(v_locus_id);
  RETURN qiraat_review_row(v_entry_id);
END;
$$;

REVOKE ALL ON FUNCTION qiraat_review_create_entry(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qiraat_review_create_entry(jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
