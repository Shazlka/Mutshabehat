-- ============================================================================
-- Qiraat Phase 4: review screen API (allowlist + review RPCs)
-- ============================================================================
-- Decisions (2026-09-23): allowlist of editors; new route /mushaf-1441/review; full row editing in
-- v1 (status, narrators/wajh, text/description/category, soft delete/restore, flag resolution,
-- undo); marking a reading reviewed resolves its open flags with an optional note.
--
--   1. qiraat_editors allowlist + qiraat_is_editor() / qiraat_require_editor().
--      Seeded with the single existing account (created every existing annotation).
--   2. The annotation editor's write RPCs (create/update/soft-delete) now require an editor
--      instead of any signed-in user. Bodies are otherwise verbatim from live.
--   3. qiraat_norm(text): SQL port of scripts/qiraat/tokens.py norm() for *_normalized columns.
--   4. edit_log also captures qiraat_qa_flags (flag resolution is undoable).
--   2b. Phase 2 fix: the deferred rule-check trigger functions become SECURITY DEFINER (they fire at
--      COMMIT as the committing role, which for PostgREST is `authenticated`).
--   5. Review RPCs (SECURITY DEFINER, editor-only, one transaction each; device id → edit_log):
--        qiraat_review_page, qiraat_review_set_status, qiraat_review_update_entry,
--        qiraat_review_set_narrators, qiraat_review_delete_entry, qiraat_review_restore_entry,
--        qiraat_review_history, qiraat_review_undo, qiraat_review_is_editor, qiraat_review_overview.
--      Optimistic concurrency: every write takes the entry's `version` (updated_at) and raises
--      VERSION_CONFLICT if it changed. The Phase 2 rule triggers (D8, narrator twice, empty
--      location) still decide what may be saved.
-- Rollback: supabase/rollbacks/20260925120000_qiraat_phase4_review_api.down.sql. Idempotent.
-- ============================================================================

-- 1. Allowlist ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qiraat_editors (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  note     text
);
ALTER TABLE qiraat_editors ENABLE ROW LEVEL SECURITY;      -- no policies: definer functions only
REVOKE ALL ON qiraat_editors FROM anon, authenticated;

