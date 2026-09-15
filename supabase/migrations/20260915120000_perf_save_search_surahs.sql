-- Performance + Surah tab support (2026-09-15). Idempotent; safe to re-run.
-- All functions are SECURITY INVOKER, so RLS (auth.uid() = user_id) still applies.

-- ── save_group: whole editor save in ONE round-trip ───────────────────────────
-- Replaces: ownership select + update + delete verses + insert verses + insert parts.
-- p_fields: any of title,color,note,unote,status,favorite,completed (only present keys change).
-- p_verses: null = leave verses untouched; array = replace all verses + parts.
create or replace function public.save_group(p_group_id uuid, p_fields jsonb default '{}'::jsonb, p_verses jsonb default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_verse jsonb;
  v_ord   int;
  v_id    uuid;
begin
  if not exists (select 1 from groups where id = p_group_id and user_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_fields is not null and p_fields <> '{}'::jsonb then
    update groups set
      title     = coalesce(p_fields->>'title', title),
      color     = coalesce(p_fields->>'color', color),
      status    = coalesce(p_fields->>'status', status),
      favorite  = coalesce((p_fields->>'favorite')::boolean, favorite),
      completed = coalesce((p_fields->>'completed')::boolean, completed),
      note      = case when p_fields ? 'note'  then p_fields->>'note'  else note  end,
      unote     = case when p_fields ? 'unote' then p_fields->>'unote' else unote end
    where id = p_group_id;
  end if;

  if p_verses is not null and jsonb_typeof(p_verses) = 'array' then
    delete from verses where group_id = p_group_id;   -- cascades to parts

    for v_verse, v_ord in
      select e.value, (e.ord - 1)::int from jsonb_array_elements(p_verses) with ordinality as e(value, ord)
    loop
      insert into verses (group_id, surah, ayah, label, sort_order)
      values (
        p_group_id,
        coalesce(v_verse->>'surah', ''),
        coalesce(nullif(v_verse->>'ayah', '')::int, 1),
        v_verse->>'label',
        v_ord
      )
      returning id into v_id;

      insert into parts (verse_id, type, text, sort_order)
      select v_id,
             coalesce(nullif(pt.part->>'type', ''), 'normal'),
             coalesce(pt.part->>'text', ''),
             (pt.ord - 1)::int
      from jsonb_array_elements(coalesce(v_verse->'parts', '[]'::jsonb)) with ordinality as pt(part, ord);
    end loop;

    -- touch updated_at even when only verses changed
    update groups set updated_at = now() where id = p_group_id;
  end if;
end;
$$;

grant execute on function public.save_group(uuid, jsonb, jsonb) to authenticated;

-- ── search_group_ids: title + part-text search in ONE round-trip ──────────────
-- FTS on search_vec first; ILIKE fallback only when FTS finds nothing.
create or replace function public.search_group_ids(p_q text)
returns uuid[]
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_ids uuid[];
  v_tsq tsquery;
begin
  if p_q is null or btrim(p_q) = '' then
    return '{}'::uuid[];
  end if;

  if length(p_q) >= 2 then
    v_tsq := websearch_to_tsquery('simple', p_q);
    select array_agg(distinct s.id) into v_ids from (
      (select g.id from groups g where g.search_vec @@ v_tsq limit 300)
      union all
      (select v.group_id from parts pa join verses v on v.id = pa.verse_id where pa.search_vec @@ v_tsq limit 300)
    ) s;
  end if;

  if v_ids is null then
    select array_agg(distinct s.id) into v_ids from (
      (select g.id from groups g where g.title ilike '%' || p_q || '%' limit 300)
      union all
      (select v.group_id from parts pa join verses v on v.id = pa.verse_id where pa.text ilike '%' || p_q || '%' limit 300)
    ) s;
  end if;

  return coalesce(v_ids, '{}'::uuid[]);
end;
$$;

grant execute on function public.search_group_ids(text) to authenticated;

-- ── automated_surah_counts: automated candidates per surah (Surah tab) ────────
create or replace view public.automated_surah_counts
with (security_invoker = true) as
  select s.surah, count(*)::int as cnt
  from automated_groups a
  cross join lateral unnest(a.surahs) as s(surah)
  group by s.surah;

grant select on public.automated_surah_counts to anon, authenticated;

-- ── Faster automated title filter (ILIKE '%q%') ───────────────────────────────
create extension if not exists pg_trgm;
create index if not exists automated_groups_title_trgm_idx
  on public.automated_groups using gin (title gin_trgm_ops);

notify pgrst, 'reload schema';
