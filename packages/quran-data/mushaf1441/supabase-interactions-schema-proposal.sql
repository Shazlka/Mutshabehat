-- PROPOSAL ONLY — DO NOT RUN FROM CODEX.
-- Supabase schema for Mushaf 1441 notes, highlights, bookmarks, and favorites.
-- This file is intentionally not applied to production by this preview phase.

create table if not exists public.mushaf_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  annotation_type text not null check (annotation_type in ('note', 'highlight', 'bookmark', 'favorite')),
  target_type text not null check (target_type in ('ayah', 'word', 'word-range')),
  ayah_key text not null check (ayah_key ~ '^[0-9]+:[0-9]+$'),
  page_number int not null check (page_number between 1 and 604),
  word_id text,
  line_number int check (line_number between 1 and 15),
  word_index_in_line int check (word_index_in_line is null or word_index_in_line >= 1),
  word_range_start_id text,
  word_range_end_id text,
  title text,
  body text,
  text_color text,
  background_color text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mushaf_annotations_target_shape_check check (
    (target_type <> 'word' or (
      word_id is not null
      and line_number is not null
      and word_index_in_line is not null
    ))
    and (target_type <> 'word-range' or (
      word_range_start_id is not null
      and word_range_end_id is not null
    ))
  )
);

create index if not exists mushaf_annotations_user_page_idx
  on public.mushaf_annotations (user_id, page_number, annotation_type);

create index if not exists mushaf_annotations_user_ayah_idx
  on public.mushaf_annotations (user_id, ayah_key, annotation_type);

create index if not exists mushaf_annotations_user_word_idx
  on public.mushaf_annotations (user_id, word_id)
  where word_id is not null;

-- Supabase Data API access is now explicit. The route only serves signed-in users,
-- so anon is intentionally not granted access to this table.
grant select, insert, update, delete on public.mushaf_annotations to authenticated;
grant select, insert, update, delete on public.mushaf_annotations to service_role;

alter table public.mushaf_annotations enable row level security;

create policy "Users can read their own mushaf annotations"
  on public.mushaf_annotations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own mushaf annotations"
  on public.mushaf_annotations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own mushaf annotations"
  on public.mushaf_annotations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own mushaf annotations"
  on public.mushaf_annotations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Optional after ayah_key migration is applied to public.verses:
-- create index if not exists verses_ayah_key_idx on public.verses (ayah_key);
