-- ############################################################################
-- ##  Core app schema baseline — consolidates the root-level supabase-*.sql
-- ##  files that were historically pasted by hand into Supabase Studio's SQL
-- ##  Editor, into one real, git-tracked migration.
-- ##
-- ##  Why this exists: `supabase/migrations/` never contained the base
-- ##  groups/verses/parts/tags schema at all — only feature-specific
-- ##  migrations layered ON TOP of it (mushaf_annotations, hifz_quiz, the
-- ##  Qiraat V2 schema, this bulk-import staging schema...). Bootstrapping a
-- ##  FRESH local stack with `supabase start` (which applies every file in
-- ##  this folder, in filename order) therefore created every later
-- ##  migration's tables successfully but left `public.groups` — which
-- ##  `src/app/(app)/layout.tsx` queries on every request — missing
-- ##  entirely. Discovered and fixed while verifying the bulk Qiraat Excel
-- ##  import system on a MacBook Air, independent of the self-hosted
-- ##  production Mac Mini (which already has all six source files applied
-- ##  by hand and is UNCHANGED by this file's existence).
-- ##
-- ##  This file is a byte-for-byte concatenation of, in dependency order:
-- ##    1. supabase-schema.sql — Base app schema — groups, verses, parts, tags, group_tags, RLS
-- ##    2. supabase-schema-automated.sql — Automated similarity candidates (read-only, shared)
-- ##    3. supabase-parts-fts.sql — Search upgrade: Uthmani rasm tolerance (Tier 1 + Tier 2), enables pg_trgm
-- ##    4. supabase-indexes.sql — Full indexing pass (depends on pg_trgm from parts-fts.sql above)
-- ##    5. supabase-migration-tag-uniqueness.sql — Case-insensitive unique constraint on tags per user
-- ##    6. supabase-stats-aggregates.sql — Dashboard stats aggregate RPC + supporting indexes
-- ##
-- ##  Ordering note: supabase-indexes.sql's own comment says "pg_trgm is
-- ##  already enabled (supabase-parts-fts.sql)" — so parts-fts.sql (which
-- ##  runs `create extension if not exists pg_trgm`) must apply BEFORE
-- ##  indexes.sql's trigram indexes, even though the historical filenames
-- ##  don't sort that way. This file fixes that ordering permanently.
-- ##
-- ##  Nothing below was rewritten — each section is exactly its source
-- ##  file's content, so this migration behaves identically to running the
-- ##  six files by hand in this order. supabase-schema.sql is NOT fully
-- ##  idempotent (plain `create table`/`create policy`, no IF NOT EXISTS)
-- ##  by original design — it was authored to run exactly once against a
-- ##  brand-new project, which is exactly what a fresh `supabase start` /
-- ##  `supabase db reset` does. Do not re-run this file against a database
-- ##  that already has these tables.
-- ############################################################################


-- ============================================================================
-- SOURCE: supabase-schema.sql
-- ============================================================================

-- ============================================================
-- Mutshabehat V2 — Database Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Groups ───────────────────────────────────────────────────
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  color       text not null default '#55b94f',
  note        text,
  unote       text,
  status      text not null default 'draft' check (status in ('draft','published','locked')),
  favorite    boolean not null default false,
  completed   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  search_vec  tsvector
);

-- ── Verses ───────────────────────────────────────────────────
create table public.verses (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid references public.groups(id) on delete cascade not null,
  surah       text not null,
  ayah        int  not null,
  label       text,
  sort_order  int  not null default 0
);

-- ── Parts ────────────────────────────────────────────────────
create table public.parts (
  id          uuid primary key default gen_random_uuid(),
  verse_id    uuid references public.verses(id) on delete cascade not null,
  type        text not null default 'shared'
                check (type in ('shared','diff','diff2','diff3','addition','unique','normal')),
  text        text not null,
  sort_order  int  not null default 0
);

-- ── Tags ─────────────────────────────────────────────────────
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  color       text
);

create table public.group_tags (
  group_id    uuid references public.groups(id) on delete cascade,
  tag_id      uuid references public.tags(id)   on delete cascade,
  primary key (group_id, tag_id)
);

-- ── Indexes ──────────────────────────────────────────────────
create index groups_user_id_idx    on public.groups(user_id);
create index groups_search_vec_idx on public.groups using gin(search_vec);
create index verses_group_id_idx   on public.verses(group_id);
create index parts_verse_id_idx    on public.parts(verse_id);
create index tags_user_id_idx      on public.tags(user_id);