INSERT INTO qiraat_editors (user_id, note)
SELECT 'ec34e9cc-7c98-4180-86ce-2b80ac34646e'::uuid, 'owner (seeded by Phase 4 migration)'
 WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'ec34e9cc-7c98-4180-86ce-2b80ac34646e')
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION qiraat_is_editor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM qiraat_editors WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION qiraat_require_editor()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT qiraat_is_editor() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- 2. Annotation editor writes: editors only (verbatim live bodies, one line changed) ----------
CREATE OR REPLACE FUNCTION public.qiraat_editor_create_annotation(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  start_word quran_words; end_word quran_words; annotation_id uuid; face jsonb; variant jsonb; source jsonb;
  face_ids uuid[] := ARRAY[]::uuid[]; face_id uuid; idx integer; source_id text;
BEGIN
  PERFORM qiraat_require_editor();
  SELECT * INTO start_word FROM quran_words WHERE canonical_key=p->>'startCanonicalKey';
  SELECT * INTO end_word FROM quran_words WHERE canonical_key=coalesce(p->>'endCanonicalKey',p->>'startCanonicalKey');
  IF start_word.id IS NULL OR end_word.id IS NULL THEN RAISE EXCEPTION 'invalid canonical key'; END IF;
  IF NOT EXISTS(SELECT 1 FROM qiraat_authorities WHERE id=p->>'targetAuthorityId' AND active) THEN RAISE EXCEPTION 'invalid target entity'; END IF;
  IF NOT EXISTS(SELECT 1 FROM qiraat_taxonomies WHERE id=(p->>'taxonomyId')::uuid AND active) THEN RAISE EXCEPTION 'missing taxonomy'; END IF;
  INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,corpus_id,framework_id,reading_context,inheritance_action,applies_to_descendants,status,color_override,entry_method,notes,created_by,updated_by)
  VALUES(coalesce(p->>'scopeType','WORD'),start_word.id,end_word.id,(p->>'taxonomyId')::uuid,p->>'targetAuthorityId',nullif(p->>'corpusId','')::uuid,nullif(p->>'frameworkId','')::uuid,coalesce(p->>'readingContext','BOTH'),coalesce(p->>'inheritanceAction','INHERIT'),coalesce((p->>'appliesToDescendants')::boolean,false),coalesce(p->>'status','draft'),nullif(p->>'colorOverride',''), 'manual',nullif(p->>'notes',''),auth.uid(),auth.uid()) RETURNING id INTO annotation_id;
  FOR face IN SELECT value FROM jsonb_array_elements(coalesce(p->'faces','[]'::jsonb)) LOOP
    INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar,preference_status,sort_order)
    VALUES(annotation_id,coalesce(face->>'faceType','CUSTOM'),coalesce(face->'faceValue','null'::jsonb),coalesce(face->>'labelAr','وجه'),nullif(face->>'preferenceStatus',''),coalesce((face->>'sortOrder')::smallint,100)) RETURNING id INTO face_id;
    face_ids := array_append(face_ids, face_id);
  END LOOP;
  FOR variant IN SELECT value FROM jsonb_array_elements(coalesce(p->'variants','[]'::jsonb)) LOOP
    idx := nullif(variant->>'faceIndex','')::integer;
    INSERT INTO qiraat_annotation_variants(annotation_id,face_id,canonical_word_key,uthmanic_text,normalized_text,phonetic_note,render_mode)
    VALUES(annotation_id,CASE WHEN idx IS NULL THEN NULL WHEN idx>=0 AND idx<array_length(face_ids,1) THEN face_ids[idx+1] ELSE NULL END,start_word.canonical_key,nullif(variant->>'uthmanicText',''),nullif(variant->>'normalizedText',''),nullif(variant->>'phoneticNote',''),coalesce(variant->>'renderMode','editor_only'));
  END LOOP;
  FOR source IN SELECT value FROM jsonb_array_elements(coalesce(p->'sources','[]'::jsonb)) LOOP
    source_id := source->>'sourceId';
    IF NOT EXISTS(SELECT 1 FROM qiraat_source_documents WHERE id=source_id) THEN RAISE EXCEPTION 'invalid source reference'; END IF;
    INSERT INTO qiraat_annotation_sources(annotation_id,source_id,reference_text,notes) VALUES(annotation_id,source_id,nullif(source->>'referenceText',''),nullif(source->>'notes',''));
  END LOOP;
  RETURN (SELECT qiraat_editor_annotations(start_word.canonical_key));
END $function$

;

