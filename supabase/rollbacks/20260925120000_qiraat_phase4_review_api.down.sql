-- ROLLBACK of 20260925120000_qiraat_phase4_review_api.sql. Idempotent.
-- Restores the annotation editor RPCs to "any signed-in user" (verbatim pre-Phase-4 bodies),
-- drops the review RPCs, qiraat_norm, the flags edit_log trigger and the allowlist.

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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE qiraat_annotations
  SET deleted_at=now(), updated_by=auth.uid()
  WHERE id=p_annotation_id AND deleted_at IS NULL AND version=p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT annotation %', p_annotation_id; END IF;
END $function$

;


ALTER FUNCTION qiraat_check_rules_from_reading()        SECURITY INVOKER RESET search_path;
ALTER FUNCTION qiraat_check_rules_from_entry()          SECURITY INVOKER RESET search_path;
ALTER FUNCTION qiraat_check_rules_from_ruling_detail()  SECURITY INVOKER RESET search_path;
ALTER FUNCTION qiraat_check_rules_from_locus()          SECURITY INVOKER RESET search_path;

DROP FUNCTION IF EXISTS qiraat_review_overview();
DROP FUNCTION IF EXISTS qiraat_review_undo(bigint, text);
DROP FUNCTION IF EXISTS qiraat_review_history(integer, integer);
DROP FUNCTION IF EXISTS qiraat_review_restore_entry(text, timestamptz, text);
DROP FUNCTION IF EXISTS qiraat_review_delete_entry(text, timestamptz, text, text);
DROP FUNCTION IF EXISTS qiraat_review_set_narrators(text, jsonb, timestamptz, text);
DROP FUNCTION IF EXISTS qiraat_review_update_entry(jsonb);
DROP FUNCTION IF EXISTS qiraat_review_set_status(text, qiraat_review_status, timestamptz, text, text);
DROP FUNCTION IF EXISTS qiraat_review_page(integer, boolean);
DROP FUNCTION IF EXISTS qiraat_review_is_editor();
DROP FUNCTION IF EXISTS qiraat_review_row(text);
DROP FUNCTION IF EXISTS qiraat_review_sync_locus(text);
DROP FUNCTION IF EXISTS qiraat_review_touch(text);
DROP FUNCTION IF EXISTS qiraat_review_begin(text, timestamptz, text);
DROP TRIGGER IF EXISTS qiraat_qa_flags_edit_log ON qiraat_qa_flags;
DROP FUNCTION IF EXISTS qiraat_norm(text);
DROP FUNCTION IF EXISTS qiraat_require_editor();
DROP FUNCTION IF EXISTS qiraat_is_editor();
DROP TABLE IF EXISTS qiraat_editors;

NOTIFY pgrst, 'reload schema';
