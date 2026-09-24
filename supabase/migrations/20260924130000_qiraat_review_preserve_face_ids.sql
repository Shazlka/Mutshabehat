-- Compatible editor update path: retain IDs of faces that the reviewer edits.
-- Existing qiraat_editor_update_annotation remains available to older clients.
CREATE OR REPLACE FUNCTION qiraat_editor_update_annotation_v2(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target_annotation_id uuid := (p->>'id')::uuid; expected_version integer := (p->>'expectedVersion')::integer;
  start_word quran_words; end_word quran_words; face jsonb; variant jsonb; source jsonb;
  face_ids uuid[]:=ARRAY[]::uuid[]; face_id uuid; proposed_id uuid; idx integer; source_id text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF target_annotation_id IS NULL OR expected_version IS NULL THEN RAISE EXCEPTION 'id and expected version are required'; END IF;
  SELECT * INTO start_word FROM quran_words WHERE canonical_key=p->>'startCanonicalKey';
  SELECT * INTO end_word FROM quran_words WHERE canonical_key=coalesce(p->>'endCanonicalKey',p->>'startCanonicalKey');
  IF start_word.id IS NULL OR end_word.id IS NULL THEN RAISE EXCEPTION 'invalid canonical key'; END IF;
  IF NOT EXISTS(SELECT 1 FROM qiraat_authorities WHERE id=p->>'targetAuthorityId' AND active) THEN RAISE EXCEPTION 'invalid target entity'; END IF;
  IF NOT EXISTS(SELECT 1 FROM qiraat_taxonomies WHERE id=(p->>'taxonomyId')::uuid AND active) THEN RAISE EXCEPTION 'missing taxonomy'; END IF;
  UPDATE qiraat_annotations SET scope_type=coalesce(p->>'scopeType','WORD'),start_word_id=start_word.id,end_word_id=end_word.id,
    taxonomy_id=(p->>'taxonomyId')::uuid,target_authority_id=p->>'targetAuthorityId',corpus_id=nullif(p->>'corpusId','')::uuid,
    framework_id=nullif(p->>'frameworkId','')::uuid,reading_context=coalesce(p->>'readingContext','BOTH'),
    inheritance_action=coalesce(p->>'inheritanceAction','INHERIT'),applies_to_descendants=coalesce((p->>'appliesToDescendants')::boolean,false),
    status=coalesce(p->>'status','draft'),color_override=nullif(p->>'colorOverride',''),notes=nullif(p->>'notes',''),updated_by=auth.uid()
  WHERE id=target_annotation_id AND deleted_at IS NULL AND version=expected_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT annotation %',target_annotation_id; END IF;
  -- Variants reference faces. Remove them first, then edit retained faces in place.
  DELETE FROM qiraat_annotation_variants WHERE annotation_id=target_annotation_id;
  FOR face IN SELECT value FROM jsonb_array_elements(coalesce(p->'faces','[]'::jsonb)) LOOP
    proposed_id:=nullif(face->>'id','')::uuid;
    IF proposed_id IS NOT NULL THEN
      UPDATE qiraat_annotation_faces SET face_type=coalesce(face->>'faceType','CUSTOM'),face_value=coalesce(face->'faceValue','null'::jsonb),
        label_ar=coalesce(face->>'labelAr','وجه'),preference_status=nullif(face->>'preferenceStatus',''),
        sort_order=coalesce((face->>'sortOrder')::smallint,100),updated_at=now()
      WHERE id=proposed_id AND annotation_id=target_annotation_id RETURNING id INTO face_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'invalid face identity'; END IF;
    ELSE
      INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar,preference_status,sort_order)
      VALUES(target_annotation_id,coalesce(face->>'faceType','CUSTOM'),coalesce(face->'faceValue','null'::jsonb),
        coalesce(face->>'labelAr','وجه'),nullif(face->>'preferenceStatus',''),coalesce((face->>'sortOrder')::smallint,100))
      RETURNING id INTO face_id;
    END IF;
    IF face_id=ANY(face_ids) THEN RAISE EXCEPTION 'duplicate face identity'; END IF;
    face_ids:=array_append(face_ids,face_id);
  END LOOP;
  DELETE FROM qiraat_annotation_faces WHERE annotation_id=target_annotation_id AND NOT (id=ANY(face_ids));
  FOR variant IN SELECT value FROM jsonb_array_elements(coalesce(p->'variants','[]'::jsonb)) LOOP
    idx:=nullif(variant->>'faceIndex','')::integer;
    INSERT INTO qiraat_annotation_variants(annotation_id,face_id,canonical_word_key,uthmanic_text,normalized_text,phonetic_note,render_mode,glyph_reference)
    VALUES(target_annotation_id,CASE WHEN idx IS NULL THEN NULL WHEN idx>=0 AND idx<array_length(face_ids,1) THEN face_ids[idx+1] ELSE NULL END,
      start_word.canonical_key,nullif(variant->>'uthmanicText',''),nullif(variant->>'normalizedText',''),
      nullif(variant->>'phoneticNote',''),coalesce(variant->>'renderMode','editor_only'),nullif(variant->>'glyphReference',''));
  END LOOP;
  DELETE FROM qiraat_annotation_sources s WHERE s.annotation_id=target_annotation_id
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(p->'sources','[]'::jsonb)) e WHERE e.value->>'sourceId'=s.source_id);
  FOR source IN SELECT value FROM jsonb_array_elements(coalesce(p->'sources','[]'::jsonb)) LOOP
    source_id:=source->>'sourceId';
    IF NOT EXISTS(SELECT 1 FROM qiraat_source_documents WHERE id=source_id) THEN RAISE EXCEPTION 'invalid source reference'; END IF;
    INSERT INTO qiraat_annotation_sources(annotation_id,source_id,reference_text,notes)
    VALUES(target_annotation_id,source_id,nullif(source->>'referenceText',''),nullif(source->>'notes',''))
    ON CONFLICT(annotation_id,source_id) DO NOTHING;
  END LOOP;
  RETURN qiraat_editor_annotations(start_word.canonical_key);
