-- Merge usul rulings that the data split into several entries although they state the same rule for the same word
-- (e.g. فتح ياء الإضافة listed once for السوسي, once for الدوري and once for the rest of the readers), and drop the farsh
-- entries that only repeat a ياءات rule. Reversible (deleted_at + edit_log). Run: psql -v ON_ERROR_STOP=1 -f merge-split-rulings.sql
-- Cluster = same surah/ayah/start word + category + sub-category (a single rule, not an «أوجه متعددة»/«وجهان» family label)
--          + same وصل/وقف flags, no structured hamzah detail, only first wajh.
-- Survivor = the human-approved entry, else the automatically approved one, else the one with the widest span, open flags, longer text.
-- Narrators of the others are moved to the survivor (an authority the survivor already has is not duplicated); the others are soft-deleted.
-- Approval: a human-approved entry only absorbs entries whose narrators it already has; a union of automatically approved entries stays
--          approved; a union that mixes approved with unreviewed entries becomes unreviewed (the automatic judge re-approves it).
BEGIN;
SELECT set_config('app.device_id', 'auto-review-merge', true);

CREATE TEMP TABLE ent AS
 SELECT e.id, e.locus_id locus, e.review_status st, e.review_source rs, (e.review_status = 'reviewed' AND e.review_source IS NULL) human,
        l.surah_number s, l.start_ayah a, l.start_word w, l.end_ayah ea, coalesce(l.end_word, l.start_word) ew,
        rd.category_code c, rd.sub_category sc, e.applies_wasl aw, e.applies_waqf af,
        (SELECT array_agg(au.authority_id ORDER BY au.authority_id) FROM qiraat_entry_authorities au WHERE au.entry_id = e.id AND au.deleted_at IS NULL) ns,
        (SELECT count(*) FROM qiraat_qa_flags f WHERE f.entry_id = e.id AND f.status = 'open') flags,
        length(coalesce(rd.text_ar, '')) dl
   FROM qiraat_entries e
   JOIN qiraat_loci l ON l.id = e.locus_id AND l.deleted_at IS NULL
   JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
  WHERE e.deleted_at IS NULL AND e.kind = 'ruling' AND e.verification_status <> 'REJECTED'
    AND rd.category_code <> 'AYAH_COUNT' AND rd.sub_category IS NOT NULL
    AND rd.sub_category NOT LIKE '%(أوجه متعددة)%' AND rd.sub_category NOT LIKE '%(وجهان)%'
    AND e.hamzah_detail IS NULL
    AND NOT EXISTS (SELECT 1 FROM qiraat_entry_authorities au WHERE au.entry_id = e.id AND au.deleted_at IS NULL AND au.wajh_order > 1)
    AND EXISTS (SELECT 1 FROM qiraat_entry_authorities au WHERE au.entry_id = e.id AND au.deleted_at IS NULL);

CREATE TEMP TABLE cl AS
 SELECT s, a, w, c, sc, aw, af FROM ent GROUP BY 1,2,3,4,5,6,7 HAVING count(*) > 1;

-- survivor per cluster
CREATE TEMP TABLE sv AS
 SELECT DISTINCT ON (cl.s, cl.a, cl.w, cl.c, cl.sc, cl.aw, cl.af)
        cl.s, cl.a, cl.w, cl.c, cl.sc, cl.aw, cl.af, e.id sid, e.ns sns, e.human shuman
   FROM cl JOIN ent e USING (s, a, w, c, sc, aw, af)
  ORDER BY cl.s, cl.a, cl.w, cl.c, cl.sc, cl.aw, cl.af,
           e.human DESC, (e.rs IS NOT NULL) DESC, e.ew DESC, e.ea DESC, (e.flags > 0) DESC, e.dl DESC, e.id;

-- the others, with what they would add
CREATE TEMP TABLE oth AS
 SELECT sv.sid, sv.shuman, e.id oid, e.locus olocus, e.st ost, e.rs ors, e.human ohuman, NOT (e.ns <@ sv.sns) adds
   FROM sv JOIN ent e USING (s, a, w, c, sc, aw, af) WHERE e.id <> sv.sid;

