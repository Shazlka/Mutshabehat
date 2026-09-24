-- ============================================================================
-- Qiraat Review (Phase 4 schema): bulk delete, inline-edit field coverage,
-- same-word verified-config copy, structured Hamzah, and Wasl/Waqf applicability.
-- ============================================================================
-- This migration is scoped to the Phase 4 review schema (qiraat_entries /
-- qiraat_loci / qiraat_entry_authorities / qiraat_review_* RPCs, applied in
-- 20260925120000_qiraat_phase4_review_api.sql and
-- 20260925150000_qiraat_review_create_entry.sql). It does NOT touch the
-- separate Phase 5 annotation schema (qiraat_annotations / qiraat_editor_*).
--
-- Additive & reversible:
--   1. qiraat_entries gains applies_wasl, applies_waqf (booleans, default true,
--      CHECK at least one true) and hamzah_detail (nullable jsonb, free-form
--      structured Hamzah performance value -- UI-defined shape, never
--      interpreted or validated server-side beyond "is valid JSON").
--   2. qiraat_review_row() / qiraat_review_update_entry() expose/accept the
--      three new fields (appliesWasl, appliesWaqf, hamzahDetail), for BOTH
--      farsh and usul entries (Hamzah rules and Wasl/Waqf apply to either).
--   3. qiraat_review_bulk_delete(items, note, device): transactional
--      multi soft-delete. Every row's optimistic version is checked BEFORE
--      any row is touched; on any mismatch the whole call aborts and reports
--      the exact conflicting/missing ids, so a batch never partially deletes.
--   4. qiraat_review_find_same_word(entryId): looks up prior REVIEWED entries
--      for the same normalized Quranic word (qiraat_norm on the word's own
--      text_uthmani), across the whole Mushaf, for copy-forward review.
--   5. qiraat_review_copy_entry(payload): copies one entry's full
--      configuration (reading/ruling text, narrators, Hamzah detail,
--      Wasl/Waqf) onto ANOTHER occurrence as a brand-new, independent entry
--      (own id, own OCC version). New copies always land at
--      review_status='unreviewed', verification_status='REVIEWED' --
--      never auto-verified. Built on top of the existing
--      qiraat_review_create_entry(), which already refuses to duplicate an
--      identical entry at the same locus.
--   6. qiraat_review_find_occurrences(entryId): every other Mushaf occurrence
--      of the same normalized word, each flagged 'exists' (an entry with
--      identical content is already there) or 'add' (nothing there yet).
--   7. qiraat_review_bulk_apply(sourceEntryId, targets, device): for the
--      given target word positions, skips any that already carry an
--      identical entry and creates independent copies for the rest, inside
--      one transaction, reporting added/skipped/errors. This function and
--      everything it calls write ONLY qiraat_* tables -- it never references
--      quran_words as an INSERT/UPDATE/DELETE target, so the canonical Quran
--      text can never be touched by a bulk-apply run (see the safety
--      comment inside the function body).
--
-- Rollback: supabase/rollbacks/20260926100000_qiraat_review_bulk_workflow.down.sql
-- Idempotent: CREATE OR REPLACE / IF NOT EXISTS throughout.
--
-- NOT YET APPLIED TO THE LIVE DATABASE. This sandbox has no connectivity to
-- the self-hosted Postgres (Mac Mini / Tailscale Funnel). Per CLAUDE.md, take
-- a `pg_dump -Fc` backup and apply with
--   docker compose exec -T db psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 --single-transaction < this-file.sql
-- from /Volumes/External Mini/Projects/apps/mutshabehat-selfhost, then
-- NOTIFY pgrst, 'reload schema' (already the final line here).
-- ============================================================================

-- 1. Schema: Wasl/Waqf applicability + structured Hamzah detail -----------------------------
ALTER TABLE qiraat_entries ADD COLUMN IF NOT EXISTS applies_wasl boolean NOT NULL DEFAULT true;
ALTER TABLE qiraat_entries ADD COLUMN IF NOT EXISTS applies_waqf boolean NOT NULL DEFAULT true;
ALTER TABLE qiraat_entries ADD COLUMN IF NOT EXISTS hamzah_detail jsonb;

