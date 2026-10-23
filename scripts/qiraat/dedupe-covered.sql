-- Soft-delete Qiraat entries that another live entry already covers (reversible: edit_log + deleted_at).
-- Run: psql -v ON_ERROR_STOP=1 -f dedupe-covered.sql   (dry run: replace the final COMMIT with ROLLBACK)
-- Run it again until it reports 0 to drop: an entry whose keeper was itself dropped waits for the next pass.
--
-- Entry B is covered by entry A when both are live, of the same kind, and
--   - A's word span contains B's span (the same span counts), and
--   - farsh: both have the same diacritized reading text; usul: both have the same category, and
--   - every narrator of B is also a narrator of A, and each of B's actions is A's action for that narrator
--     (or B's action is empty, or A's action contains it).
-- This catches what dedupe-exact.sql cannot: the automatic import wrote a one-word entry beside a person's
-- two-word entry («حنيفًا وما» + «وما», ترك الغنة, خلف).
-- Never dropped: an entry approved by a person in favour of an automatic one (a person's entry is dropped
-- only when the keeper is a person's entry too).
-- Not touched (needs a person): same word and category with a DIFFERENT action («إمالة» vs «تقليل», «إدغام الهاء
-- في الهاء» vs «إدغام كبير»), and the same reading assigned to partly overlapping narrators.
-- Keeper rank: person-approved > automatically approved > open flags > longer explanation > smaller id.
BEGIN;
SELECT set_config('app.device_id', 'dedupe-covered', true);

-- The farsh key is the exact diacritized reading text: qiraat_norm strips vowels and would equate «خَوْفَ» with «خَوْفٌ».
CREATE TEMP TABLE ent AS
 SELECT e.id, e.kind, e.review_status st, e.review_source rs, e.locus_id locus,
        l.surah_number s, l.start_ayah a, l.start_word w, coalesce(l.end_ayah, l.start_ayah) ea, coalesce(l.end_word, l.start_word) ew,
        coalesce(btrim(vd.reading_text), '') rt, coalesce(rd.category_code, '') cat,
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

CREATE TEMP TABLE catn AS SELECT code, qiraat_norm(name_ar) n FROM qiraat_categories;

CREATE TEMP TABLE dd AS
 SELECT DISTINCT ON (b.id) b.id AS drop_id, a.id AS keep_id,
        ((a.a, a.w) = (b.a, b.w) AND (a.ea, a.ew) = (b.ea, b.ew)) AS same_span,
        b.human AS drop_human, a.human AS keep_human, b.kind AS kind
   FROM ent b
   JOIN ent a ON a.id <> b.id AND a.kind = b.kind AND a.s = b.s
             AND (a.a, a.w) <= (b.a, b.w) AND (a.ea, a.ew) >= (b.ea, b.ew)
             AND ((b.kind = 'variant' AND a.rt = b.rt) OR (b.kind = 'ruling' AND a.cat = b.cat))
  WHERE a.ns IS NOT NULL AND b.ns IS NOT NULL AND b.ns <@ a.ns
    AND (b.nsa <@ a.nsa
         OR NOT EXISTS (
              SELECT 1 FROM qiraat_entry_authorities bu
               WHERE bu.entry_id = b.id AND bu.deleted_at IS NULL
                 AND NOT EXISTS (
                      SELECT 1 FROM qiraat_entry_authorities ax
                       WHERE ax.entry_id = a.id AND ax.deleted_at IS NULL AND ax.authority_id = bu.authority_id
                         AND (qiraat_norm(coalesce(bu.action_ar, '')) = ''
                              OR qiraat_norm(coalesce(ax.action_ar, '')) LIKE '%' || qiraat_norm(bu.action_ar) || '%'
                              OR qiraat_norm(coalesce(bu.action_ar, '')) = (SELECT n FROM catn WHERE code = b.cat)))))
    AND (NOT b.human OR a.human)
    -- the same span can cover each other: keep exactly one, the better ranked (or the one with more narrators)
    AND (NOT ((a.a, a.w) = (b.a, b.w) AND (a.ea, a.ew) = (b.ea, b.ew))
         OR cardinality(a.ns) > cardinality(b.ns)
         OR (a.rank1, a.flags > 0, a.dl, b.id) > (b.rank1, b.flags > 0, b.dl, a.id))
  ORDER BY b.id, a.human DESC, a.rank1 DESC, (a.flags > 0) DESC, a.dl DESC, a.id;

-- a keeper that is itself dropped leaves its entries for the next pass
DELETE FROM dd WHERE keep_id IN (SELECT drop_id FROM dd);

SELECT 'to drop: ' || count(*) || ' (' || count(*) FILTER (WHERE kind = 'variant') || ' farsh, ' || count(*) FILTER (WHERE kind = 'ruling') || ' usul; '
       || count(*) FILTER (WHERE same_span) || ' same span, ' || count(*) FILTER (WHERE drop_human) || ' person-approved with a person-approved keeper)' AS summary
  FROM dd;

UPDATE qiraat_qa_flags f SET status = 'corrected', resolved_at = now(), resolved_note = 'سجل مكرر؛ يغطيه ' || dd.keep_id
  FROM dd WHERE f.entry_id = dd.drop_id AND f.status = 'open';
UPDATE qiraat_entries e SET deleted_at = now(), notes = concat_ws(E'\n', e.notes, '[حذف] يغطيه السجل ' || dd.keep_id)
  FROM dd WHERE e.id = dd.drop_id AND e.deleted_at IS NULL;
UPDATE qiraat_loci l SET deleted_at = now()
 WHERE l.deleted_at IS NULL AND l.id IN (SELECT locus FROM ent JOIN dd ON dd.drop_id = ent.id)
   AND NOT EXISTS (SELECT 1 FROM qiraat_entries x WHERE x.locus_id = l.id AND x.deleted_at IS NULL AND x.verification_status <> 'REJECTED');
SELECT qiraat_review_sync_locus(l) FROM (SELECT DISTINCT locus AS l FROM ent JOIN dd ON dd.drop_id = ent.id) q;

-- the list, for the report
SELECT dd.drop_id, dd.keep_id, dd.kind, dd.same_span, dd.drop_human FROM dd ORDER BY dd.kind, dd.drop_id;
COMMIT;
