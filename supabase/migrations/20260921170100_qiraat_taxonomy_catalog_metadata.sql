-- Expose taxonomy metadata (including contextual Face presets) through the
-- existing authenticated editor catalog RPC.
CREATE OR REPLACE FUNCTION qiraat_editor_catalog() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'entities', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'parentId',parent_id,'type',authority_type,'nameAr',name_ar,'color',color_hex) ORDER BY sort_order,id) FROM qiraat_authorities WHERE active), '[]'::jsonb),
    'taxonomies', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'parentId',parent_id,'category',category_type,'nameAr',name_ar,'code',code,'metadata',metadata) ORDER BY category_type, parent_id NULLS FIRST, sort_order,id) FROM qiraat_taxonomies WHERE active), '[]'::jsonb),
    'corpora', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'code',code,'nameAr',name_ar) ORDER BY code) FROM qiraat_corpora WHERE active), '[]'::jsonb),
    'frameworks', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'corpusId',corpus_id,'code',code,'nameAr',name_ar) ORDER BY code) FROM qiraat_frameworks WHERE active), '[]'::jsonb),
    'sources', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'titleAr',name_ar) ORDER BY id) FROM qiraat_source_documents), '[]'::jsonb)
  );
$$;