DO $$ BEGIN
  ALTER TABLE qiraat_entries
    ADD CONSTRAINT qiraat_entries_wasl_waqf_chk CHECK (applies_wasl OR applies_waqf);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. qiraat_review_row(): expose the new fields --------------------------------------------
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
$$;

-- 3. qiraat_review_update_entry(): accept appliesWasl / appliesWaqf / hamzahDetail
-- for both kinds (Hamzah rules and Wasl/Waqf applicability are not farsh/usul-specific).
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

-- 4. Multi soft-delete, all-or-nothing on version conflicts --------------------------------
-- p_items: [{"entryId": "...", "expectedVersion": "2026-...Z"}, ...]
CREATE OR REPLACE FUNCTION qiraat_review_bulk_delete(p_items jsonb, p_note text DEFAULT NULL, p_device_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_device text := coalesce(nullif(btrim(p_device_id), ''), 'review-web');
  v_item jsonb; v_id text; v_expected timestamptz; e qiraat_entries;
  v_conflicts jsonb := '[]'::jsonb; v_missing jsonb := '[]'::jsonb; v_ok text[] := ARRAY[]::text[];
  v_locus_ids text[];
BEGIN
  PERFORM qiraat_require_editor();
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty array' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  PERFORM set_config('app.device_id', v_device, true);

  -- Phase 1: lock + validate every row's optimistic version before changing anything.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_id := v_item->>'entryId';
    v_expected := (v_item->>'expectedVersion')::timestamptz;
    SELECT * INTO e FROM qiraat_entries WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN
      v_missing := v_missing || to_jsonb(v_id);
    ELSIF e.updated_at IS DISTINCT FROM v_expected THEN
      v_conflicts := v_conflicts || jsonb_build_object('entryId', v_id, 'currentVersion', e.updated_at);
    ELSE
      v_ok := array_append(v_ok, v_id);
    END IF;
  END LOOP;

  -- Any conflict/missing row aborts the whole batch: nothing is deleted, nothing is silently
  -- half-applied. The caller re-fetches and re-selects before retrying.
  --
  -- ERRCODE is PT409, NOT the standard 'serialization_failure' (40001): per
  -- 20260925130000_qiraat_review_version_conflict_code.sql, PostgREST automatically retries any
  -- 40001 failure, which previously caused a runaway retry loop (~4,000 tx/s) on a stale-version
  -- save. PT409 maps to HTTP 409 and is never retried by PostgREST.
  IF jsonb_array_length(v_conflicts) > 0 OR jsonb_array_length(v_missing) > 0 THEN
    RAISE EXCEPTION 'VERSION_CONFLICT bulk delete: % conflicting, % missing', jsonb_array_length(v_conflicts), jsonb_array_length(v_missing)
      USING ERRCODE = 'PT409', DETAIL = jsonb_build_object('conflicts', v_conflicts, 'missing', v_missing)::text;
  END IF;

  UPDATE qiraat_entries
     SET deleted_at = now(),
         notes = CASE WHEN nullif(btrim(p_note), '') IS NULL THEN notes ELSE concat_ws(E'\n', notes, '[حذف جماعي] ' || btrim(p_note)) END
   WHERE id = ANY(v_ok);

  SELECT array_agg(DISTINCT locus_id) INTO v_locus_ids FROM qiraat_entries WHERE id = ANY(v_ok);

  UPDATE qiraat_loci l SET deleted_at = now()
   WHERE l.id = ANY(v_locus_ids) AND l.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM qiraat_entries x WHERE x.locus_id = l.id AND x.deleted_at IS NULL AND x.verification_status <> 'REJECTED');

  PERFORM qiraat_review_sync_locus(x) FROM unnest(v_locus_ids) AS x;

  RETURN jsonb_build_object(
    'deleted', (SELECT coalesce(jsonb_agg(qiraat_review_row(x)), '[]'::jsonb) FROM unnest(v_ok) AS x)
  );
