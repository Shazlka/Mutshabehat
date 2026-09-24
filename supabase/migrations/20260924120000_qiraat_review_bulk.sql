-- Review editor operations. Additive; apply after a fresh pg_dump -Fc backup.
-- Rollback: drop the functions/index/column introduced here (existing data is untouched).

ALTER TABLE qiraat_annotations ADD COLUMN IF NOT EXISTS source_annotation_id uuid REFERENCES qiraat_annotations(id) ON DELETE SET NULL;

-- Keep the existing Usul taxonomy. These are chapters beneath its Hamzah node,
-- not a second classification model. Existing assignments remain where they are.
INSERT INTO qiraat_taxonomies(parent_id,category_type,code,name_ar,sort_order,metadata)
SELECT id,'USUL','USUL_HAMZ_CHANGE','تغيير الهمز',10,'{}'::jsonb FROM qiraat_taxonomies WHERE code='USUL_HAMZ'
ON CONFLICT (code) DO NOTHING;
INSERT INTO qiraat_taxonomies(parent_id,category_type,code,name_ar,sort_order,metadata)
SELECT id,'USUL','USUL_HAMZ_TWO_ONE_WORD','الهمزتان من كلمة',20,'{}'::jsonb FROM qiraat_taxonomies WHERE code='USUL_HAMZ'
ON CONFLICT (code) DO NOTHING;
INSERT INTO qiraat_taxonomies(parent_id,category_type,code,name_ar,sort_order,metadata)
SELECT id,'USUL','USUL_HAMZ_TWO_WORDS','الهمزتان من كلمتين',30,'{}'::jsonb FROM qiraat_taxonomies WHERE code='USUL_HAMZ'
ON CONFLICT (code) DO NOTHING;

-- Preserve lexical distinctions after the existing Arabic normalization: remove Quranic
-- vowel/stop marks but keep hamza seats and actual consonants. This is deliberately
-- conservative; the reviewer can still inspect every eligible occurrence.
CREATE OR REPLACE FUNCTION qiraat_editor_lexical_key(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT regexp_replace(
    translate(regexp_replace(replace(replace(replace(replace(coalesce(p_text,''), 'ىٰ', 'ا'), 'ٰ', 'ا'), 'ۥ', 'و'), 'ۦ', 'ي'), '[ً-ٟۖ-ۭؐ-ؚـ۞۩۝۠-ۤۨ-ۯ]', '', 'g'), 'ٱۧ', 'اي'),
    '[^ء-ي]', '', 'g');
$$;
CREATE INDEX IF NOT EXISTS quran_words_editor_match_idx ON quran_words
  (normalize_arabic(text_uthmani), qiraat_editor_lexical_key(text_uthmani));

CREATE OR REPLACE FUNCTION qiraat_editor_bulk_delete(p_items jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; affected integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid selection';
  END IF;
  IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'duplicate selection';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    UPDATE qiraat_annotations SET deleted_at=now(), updated_by=auth.uid()
    WHERE id=(item->>'id')::uuid AND version=(item->>'expectedVersion')::integer AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT annotation %', item->>'id'; END IF;
    affected := affected + 1;
  END LOOP;
  RETURN affected;
END $$;

-- A face configuration is equivalent only when its complete ordered face set and
-- applicability match. A different configuration for the same authority/rule is
-- sent to manual review, regardless of its verification state.
CREATE OR REPLACE FUNCTION qiraat_editor_face_signature(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('type',f.face_type,'value',f.face_value,'label',f.label_ar,'preference',f.preference_status)
    ORDER BY f.sort_order,f.id),'[]'::jsonb)
  FROM qiraat_annotation_faces f WHERE f.annotation_id=p_id;
$$;

CREATE OR REPLACE FUNCTION qiraat_editor_variant_signature(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('text',v.uthmanic_text,'normalized',v.normalized_text,
    'phonetic',v.phonetic_note,'mode',v.render_mode,'glyph',v.glyph_reference,'face',f.sort_order)
    ORDER BY f.sort_order NULLS FIRST,v.uthmanic_text,v.normalized_text,v.phonetic_note),'[]'::jsonb)
  FROM qiraat_annotation_variants v LEFT JOIN qiraat_annotation_faces f ON f.id=v.face_id
  WHERE v.annotation_id=p_id;
$$;