-- clusters we leave alone: a human-approved entry that would receive narrators, or two human-approved entries
CREATE TEMP TABLE skip AS
 SELECT DISTINCT sid FROM oth
  WHERE ohuman OR (shuman AND adds);
DELETE FROM oth WHERE sid IN (SELECT sid FROM skip);

SELECT 'clusters merged: ' || count(DISTINCT sid) || ', entries merged away: ' || count(*) || ', of which add narrators: ' || count(*) FILTER (WHERE adds) FROM oth;
SELECT 'skipped (human involved): ' || count(*) FROM skip;

-- 1. move the narrators
UPDATE qiraat_entry_authorities au SET entry_id = mv.sid
  FROM (SELECT DISTINCT ON (o.sid, a.authority_id) a.id, o.sid
          FROM oth o JOIN qiraat_entry_authorities a ON a.entry_id = o.oid AND a.deleted_at IS NULL
         WHERE o.adds
           AND NOT EXISTS (SELECT 1 FROM qiraat_entry_authorities x WHERE x.entry_id = o.sid AND x.authority_id = a.authority_id AND x.deleted_at IS NULL)
         ORDER BY o.sid, a.authority_id, a.wajh_order, a.id) mv
 WHERE au.id = mv.id;

-- 2. approval of the survivor
CREATE TEMP TABLE newstatus AS
 SELECT s.sid,
        CASE WHEN bool_or(NOT o.adds) AND NOT bool_or(o.adds) THEN 'keep'
             WHEN s.shuman THEN 'keep'
             WHEN bool_and(o.ors IS NOT NULL) AND (SELECT st = 'reviewed' AND rs IS NOT NULL FROM ent WHERE id = s.sid) THEN 'auto'
             WHEN bool_or(o.ost = 'flagged') OR (SELECT st = 'flagged' FROM ent WHERE id = s.sid) THEN 'flagged'
             ELSE 'unreviewed' END AS mode,
        CASE WHEN bool_or(o.ors = 'auto:nquran') OR (SELECT rs = 'auto:nquran' FROM ent WHERE id = s.sid) THEN 'auto:nquran' ELSE 'auto:nquran+book' END AS src
   FROM (SELECT DISTINCT sid, shuman FROM oth) s JOIN oth o USING (sid) GROUP BY s.sid, s.shuman;
UPDATE qiraat_entries e SET review_status = 'unreviewed', review_source = NULL, review_note = NULL
  FROM newstatus n WHERE e.id = n.sid AND n.mode = 'unreviewed';
UPDATE qiraat_entries e SET review_status = 'flagged', review_source = NULL, review_note = NULL
  FROM newstatus n WHERE e.id = n.sid AND n.mode = 'flagged';
UPDATE qiraat_entries e SET review_source = n.src
  FROM newstatus n WHERE e.id = n.sid AND n.mode = 'auto' AND e.review_source IS DISTINCT FROM n.src;

-- 3. drop the others
UPDATE qiraat_qa_flags f SET status = 'corrected', resolved_at = now(), resolved_note = 'سجل مدمج مع ' || o.sid
  FROM oth o WHERE f.entry_id = o.oid AND f.status = 'open';
UPDATE qiraat_entries e SET deleted_at = now(), notes = concat_ws(E'\n', e.notes, '[حذف] دُمج في السجل ' || o.sid)
  FROM oth o WHERE e.id = o.oid AND e.deleted_at IS NULL;

