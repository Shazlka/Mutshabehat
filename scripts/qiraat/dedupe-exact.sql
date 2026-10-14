-- Soft-delete exact duplicates of the Qiraat entries (reversible: edit_log + deleted_at). Run: psql -v ON_ERROR_STOP=1 -f dedupe-exact.sql
-- An entry B is an exact duplicate of A when both are live, cover the same word span, and
--   farsh: have the same diacritized reading text and B's narrators are a subset of A's;
--   usul : have the same category and every (narrator, action text) pair of B is also in A.
-- Never dropped: entries approved by a person; B is dropped only if A outranks it or A has strictly more narrators.
-- Rank (kept first): human-approved > automatically approved > has open flags > longer explanation > smaller id.
BEGIN;
SELECT set_config('app.device_id', 'auto-review-dedup', true);

CREATE TEMP TABLE ent AS
 SELECT e.id, e.kind, e.review_status st, e.review_source rs, e.locus_id locus,
        l.surah_number s, l.start_ayah a, l.start_word w, l.end_ayah ea, coalesce(l.end_word, l.start_word) ew,
        coalesce(vd.reading_text, '') rt, coalesce(rd.category_code, '') cat,
        (SELECT array_agg(au.authority_id ORDER BY au.authority_id) FROM qiraat_entry_authorities au WHERE au.entry_id = e.id AND au.deleted_at IS NULL) ns,
        (SELECT array_agg(au.authority_id || '=' || coalesce(au.action_ar, '') ORDER BY au.authority_id, au.action_ar) FROM qiraat_entry_authorities au WHERE au.entry_id = e.id AND au.deleted_at IS NULL) nsa,
        (SELECT count(*) FROM qiraat_qa_flags f WHERE f.entry_id = e.id AND f.status = 'open') flags,
        length(coalesce(vd.description_ar, rd.text_ar, '')) dl,
        (e.review_status = 'reviewed' AND e.review_source IS NULL) AS human,
        (CASE WHEN e.review_status = 'reviewed' AND e.review_source IS NULL THEN 3 WHEN e.review_status = 'reviewed' THEN 2 ELSE 0 END) rank1
   FROM qiraat_entries e
   JOIN qiraat_loci l ON l.id = e.locus_id AND l.deleted_at IS NULL
   LEFT JOIN qiraat_variant_details vd ON vd.entry_id = e.id
   LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
  WHERE e.deleted_at IS NULL AND e.verification_status <> 'REJECTED';

CREATE TEMP TABLE dd AS
 SELECT DISTINCT ON (b.id) b.id AS drop_id, a.id AS keep_id
   FROM ent b
   JOIN ent a ON a.id <> b.id AND a.kind = b.kind AND a.s = b.s AND a.a = b.a AND a.w = b.w AND a.ea = b.ea AND a.ew = b.ew
             AND a.ns IS NOT NULL AND b.ns IS NOT NULL AND b.ns <@ a.ns
             AND ((b.kind = 'variant' AND a.rt = b.rt) OR (b.kind = 'ruling' AND a.cat = b.cat AND b.nsa <@ a.nsa))
  WHERE NOT b.human
    AND (cardinality(a.ns) > cardinality(b.ns)
         OR (a.rank1, a.flags > 0, a.dl, b.id) > (b.rank1, b.flags > 0, b.dl, a.id))   -- equal narrator sets: keep the better ranked
  ORDER BY b.id, a.rank1 DESC, (a.flags > 0) DESC, a.dl DESC, a.id;

SELECT 'to drop: ' || count(*) || ' (' || count(*) FILTER (WHERE e.kind = 'variant') || ' farsh, ' || count(*) FILTER (WHERE e.kind = 'ruling') || ' usul)'
  FROM dd JOIN ent e ON e.id = dd.drop_id;
-- a dropped entry must not be the only keeper of another dropped entry
SELECT 'chain check (keep also dropped, ok if its own keeper covers): ' || count(*) FROM dd x JOIN dd y ON y.drop_id = x.keep_id;

UPDATE qiraat_qa_flags f SET status = 'corrected', resolved_at = now(), resolved_note = 'سجل مكرر؛ أُزيل وبقي ' || dd.keep_id
  FROM dd WHERE f.entry_id = dd.drop_id AND f.status = 'open';
UPDATE qiraat_entries e SET deleted_at = now(), notes = concat_ws(E'\n', e.notes, '[حذف] مكرر تمامًا للسجل ' || dd.keep_id)
  FROM dd WHERE e.id = dd.drop_id AND e.deleted_at IS NULL;
UPDATE qiraat_loci l SET deleted_at = now()
 WHERE l.deleted_at IS NULL AND l.id IN (SELECT locus FROM ent JOIN dd ON dd.drop_id = ent.id)
   AND NOT EXISTS (SELECT 1 FROM qiraat_entries x WHERE x.locus_id = l.id AND x.deleted_at IS NULL AND x.verification_status <> 'REJECTED');
SELECT qiraat_review_sync_locus(l) FROM (SELECT DISTINCT locus AS l FROM ent JOIN dd ON dd.drop_id = ent.id) q;
COMMIT;
