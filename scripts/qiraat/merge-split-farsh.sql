-- Merge farsh entries that the data split into several entries although they record the SAME reading of the SAME word
-- (e.g. «وَنَقُولُ» once for السوسي and once for هشام وابن ذكوان). Reversible (deleted_at + edit_log).
-- Run: psql -v ON_ERROR_STOP=1 -f merge-split-farsh.sql   (dry run: replace the final COMMIT with ROLLBACK)
-- Cluster = same surah and word span + the EXACT diacritized reading text (qiraat_norm strips vowels and would equate
--          «خَوْفَ» with «خَوْفٌ») + same وصل/وقف flags, only first wajh. The usul counterpart is merge-split-rulings.sql.
-- Survivor = the human-approved entry, else the automatically approved one, else the one with open flags, longer text, smaller id.
-- Narrators of the others are moved to the survivor (an authority the survivor already has is not duplicated); the others are soft-deleted.
-- A description / performance note the survivor lacks is copied from an entry merged away.
-- Approval: a human-approved entry only absorbs entries whose narrators it already has; two human-approved entries are left alone;
--          a union of automatically approved entries stays approved; a union that mixes approved with unreviewed becomes unreviewed.
BEGIN;
SELECT set_config('app.device_id', 'dedupe-split-farsh', true);

CREATE TEMP TABLE ent AS
 SELECT e.id, e.locus_id locus, e.review_status st, e.review_source rs, (e.review_status = 'reviewed' AND e.review_source IS NULL) human,
        l.surah_number s, l.start_ayah a, l.start_word w, coalesce(l.end_ayah, l.start_ayah) ea, coalesce(l.end_word, l.start_word) ew,
        btrim(vd.reading_text) rt, e.applies_wasl aw, e.applies_waqf af,
        (SELECT array_agg(au.authority_id ORDER BY au.authority_id) FROM qiraat_entry_authorities au WHERE au.entry_id = e.id AND au.deleted_at IS NULL) ns,
        (SELECT count(*) FROM qiraat_qa_flags f WHERE f.entry_id = e.id AND f.status = 'open') flags,
        length(coalesce(vd.description_ar, '')) dl
   FROM qiraat_entries e
   JOIN qiraat_loci l ON l.id = e.locus_id AND l.deleted_at IS NULL
   JOIN qiraat_variant_details vd ON vd.entry_id = e.id
  WHERE e.deleted_at IS NULL AND e.kind = 'variant' AND e.verification_status <> 'REJECTED'
    AND btrim(vd.reading_text) <> ''
    AND NOT EXISTS (SELECT 1 FROM qiraat_entry_authorities au WHERE au.entry_id = e.id AND au.deleted_at IS NULL AND au.wajh_order > 1)
    AND EXISTS (SELECT 1 FROM qiraat_entry_authorities au WHERE au.entry_id = e.id AND au.deleted_at IS NULL);

CREATE TEMP TABLE cl AS
 SELECT s, a, w, ea, ew, rt, aw, af FROM ent GROUP BY 1,2,3,4,5,6,7,8 HAVING count(*) > 1;

CREATE TEMP TABLE sv AS
 SELECT DISTINCT ON (cl.s, cl.a, cl.w, cl.ea, cl.ew, cl.rt, cl.aw, cl.af)
        cl.s, cl.a, cl.w, cl.ea, cl.ew, cl.rt, cl.aw, cl.af, e.id sid, e.ns sns, e.human shuman
   FROM cl JOIN ent e USING (s, a, w, ea, ew, rt, aw, af)
  ORDER BY cl.s, cl.a, cl.w, cl.ea, cl.ew, cl.rt, cl.aw, cl.af,
           e.human DESC, (e.rs IS NOT NULL) DESC, (e.flags > 0) DESC, e.dl DESC, e.id;

