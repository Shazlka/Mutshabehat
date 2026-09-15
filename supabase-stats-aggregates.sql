-- ============================================================
-- Dashboard stats — single aggregate RPC
-- Paste into Supabase → SQL Editor → Run (once).
-- ============================================================
-- Replaces ~11 separate queries + 4 full-table row transfers (verses.surah,
-- parts.type, group_tags, groups.updated_at) that the /stats page used to pull
-- and aggregate in JS. Everything is now aggregated in Postgres and returned as
-- one compact JSON payload.
--
-- SECURITY INVOKER + explicit `user_id = auth.uid()` anchor → a user only ever
-- sees their own rows (RLS policies also still apply).

create or replace function public.get_dashboard_stats()
returns jsonb
language sql
security invoker
stable
as $$
  with
  g  as (select * from public.groups where user_id = auth.uid()),
  v  as (select vv.* from public.verses vv join g on g.id = vv.group_id),
  p  as (select pp.* from public.parts pp join v on v.id = pp.verse_id),
  gt as (select x.*  from public.group_tags x join g on g.id = x.group_id)
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'groups',    (select count(*) from g),
      'verses',    (select count(*) from v),
      'parts',     (select count(*) from p),
      'favorites', (select count(*) from g where favorite),
      'completed', (select count(*) from g where completed),
      'locked',    (select count(*) from g where status = 'locked')
    ),
    -- verse count per surah (Arabic name → count)
    'surah_counts', coalesce(
      (select jsonb_object_agg(surah, c)
         from (select surah, count(*) c from v group by surah) s), '{}'::jsonb),
    -- parts grouped by type
    'parts_by_type', coalesce(
      (select jsonb_object_agg(type, c)
         from (select type, count(*) c from p group by type) t), '{}'::jsonb),
    -- tag usage, joined to tag name/color, sorted desc
    'tag_usage', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'id', t.id, 'name', t.name, 'color', t.color, 'count', u.cnt)
              order by u.cnt desc)
         from (select tag_id, count(*) cnt from gt group by tag_id) u
         join public.tags t on t.id = u.tag_id), '[]'::jsonb),
    -- groups updated per day, last 30 days (sparse — UI fills the gaps)
    'activity', coalesce(
      (select jsonb_agg(jsonb_build_object('date', d, 'count', c))
         from (select to_char(date_trunc('day', updated_at), 'YYYY-MM-DD') d, count(*) c
                 from g
                where updated_at >= (now() - interval '30 days')
                group by 1) a), '[]'::jsonb),
    -- distinct (surah, group) pairs — needed for the JS juz mapping
    'surah_groups', coalesce(
      (select jsonb_agg(jsonb_build_object('surah', surah, 'group_id', group_id))
         from (select distinct surah, group_id from v) sg), '[]'::jsonb)
  );
$$;

-- Allow authenticated users to call it
grant execute on function public.get_dashboard_stats() to authenticated;

-- ── Supporting indexes ───────────────────────────────────────
-- Speeds the home-page surah filter (verses.eq('surah', …)) and the RPC's
-- per-surah grouping / distinct(surah, group_id).
create index if not exists verses_surah_idx        on public.verses (surah);
create index if not exists verses_group_surah_idx  on public.verses (group_id, surah);
-- Speeds the default group list ordering (most-recent first, per user).
create index if not exists groups_user_created_idx on public.groups (user_id, created_at desc);
create index if not exists groups_user_updated_idx on public.groups (user_id, updated_at desc);