-- 4. farsh entries that only repeat a ياءات rule already stated by a ruling for the same word and narrators
CREATE TEMP TABLE fy AS
 SELECT v.id fid, r.id rid
   FROM qiraat_entries v
   JOIN qiraat_loci vl ON vl.id = v.locus_id AND vl.deleted_at IS NULL
   JOIN qiraat_variant_details vd ON vd.entry_id = v.id
   JOIN LATERAL (
        SELECT array_agg(au.authority_id) ns,
               string_agg(coalesce(au.action_ar, ''), ' ') acts
          FROM qiraat_entry_authorities au WHERE au.entry_id = v.id AND au.deleted_at IS NULL) vn ON true
   JOIN (SELECT e.id, l.surah_number s, l.start_ayah a, l.start_word w, coalesce(l.end_word, l.start_word) ew, rd.category_code c, rd.sub_category sc,
                (SELECT array_agg(au.authority_id) FROM qiraat_entry_authorities au WHERE au.entry_id = e.id AND au.deleted_at IS NULL) ns
           FROM qiraat_entries e JOIN qiraat_loci l ON l.id = e.locus_id AND l.deleted_at IS NULL
           JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
          WHERE e.deleted_at IS NULL AND rd.category_code IN ('YAAT_IDAFA', 'YAAT_ZAWAID')) r
     ON r.s = vl.surah_number AND r.a = vl.start_ayah AND vl.start_word BETWEEN r.w AND r.ew AND vn.ns <@ r.ns
  CROSS JOIN LATERAL (SELECT translate(regexp_replace(coalesce(vd.description_ar, '') || ' ' || coalesce(vd.performance_note, '') || ' ' || vn.acts, '[ً-ٰـ]', '', 'g'), 'أإآٱ', 'اااا') t) n
  WHERE v.deleted_at IS NULL AND v.kind = 'variant' AND NOT (v.review_status = 'reviewed' AND v.review_source IS NULL)
    AND n.t LIKE '%الياء%'
    AND ((r.sc = 'فتح الياء' AND n.t ~ 'فتح' AND n.t !~ 'اسكن|اسكان|اثبات|حذف')
      OR (r.sc = 'إسكان الياء' AND n.t ~ 'اسكن|اسكان' AND n.t !~ 'فتح|اثبات|حذف')
      OR (r.c = 'YAAT_ZAWAID' AND r.sc LIKE 'إثبات%' AND n.t ~ 'اثبات|اثبت' AND n.t !~ 'حذف'));
SELECT 'farsh entries repeating a ياءات rule: ' || count(DISTINCT fid) FROM fy;
UPDATE qiraat_qa_flags f SET status = 'corrected', resolved_at = now(), resolved_note = 'يكرر حكمًا مسجلًا في السجل ' || fy.rid
  FROM fy WHERE f.entry_id = fy.fid AND f.status = 'open';
UPDATE qiraat_entries e SET deleted_at = now(), notes = concat_ws(E'\n', e.notes, '[حذف] يكرر حكمًا مسجلًا في السجل ' || fy.rid)
  FROM (SELECT DISTINCT ON (fid) fid, rid FROM fy ORDER BY fid, rid) fy WHERE e.id = fy.fid AND e.deleted_at IS NULL;

-- 5. empty loci, locus statuses
UPDATE qiraat_loci l SET deleted_at = now()
 WHERE l.deleted_at IS NULL
   AND l.id IN (SELECT olocus FROM oth UNION SELECT locus FROM qiraat_entries e JOIN fy ON fy.fid = e.id JOIN ent ON false)
   AND NOT EXISTS (SELECT 1 FROM qiraat_entries x WHERE x.locus_id = l.id AND x.deleted_at IS NULL AND x.verification_status <> 'REJECTED');
UPDATE qiraat_loci l SET deleted_at = now()
 WHERE l.deleted_at IS NULL AND l.id IN (SELECT e.locus_id FROM qiraat_entries e JOIN fy ON fy.fid = e.id)
   AND NOT EXISTS (SELECT 1 FROM qiraat_entries x WHERE x.locus_id = l.id AND x.deleted_at IS NULL AND x.verification_status <> 'REJECTED');
SELECT qiraat_review_sync_locus(l) FROM (SELECT DISTINCT locus_id AS l FROM qiraat_entries WHERE id IN (SELECT sid FROM oth) OR id IN (SELECT oid FROM oth) OR id IN (SELECT fid FROM fy)) q;
COMMIT;