-- ── Auto-update updated_at ────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger groups_updated_at
  before update on public.groups
  for each row execute procedure public.handle_updated_at();

-- ── Full-text search: auto-update search_vec on title change ─
create or replace function public.groups_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vec := to_tsvector('simple', coalesce(new.title, ''));
  return new;
end;
$$;

create trigger groups_search_vec_update
  before insert or update of title on public.groups
  for each row execute procedure public.groups_search_update();

-- ── Row Level Security ────────────────────────────────────────
alter table public.groups     enable row level security;
alter table public.verses     enable row level security;
alter table public.parts      enable row level security;
alter table public.tags       enable row level security;
alter table public.group_tags enable row level security;

-- Groups: users only see/edit their own
create policy "groups_select" on public.groups for select using (auth.uid() = user_id);
create policy "groups_insert" on public.groups for insert with check (auth.uid() = user_id);
create policy "groups_update" on public.groups for update using (auth.uid() = user_id);
create policy "groups_delete" on public.groups for delete using (auth.uid() = user_id);

-- Verses: accessible if user owns the parent group
create policy "verses_select" on public.verses for select
  using (exists (select 1 from public.groups g where g.id = group_id and g.user_id = auth.uid()));
create policy "verses_insert" on public.verses for insert
  with check (exists (select 1 from public.groups g where g.id = group_id and g.user_id = auth.uid()));
create policy "verses_update" on public.verses for update
  using (exists (select 1 from public.groups g where g.id = group_id and g.user_id = auth.uid()));
create policy "verses_delete" on public.verses for delete
  using (exists (select 1 from public.groups g where g.id = group_id and g.user_id = auth.uid()));

-- Parts: accessible if user owns the grandparent group
create policy "parts_select" on public.parts for select
  using (exists (
    select 1 from public.verses v
    join public.groups g on g.id = v.group_id
    where v.id = verse_id and g.user_id = auth.uid()
  ));
create policy "parts_insert" on public.parts for insert
  with check (exists (
    select 1 from public.verses v
    join public.groups g on g.id = v.group_id
    where v.id = verse_id and g.user_id = auth.uid()
  ));
create policy "parts_update" on public.parts for update
  using (exists (
    select 1 from public.verses v
    join public.groups g on g.id = v.group_id
    where v.id = verse_id and g.user_id = auth.uid()
  ));
create policy "parts_delete" on public.parts for delete
  using (exists (
    select 1 from public.verses v
    join public.groups g on g.id = v.group_id
    where v.id = verse_id and g.user_id = auth.uid()
  ));

-- Tags
create policy "tags_select" on public.tags for select using (auth.uid() = user_id);
create policy "tags_insert" on public.tags for insert with check (auth.uid() = user_id);
create policy "tags_update" on public.tags for update using (auth.uid() = user_id);
create policy "tags_delete" on public.tags for delete using (auth.uid() = user_id);

-- Group tags
create policy "group_tags_select" on public.group_tags for select
  using (exists (select 1 from public.groups g where g.id = group_id and g.user_id = auth.uid()));
create policy "group_tags_insert" on public.group_tags for insert
  with check (exists (select 1 from public.groups g where g.id = group_id and g.user_id = auth.uid()));
create policy "group_tags_delete" on public.group_tags for delete
  using (exists (select 1 from public.groups g where g.id = group_id and g.user_id = auth.uid()));


-- ============================================================================
-- SOURCE: supabase-schema-automated.sql
-- ============================================================================

