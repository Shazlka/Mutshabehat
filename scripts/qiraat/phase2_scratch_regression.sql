-- Phase 2 regression probe: the live editor RPCs, resolved cache and page export must behave the
-- same before and after the migration. SCRATCH DATABASE ONLY (creates and soft-deletes a test annotation).
-- Output lines are stable so the before/after runs can be diffed.
\set ON_ERROR_STOP 1
\pset format unaligned
\pset tuples_only on
-- Act as an existing editor (created_by references auth.users).
SELECT set_config('request.jwt.claim.sub', (SELECT created_by::text FROM qiraat_annotations ORDER BY created_at LIMIT 1), false) IS NOT NULL AS editor_set;

SELECT 'catalog ' || md5(qiraat_editor_catalog()::text);
SELECT 'catalog entities ' || jsonb_array_length(qiraat_editor_catalog()->'entities');
SELECT 'annotations 001:002:002 ' || jsonb_array_length(qiraat_editor_annotations('001:002:002'));
SELECT 'export p1 ' || md5(qiraat_export_page(1::smallint, true)::text);
SELECT 'export p245 ' || md5(qiraat_export_page(245::smallint, true)::text);
SELECT 'export p584 ' || md5(qiraat_export_page(584::smallint, true)::text);
SELECT 'cache rows before ' || count(*) FROM resolved_qiraat_cache;

-- Create → update → soft delete through the editor RPCs, checking the cache at each step.
SELECT (qiraat_editor_create_annotation(jsonb_build_object(
          'startCanonicalKey', '001:002:002', 'taxonomyId', '7aed6225-50c0-4245-aab8-dc626d788f38',
          'targetAuthorityId', 'Q01-R02', 'notes', 'phase2 regression',
          'faces', jsonb_build_array(jsonb_build_object('labelAr', 'وجه')))) -> 0 ->> 'id') AS ann_id \gset
SELECT 'created, faces ' || jsonb_array_length(qiraat_editor_annotations('001:002:002') -> 0 -> 'faces');
SELECT 'cache rows for new annotation ' || count(*) FROM resolved_qiraat_cache WHERE resolved_annotation_id = :'ann_id';
SELECT 'updated version ' || (qiraat_editor_update_annotation(jsonb_build_object(
          'id', :'ann_id', 'expectedVersion', (SELECT version FROM qiraat_annotations WHERE id = :'ann_id'),
          'startCanonicalKey', '001:002:002', 'taxonomyId', '7aed6225-50c0-4245-aab8-dc626d788f38',
          'targetAuthorityId', 'Q01-R02', 'notes', 'phase2 regression v2')) -> 0 ->> 'version');
SELECT qiraat_editor_soft_delete_annotation(:'ann_id'::uuid, (SELECT version FROM qiraat_annotations WHERE id = :'ann_id'));
SELECT 'cache rows after soft delete ' || count(*) FROM resolved_qiraat_cache WHERE resolved_annotation_id = :'ann_id';
SELECT 'revisions for test annotation ' || count(*) FROM qiraat_annotation_revisions WHERE annotation_id = :'ann_id';
SELECT 'cache rows end ' || count(*) FROM resolved_qiraat_cache;
SELECT 'quran_words checksum ' || md5(string_agg(canonical_key || text_uthmani, '|' ORDER BY canonical_key)) FROM quran_words;