CREATE OR REPLACE FUNCTION qiraat_editor_occurrences(p_source_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE src qiraat_annotations; source_word quran_words; result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT * INTO src FROM qiraat_annotations WHERE id=p_source_id AND deleted_at IS NULL AND scope_type='WORD';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid source annotation'; END IF;
  SELECT * INTO source_word FROM quran_words WHERE id=src.start_word_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'canonicalKey',w.canonical_key,'surah',w.surah,'ayah',w.ayah,'page',w.page_number,
    'token',w.word_position,'word',w.text_uthmani,
    'state',CASE WHEN w.id=source_word.id THEN 'source'
      WHEN EXISTS (SELECT 1 FROM qiraat_annotations a WHERE a.deleted_at IS NULL AND a.scope_type='WORD'
        AND a.start_word_id=w.id AND a.target_authority_id=src.target_authority_id AND a.taxonomy_id=src.taxonomy_id
        AND a.reading_context=src.reading_context AND a.inheritance_action=src.inheritance_action
        AND a.applies_to_descendants=src.applies_to_descendants AND a.corpus_id IS NOT DISTINCT FROM src.corpus_id
        AND a.framework_id IS NOT DISTINCT FROM src.framework_id
        AND qiraat_editor_face_signature(a.id)=qiraat_editor_face_signature(src.id)
        AND qiraat_editor_variant_signature(a.id)=qiraat_editor_variant_signature(src.id)) THEN 'existing'
      WHEN EXISTS (SELECT 1 FROM qiraat_annotations a WHERE a.deleted_at IS NULL AND a.scope_type='WORD'
        AND a.start_word_id=w.id AND a.target_authority_id=src.target_authority_id AND a.taxonomy_id=src.taxonomy_id
        AND a.status='verified') THEN 'conflict'
      WHEN EXISTS (SELECT 1 FROM qiraat_annotations a WHERE a.deleted_at IS NULL AND a.scope_type='WORD'
        AND a.start_word_id=w.id AND a.target_authority_id=src.target_authority_id AND a.taxonomy_id=src.taxonomy_id) THEN 'review'
      ELSE 'add' END,
    'verification',(SELECT string_agg(DISTINCT a.status, '، ') FROM qiraat_annotations a
      WHERE a.deleted_at IS NULL AND a.scope_type='WORD' AND a.start_word_id=w.id
        AND a.target_authority_id=src.target_authority_id AND a.taxonomy_id=src.taxonomy_id),
    'existingVariant',(SELECT string_agg(f.label_ar, '، ' ORDER BY f.sort_order) FROM qiraat_annotations a
      JOIN qiraat_annotation_faces f ON f.annotation_id=a.id WHERE a.deleted_at IS NULL AND a.scope_type='WORD'
      AND a.start_word_id=w.id AND a.target_authority_id=src.target_authority_id AND a.taxonomy_id=src.taxonomy_id)
    ) ORDER BY w.surah,w.ayah,w.word_position),'[]'::jsonb) INTO result
  FROM quran_words w WHERE normalize_arabic(w.text_uthmani)=normalize_arabic(source_word.text_uthmani)
    AND qiraat_editor_lexical_key(w.text_uthmani)=qiraat_editor_lexical_key(source_word.text_uthmani);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION qiraat_editor_verified_matches(p_canonical_key text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'canonicalKey',w.canonical_key,'surah',w.surah,'ayah',w.ayah,'page',w.page_number,
    'word',w.text_uthmani,'authorityId',a.target_authority_id,'taxonomyId',a.taxonomy_id,
    'readingContext',a.reading_context,'faces',qiraat_editor_face_signature(a.id),'status',a.status
  ) ORDER BY w.surah,w.ayah,w.word_position),'[]'::jsonb)
  FROM quran_words selected JOIN quran_words w
    ON normalize_arabic(w.text_uthmani)=normalize_arabic(selected.text_uthmani)
    AND qiraat_editor_lexical_key(w.text_uthmani)=qiraat_editor_lexical_key(selected.text_uthmani)
  JOIN qiraat_annotations a ON a.start_word_id=w.id AND a.end_word_id=w.id
  WHERE selected.canonical_key=p_canonical_key AND w.id<>selected.id
    AND a.deleted_at IS NULL AND a.scope_type='WORD' AND a.status='verified';
$$;

