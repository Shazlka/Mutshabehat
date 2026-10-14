-- Gate for every import/approval batch. Read-only. Prints one line per check; the orchestrator compares before/after.
SELECT 'quran_words_checksum ' || md5(string_agg(canonical_key || text_uthmani, '|' ORDER BY canonical_key)) FROM quran_words;
SELECT 'entries_live ' || count(*) FROM qiraat_entries WHERE deleted_at IS NULL;
SELECT 'status ' || kind || ' ' || review_status || ' ' || coalesce(review_source, 'human/none') || ' ' || count(*)
  FROM qiraat_entries WHERE deleted_at IS NULL GROUP BY kind, review_status, review_source ORDER BY 1;
SELECT 'human_approved_fingerprint ' || md5(coalesce(string_agg(id || ':' || to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'), '|' ORDER BY id COLLATE "C"), ''))
  FROM qiraat_entries WHERE deleted_at IS NULL AND review_status = 'reviewed' AND review_source IS NULL;
SELECT 'violations ' || count(*) FROM qiraat_qa_phase2_violations;
SELECT 'farsh_without_variant_type ' || count(*) FROM qiraat_entries e LEFT JOIN qiraat_variant_details vd ON vd.entry_id = e.id
  WHERE e.deleted_at IS NULL AND e.kind = 'variant' AND (vd.entry_id IS NULL OR vd.variant_type IS NULL);
SELECT 'usul_without_category ' || count(*) FROM qiraat_entries e LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
  WHERE e.deleted_at IS NULL AND e.kind = 'ruling' AND (rd.entry_id IS NULL OR rd.category_code IS NULL);
SELECT 'entries_without_narrators ' || count(*) FROM qiraat_entries e
  WHERE e.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM qiraat_entry_authorities a WHERE a.entry_id = e.id AND a.deleted_at IS NULL);
SELECT 'empty_explanation_variants ' || count(*) FROM qiraat_entries e JOIN qiraat_variant_details vd ON vd.entry_id = e.id
  WHERE e.deleted_at IS NULL AND btrim(coalesce(vd.description_ar, '')) = '';
SELECT 'empty_explanation_rulings ' || count(*) FROM qiraat_entries e JOIN qiraat_ruling_details rd ON rd.entry_id = e.id
  WHERE e.deleted_at IS NULL AND btrim(coalesce(rd.text_ar, '')) = ''
    AND NOT EXISTS (SELECT 1 FROM qiraat_entry_authorities a WHERE a.entry_id = e.id AND a.deleted_at IS NULL AND btrim(coalesce(a.action_ar, '')) <> '');
