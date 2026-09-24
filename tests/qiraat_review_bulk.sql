-- Transactional integration checks against the real schema. All fixtures roll back.
BEGIN;
DO $$
DECLARE ids uuid[] := ARRAY[]::uuid[]; n integer; i integer; a uuid; sample qiraat_annotations; word_id uuid;
BEGIN
  SELECT * INTO sample FROM qiraat_annotations WHERE created_by IS NOT NULL LIMIT 1;
  IF sample.id IS NULL THEN RAISE EXCEPTION 'A real authenticated editor user is required'; END IF;
  PERFORM set_config('request.jwt.claim.sub',sample.created_by::text,true);
  FOR i IN 1..4 LOOP
    SELECT id INTO word_id FROM quran_words WHERE canonical_key=(ARRAY['002:011:007','002:022:004','002:027:017','002:029:007'])[i];
    INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,created_by,updated_by)
    VALUES('WORD',word_id,word_id,sample.taxonomy_id,sample.target_authority_id,sample.created_by,sample.created_by)
    RETURNING id INTO a;
    ids:=array_append(ids,a);
  END LOOP;
  SELECT qiraat_editor_bulk_delete(jsonb_build_array(
    jsonb_build_object('id',ids[1],'expectedVersion',1),jsonb_build_object('id',ids[2],'expectedVersion',1),
    jsonb_build_object('id',ids[3],'expectedVersion',1))) INTO n;
  IF n<>3 OR (SELECT count(*) FROM qiraat_annotations WHERE id=ANY(ids) AND deleted_at IS NOT NULL)<>3
    OR (SELECT count(*) FROM qiraat_annotations WHERE id=ids[4] AND deleted_at IS NULL)<>1 THEN
    RAISE EXCEPTION 'multi-delete did not preserve the unselected annotation';
  END IF;
  BEGIN
    PERFORM qiraat_editor_bulk_delete(jsonb_build_array(jsonb_build_object('id',ids[4],'expectedVersion',99)));
    RAISE EXCEPTION 'expected OCC conflict';
  EXCEPTION WHEN others THEN
    IF SQLERRM='expected OCC conflict' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE 'VERSION_CONFLICT%' THEN RAISE; END IF;
  END;
  IF (SELECT deleted_at IS NOT NULL FROM qiraat_annotations WHERE id=ids[4]) THEN RAISE EXCEPTION 'OCC conflict deleted a record'; END IF;
  RAISE NOTICE 'multi-delete and OCC: passed';
END $$;

DO $$
DECLARE sample qiraat_annotations; source_id uuid; target_id uuid; duplicate_id uuid; conflict_id uuid; target_face_id uuid;
  word_id uuid; result jsonb; before_text text; after_text text; count_before integer; update_payload jsonb;
