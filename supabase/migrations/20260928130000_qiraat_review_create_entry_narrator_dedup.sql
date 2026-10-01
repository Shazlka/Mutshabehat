-- ============================================================================
-- Fix: qiraat_review_create_entry's "already exists" short-circuit ignored narrators
--
-- Root cause (owner report: nquran.com "إضافة كوجه" click on a word whose written
-- text never changes -- e.g. 2:113 "شيء", where every reader group differs only in
-- pronunciation/hamzah handling, not spelling -- silently did nothing after the first
-- group had already been added: no new row in the DB, and "٣. الأوجه المسجلة" /
-- the reconciliation badge for the *new* group stayed red/"missing"):
--
-- Step 2 of qiraat_review_create_entry ("find existing locus or check duplicate") was
-- keyed ONLY on (locus_id, reading_text_normalized) for a farsh (variant) entry, and
-- on (locus_id, category_code) for a usul (ruling) entry -- it never compared the
-- submitted narrators at all. For a phonetic-only nquran.com difference the written
-- word is identical across every reader group (readingText/uthmaniText is always just
-- the word itself), so every group's create request shares the same
-- reading_text_normalized. The FIRST group to be added therefore "claims" that
-- (locus, normalized text) key; every later click for a DIFFERENT group at the same
-- word matched that same existing row and the function just RETURNed it unchanged --
-- never inserting the new narrator, never creating a new row -- while still reporting
-- success (result.ok = true) to the client, which is exactly why the click looked like
-- it worked but "٣. الأوجه المسجلة" and the group's own reconciliation badge never
-- reflected it.
--
-- Fix: the duplicate check now ALSO requires the existing entry's narrator set (by
-- reading_id, order-independent) to match the submitted narrators set exactly. Only a
-- genuine re-submission of the same face (same word, same reading text, same
-- narrators -- e.g. a double-click or a page reload replay) short-circuits to the
-- existing row; a different narrator group at the same word now correctly falls
-- through to creating its own new entry, same as this app's existing multiple-wajh
-- model elsewhere (Hamzah/Imalah "+ وجه آخر" builders) already relies on.
--
-- Everything else in the function is byte-identical to 20260927100000's version.
--
-- Rollback: supabase/rollbacks/20260928130000_qiraat_review_create_entry_narrator_dedup.down.sql
-- Idempotent: CREATE OR REPLACE.
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
  -- reading text at a phonetic-only locus (see header comment).
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
           SELECT coalesce(array_agg(DISTINCT en.reading_id ORDER BY en.reading_id), ARRAY[]::text[])
             FROM qiraat_entry_narrators en WHERE en.entry_id = e.id
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
           SELECT coalesce(array_agg(DISTINCT en.reading_id ORDER BY en.reading_id), ARRAY[]::text[])
             FROM qiraat_entry_narrators en WHERE en.entry_id = e.id
         ) = v_narrator_ids
       LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      RETURN qiraat_review_row(v_existing_id);
    END IF;
  END IF;

  -- 3. Resolve or create locus
  IF v_locus_id IS NULL THEN
    SELECT p.id, p.page_number INTO v_page_id, v_mushaf_page
      FROM qiraat_pages p
     WHERE p.id = (
       SELECT page_id FROM qiraat_loci
        WHERE surah_number = v_surah AND start_ayah = v_start_ayah
        LIMIT 1
     );

    IF v_page_id IS NULL THEN
      SELECT id, page_number INTO v_page_id, v_mushaf_page
        FROM qiraat_pages
       WHERE page_number = coalesce((p->>'page')::integer, 1)
       LIMIT 1;
    END IF;

    IF v_page_id IS NULL THEN
      SELECT id, page_number INTO v_page_id, v_mushaf_page FROM qiraat_pages ORDER BY page_number LIMIT 1;
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

  -- 6. Insert narrators
  FOR v_narrator IN SELECT value FROM jsonb_array_elements(v_narrators) LOOP
    v_w_order := coalesce((v_narrator->>'wajhOrder')::smallint, 1);
    v_w_note := nullif(btrim(v_narrator->>'wajhNote'), '');
    v_action := nullif(btrim(v_narrator->>'action'), '');

    IF (v_narrator->>'id') = 'Q05-R02' AND v_w_order = 1 AND v_w_note IS NULL THEN
      RAISE EXCEPTION 'QIRAAT_D8 hafs primary' USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO qiraat_entry_narrators (
      entry_id, reading_id, action, wajh_order, wajh_note, device_id
    ) VALUES (
      v_entry_id, v_narrator->>'id', v_action, v_w_order, v_w_note, v_device_id
    );
  END LOOP;

  PERFORM qiraat_review_touch(v_entry_id);
  RETURN qiraat_review_row(v_entry_id);
END;
$$;

NOTIFY pgrst, 'reload schema';
