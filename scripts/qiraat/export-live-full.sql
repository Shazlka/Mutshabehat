-- Full read-only export of every live entry with the fields the importers need (one JSON array).
--   psql ... -tA -f scripts/qiraat/export-live-full.sql > artifacts/live-all.json
SELECT coalesce(json_agg(x ORDER BY x.page, x.surah, x.ayah, x.word, x.id), '[]'::json) FROM (
  SELECT e.id, e.kind::text AS kind, e.review_status::text AS status, e.review_source, e.device_id,
         e.verification_status::text AS verification, e.updated_at,
         p.mushaf_page_number AS page, l.id AS locus_id, l.surah_number AS surah, l.start_ayah AS ayah,
         l.start_word AS word, l.end_ayah, l.end_word, l.base_text,
         vd.reading_text, vd.uthmani_text, vd.description_ar, vd.performance_note, vd.variant_type::text AS variant_type,
         rd.category_code, rd.text_ar AS ruling_text, rd.options,
         e.applies_wasl, e.applies_waqf, e.hamzah_detail,
         (SELECT coalesce(json_agg(json_build_object('id', a.authority_id, 'action', a.action_ar, 'condition', a.condition_ar,
                 'wajh', a.wajh_order, 'wajh_note', a.wajh_note) ORDER BY a.authority_id, a.wajh_order), '[]'::json)
            FROM qiraat_entry_authorities a WHERE a.entry_id = e.id AND a.deleted_at IS NULL) AS authorities
  FROM qiraat_entries e
  JOIN qiraat_loci l ON l.id = e.locus_id AND l.deleted_at IS NULL
  JOIN qiraat_pages p ON p.id = e.page_id
  LEFT JOIN qiraat_variant_details vd ON vd.entry_id = e.id AND vd.deleted_at IS NULL
  LEFT JOIN qiraat_ruling_details rd ON rd.entry_id = e.id AND rd.deleted_at IS NULL
  WHERE e.deleted_at IS NULL
) x;