END $$;
REVOKE ALL ON FUNCTION qiraat_editor_update_annotation_v2(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qiraat_editor_update_annotation_v2(jsonb) TO authenticated,service_role;

-- Idempotent create for routine saves and same-word draft duplication. It uses the
-- same validation/write RPC after taking a semantic lock and checking full faces.
CREATE OR REPLACE FUNCTION qiraat_editor_create_annotation_v2(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing_id uuid; face_signature jsonb; variant_signature jsonb; key text:=p->>'startCanonicalKey';
  source_id uuid:=nullif(p->>'sourceAnnotationId','')::uuid; source_row qiraat_annotations;
  source_word quran_words; target_word quran_words; created_rows jsonb; created_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF source_id IS NOT NULL THEN
    SELECT * INTO source_row FROM qiraat_annotations WHERE id=source_id AND deleted_at IS NULL AND status='verified' AND scope_type='WORD';
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid verified source'; END IF;
    SELECT * INTO source_word FROM quran_words WHERE id=source_row.start_word_id;
    SELECT * INTO target_word FROM quran_words WHERE canonical_key=key;
    IF target_word.id IS NULL OR normalize_arabic(source_word.text_uthmani)<>normalize_arabic(target_word.text_uthmani)
      OR qiraat_editor_lexical_key(source_word.text_uthmani)<>qiraat_editor_lexical_key(target_word.text_uthmani)
      OR source_row.target_authority_id<>(p->>'targetAuthorityId') OR source_row.taxonomy_id<>(p->>'taxonomyId')::uuid
      OR source_row.reading_context<>coalesce(p->>'readingContext','BOTH') THEN RAISE EXCEPTION 'invalid verified source'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(p->'faces','[]'::jsonb)) requested
      WHERE NOT EXISTS(SELECT 1 FROM qiraat_annotation_faces f WHERE f.annotation_id=source_id
        AND f.face_type=(requested.value->>'faceType') AND f.face_value=(requested.value->'faceValue')
        AND f.label_ar=(requested.value->>'labelAr'))) THEN RAISE EXCEPTION 'invalid source face'; END IF;
    p:=jsonb_set(p,'{status}','"draft"'::jsonb);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(coalesce(key,'') || coalesce(p->>'targetAuthorityId','') || coalesce(p->>'taxonomyId','')));
  SELECT coalesce(jsonb_agg(jsonb_build_object('type',e.value->>'faceType','value',coalesce(e.value->'faceValue','null'::jsonb),
    'label',e.value->>'labelAr','preference',nullif(e.value->>'preferenceStatus',''))
    ORDER BY coalesce((e.value->>'sortOrder')::int,100),e.ordinality),'[]'::jsonb)
    INTO face_signature FROM jsonb_array_elements(coalesce(p->'faces','[]'::jsonb)) WITH ORDINALITY e;
  SELECT coalesce(jsonb_agg(jsonb_build_object('text',nullif(e.value->>'uthmanicText',''),
    'normalized',nullif(e.value->>'normalizedText',''),'phonetic',nullif(e.value->>'phoneticNote',''),
    'mode',coalesce(e.value->>'renderMode','editor_only'),'glyph',nullif(e.value->>'glyphReference',''),
    'face',CASE WHEN e.value->>'faceIndex' IS NULL THEN NULL ELSE (p->'faces'->((e.value->>'faceIndex')::int)->>'sortOrder')::int END)
    ORDER BY (e.value->>'faceIndex') NULLS FIRST,e.value->>'uthmanicText',e.value->>'normalizedText',e.value->>'phoneticNote'),'[]'::jsonb)
    INTO variant_signature FROM jsonb_array_elements(coalesce(p->'variants','[]'::jsonb)) e;
  SELECT a.id INTO existing_id FROM qiraat_annotations a
  WHERE a.deleted_at IS NULL AND a.scope_type=coalesce(p->>'scopeType','WORD')
    AND a.start_canonical_key=key AND a.end_canonical_key=coalesce(p->>'endCanonicalKey',key)
    AND a.target_authority_id=p->>'targetAuthorityId' AND a.taxonomy_id=(p->>'taxonomyId')::uuid
    AND a.reading_context=coalesce(p->>'readingContext','BOTH')
    AND a.inheritance_action=coalesce(p->>'inheritanceAction','INHERIT')
    AND a.applies_to_descendants=coalesce((p->>'appliesToDescendants')::boolean,false)
    AND a.corpus_id IS NOT DISTINCT FROM nullif(p->>'corpusId','')::uuid
    AND a.framework_id IS NOT DISTINCT FROM nullif(p->>'frameworkId','')::uuid
    AND qiraat_editor_face_signature(a.id)=face_signature
    AND qiraat_editor_variant_signature(a.id)=variant_signature LIMIT 1;
  IF existing_id IS NOT NULL THEN RETURN jsonb_build_object('annotations',qiraat_editor_annotations(key),'result','existing'); END IF;
  created_rows:=qiraat_editor_create_annotation(p);
  IF source_id IS NULL THEN RETURN jsonb_build_object('annotations',created_rows,'result','created'); END IF;
  created_id:=(created_rows->0->>'id')::uuid;
  IF created_id IS NULL THEN RAISE EXCEPTION 'source copy did not create an annotation'; END IF;
  UPDATE qiraat_annotations SET source_annotation_id=source_id,entry_method='batch',updated_by=auth.uid() WHERE id=created_id;
  RETURN jsonb_build_object('annotations',qiraat_editor_annotations(key),'result','created');
END $$;
REVOKE ALL ON FUNCTION qiraat_editor_create_annotation_v2(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qiraat_editor_create_annotation_v2(jsonb) TO authenticated,service_role;
