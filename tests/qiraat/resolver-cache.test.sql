-- Run with: docker exec -i mutshabehat-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction < tests/qiraat/resolver-cache.test.sql
-- The final exception is intentional: every synthetic authority, annotation and cache row rolls back.
DO $$
DECLARE w uuid; tax uuid; reader uuid; narrator uuid; a uuid; b uuid; x uuid;
BEGIN
 SELECT id INTO w FROM quran_words WHERE canonical_key='002:002:001'; SELECT id INTO tax FROM qiraat_taxonomies WHERE code='USUL';
 INSERT INTO qiraat_authorities(id,authority_type,parent_id,name_ar,name_ar_short,name_en,slug,color_hex,sort_order) VALUES
 ('Q01-R01-T01','route','Q01-R01','اختبار أ','أ','Test A','resolver-test-a','#111111',1),('Q01-R01-T02','route','Q01-R01','اختبار ب','ب','Test B','resolver-test-b','#222222',2);
 -- Reader inheritance; unrelated Q02 never receives it.
 INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,start_canonical_key,end_canonical_key,taxonomy_id,target_authority_id,applies_to_descendants) VALUES('WORD',w,w,'x','x',tax,'Q01',true) RETURNING id INTO reader;
 IF NOT EXISTS(SELECT 1 FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T01' AND resolved_annotation_id=reader) OR EXISTS(SELECT 1 FROM resolved_qiraat_cache WHERE target_authority_id='Q02-R01') THEN RAISE EXCEPTION 'reader inheritance or branch isolation'; END IF;
 -- Non-propagating override/exclude affect Narrator only; Tariq retains Reader.
 INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,start_canonical_key,end_canonical_key,taxonomy_id,target_authority_id,inheritance_action,applies_to_descendants) VALUES('WORD',w,w,'x','x',tax,'Q01-R01','OVERRIDE',false) RETURNING id INTO narrator;
 IF (SELECT resolved_annotation_id FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T01')<>reader THEN RAISE EXCEPTION 'nonprop override'; END IF;
 UPDATE qiraat_annotations SET inheritance_action='EXCLUDE' WHERE id=narrator;
 IF EXISTS(SELECT 1 FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01') OR (SELECT resolved_annotation_id FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T01')<>reader THEN RAISE EXCEPTION 'nonprop exclude'; END IF;
 -- Propagating exclude suppresses Tariq; direct Tariq override wins.
 UPDATE qiraat_annotations SET applies_to_descendants=true WHERE id=narrator;
 IF EXISTS(SELECT 1 FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T01') THEN RAISE EXCEPTION 'prop exclude'; END IF;
 INSERT INTO qiraat_annotations(scope_type,start_word_id,end_word_id,start_canonical_key,end_canonical_key,taxonomy_id,target_authority_id,inheritance_action) VALUES('WORD',w,w,'x','x',tax,'Q01-R01-T01','OVERRIDE') RETURNING id INTO a;
 IF (SELECT resolved_annotation_id FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T01')<>a THEN RAISE EXCEPTION 'direct over exclude/cache parity'; END IF;
 -- sibling remains excluded: no horizontal leakage.
 IF EXISTS(SELECT 1 FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T02') THEN RAISE EXCEPTION 'sibling leak'; END IF;
 -- propagated narrator override becomes nearest ancestor; direct Tariq remains stronger.
 UPDATE qiraat_annotations SET inheritance_action='OVERRIDE' WHERE id=narrator;
 IF (SELECT resolved_annotation_id FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T02')<>narrator OR (SELECT resolved_annotation_id FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T01')<>a THEN RAISE EXCEPTION 'nearest/direct precedence'; END IF;
 -- soft deleting the narrator override falls back to Reader for sibling; direct A remains direct.
 UPDATE qiraat_annotations SET deleted_at=now() WHERE id=narrator;
 IF (SELECT resolved_annotation_id FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T02')<>reader OR (SELECT resolved_annotation_id FROM resolved_qiraat_cache WHERE target_authority_id='Q01-R01-T01')<>a THEN RAISE EXCEPTION 'deletion fallback'; END IF;
 RAISE EXCEPTION 'intentional rollback';
END $$;
