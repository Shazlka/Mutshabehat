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
