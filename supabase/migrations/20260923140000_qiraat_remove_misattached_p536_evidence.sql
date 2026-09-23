-- 20260923121000 copied the evidence link of the page-536 alif-substitution face
-- (locus ...fe7dd2d9) onto the hamza-easing face (locus ...ae204faa) while they were
-- wrongly treated as one face. 20260923130000 separated the faces again but left the
-- copied link, so the hamza-easing face still shows the other face's citation.
-- Remove only the copied link; the original link on the fe7dd2d9 locus is untouched.
DELETE FROM qiraat_evidence_links canonical_link
 USING qiraat_evidence_links source_link
 WHERE canonical_link.locus_id = 'AUDIT-P536-R03380-PERF-ae204faa-a58-t1'
   AND source_link.locus_id = 'AUDIT-P536-R03380-PERF-fe7dd2d9-a58-t1'
   AND canonical_link.evidence_text_id = source_link.evidence_text_id
   AND canonical_link.page_id = source_link.page_id;

NOTIFY pgrst, 'reload schema';