CREATE TEMP TABLE oth AS
 SELECT sv.sid, sv.shuman, e.id oid, e.locus olocus, e.st ost, e.rs ors, e.human ohuman, NOT (e.ns <@ sv.sns) adds
   FROM sv JOIN ent e USING (s, a, w, ea, ew, rt, aw, af) WHERE e.id <> sv.sid;

-- clusters we leave alone: a human-approved entry that would receive narrators, or two human-approved entries
CREATE TEMP TABLE skip AS
 SELECT DISTINCT sid FROM oth WHERE ohuman OR (shuman AND adds);
DELETE FROM oth WHERE sid IN (SELECT sid FROM skip);

SELECT 'clusters merged: ' || count(DISTINCT sid) || ', entries merged away: ' || count(*) || ', of which add narrators: ' || count(*) FILTER (WHERE adds) AS summary FROM oth;
SELECT 'skipped (a person-approved entry involved): ' || count(*) AS skipped FROM skip;

-- 1. move the narrators
UPDATE qiraat_entry_authorities au SET entry_id = mv.sid
  FROM (SELECT DISTINCT ON (o.sid, a.authority_id) a.id, o.sid
          FROM oth o JOIN qiraat_entry_authorities a ON a.entry_id = o.oid AND a.deleted_at IS NULL
         WHERE o.adds
           AND NOT EXISTS (SELECT 1 FROM qiraat_entry_authorities x WHERE x.entry_id = o.sid AND x.authority_id = a.authority_id AND x.deleted_at IS NULL)
         ORDER BY o.sid, a.authority_id, a.wajh_order, a.id) mv
 WHERE au.id = mv.id;

-- 2. a description / performance note the survivor lacks
UPDATE qiraat_variant_details sd
   SET description_ar = coalesce(sd.description_ar, x.d), performance_note = coalesce(sd.performance_note, x.p)
  FROM (SELECT o.sid, (array_agg(od.description_ar) FILTER (WHERE od.description_ar IS NOT NULL))[1] d,
               (array_agg(od.performance_note) FILTER (WHERE od.performance_note IS NOT NULL))[1] p
          FROM oth o JOIN qiraat_variant_details od ON od.entry_id = o.oid GROUP BY o.sid) x
 WHERE sd.entry_id = x.sid AND ((sd.description_ar IS NULL AND x.d IS NOT NULL) OR (sd.performance_note IS NULL AND x.p IS NOT NULL));

-- 3. approval of the survivor
CREATE TEMP TABLE newstatus AS
 SELECT s.sid,
        CASE WHEN NOT bool_or(o.adds) THEN 'keep'
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

-- 4. drop the others
UPDATE qiraat_qa_flags f SET status = 'corrected', resolved_at = now(), resolved_note = 'سجل مدمج مع ' || o.sid
  FROM oth o WHERE f.entry_id = o.oid AND f.status = 'open';
UPDATE qiraat_entries e SET deleted_at = now(), notes = concat_ws(E'\n', e.notes, '[حذف] دُمج في السجل ' || o.sid)
  FROM oth o WHERE e.id = o.oid AND e.deleted_at IS NULL;

-- 5. empty loci, locus statuses
UPDATE qiraat_loci l SET deleted_at = now()
 WHERE l.deleted_at IS NULL AND l.id IN (SELECT olocus FROM oth)
   AND NOT EXISTS (SELECT 1 FROM qiraat_entries x WHERE x.locus_id = l.id AND x.deleted_at IS NULL AND x.verification_status <> 'REJECTED');
SELECT qiraat_review_sync_locus(l) FROM (SELECT DISTINCT locus_id AS l FROM qiraat_entries WHERE id IN (SELECT sid FROM oth) OR id IN (SELECT oid FROM oth)) q;

-- the list, for the report
SELECT o.oid AS merged_away, o.sid AS survivor, o.adds, o.ohuman FROM oth o ORDER BY o.sid, o.oid;
SELECT sk.sid AS skipped_survivor FROM skip sk ORDER BY 1;
COMMIT;