CREATE OR REPLACE FUNCTION public.qiraat_editor_update_annotation(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  start_word quran_words; end_word quran_words; target_annotation_id uuid := (p->>'id')::uuid;
  expected_version integer := (p->>'expectedVersion')::integer; face jsonb; variant jsonb; source jsonb;
  face_ids uuid[] := ARRAY[]::uuid[]; face_id uuid; idx integer; source_id text;
BEGIN
  PERFORM qiraat_require_editor();
  IF target_annotation_id IS NULL OR expected_version IS NULL THEN RAISE EXCEPTION 'id and expected version are required'; END IF;
  SELECT * INTO start_word FROM quran_words WHERE canonical_key=p->>'startCanonicalKey';
  SELECT * INTO end_word FROM quran_words WHERE canonical_key=coalesce(p->>'endCanonicalKey',p->>'startCanonicalKey');
  IF start_word.id IS NULL OR end_word.id IS NULL THEN RAISE EXCEPTION 'invalid canonical key'; END IF;
  IF NOT EXISTS(SELECT 1 FROM qiraat_authorities WHERE id=p->>'targetAuthorityId' AND active) THEN RAISE EXCEPTION 'invalid target entity'; END IF;
  IF NOT EXISTS(SELECT 1 FROM qiraat_taxonomies WHERE id=(p->>'taxonomyId')::uuid AND active) THEN RAISE EXCEPTION 'missing taxonomy'; END IF;
  UPDATE qiraat_annotations SET scope_type=coalesce(p->>'scopeType','WORD'),start_word_id=start_word.id,end_word_id=end_word.id,taxonomy_id=(p->>'taxonomyId')::uuid,target_authority_id=p->>'targetAuthorityId',corpus_id=nullif(p->>'corpusId','')::uuid,framework_id=nullif(p->>'frameworkId','')::uuid,reading_context=coalesce(p->>'readingContext','BOTH'),inheritance_action=coalesce(p->>'inheritanceAction','INHERIT'),applies_to_descendants=coalesce((p->>'appliesToDescendants')::boolean,false),status=coalesce(p->>'status','draft'),color_override=nullif(p->>'colorOverride',''),notes=nullif(p->>'notes',''),updated_by=auth.uid()
  WHERE id=target_annotation_id AND deleted_at IS NULL AND version=expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT annotation %', target_annotation_id; END IF;
  DELETE FROM qiraat_annotation_sources s WHERE s.annotation_id=target_annotation_id;
  DELETE FROM qiraat_annotation_variants v WHERE v.annotation_id=target_annotation_id;
  DELETE FROM qiraat_annotation_faces f WHERE f.annotation_id=target_annotation_id;
  FOR face IN SELECT value FROM jsonb_array_elements(coalesce(p->'faces','[]'::jsonb)) LOOP
    INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar,preference_status,sort_order,metadata)
    VALUES(target_annotation_id,coalesce(face->>'faceType','CUSTOM'),coalesce(face->'faceValue','null'::jsonb),coalesce(face->>'labelAr','وجه'),nullif(face->>'preferenceStatus',''),coalesce((face->>'sortOrder')::smallint,100),coalesce(face->'metadata','{}'::jsonb)) RETURNING id INTO face_id;
    face_ids:=array_append(face_ids,face_id);
  END LOOP;
  FOR variant IN SELECT value FROM jsonb_array_elements(coalesce(p->'variants','[]'::jsonb)) LOOP
    idx:=nullif(variant->>'faceIndex','')::integer;
    INSERT INTO qiraat_annotation_variants(annotation_id,face_id,canonical_word_key,uthmanic_text,normalized_text,phonetic_note,render_mode,glyph_reference)
    VALUES(target_annotation_id,CASE WHEN idx IS NULL THEN NULL WHEN idx>=0 AND idx<array_length(face_ids,1) THEN face_ids[idx+1] ELSE NULL END,start_word.canonical_key,nullif(variant->>'uthmanicText',''),nullif(variant->>'normalizedText',''),nullif(variant->>'phoneticNote',''),coalesce(variant->>'renderMode','editor_only'),nullif(variant->>'glyphReference',''));
  END LOOP;
  FOR source IN SELECT value FROM jsonb_array_elements(coalesce(p->'sources','[]'::jsonb)) LOOP
    source_id:=source->>'sourceId';
    IF NOT EXISTS(SELECT 1 FROM qiraat_source_documents WHERE id=source_id) THEN RAISE EXCEPTION 'invalid source reference'; END IF;
    INSERT INTO qiraat_annotation_sources(annotation_id,source_id,reference_text,notes) VALUES(target_annotation_id,source_id,nullif(source->>'referenceText',''),nullif(source->>'notes',''));
  END LOOP;
  RETURN qiraat_editor_annotations(start_word.canonical_key);
END $function$

;