END;
$$;

-- 5. Same-word verified-config lookup --------------------------------------------------------
-- Keyed by the Quran word position itself (not an entry id), so it works both for a word that
-- already carries a reading/ruling (State A/B) AND for a plain word being newly added (State C,
-- where no entry exists yet to key off). p_exclude_locus_id lets the caller exclude its own
-- current location when one exists.
CREATE OR REPLACE FUNCTION qiraat_review_find_same_word(p_surah integer, p_ayah integer, p_word integer, p_exclude_locus_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key text; v_result jsonb;
BEGIN
  PERFORM qiraat_require_editor();
  SELECT qiraat_norm(qw.text_uthmani) INTO v_key
    FROM quran_words qw WHERE qw.surah = p_surah AND qw.ayah = p_ayah AND qw.word_position = p_word;
  IF v_key IS NULL OR v_key = '' THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(qiraat_review_row(e2.id) ORDER BY sw2.page_number, sw2.ayah, sw2.word_position), '[]'::jsonb)
    INTO v_result
    FROM qiraat_loci l2
    JOIN quran_words sw2 ON sw2.surah = l2.surah_number AND sw2.ayah = l2.start_ayah AND sw2.word_position = l2.start_word
    JOIN qiraat_entries e2 ON e2.locus_id = l2.id
   WHERE l2.deleted_at IS NULL AND e2.deleted_at IS NULL AND e2.verification_status <> 'REJECTED'
     AND e2.review_status = 'reviewed'
     AND qiraat_norm(sw2.text_uthmani) = v_key
     AND (p_exclude_locus_id IS NULL OR l2.id <> p_exclude_locus_id);

  RETURN coalesce(v_result, '[]'::jsonb);
END;
$$;

-- 6. Copy one entry's full configuration onto another occurrence, as a new independent entry.
-- p: {"sourceEntryId","surah","ayah","startWord","endAyah"?,"endWord"?,"deviceId"?}
CREATE OR REPLACE FUNCTION qiraat_review_copy_entry(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;

-- 7. Occurrence preview for "apply to all occurrences of the same word" --------------------
CREATE OR REPLACE FUNCTION qiraat_review_find_occurrences(p_entry_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries; v_locus qiraat_loci; v_key text; v_result jsonb;
BEGIN
  PERFORM qiraat_require_editor();
  SELECT * INTO e FROM qiraat_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND entry %', p_entry_id USING ERRCODE = 'no_data_found'; END IF;
  SELECT * INTO v_locus FROM qiraat_loci WHERE id = e.locus_id;

  SELECT qiraat_norm(qw.text_uthmani) INTO v_key
    FROM quran_words qw
   WHERE qw.surah = v_locus.surah_number AND qw.ayah = v_locus.start_ayah AND qw.word_position = v_locus.start_word;
  IF v_key IS NULL OR v_key = '' THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'surah', qw.surah, 'ayah', qw.ayah, 'word', qw.word_position, 'page', qw.page_number,
      'canonicalKey', qw.canonical_key, 'text', qw.text_uthmani,
      'status', CASE WHEN existing.id IS NOT NULL THEN 'exists' ELSE 'add' END,
      'existingEntryId', existing.id
    ) ORDER BY qw.page_number, qw.ayah, qw.word_position), '[]'::jsonb)
    INTO v_result
    FROM quran_words qw
    LEFT JOIN qiraat_loci l2 ON l2.surah_number = qw.surah AND l2.start_ayah = qw.ayah AND l2.start_word = qw.word_position AND l2.deleted_at IS NULL
    LEFT JOIN qiraat_entries existing ON existing.locus_id = l2.id AND existing.deleted_at IS NULL AND existing.verification_status <> 'REJECTED'
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
   WHERE qiraat_norm(qw.text_uthmani) = v_key
     AND NOT (qw.surah = v_locus.surah_number AND qw.ayah = v_locus.start_ayah AND qw.word_position = v_locus.start_word);
  RETURN coalesce(v_result, '[]'::jsonb);
