-- Phase 4 regression.  The final exception deliberately rolls every fixture
-- back, so this test never leaves synthetic Qiraat data in the database.
BEGIN;

DO $$
DECLARE
  w1 uuid; w2 uuid; w3 uuid; tax uuid;
  a_id uuid := gen_random_uuid(); b_id uuid := gen_random_uuid(); c_id uuid := gen_random_uuid(); u_id uuid := gen_random_uuid();
  batch_id uuid := gen_random_uuid(); conflict_batch uuid := gen_random_uuid();
  b_before jsonb; c_before jsonb; b_after jsonb; c_after jsonb;
  b_version_after integer; c_version_after integer; b_version_rollback integer;
  unrelated_cache_id uuid; cache_before bigint; cache_after bigint;
  source_id text;
  actual text;
  conflict_seen boolean := false;
  b_face uuid := gen_random_uuid();
BEGIN
  SELECT id INTO w1 FROM quran_words WHERE canonical_key='002:002:001';
  SELECT id INTO w2 FROM quran_words WHERE canonical_key='002:002:002';
  SELECT id INTO w3 FROM quran_words WHERE canonical_key='002:002:003';
  SELECT id INTO tax FROM qiraat_taxonomies WHERE category_type='USUL' ORDER BY sort_order,id LIMIT 1;
  SELECT id INTO source_id FROM qiraat_source_documents ORDER BY id LIMIT 1;
  IF w1 IS NULL OR w2 IS NULL OR w3 IS NULL OR tax IS NULL OR source_id IS NULL THEN
    RAISE EXCEPTION 'Phase 4 fixture prerequisites are unavailable';
  END IF;

  -- B has every aggregate child shape: a face, a face-linked variant, an
  -- annotation-level variant, and a source association.
  INSERT INTO qiraat_annotations(id,scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,entry_method,applies_to_descendants,status,notes)
  VALUES (b_id,'WORD',w1,w1,tax,'Q01','batch',true,'reviewed','phase4 original B');
  INSERT INTO qiraat_annotation_faces(id,annotation_id,face_type,face_value,label_ar,sort_order)
  VALUES (b_face,b_id,'TEST','1'::jsonb,'وجه الأصل',10);
  INSERT INTO qiraat_annotation_variants(annotation_id,face_id,canonical_word_key,uthmanic_text,render_mode)
  VALUES (b_id,NULL,'002:002:001','variant annotation original','editor_only'),
        (b_id,b_face,'002:002:001','variant face original','editor_only');
  INSERT INTO qiraat_annotation_sources(annotation_id,source_id,reference_text)
  VALUES (b_id,source_id,'source original');

  INSERT INTO qiraat_annotations(id,scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,entry_method,applies_to_descendants,status,notes)
  VALUES (c_id,'WORD',w2,w2,tax,'Q02','batch',true,'verified','phase4 original C');
  INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar)
  VALUES (c_id,'TEST','2'::jsonb,'وجه C');
  INSERT INTO qiraat_annotation_variants(annotation_id,canonical_word_key,uthmanic_text,render_mode)
  VALUES (c_id,'002:002:002','variant C','editor_only');
  INSERT INTO qiraat_annotation_sources(annotation_id,source_id,reference_text)
  VALUES (c_id,source_id,'source C');

  -- Independent Q04 data proves rollback invalidates only relevant cache rows.
  INSERT INTO qiraat_annotations(id,scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,entry_method,status,notes)
  VALUES (u_id,'WORD',w3,w3,tax,'Q04','batch','draft','phase4 unrelated');
  SELECT id,resolved_revision INTO unrelated_cache_id,cache_before
  FROM resolved_qiraat_cache WHERE resolved_annotation_id=u_id LIMIT 1;
  IF unrelated_cache_id IS NULL THEN RAISE EXCEPTION 'unrelated cache fixture missing'; END IF;

  SELECT jsonb_build_object('annotation',to_jsonb(q),'faces',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM qiraat_annotation_faces f WHERE f.annotation_id=q.id),'[]'::jsonb),'variants',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM qiraat_annotation_variants v WHERE v.annotation_id=q.id),'[]'::jsonb),'sources',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.source_id) FROM qiraat_annotation_sources s WHERE s.annotation_id=q.id),'[]'::jsonb)) INTO b_before FROM qiraat_annotations q WHERE q.id=b_id;
  SELECT jsonb_build_object('annotation',to_jsonb(q),'faces',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM qiraat_annotation_faces f WHERE f.annotation_id=q.id),'[]'::jsonb),'variants',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM qiraat_annotation_variants v WHERE v.annotation_id=q.id),'[]'::jsonb),'sources',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.source_id) FROM qiraat_annotation_sources s WHERE s.annotation_id=q.id),'[]'::jsonb)) INTO c_before FROM qiraat_annotations q WHERE q.id=c_id;

  INSERT INTO qiraat_batches(id,batch_key,status,entry_method) VALUES(batch_id,'phase4-regression-main-'||batch_id,'committed','batch');
  -- INSERT A.
  INSERT INTO qiraat_annotations(id,scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,entry_method,status,notes)
  VALUES(a_id,'WORD',w1,w1,tax,'Q03','batch','draft','phase4 inserted A');
  -- UPDATE B including core state and all child collections.
  UPDATE qiraat_annotations SET scope_type='BOUNDARY',end_word_id=w2,status='verified',reading_context='WAQF_ONLY',inheritance_action='OVERRIDE',applies_to_descendants=false,color_override='#123456',notes='phase4 batch B' WHERE id=b_id;
  DELETE FROM qiraat_annotation_variants WHERE annotation_id=b_id;
  DELETE FROM qiraat_annotation_faces WHERE annotation_id=b_id;
  DELETE FROM qiraat_annotation_sources WHERE annotation_id=b_id;
  INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar,sort_order) VALUES(b_id,'TEST','9'::jsonb,'وجه الدفعة',99);
  INSERT INTO qiraat_annotation_variants(annotation_id,canonical_word_key,uthmanic_text,render_mode) VALUES(b_id,'002:002:001','variant batch','editor_only');
  INSERT INTO qiraat_annotation_sources(annotation_id,source_id,reference_text) VALUES(b_id,source_id,'source batch');
  -- DELETE C is deliberately soft, preserving its audit history.
  UPDATE qiraat_annotations SET deleted_at=now(),notes='phase4 batch deleted C' WHERE id=c_id;

  SELECT jsonb_build_object('annotation',to_jsonb(q),'faces',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM qiraat_annotation_faces f WHERE f.annotation_id=q.id),'[]'::jsonb),'variants',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM qiraat_annotation_variants v WHERE v.annotation_id=q.id),'[]'::jsonb),'sources',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.source_id) FROM qiraat_annotation_sources s WHERE s.annotation_id=q.id),'[]'::jsonb)) INTO b_after FROM qiraat_annotations q WHERE q.id=b_id;
  SELECT jsonb_build_object('annotation',to_jsonb(q),'faces',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM qiraat_annotation_faces f WHERE f.annotation_id=q.id),'[]'::jsonb),'variants',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM qiraat_annotation_variants v WHERE v.annotation_id=q.id),'[]'::jsonb),'sources',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.source_id) FROM qiraat_annotation_sources s WHERE s.annotation_id=q.id),'[]'::jsonb)) INTO c_after FROM qiraat_annotations q WHERE q.id=c_id;
  INSERT INTO qiraat_batch_changes(batch_id,operation,record_id,before_json,after_json,sequence_number) VALUES
    (batch_id,'INSERT',a_id,NULL,(SELECT jsonb_build_object('annotation',to_jsonb(q)) FROM qiraat_annotations q WHERE q.id=a_id),1),
    (batch_id,'UPDATE',b_id,b_before,b_after,2),
    (batch_id,'DELETE',c_id,c_before,c_after,3);
  SELECT version INTO b_version_after FROM qiraat_annotations WHERE id=b_id;
  SELECT version INTO c_version_after FROM qiraat_annotations WHERE id=c_id;

  PERFORM rollback_qiraat_batch(batch_id);

  -- INSERT is soft-deleted and remains revision-auditable.
  IF NOT EXISTS(SELECT 1 FROM qiraat_annotations WHERE id=a_id AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'INSERT rollback was not soft deleted'; END IF;
  IF EXISTS(SELECT 1 FROM resolved_qiraat_cache WHERE resolved_annotation_id=a_id) THEN RAISE EXCEPTION 'INSERT rollback cache remains'; END IF;
  IF (SELECT count(*) FROM qiraat_annotation_revisions WHERE annotation_id=a_id) < 2 THEN RAISE EXCEPTION 'INSERT rollback revision missing'; END IF;

  -- B core and every owned child collection restore with a new, monotonic version.
  IF (SELECT version FROM qiraat_annotations WHERE id=b_id) <= b_version_after THEN RAISE EXCEPTION 'UPDATE rollback version did not increase'; END IF;
  SELECT version INTO b_version_rollback FROM qiraat_annotations WHERE id=b_id;
  IF NOT EXISTS(
    SELECT 1 FROM qiraat_annotations WHERE id=b_id
      AND scope_type='WORD' AND start_word_id=w1 AND end_word_id=w1
      AND status='reviewed' AND reading_context='BOTH'
      AND inheritance_action='INHERIT' AND applies_to_descendants
      AND color_override IS NULL AND notes='phase4 original B'
  ) THEN RAISE EXCEPTION 'UPDATE rollback core not restored'; END IF;
  IF (SELECT count(*) FROM qiraat_annotation_faces WHERE annotation_id=b_id) <> 1 OR (SELECT label_ar FROM qiraat_annotation_faces WHERE annotation_id=b_id) <> 'وجه الأصل' THEN RAISE EXCEPTION 'faces not restored'; END IF;
  IF (SELECT count(*) FROM qiraat_annotation_variants WHERE annotation_id=b_id) <> 2 OR NOT EXISTS(SELECT 1 FROM qiraat_annotation_variants WHERE annotation_id=b_id AND face_id IS NULL AND uthmanic_text='variant annotation original') OR NOT EXISTS(SELECT 1 FROM qiraat_annotation_variants WHERE annotation_id=b_id AND face_id IS NOT NULL AND uthmanic_text='variant face original') THEN RAISE EXCEPTION 'variants not restored'; END IF;
  IF (SELECT reference_text FROM qiraat_annotation_sources WHERE annotation_id=b_id) <> 'source original' THEN RAISE EXCEPTION 'sources not restored'; END IF;
  IF (SELECT count(*) FROM qiraat_annotation_revisions WHERE annotation_id=b_id) < 3 THEN RAISE EXCEPTION 'UPDATE rollback revision missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM resolved_qiraat_cache WHERE resolved_annotation_id=b_id) THEN RAISE EXCEPTION 'UPDATE rollback cache missing'; END IF;

  -- DELETE C restores aggregate, visibility, and a newer version.
  IF NOT EXISTS(SELECT 1 FROM qiraat_annotations WHERE id=c_id AND deleted_at IS NULL AND scope_type='WORD' AND start_word_id=w2 AND end_word_id=w2 AND status='verified' AND reading_context='BOTH' AND inheritance_action='INHERIT' AND applies_to_descendants AND notes='phase4 original C') OR (SELECT version FROM qiraat_annotations WHERE id=c_id) <= c_version_after THEN RAISE EXCEPTION 'DELETE rollback not restored monotonically'; END IF;
  IF (SELECT count(*) FROM qiraat_annotation_faces WHERE annotation_id=c_id) <> 1 OR (SELECT count(*) FROM qiraat_annotation_variants WHERE annotation_id=c_id) <> 1 OR (SELECT count(*) FROM qiraat_annotation_sources WHERE annotation_id=c_id) <> 1 THEN RAISE EXCEPTION 'DELETE aggregate children not restored'; END IF;
  IF (SELECT count(*) FROM qiraat_annotation_revisions WHERE annotation_id=c_id) < 3 OR NOT EXISTS(SELECT 1 FROM resolved_qiraat_cache WHERE resolved_annotation_id=c_id) THEN RAISE EXCEPTION 'DELETE rollback audit/cache missing'; END IF;

  -- A second rollback is a no-op.
  PERFORM rollback_qiraat_batch(batch_id);
  IF (SELECT version FROM qiraat_annotations WHERE id=b_id) <> b_version_rollback OR (SELECT status FROM qiraat_batches WHERE id=batch_id) <> 'rolled_back' THEN RAISE EXCEPTION 'double rollback mutated state'; END IF;
  SELECT resolved_revision INTO cache_after FROM resolved_qiraat_cache WHERE id=unrelated_cache_id;
  IF cache_after <> cache_before THEN RAISE EXCEPTION 'rollback rebuilt unrelated cache row'; END IF;

  -- A post-batch edit produces a conflict and the complete rollback is atomic.
  INSERT INTO qiraat_batches(id,batch_key,status,entry_method) VALUES(conflict_batch,'phase4-regression-conflict-'||conflict_batch,'committed','batch');
  UPDATE qiraat_annotations SET notes='phase4 conflict batch B' WHERE id=b_id;
  UPDATE qiraat_annotations SET notes='phase4 conflict batch C' WHERE id=c_id;
  INSERT INTO qiraat_batch_changes(batch_id,operation,record_id,before_json,after_json,sequence_number)
  VALUES(conflict_batch,'UPDATE',b_id,b_before,(SELECT jsonb_build_object('annotation',to_jsonb(q),'faces','[]'::jsonb,'variants','[]'::jsonb,'sources','[]'::jsonb) FROM qiraat_annotations q WHERE q.id=b_id),1);
  INSERT INTO qiraat_batch_changes(batch_id,operation,record_id,before_json,after_json,sequence_number)
  VALUES(conflict_batch,'UPDATE',c_id,c_before,(SELECT jsonb_build_object('annotation',to_jsonb(q),'faces','[]'::jsonb,'variants','[]'::jsonb,'sources','[]'::jsonb) FROM qiraat_annotations q WHERE q.id=c_id),2);
  UPDATE qiraat_annotations SET notes='phase4 later manual edit' WHERE id=b_id;
  BEGIN
    PERFORM rollback_qiraat_batch(conflict_batch);
  EXCEPTION WHEN OTHERS THEN
    IF position('ROLLBACK_CONFLICT' IN SQLERRM)>0 THEN conflict_seen:=true; ELSE RAISE; END IF;
  END;
  IF NOT conflict_seen OR (SELECT notes FROM qiraat_annotations WHERE id=b_id) <> 'phase4 later manual edit' OR (SELECT notes FROM qiraat_annotations WHERE id=c_id) <> 'phase4 conflict batch C' OR (SELECT status FROM qiraat_batches WHERE id=conflict_batch) <> 'committed' THEN RAISE EXCEPTION 'post-batch conflict was not atomic'; END IF;

  -- There is intentionally no active-only logical uniqueness constraint today:
  -- a soft-deleted historical record does not block an equivalent active record.
  INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,taxonomy_id,target_authority_id,entry_method,status,notes)
  VALUES('WORD',w1,w1,tax,'Q03','batch','draft','phase4 replacement after soft delete');
  IF NOT EXISTS(SELECT 1 FROM qiraat_annotations WHERE target_authority_id='Q03' AND notes='phase4 replacement after soft delete' AND deleted_at IS NULL) THEN RAISE EXCEPTION 'soft-delete replacement blocked'; END IF;

  RAISE EXCEPTION 'phase4 batch rollback test complete: intentional rollback';
END $$;
COMMIT;