CREATE OR REPLACE FUNCTION public.qiraat_editor_soft_delete_annotation(p_annotation_id uuid, p_expected_version integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM qiraat_require_editor();
  UPDATE qiraat_annotations
  SET deleted_at=now(), updated_by=auth.uid()
  WHERE id=p_annotation_id AND deleted_at IS NULL AND version=p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT annotation %', p_annotation_id; END IF;
END $function$

;


-- 2b. Phase 2 fix: the rule checks are DEFERRED constraint triggers, so they fire at COMMIT under
-- the role that commits. Through PostgREST that is `authenticated`, which may not execute the
-- qiraat_assert_* functions, so every review save failed with "permission denied". The trigger
-- functions now run as their owner.
ALTER FUNCTION qiraat_check_rules_from_reading()        SECURITY DEFINER SET search_path = public;
ALTER FUNCTION qiraat_check_rules_from_entry()          SECURITY DEFINER SET search_path = public;
ALTER FUNCTION qiraat_check_rules_from_ruling_detail()  SECURITY DEFINER SET search_path = public;
ALTER FUNCTION qiraat_check_rules_from_locus()          SECURITY DEFINER SET search_path = public;

-- 3. SQL port of tokens.py norm() --------------------------------------------------------------
CREATE OR REPLACE FUNCTION qiraat_norm(p text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(
           replace(replace(replace(replace(replace(
             regexp_replace(
               regexp_replace(
                 replace(replace(replace(replace(replace(coalesce(p, ''),
                   'ىٰ', 'ا'), 'ۧ', 'ي'), 'ۦ', 'ي'), 'ۥ', 'و'), 'ٰ', 'ا'),
                 '[ً-ٰۖ-ۭؐ-ؚ]', '', 'g'),
               '[إأآاٱ]', 'ا', 'g'),
             'ى', 'ي'), 'ة', 'ه'), 'ؤ', 'و'), 'ئ', 'ي'), 'ـ', ''),
           '\s+', ' ', 'g'));
$$;

-- 4. Flags are part of the edit history ---------------------------------------------------------
DROP TRIGGER IF EXISTS qiraat_qa_flags_edit_log ON qiraat_qa_flags;
CREATE TRIGGER qiraat_qa_flags_edit_log AFTER INSERT OR UPDATE OR DELETE ON qiraat_qa_flags
  FOR EACH ROW EXECUTE FUNCTION edit_log_capture('id');

-- 5. Review RPCs ------------------------------------------------------------------------------

-- Common start of every review write: editor check, device id for edit_log / sync columns,
-- optimistic version check (locks the entry row).
CREATE OR REPLACE FUNCTION qiraat_review_begin(p_entry_id text, p_expected timestamptz, p_device_id text)
RETURNS qiraat_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries;
BEGIN
  PERFORM qiraat_require_editor();
  PERFORM set_config('app.device_id', coalesce(nullif(btrim(p_device_id), ''), 'review-web'), true);
  SELECT * INTO e FROM qiraat_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND entry %', p_entry_id USING ERRCODE = 'no_data_found'; END IF;
  IF p_expected IS NULL OR e.updated_at IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'VERSION_CONFLICT entry %', p_entry_id USING ERRCODE = 'serialization_failure';
  END IF;
  RETURN e;
END;
$$;

-- Bump the entry's version after a child-table change (device_id/updated_at are not logged).
CREATE OR REPLACE FUNCTION qiraat_review_touch(p_entry_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE qiraat_entries SET device_id = current_setting('app.device_id', true) WHERE id = p_entry_id;
$$;

-- A location is reviewed when all its live readings are, flagged when any is.
CREATE OR REPLACE FUNCTION qiraat_review_sync_locus(p_locus_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE qiraat_loci l
     SET review_status = s.status
    FROM (SELECT CASE WHEN bool_or(x.review_status = 'flagged') THEN 'flagged'
                      WHEN bool_and(x.review_status = 'reviewed') THEN 'reviewed'
                      ELSE 'unreviewed' END::qiraat_review_status AS status
            FROM qiraat_entries x
           WHERE x.locus_id = p_locus_id AND x.deleted_at IS NULL AND x.verification_status <> 'REJECTED') s
   WHERE l.id = p_locus_id AND s.status IS NOT NULL AND l.review_status IS DISTINCT FROM s.status;
$$;

-- One review-table row (also used as the return value of every write).
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

CREATE OR REPLACE FUNCTION qiraat_review_is_editor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT qiraat_is_editor();
$$;

-- The whole page: exact Hafs words (for rendering/highlighting), review rows, catalogues, stats.
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

-- Review status. 'reviewed' resolves the entry's open flags (corrected if it was edited through
-- the review screen after the flag was raised, else verified). 'flagged' with a note raises a
-- MANUAL flag.
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

-- Content fields. Only keys present in p are changed. Keys: readingText, uthmaniText,
-- description, performanceNote, variantType (فرش); categoryCode, rulingText (أصول); notes.
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

-- Replace the narrator list: [{id, action?, wajhOrder?, wajhNote?}] (narrator ids only).
-- Rows no longer listed are soft-deleted; the readings are rebuilt by the existing trigger.
CREATE OR REPLACE FUNCTION qiraat_review_set_narrators(p_entry_id text, p_narrators jsonb,
                                                       p_expected timestamptz, p_device_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries;
BEGIN
  e := qiraat_review_begin(p_entry_id, p_expected, p_device_id);
  IF e.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'DELETED entry %', p_entry_id USING ERRCODE = 'object_not_in_prerequisite_state'; END IF;
  IF jsonb_typeof(p_narrators) <> 'array' OR jsonb_array_length(p_narrators) = 0 THEN
    RAISE EXCEPTION 'at least one narrator is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  CREATE TEMP TABLE IF NOT EXISTS _review_narrators (authority_id text, action_ar text, wajh_order smallint, wajh_note text) ON COMMIT DROP;
  TRUNCATE _review_narrators;
  INSERT INTO _review_narrators
  SELECT x->>'id', nullif(btrim(x->>'action'), ''), coalesce((x->>'wajhOrder')::smallint, 1), nullif(btrim(x->>'wajhNote'), '')
    FROM jsonb_array_elements(p_narrators) x;
  IF EXISTS (SELECT 1 FROM _review_narrators n LEFT JOIN qiraat_authorities a ON a.id = n.authority_id AND a.authority_type = 'narrator'
              WHERE a.id IS NULL OR n.wajh_order < 1) THEN
    RAISE EXCEPTION 'invalid narrator or wajh order' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF EXISTS (SELECT 1 FROM _review_narrators GROUP BY authority_id, coalesce(action_ar, '') HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate narrator' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  UPDATE qiraat_entry_authorities ea SET deleted_at = now()
   WHERE ea.entry_id = p_entry_id AND ea.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM _review_narrators n
                      WHERE n.authority_id = ea.authority_id AND coalesce(n.action_ar, '') = coalesce(ea.action_ar, ''));
  INSERT INTO qiraat_entry_authorities (entry_id, authority_id, action_ar, is_default, wajh_order, wajh_note)
  SELECT p_entry_id, authority_id, action_ar, wajh_order = 1, wajh_order, wajh_note FROM _review_narrators
  ON CONFLICT (entry_id, authority_id, COALESCE(action_ar, '')) DO UPDATE
     SET is_default = EXCLUDED.is_default, wajh_order = EXCLUDED.wajh_order, wajh_note = EXCLUDED.wajh_note, deleted_at = NULL
   WHERE (qiraat_entry_authorities.is_default, qiraat_entry_authorities.wajh_order, qiraat_entry_authorities.wajh_note, qiraat_entry_authorities.deleted_at)
         IS DISTINCT FROM (EXCLUDED.is_default, EXCLUDED.wajh_order, EXCLUDED.wajh_note, NULL::timestamptz);
  PERFORM qiraat_review_touch(p_entry_id);
  RETURN qiraat_review_row(p_entry_id);
END;
$$;

-- Soft delete a reading; the location goes with it when it was the last live reading.
CREATE OR REPLACE FUNCTION qiraat_review_delete_entry(p_entry_id text, p_expected timestamptz,
                                                      p_note text DEFAULT NULL, p_device_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries;
BEGIN
  e := qiraat_review_begin(p_entry_id, p_expected, p_device_id);
  IF e.deleted_at IS NOT NULL THEN RETURN qiraat_review_row(p_entry_id); END IF;
  UPDATE qiraat_entries
     SET deleted_at = now(),
         notes = CASE WHEN nullif(btrim(p_note), '') IS NULL THEN notes ELSE concat_ws(E'\n', notes, '[حذف] ' || btrim(p_note)) END
   WHERE id = p_entry_id;
  IF NOT EXISTS (SELECT 1 FROM qiraat_entries WHERE locus_id = e.locus_id AND deleted_at IS NULL AND verification_status <> 'REJECTED') THEN
    UPDATE qiraat_loci SET deleted_at = now() WHERE id = e.locus_id AND deleted_at IS NULL;
  END IF;
  PERFORM qiraat_review_sync_locus(e.locus_id);
  RETURN qiraat_review_row(p_entry_id);
END;
$$;

CREATE OR REPLACE FUNCTION qiraat_review_restore_entry(p_entry_id text, p_expected timestamptz, p_device_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e qiraat_entries;
BEGIN
  e := qiraat_review_begin(p_entry_id, p_expected, p_device_id);
  UPDATE qiraat_loci SET deleted_at = NULL WHERE id = e.locus_id AND deleted_at IS NOT NULL;
  UPDATE qiraat_entries SET deleted_at = NULL WHERE id = p_entry_id AND deleted_at IS NOT NULL;
  PERFORM qiraat_review_sync_locus(e.locus_id);
  RETURN qiraat_review_row(p_entry_id);
END;
$$;

-- Recent review transactions touching a page's readings (newest first), for the undo list.
-- Only transactions made by a signed-in editor are listed (never the Phase 3 import).
CREATE OR REPLACE FUNCTION qiraat_review_history(p_page integer, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM qiraat_require_editor();
  WITH page_entries AS (
    SELECT e.id, e.locus_id FROM qiraat_entries e
      JOIN qiraat_loci l ON l.id = e.locus_id
      JOIN quran_words sw ON sw.surah = l.surah_number AND sw.ayah = l.start_ayah AND sw.word_position = l.start_word
     WHERE sw.page_number = p_page
  ), rows AS (
    SELECT el.* FROM edit_log el
     WHERE el.actor_id IS NOT NULL AND el.undo_of IS NULL
       AND ((el.table_name IN ('qiraat_entries', 'qiraat_variant_details', 'qiraat_ruling_details') AND el.row_id IN (SELECT id FROM page_entries))
         OR (el.table_name = 'qiraat_loci' AND el.row_id IN (SELECT locus_id FROM page_entries))
         OR (el.table_name IN ('qiraat_entry_authorities', 'qiraat_qa_flags')
             AND coalesce(el.new_value, el.old_value)->>'entry_id' IN (SELECT id FROM page_entries)))
  ), tx AS (
    SELECT txid, min(changed_at) AS at, max(device_id) AS device_id, bool_and(undone_at IS NOT NULL) AS undone,
           -- the reading the transaction was about (location rows carry no entry id)
           min(CASE WHEN table_name IN ('qiraat_entry_authorities', 'qiraat_qa_flags')
                    THEN coalesce(new_value, old_value)->>'entry_id'
                    WHEN table_name IN ('qiraat_entries', 'qiraat_variant_details', 'qiraat_ruling_details')
                    THEN row_id END) AS entry_id,
           jsonb_agg(jsonb_build_object('table', table_name, 'rowId', row_id, 'op', op, 'field', field,
                                        'old', CASE WHEN op = 'UPDATE' THEN old_value END,
                                        'new', CASE WHEN op = 'UPDATE' THEN new_value END) ORDER BY id) AS changes
      FROM rows GROUP BY txid
     ORDER BY min(changed_at) DESC
     LIMIT greatest(1, least(coalesce(p_limit, 20), 100))
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('txid', txid, 'at', at, 'deviceId', device_id, 'undone', undone,
                                               'entryId', entry_id, 'changes', changes) ORDER BY at DESC), '[]'::jsonb)
    INTO v FROM tx;
  RETURN v;
END;
$$;

-- Undo one review transaction. Refuses transactions that were not made by a signed-in editor
-- (e.g. the Phase 3 import) and transactions already undone.
CREATE OR REPLACE FUNCTION qiraat_review_undo(p_txid bigint, p_device_id text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM qiraat_require_editor();
  PERFORM set_config('app.device_id', coalesce(nullif(btrim(p_device_id), ''), 'review-web'), true);
  IF NOT EXISTS (SELECT 1 FROM edit_log WHERE txid = p_txid AND undo_of IS NULL AND undone_at IS NULL) THEN
    RAISE EXCEPTION 'NOT_FOUND transaction %', p_txid USING ERRCODE = 'no_data_found';
  END IF;
  IF EXISTS (SELECT 1 FROM edit_log WHERE txid = p_txid AND undo_of IS NULL AND (actor_id IS NULL OR actor_id NOT IN (SELECT user_id FROM qiraat_editors))) THEN
    RAISE EXCEPTION 'UNDO_REFUSED transaction % was not made by an editor', p_txid USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN edit_log_undo_tx(p_txid);
END;
$$;

-- Review progress per page (for the page picker and "next page to review").
CREATE OR REPLACE FUNCTION qiraat_review_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM qiraat_require_editor();
  SELECT coalesce(jsonb_agg(jsonb_build_object('page', page, 'total', total, 'unreviewed', unreviewed,
                                               'reviewed', reviewed, 'flagged', flagged) ORDER BY page), '[]'::jsonb)
    INTO v
    FROM (SELECT sw.page_number AS page, count(*) AS total,
                 count(*) FILTER (WHERE e.review_status = 'unreviewed') AS unreviewed,
                 count(*) FILTER (WHERE e.review_status = 'reviewed')   AS reviewed,
                 count(*) FILTER (WHERE e.review_status = 'flagged')    AS flagged
            FROM qiraat_entries e
            JOIN qiraat_loci l ON l.id = e.locus_id AND l.deleted_at IS NULL
            JOIN quran_words sw ON sw.surah = l.surah_number AND sw.ayah = l.start_ayah AND sw.word_position = l.start_word
            LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
           WHERE e.deleted_at IS NULL AND e.verification_status <> 'REJECTED'
             AND rd.category_code IS DISTINCT FROM 'AYAH_COUNT'
           GROUP BY sw.page_number) x;
  RETURN v;
END;
$$;

-- Grants: editor RPCs are callable by signed-in users (they check the allowlist themselves);
-- helpers are internal.
REVOKE ALL ON FUNCTION qiraat_is_editor(), qiraat_require_editor(), qiraat_norm(text),
  qiraat_review_begin(text, timestamptz, text), qiraat_review_touch(text), qiraat_review_sync_locus(text),
  qiraat_review_row(text), qiraat_review_is_editor(), qiraat_review_page(integer, boolean),
  qiraat_review_set_status(text, qiraat_review_status, timestamptz, text, text),
  qiraat_review_update_entry(jsonb), qiraat_review_set_narrators(text, jsonb, timestamptz, text),
  qiraat_review_delete_entry(text, timestamptz, text, text), qiraat_review_restore_entry(text, timestamptz, text),
  qiraat_review_history(integer, integer), qiraat_review_undo(bigint, text), qiraat_review_overview()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION qiraat_norm(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION qiraat_review_is_editor(), qiraat_review_page(integer, boolean),
  qiraat_review_set_status(text, qiraat_review_status, timestamptz, text, text),
  qiraat_review_update_entry(jsonb), qiraat_review_set_narrators(text, jsonb, timestamptz, text),
  qiraat_review_delete_entry(text, timestamptz, text, text), qiraat_review_restore_entry(text, timestamptz, text),
  qiraat_review_history(integer, integer), qiraat_review_undo(bigint, text), qiraat_review_overview()
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