-- ============================================================
-- Automated similarity candidates (read-only, shared across users)
-- ============================================================
-- These come from the old Mini's 114 surah-NNN.js files.
-- Anyone can SELECT; only the service role can INSERT/UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS automated_groups (
  id           bigserial PRIMARY KEY,
  legacy_id    text,                 -- original numeric id from automated-data.js
  title        text NOT NULL,
  color        text DEFAULT '#888',
  surahs       text[] DEFAULT '{}',
  payload      jsonb NOT NULL,        -- full { verses, note, unote, etc. } blob
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automated_groups_legacy_idx ON automated_groups (legacy_id);
CREATE INDEX IF NOT EXISTS automated_groups_surahs_idx ON automated_groups USING GIN (surahs);

-- RLS: everyone reads, nobody writes (only service role via migration)
ALTER TABLE automated_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automated_groups_read_all" ON automated_groups;
CREATE POLICY "automated_groups_read_all" ON automated_groups
  FOR SELECT USING (true);


-- ============================================================================
-- SOURCE: supabase-parts-fts.sql
-- ============================================================================

-- ── Search upgrade: Uthmani rasm tolerance (Tier 1 + Tier 2) ──────────────────
-- Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: every column is dropped & re-added, every function is OR REPLACE.
--
-- Tier 1  — normalize the Uthmani dagger alef (ٰ U+0670) to a real ا so the mushaf
--           spelling (عَٰلَمِينَ, ٱلرَّحۡمَٰنِ) matches what users type (عالمين, الرحمن).
-- Tier 2  — a "rasm skeleton" (long alef removed) + trigram index, so plene/defective
--           variants collapse to the same key (السماوات ↔ السموات, عاكفين ↔ عكفين).

-- pg_trgm powers the gin_trgm_ops indexes used for ILIKE on the skeleton columns.
create extension if not exists pg_trgm;

-- ── normalize_arabic(): SQL mirror of TypeScript normalizeArabic() ─────────────
--   * dagger alef (U+0670) → ا   (done first, before tashkeel stripping)
--   * strip tashkeel + Quranic annotations  [U+064B–U+0670, U+06D6–U+06ED]
--   * fold alef variants → ا, ى → ي, ة → ه, ؤ → و, ئ → ي
--   * remove tatweel (ـ)
create or replace function public.normalize_arabic(input text)
returns text language sql immutable strict parallel safe as $$
  select trim(
    replace(
      translate(
        regexp_replace(
          -- dagger alef → ا FIRST, so it survives the tashkeel strip as a real letter
          replace(coalesce(input, ''), chr(1648), 'ا'),
          '[ً-ٰۖ-ۭ]',
          '',
          'g'
        ),
        'إأآٱىةؤئ',   -- from
        'اااايهوي'    -- to
      ),
      'ـ', ''          -- remove tatweel
    )
  )
$$;

-- ── rasm_skeleton(): aggressive fuzzy key — drop the long alef entirely ────────
-- Only ا is removed (the overwhelmingly common Uthmani variation); و/ي are kept
-- to avoid over-merging unrelated words.
create or replace function public.rasm_skeleton(input text)
returns text language sql immutable strict parallel safe as $$
  select replace(public.normalize_arabic(input), 'ا', '')
$$;

-- ── parts.search_vec — rebuild so it picks up the new normalize_arabic() ───────
-- (A STORED generated column is NOT recomputed when its function body changes,
--  so we drop & re-add it; ADD backfills every existing row automatically.)
alter table public.parts drop column if exists search_vec;
alter table public.parts
  add column search_vec tsvector
  generated always as (to_tsvector('simple', public.normalize_arabic(text))) stored;
create index if not exists parts_search_vec_idx
  on public.parts using gin(search_vec);

-- ── parts.rasm_skeleton (Tier 2) ──────────────────────────────────────────────
alter table public.parts drop column if exists rasm_skeleton;
alter table public.parts
  add column rasm_skeleton text
  generated always as (public.rasm_skeleton(text)) stored;
create index if not exists parts_rasm_skeleton_idx
  on public.parts using gin(rasm_skeleton gin_trgm_ops);

-- ── groups.search_vec — Tier 1: normalize titles too (was plain to_tsvector) ──
create or replace function public.groups_search_update()
returns trigger language plpgsql as $$
begin
  new.search_vec := to_tsvector('simple', public.normalize_arabic(coalesce(new.title, '')));
  return new;
end;
$$;

-- Backfill existing groups without bumping updated_at (disable that trigger only).
alter table public.groups disable trigger groups_updated_at;
update public.groups
  set search_vec = to_tsvector('simple', public.normalize_arabic(coalesce(title, '')));
alter table public.groups enable trigger groups_updated_at;

-- ── groups.rasm_skeleton (Tier 2) ─────────────────────────────────────────────
alter table public.groups drop column if exists rasm_skeleton;
alter table public.groups
  add column rasm_skeleton text
  generated always as (public.rasm_skeleton(title)) stored;
create index if not exists groups_rasm_skeleton_idx
  on public.groups using gin(rasm_skeleton gin_trgm_ops);


-- ============================================================================
-- SOURCE: supabase-indexes.sql
-- ============================================================================

-- ============================================================
-- Mutshabehat V2 — Full indexing pass
-- Idempotent: every statement uses IF NOT EXISTS / OR REPLACE.
-- Paste into Supabase → SQL Editor → Run once.
-- ============================================================

-- ── 1. surah_counts view ─────────────────────────────────────
-- The main listing page calls supabase.from('surah_counts') to power
-- the SurahFilter sidebar (shows verse counts per surah for the current user).
-- security_invoker = on is REQUIRED: the view is owned by the postgres
-- superuser, which would bypass RLS without it. With security_invoker, the
-- view runs with the caller's identity so the RLS policy on verses
-- (group_id → groups.user_id = auth.uid()) applies correctly.
CREATE OR REPLACE VIEW public.surah_counts
  WITH (security_invoker = on) AS
  SELECT
    surah,
    COUNT(DISTINCT group_id)::bigint AS cnt
  FROM public.verses
  GROUP BY surah;

GRANT SELECT ON public.surah_counts TO authenticated;

-- ── 2. pg_trgm ILIKE indexes ──────────────────────────────────
-- The search cascade falls back to .ilike('title', '%...%') and
-- .ilike('text', '%...%') when FTS returns nothing. Without gin_trgm_ops
-- indexes these are sequential scans on every user's rows.
-- pg_trgm is already enabled (supabase-parts-fts.sql).
CREATE INDEX IF NOT EXISTS groups_title_trgm_idx
  ON public.groups USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS parts_text_trgm_idx
  ON public.parts USING gin (text gin_trgm_ops);

-- ── 3. Title sort index ───────────────────────────────────────
-- ?sort=title calls .order('title', { ascending: true }) scoped to user.
-- Without (user_id, title), Postgres fetches via user_id index then sorts
-- the entire user's groups in memory. This delivers them pre-sorted.
CREATE INDEX IF NOT EXISTS groups_user_title_idx
  ON public.groups (user_id, title);

-- ── 4. sort_order composite indexes ──────────────────────────
-- Every group view/edit page fetches:
--   verses WHERE group_id = ? ORDER BY sort_order
--   parts  WHERE verse_id IN (…) ORDER BY sort_order
-- The existing (group_id) and (verse_id) indexes cover the filter but
-- leave an in-memory sort step. Composites deliver pre-sorted rows.
CREATE INDEX IF NOT EXISTS verses_group_sort_idx
  ON public.verses (group_id, sort_order);

CREATE INDEX IF NOT EXISTS parts_verse_sort_idx
  ON public.parts (verse_id, sort_order);

-- ── 5. group_tags reverse lookup ─────────────────────────────
-- PK (group_id, tag_id) covers WHERE group_id = ? but not WHERE tag_id = ?.
-- The get_dashboard_stats() RPC joins group_tags → tags on tag_id; this
-- index keeps that join fast as tag and group counts grow.
CREATE INDEX IF NOT EXISTS group_tags_tag_id_idx
  ON public.group_tags (tag_id);

-- ── 6. Boolean filter partial indexes ────────────────────────
-- ?filter=favorite and ?filter=completed only match the true rows.
-- Partial indexes store only those rows — very compact, very fast.
CREATE INDEX IF NOT EXISTS groups_user_favorite_idx
  ON public.groups (user_id) WHERE favorite = true;

CREATE INDEX IF NOT EXISTS groups_user_completed_idx
  ON public.groups (user_id) WHERE completed = true;

-- ── 7. Status filter index ────────────────────────────────────
-- ?filter=draft and ?filter=locked narrow by status per user.
CREATE INDEX IF NOT EXISTS groups_user_status_idx
  ON public.groups (user_id, status);


-- ============================================================================
-- SOURCE: supabase-migration-tag-uniqueness.sql
-- ============================================================================

-- Run this once in Supabase SQL Editor.
-- Adds a case-insensitive unique constraint on tags per user.
-- Existing duplicates (if any) must be resolved before running.

create unique index if not exists tags_user_name_unique
  on public.tags (user_id, lower(name));


-- ============================================================================
-- SOURCE: supabase-stats-aggregates.sql
-- ============================================================================

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