-- One PostgREST RPC call is one database transaction. Lock each target's semantic
-- authority/rule key to serialize concurrent bulk copies; re-check after the lock.
CREATE OR REPLACE FUNCTION qiraat_editor_apply_occurrences(p_source_id uuid, p_keys text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE src qiraat_annotations; source_word quran_words; target_word quran_words; k text;
  added integer:=0; already integer:=0; conflicts integer:=0; needs_review integer:=0; invalid integer:=0;
  new_id uuid; face_row record; variant_row record; new_face_id uuid; face_map jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_keys IS NULL OR array_length(p_keys,1) IS NULL OR array_length(p_keys,1)>10000 THEN RAISE EXCEPTION 'invalid selection'; END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_keys) x) <> array_length(p_keys,1) THEN RAISE EXCEPTION 'duplicate selection'; END IF;
  SELECT array_agg(x ORDER BY x) INTO p_keys FROM unnest(p_keys) x;
  SELECT * INTO src FROM qiraat_annotations WHERE id=p_source_id AND deleted_at IS NULL AND scope_type='WORD' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid source annotation'; END IF;
  SELECT * INTO source_word FROM quran_words WHERE id=src.start_word_id;
  FOREACH k IN ARRAY p_keys LOOP
    SELECT * INTO target_word FROM quran_words WHERE canonical_key=k;
    IF NOT FOUND OR normalize_arabic(target_word.text_uthmani)<>normalize_arabic(source_word.text_uthmani)
      OR qiraat_editor_lexical_key(target_word.text_uthmani)<>qiraat_editor_lexical_key(source_word.text_uthmani) THEN
      invalid:=invalid+1; CONTINUE;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(k || src.target_authority_id || src.taxonomy_id::text));
    IF target_word.id=source_word.id OR EXISTS (SELECT 1 FROM qiraat_annotations a WHERE a.deleted_at IS NULL
      AND a.scope_type='WORD' AND a.start_word_id=target_word.id AND a.target_authority_id=src.target_authority_id
      AND a.taxonomy_id=src.taxonomy_id AND a.reading_context=src.reading_context
      AND a.inheritance_action=src.inheritance_action AND a.applies_to_descendants=src.applies_to_descendants
      AND a.corpus_id IS NOT DISTINCT FROM src.corpus_id AND a.framework_id IS NOT DISTINCT FROM src.framework_id
      AND qiraat_editor_face_signature(a.id)=qiraat_editor_face_signature(src.id)
      AND qiraat_editor_variant_signature(a.id)=qiraat_editor_variant_signature(src.id)) THEN already:=already+1; CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM qiraat_annotations a WHERE a.deleted_at IS NULL AND a.scope_type='WORD'
      AND a.start_word_id=target_word.id AND a.target_authority_id=src.target_authority_id AND a.taxonomy_id=src.taxonomy_id) THEN
      IF EXISTS (SELECT 1 FROM qiraat_annotations a WHERE a.deleted_at IS NULL AND a.scope_type='WORD'
        AND a.start_word_id=target_word.id AND a.target_authority_id=src.target_authority_id AND a.taxonomy_id=src.taxonomy_id
        AND a.status='verified') THEN conflicts:=conflicts+1;
      ELSE needs_review:=needs_review+1; END IF;
      CONTINUE;
    END IF;
    INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,reading_context,taxonomy_id,target_authority_id,
      corpus_id,framework_id,inheritance_action,applies_to_descendants,status,color_override,entry_method,notes,
      source_annotation_id,created_by,updated_by)
    VALUES('WORD',target_word.id,target_word.id,src.reading_context,src.taxonomy_id,src.target_authority_id,
      src.corpus_id,src.framework_id,src.inheritance_action,src.applies_to_descendants,'draft',src.color_override,
      'batch',src.notes,src.id,auth.uid(),auth.uid()) RETURNING id INTO new_id;
    face_map:='{}'::jsonb;
    FOR face_row IN SELECT * FROM qiraat_annotation_faces WHERE annotation_id=src.id ORDER BY sort_order,id LOOP
      INSERT INTO qiraat_annotation_faces(annotation_id,face_type,face_value,label_ar,label_en,preference_status,sort_order,metadata)
      VALUES(new_id,face_row.face_type,face_row.face_value,face_row.label_ar,face_row.label_en,face_row.preference_status,face_row.sort_order,face_row.metadata)
      RETURNING id INTO new_face_id;
      face_map:=face_map || jsonb_build_object(face_row.id::text,new_face_id::text);
    END LOOP;
    FOR variant_row IN SELECT * FROM qiraat_annotation_variants WHERE annotation_id=src.id LOOP
      INSERT INTO qiraat_annotation_variants(annotation_id,face_id,canonical_word_key,uthmanic_text,normalized_text,phonetic_note,render_mode,glyph_reference,metadata)
      VALUES(new_id,CASE WHEN variant_row.face_id IS NULL THEN NULL ELSE (face_map->>variant_row.face_id::text)::uuid END,
        target_word.canonical_key,variant_row.uthmanic_text,variant_row.normalized_text,variant_row.phonetic_note,
        variant_row.render_mode,variant_row.glyph_reference,variant_row.metadata);
    END LOOP;
    INSERT INTO qiraat_annotation_sources(annotation_id,source_id,chapter,section,bayt_number,page,reference_text,notes)
      SELECT new_id,source_id,chapter,section,bayt_number,page,reference_text,notes
      FROM qiraat_annotation_sources WHERE annotation_id=src.id;
    added:=added+1;
  END LOOP;
  RETURN jsonb_build_object('added',added,'existing',already,'review',needs_review,'conflicts',conflicts,'invalid',invalid);
END $$;

REVOKE ALL ON FUNCTION qiraat_editor_lexical_key(text),qiraat_editor_face_signature(uuid),qiraat_editor_variant_signature(uuid),qiraat_editor_bulk_delete(jsonb),
  qiraat_editor_occurrences(uuid),qiraat_editor_verified_matches(text),qiraat_editor_apply_occurrences(uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qiraat_editor_bulk_delete(jsonb),qiraat_editor_occurrences(uuid),
  qiraat_editor_verified_matches(text),qiraat_editor_apply_occurrences(uuid,text[]) TO authenticated,service_role;
