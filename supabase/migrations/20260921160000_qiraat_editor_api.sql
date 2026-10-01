-- Phase 5: authenticated editor RPCs.  All writes remain server-validated and
-- flow through the annotation/revision/cache triggers; no client table insert is granted.
CREATE OR REPLACE FUNCTION qiraat_editor_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'entities', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'parentId',parent_id,'type',authority_type,'nameAr',name_ar,'color',color_hex) ORDER BY sort_order,id) FROM qiraat_authorities WHERE active), '[]'::jsonb),
    'taxonomies', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'parentId',parent_id,'category',category_type,'nameAr',name_ar) ORDER BY sort_order,id) FROM qiraat_taxonomies WHERE active), '[]'::jsonb),
    'corpora', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'nameAr',name_ar) ORDER BY code) FROM qiraat_corpora WHERE active), '[]'::jsonb),
    'frameworks', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'corpusId',corpus_id,'code',code,'nameAr',name_ar) ORDER BY code) FROM qiraat_frameworks WHERE active), '[]'::jsonb),
    'sources', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'titleAr',name_ar) ORDER BY id) FROM qiraat_source_documents), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION qiraat_editor_annotations(p_canonical_key text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'scopeType',q.scope_type,'startCanonicalKey',q.start_canonical_key,'endCanonicalKey',q.end_canonical_key,
    'readingContext',q.reading_context,'taxonomyId',q.taxonomy_id,'targetAuthorityId',q.target_authority_id,'corpusId',q.corpus_id,'frameworkId',q.framework_id,
    'inheritanceAction',q.inheritance_action,'appliesToDescendants',q.applies_to_descendants,'status',q.status,
    'colorOverride',q.color_override,'notes',q.notes,'version',q.version,
    'faces',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'faceType',f.face_type,'faceValue',f.face_value,'labelAr',f.label_ar,'preferenceStatus',f.preference_status,'sortOrder',f.sort_order) ORDER BY f.sort_order,f.id) FROM qiraat_annotation_faces f WHERE f.annotation_id=q.id),'[]'::jsonb),
    'variants',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'faceId',v.face_id,'uthmanicText',v.uthmanic_text,'normalizedText',v.normalized_text,'phoneticNote',v.phonetic_note,'renderMode',v.render_mode) ORDER BY v.id) FROM qiraat_annotation_variants v WHERE v.annotation_id=q.id),'[]'::jsonb),
    'sources',coalesce((SELECT jsonb_agg(jsonb_build_object('sourceId',s.source_id,'referenceText',s.reference_text,'notes',s.notes) ORDER BY s.source_id) FROM qiraat_annotation_sources s WHERE s.annotation_id=q.id),'[]'::jsonb)
  ) ORDER BY q.updated_at DESC), '[]'::jsonb)
  FROM qiraat_annotations q
  WHERE q.deleted_at IS NULL AND p_canonical_key IN(q.start_canonical_key,q.end_canonical_key);
$$;

CREATE OR REPLACE FUNCTION qiraat_editor_create_annotation(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;

CREATE OR REPLACE FUNCTION qiraat_editor_soft_delete_annotation(p_annotation_id uuid, p_expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE qiraat_annotations
  SET deleted_at=now(), updated_by=auth.uid()
  WHERE id=p_annotation_id AND deleted_at IS NULL AND version=p_expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT annotation %', p_annotation_id; END IF;
END $$;

CREATE OR REPLACE FUNCTION qiraat_editor_update_annotation(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;

REVOKE ALL ON FUNCTION qiraat_editor_catalog(),qiraat_editor_annotations(text),qiraat_editor_create_annotation(jsonb),qiraat_editor_soft_delete_annotation(uuid,integer),qiraat_editor_update_annotation(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qiraat_editor_catalog(),qiraat_editor_annotations(text),qiraat_editor_create_annotation(jsonb),qiraat_editor_soft_delete_annotation(uuid,integer),qiraat_editor_update_annotation(jsonb) TO authenticated,service_role;