BEGIN
  SELECT * INTO sample FROM qiraat_annotations WHERE created_by IS NOT NULL LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',sample.created_by::text,true);
  SELECT id INTO word_id FROM quran_words WHERE canonical_key='002:011:007';
  INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,
    reading_context,status,created_by,updated_by)
  VALUES('WORD',word_id,word_id,sample.taxonomy_id,sample.target_authority_id,'WAQF_ONLY','verified',sample.created_by,sample.created_by)
  RETURNING id INTO source_id;
  INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar)
  VALUES(source_id,'HAMZAH','{"first":"تسهيل"}'::jsonb,'تسهيل الهمزة');
  SELECT count(*) INTO count_before FROM qiraat_annotations;
  PERFORM qiraat_editor_create_annotation_v2(jsonb_build_object('startCanonicalKey','002:011:007',
    'endCanonicalKey','002:011:007','scopeType','WORD','targetAuthorityId',sample.target_authority_id,
    'taxonomyId',sample.taxonomy_id,'readingContext','WAQF_ONLY','status','draft','faces',jsonb_build_array(
      jsonb_build_object('faceType','HAMZAH','faceValue',jsonb_build_object('first','تسهيل'),
        'labelAr','تسهيل الهمزة','sortOrder',100))));
  IF (SELECT count(*) FROM qiraat_annotations)<>count_before THEN RAISE EXCEPTION 'routine create duplicated an equivalent face'; END IF;
  IF jsonb_array_length(qiraat_editor_verified_matches('002:022:004'))<1 THEN RAISE EXCEPTION 'verified lookup missed source'; END IF;
  SELECT id INTO word_id FROM quran_words WHERE canonical_key='002:029:007';
  INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,
    reading_context,status,created_by,updated_by)
  VALUES('WORD',word_id,word_id,sample.taxonomy_id,sample.target_authority_id,'WAQF_ONLY','verified',sample.created_by,sample.created_by)
  RETURNING id INTO duplicate_id;
  INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar)
  VALUES(duplicate_id,'HAMZAH','{"first":"تسهيل"}'::jsonb,'تسهيل الهمزة');
  SELECT id INTO word_id FROM quran_words WHERE canonical_key='002:030:008';
  INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,
    reading_context,status,created_by,updated_by)
  VALUES('WORD',word_id,word_id,sample.taxonomy_id,sample.target_authority_id,'WAQF_ONLY','verified',sample.created_by,sample.created_by)
  RETURNING id INTO conflict_id;
  INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar)
  VALUES(conflict_id,'HAMZAH','{"first":"إبدال"}'::jsonb,'إبدال الهمزة');
  SELECT text_uthmani INTO before_text FROM quran_words WHERE canonical_key='002:022:004';
  SELECT count(*) INTO count_before FROM qiraat_annotations;
  SELECT qiraat_editor_apply_occurrences(source_id,ARRAY['002:022:004','002:029:007','002:030:008']) INTO result;
  IF result->>'added'<>'1' OR result->>'existing'<>'1' OR result->>'conflicts'<>'1' THEN
    RAISE EXCEPTION 'unexpected bulk result %',result;
  END IF;
  SELECT text_uthmani INTO after_text FROM quran_words WHERE canonical_key='002:022:004';
  IF before_text<>after_text THEN RAISE EXCEPTION 'Quran text changed'; END IF;
  IF (SELECT count(*) FROM qiraat_annotations)<>count_before+1 THEN RAISE EXCEPTION 'bulk inserted duplicate rows'; END IF;
  SELECT id INTO target_id FROM qiraat_annotations WHERE source_annotation_id=source_id;
  IF target_id IS NULL OR target_id=source_id OR (SELECT reading_context FROM qiraat_annotations WHERE id=target_id)<>'WAQF_ONLY'
    OR (SELECT face_value->>'first' FROM qiraat_annotation_faces WHERE annotation_id=target_id)<>'تسهيل' THEN
    RAISE EXCEPTION 'copy identity or structured face failed';
  END IF;
  UPDATE qiraat_annotation_faces SET label_ar='تعديل مستقل' WHERE annotation_id=target_id;
  IF (SELECT label_ar FROM qiraat_annotation_faces WHERE annotation_id=source_id)<>'تسهيل الهمزة' THEN
    RAISE EXCEPTION 'source changed with copied face';
  END IF;
  SELECT id INTO target_face_id FROM qiraat_annotation_faces WHERE annotation_id=target_id;
  update_payload:=jsonb_build_object('id',target_id,'expectedVersion',1,'scopeType','WORD',
    'startCanonicalKey','002:022:004','endCanonicalKey','002:022:004','targetAuthorityId',sample.target_authority_id,
    'taxonomyId',sample.taxonomy_id,'readingContext','BOTH','status','draft','faces',jsonb_build_array(
      jsonb_build_object('id',target_face_id,'faceType','HAMZAH','faceValue',
        jsonb_build_object('first','تحقيق','second','تسهيل','insertion',false),
        'labelAr','تحقيق الأولى + تسهيل الثانية','sortOrder',0)),'variants','[]'::jsonb,'sources','[]'::jsonb);
  PERFORM qiraat_editor_update_annotation_v2(update_payload);
  IF (SELECT version FROM qiraat_annotations WHERE id=target_id)<>2
    OR (SELECT reading_context FROM qiraat_annotations WHERE id=target_id)<>'BOTH'
    OR (SELECT count(*) FROM qiraat_annotation_faces WHERE annotation_id=target_id AND id=target_face_id)<>1
    OR (SELECT face_value->>'second' FROM qiraat_annotation_faces WHERE id=target_face_id)<>'تسهيل' THEN
    RAISE EXCEPTION 'inline edit lost identity or two-Hamzah combination';
  END IF;
  update_payload:=jsonb_set(jsonb_set(update_payload,'{expectedVersion}','2'::jsonb),'{readingContext}','"WASL_ONLY"'::jsonb);
  update_payload:=jsonb_set(update_payload,'{faces,0,faceValue}',jsonb_build_object('first','إبدال'));
  PERFORM qiraat_editor_update_annotation_v2(update_payload);
  IF (SELECT reading_context FROM qiraat_annotations WHERE id=target_id)<>'WASL_ONLY'
    OR (SELECT face_value->>'first' FROM qiraat_annotation_faces WHERE id=target_face_id)<>'إبدال' THEN
    RAISE EXCEPTION 'Wasl or Ibdal roundtrip failed';
  END IF;
  update_payload:=jsonb_build_object('startCanonicalKey','002:036:015','endCanonicalKey','002:036:015',
    'scopeType','WORD','targetAuthorityId',sample.target_authority_id,'taxonomyId',sample.taxonomy_id,
    'readingContext','WAQF_ONLY','status','verified','sourceAnnotationId',source_id,
    'faces',jsonb_build_array(jsonb_build_object('faceType','HAMZAH','faceValue',jsonb_build_object('first','تسهيل'),
      'labelAr','تسهيل الهمزة','sortOrder',0)));
  result:=qiraat_editor_create_annotation_v2(update_payload);
  IF result->>'result'<>'created' OR NOT EXISTS(SELECT 1 FROM qiraat_annotations
    WHERE start_canonical_key='002:036:015' AND source_annotation_id=source_id AND status='draft' AND entry_method='batch') THEN
    RAISE EXCEPTION 'selected verified source copy failed';
  END IF;
  result:=qiraat_editor_create_annotation_v2(update_payload);
  IF result->>'result'<>'existing' THEN RAISE EXCEPTION 'repeat source copy was not idempotent'; END IF;
  INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar,sort_order)
  VALUES(source_id,'HAMZAH','{"first":"إبدال"}'::jsonb,'إبدال الهمزة',1);
  update_payload:=jsonb_set(jsonb_set(update_payload,'{startCanonicalKey}','"002:060:027"'::jsonb),
    '{endCanonicalKey}','"002:060:027"'::jsonb);
  result:=qiraat_editor_create_annotation_v2(update_payload);
  IF result->>'result'<>'created' OR (SELECT count(*) FROM qiraat_annotation_faces f
    JOIN qiraat_annotations a ON a.id=f.annotation_id WHERE a.start_canonical_key='002:060:027'
      AND a.source_annotation_id=source_id)<>1 THEN
    RAISE EXCEPTION 'selected face copy copied extra faces';
  END IF;
  update_payload:=jsonb_set(jsonb_set(update_payload,'{startCanonicalKey}','"002:030:008"'::jsonb),
    '{endCanonicalKey}','"002:030:008"'::jsonb);
  BEGIN
    PERFORM qiraat_editor_create_annotation_v2(update_payload);
    RAISE EXCEPTION 'expected verified copy conflict';
  EXCEPTION WHEN others THEN
    IF SQLERRM='expected verified copy conflict' THEN RAISE; END IF;
    IF SQLERRM<>'COPY_CONFLICT' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'verified lookup, copy isolation, dedup, conflict, Waqf and Quran text: passed';
END $$;
ROLLBACK;
