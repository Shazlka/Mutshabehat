-- Phase 4b pages 051-100. Entries are created through the editor RPC, then marked: nquran also lists the same narrators at the
-- word -> reviewed as 'auto:nquran+book'; otherwise unreviewed (waiting for a person).
BEGIN;
SELECT set_config('app.device_id','auto-review',true);
CREATE TEMP TABLE _auto_new_ids(id text, approve boolean) ON COMMIT DROP;

INSERT INTO _auto_new_ids(id, approve) SELECT (qiraat_review_create_entry('{"surah":3,"ayah":48,"startWord":4,"endAyah":48,"endWord":4,"kind":"usul","categoryCode":"IMALAH_TAQLIL","rulingText":"نافع (الوجه الثاني): التقليل\n[المصدر: كتاب قالون، ورش ص83]","hafsText":"وَٱلتَّوْرَىٰةَ","notes":"sources: Nafe3.csv:220 | qaloon.csv:112","deviceId":"auto-review","narrators":[{"id":"Q01-R01","action":"نافع (الوجه الثاني): التقليل","wajhOrder":1,"wajhNote":null},{"id":"Q01-R02","action":"نافع (الوجه الثاني): التقليل","wajhOrder":1,"wajhNote":null}]}'::jsonb))->>'entryId', true;
INSERT INTO _auto_new_ids(id, approve) SELECT (qiraat_review_create_entry('{"surah":3,"ayah":66,"startWord":1,"endAyah":66,"endWord":1,"kind":"usul","categoryCode":"TAGHYIR_HAMZ","rulingText":"قرأها نافع (قالون وورش): تسهيل الهمزة مع إثبات الألف والقصر والتوسط\n[المصدر: كتاب قالون، ورش ص83]","hafsText":"هَـٰٓأَنتُمْ","notes":"sources: Nafe3.csv:233","deviceId":"auto-review","narrators":[{"id":"Q01-R01","action":"قرأها نافع (قالون وورش): تسهيل الهمزة مع إثبات الألف والقصر والتوسط","wajhOrder":1,"wajhNote":null}]}'::jsonb))->>'entryId', true;
INSERT INTO _auto_new_ids(id, approve) SELECT (qiraat_review_create_entry('{"surah":4,"ayah":109,"startWord":1,"endAyah":109,"endWord":1,"kind":"usul","categoryCode":"TAGHYIR_HAMZ","rulingText":"قرأها نافع (قالون وورش): تسهيل الهمزة\n[المصدر: كتاب قالون، ورش ص98]","hafsText":"هَـٰٓأَنتُمْ","notes":"sources: Nafe3.csv:388","deviceId":"auto-review","narrators":[{"id":"Q01-R01","action":"قرأها نافع (قالون وورش): تسهيل الهمزة","wajhOrder":1,"wajhNote":null}]}'::jsonb))->>'entryId', true;

UPDATE qiraat_entries SET review_status='unreviewed', verification_status='REVIEWED', review_source=NULL, review_note='أُضيف آليًا من كتاب القراءة — بانتظار المراجعة' WHERE id IN (SELECT id FROM _auto_new_ids WHERE NOT approve) AND created_at >= now();
UPDATE qiraat_entries SET review_status='reviewed', verification_status='REVIEWED', review_source='auto:nquran+book', review_note='أُضيف آليًا: طابق كتاب القراءة وnquran.com' WHERE id IN (SELECT id FROM _auto_new_ids WHERE approve) AND created_at >= now();
SELECT count(*) AS generated_entry_count FROM qiraat_entries WHERE id IN (SELECT id FROM _auto_new_ids);
COMMIT;
