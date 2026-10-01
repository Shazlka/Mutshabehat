-- ============================================================================
-- Review editor: learned suggestions from APPROVED (review_status = 'reviewed') entries.
--
-- qiraat_review_suggestions(surah, ayah, word, limit) answers: "for this word, what has the owner
-- already approved that could be added here in one click?" It never writes anything.
--
--   tier 'exact'   -- approved single-word entries on the same normalised word (qiraat_norm), anywhere
--                     in the Mushaf. Their full configuration is offered (reading text included).
--   tier 'pattern' -- approved single-word أصول (ruling) entries on words that END the same way
--                     (last 3 normalised letters). Only the rule itself is offered (category, ruling
--                     text, narrators/actions, wasl/waqf), never word-specific text or the
--                     word-position links inside hamzah details. Ranked by how consistently that
--                     word shape was approved with that configuration.
--
-- Identical configurations are grouped: `support` = how many approved entries share it. A
-- configuration that this locus already carries is left out. Nothing is auto-applied: the client
-- turns a chosen suggestion into an ordinary UNREVIEWED entry that still needs manual approval.
--
-- Additive only (two new functions). Rollback:
--   supabase/rollbacks/20260930120000_qiraat_review_suggestions.down.sql
-- ============================================================================

-- Comparable configuration of one entry. word_specific = true keeps reading text and the hamzah
-- detail; false drops them (pattern tier).
CREATE OR REPLACE FUNCTION qiraat_suggestion_config(p_entry_id text, p_word_specific boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (SELECT qiraat_review_row(p_entry_id) AS j)
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'kind', r.j->'kind',
    'categoryCode', r.j->'categoryCode',
    'categoryNameAr', r.j->'categoryNameAr',
    'variantType', r.j->'variantType',
    'rulingText', r.j->'rulingText',
    'description', CASE WHEN p_word_specific THEN r.j->'description' END,
    'performanceNote', CASE WHEN p_word_specific THEN r.j->'performanceNote' END,
    'readingText', CASE WHEN p_word_specific THEN r.j->'readingText' END,
    'uthmaniText', CASE WHEN p_word_specific THEN r.j->'uthmaniText' END,
    'appliesWasl', r.j->'appliesWasl',
    'appliesWaqf', r.j->'appliesWaqf',
    'hamzahDetail', CASE WHEN p_word_specific AND r.j->'hamzahDetail' <> 'null'::jsonb
                         THEN (r.j->'hamzahDetail') - 'wordKeys' END,
    'narrators', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                          'id', n->'id', 'nameAr', n->'nameAr', 'action', n->'action',
                          'wajhOrder', n->'wajhOrder', 'wajhNote', n->'wajhNote')
                        ORDER BY n->>'id', (n->>'wajhOrder')::int), '[]'::jsonb)
                    FROM jsonb_array_elements(r.j->'narrators') n)
  ))
  FROM r;
$$;

CREATE OR REPLACE FUNCTION qiraat_review_suggestions(
  p_surah integer, p_ayah integer, p_word integer, p_limit integer DEFAULT 8
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_text text; v_norm text; v_suffix text; v_result jsonb;
BEGIN
  PERFORM qiraat_require_editor();
  SELECT qw.text_uthmani INTO v_text
    FROM quran_words qw WHERE qw.surah = p_surah AND qw.ayah = p_ayah AND qw.word_position = p_word;
  IF v_text IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_norm := qiraat_norm(v_text);
  v_suffix := CASE WHEN char_length(v_norm) >= 4 THEN right(v_norm, 3) END;

  WITH approved AS (
    SELECT e.id AS entry_id, e.kind, e.updated_at,
           l.surah_number AS s, l.start_ayah AS a, l.start_word AS w,
           qiraat_norm(qw.text_uthmani) AS wnorm
      FROM qiraat_entries e
      JOIN qiraat_loci l ON l.id = e.locus_id
      JOIN quran_words qw ON qw.surah = l.surah_number AND qw.ayah = l.start_ayah AND qw.word_position = l.start_word
     WHERE e.deleted_at IS NULL AND l.deleted_at IS NULL
       AND e.review_status = 'reviewed' AND e.verification_status <> 'REJECTED'
       AND l.end_ayah = l.start_ayah AND coalesce(l.end_word, l.start_word) = l.start_word
       AND NOT (l.surah_number = p_surah AND l.start_ayah = p_ayah AND l.start_word = p_word)
  ),
  shape_total AS (
    SELECT count(*)::int AS n FROM approved
     WHERE v_suffix IS NOT NULL AND kind = 'ruling' AND right(wnorm, 3) = v_suffix
  ),
  candidates AS (
    SELECT entry_id, s, a, w, updated_at, 'exact'::text AS tier,
           qiraat_suggestion_config(entry_id, true) AS config
      FROM approved WHERE wnorm = v_norm
    UNION ALL
    SELECT entry_id, s, a, w, updated_at, 'pattern',
           qiraat_suggestion_config(entry_id, false)
      FROM approved
     WHERE v_suffix IS NOT NULL AND kind = 'ruling' AND wnorm <> v_norm AND right(wnorm, 3) = v_suffix
       AND (SELECT r.j->'hamzahDetail' FROM (SELECT qiraat_review_row(entry_id) AS j) r) = 'null'::jsonb
  ),
  here AS (  -- configurations this locus already carries, compared in both shapes
    SELECT qiraat_suggestion_config(e.id, true)::text AS c_exact, qiraat_suggestion_config(e.id, false)::text AS c_pattern
      FROM qiraat_entries e JOIN qiraat_loci l ON l.id = e.locus_id
     WHERE e.deleted_at IS NULL AND l.deleted_at IS NULL
       AND l.surah_number = p_surah AND l.start_ayah = p_ayah AND l.start_word = p_word
  ),
  grouped AS (
    SELECT tier, md5(config::text) AS sig, config, count(*)::int AS support,
           (array_agg(entry_id ORDER BY updated_at DESC))[1] AS source_entry_id,
           (array_agg(s || ':' || a || ':' || w ORDER BY updated_at DESC))[1:3] AS sources
      FROM candidates
     WHERE NOT EXISTS (SELECT 1 FROM here h WHERE h.c_exact = config::text OR h.c_pattern = config::text)
     GROUP BY tier, config
  ),
  best AS (  -- the same configuration found by both tiers is offered once, as 'exact'
    SELECT DISTINCT ON (sig) * FROM grouped ORDER BY sig, (tier = 'exact') DESC
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'key', b.sig, 'tier', b.tier, 'support', b.support,
           'shapeTotal', CASE WHEN b.tier = 'pattern' THEN (SELECT n FROM shape_total) END,
           'shape', CASE WHEN b.tier = 'pattern' THEN v_suffix END,
           'sourceEntryId', b.source_entry_id, 'sources', to_jsonb(b.sources), 'config', b.config)
         ORDER BY (b.tier = 'exact') DESC,
                  CASE WHEN b.tier = 'pattern' THEN b.support::numeric / greatest((SELECT n FROM shape_total), 1) ELSE 1 END DESC,
                  b.support DESC), '[]'::jsonb)
    INTO v_result
    FROM (SELECT * FROM best ORDER BY (tier = 'exact') DESC, support DESC LIMIT greatest(p_limit, 1)) b;

  RETURN coalesce(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION qiraat_suggestion_config(text, boolean), qiraat_review_suggestions(integer, integer, integer, integer)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