END;
$$;

-- 8. Bulk apply: create the source entry's configuration at every selected target occurrence
-- that does not already carry an identical entry, in one transaction. SAFETY: this function and
-- everything it calls (qiraat_review_copy_entry -> qiraat_review_create_entry) write only
-- qiraat_entries / qiraat_loci / qiraat_variant_details / qiraat_ruling_details /
-- qiraat_entry_authorities / edit_log. Neither this function nor anything it calls contains an
-- INSERT, UPDATE or DELETE with quran_words as its target -- the canonical Quran word text can
-- never be written by this code path.
-- p_targets: [{"surah","ayah","word"}, ...] (from qiraat_review_find_occurrences, reviewer-selected)
CREATE OR REPLACE FUNCTION qiraat_review_bulk_apply(p_source_entry_id text, p_targets jsonb, p_device_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e qiraat_entries; v_device text := coalesce(nullif(btrim(p_device_id), ''), 'review-web');
  v_target jsonb; v_surah int; v_ayah int; v_word int;
  v_existing_id text; v_created jsonb;
  v_added jsonb := '[]'::jsonb; v_skipped jsonb := '[]'::jsonb; v_errors jsonb := '[]'::jsonb;
BEGIN
  PERFORM qiraat_require_editor();
  SELECT * INTO e FROM qiraat_entries WHERE id = p_source_entry_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND entry %', p_source_entry_id USING ERRCODE = 'no_data_found'; END IF;
  IF jsonb_typeof(p_targets) <> 'array' OR jsonb_array_length(p_targets) = 0 THEN
    RAISE EXCEPTION 'targets must be a non-empty array' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF jsonb_array_length(p_targets) > 500 THEN
    RAISE EXCEPTION 'too many targets in one call (max 500)' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_target IN SELECT value FROM jsonb_array_elements(p_targets) LOOP
    v_surah := (v_target->>'surah')::int;
    v_ayah := (v_target->>'ayah')::int;
    v_word := (v_target->>'word')::int;

    BEGIN
      SELECT existing.id INTO v_existing_id
        FROM qiraat_loci l2
        JOIN qiraat_entries existing ON existing.locus_id = l2.id AND existing.deleted_at IS NULL AND existing.verification_status <> 'REJECTED'
       WHERE l2.surah_number = v_surah AND l2.start_ayah = v_ayah AND l2.start_word = v_word AND l2.deleted_at IS NULL
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

      IF v_existing_id IS NOT NULL THEN
        v_skipped := v_skipped || jsonb_build_object('surah', v_surah, 'ayah', v_ayah, 'word', v_word, 'existingEntryId', v_existing_id);
        CONTINUE;
      END IF;

      v_created := qiraat_review_copy_entry(jsonb_build_object(
        'sourceEntryId', p_source_entry_id, 'surah', v_surah, 'ayah', v_ayah, 'startWord', v_word,
        'deviceId', v_device));
      v_added := v_added || jsonb_build_object('entryId', v_created->>'entryId', 'surah', v_surah, 'ayah', v_ayah, 'word', v_word);
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('surah', v_surah, 'ayah', v_ayah, 'word', v_word, 'message', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('sourceEntryId', p_source_entry_id, 'added', v_added, 'skipped', v_skipped, 'errors', v_errors);
END;
$$;

-- Grants -------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION
  qiraat_review_bulk_delete(jsonb, text, text),
  qiraat_review_find_same_word(integer, integer, integer, text),
  qiraat_review_copy_entry(jsonb),
  qiraat_review_find_occurrences(text),
  qiraat_review_bulk_apply(text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  qiraat_review_bulk_delete(jsonb, text, text),
  qiraat_review_find_same_word(integer, integer, integer, text),
  qiraat_review_copy_entry(jsonb),
  qiraat_review_find_occurrences(text),
  qiraat_review_bulk_apply(text, jsonb, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
