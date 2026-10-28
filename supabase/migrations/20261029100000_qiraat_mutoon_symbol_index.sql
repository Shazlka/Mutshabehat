-- متون editor: the index of reader/narrator symbols (رموز القراء). Read-only: for a poem, each symbol that is marked
-- in it, how many times (and how many are verified) and the first verses it stands in. No table changes.
CREATE OR REPLACE FUNCTION public.qiraat_mutoon_symbol_index(p_work text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('symbol', s.symbol, 'count', s.n, 'verified', s.verified, 'verses', s.verses) ORDER BY s.symbol), '[]'::jsonb)
  FROM (
    SELECT m.symbol, count(*) AS n, count(*) FILTER (WHERE m.status = 'verified') AS verified,
           (SELECT coalesce(jsonb_agg(d.verse ORDER BY d.verse), '[]'::jsonb)
              FROM (SELECT DISTINCT m2.verse FROM public.qiraat_mutoon_marks m2 WHERE m2.work = p_work AND m2.symbol = m.symbol ORDER BY m2.verse LIMIT 40) d) AS verses
    FROM public.qiraat_mutoon_marks m
    WHERE m.work = p_work
    GROUP BY m.symbol
  ) s
$$;
REVOKE ALL ON FUNCTION public.qiraat_mutoon_symbol_index(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qiraat_mutoon_symbol_index(text) TO service_role;
NOTIFY pgrst, 'reload schema';
