-- Preview migration for Mushaf 1441 annotations.
-- (Originally marked to apply only to a Supabase preview/development branch).
--
-- STATUS (verified against production 2026-09-16): this table IS LIVE in the
-- self-hosted production database and is in active use — 14 rows, written
-- through src/app/api/mushaf-1441/annotations/route.ts. All 19 columns and
-- every CHECK constraint below match production exactly.
--
-- It reached production via the 2026-08-31 Supabase-Cloud -> self-host data
-- migration (schema reconstructed by introspection), NOT by running this file.
-- The file and production agree today; that is verified, not guaranteed by
-- construction.
--
-- The previous header here said "review and apply only to a preview/development
-- branch" and "Codex did not apply this migration to any live database". Both
-- were true when written and are now wrong; they caused a live, in-use table to
-- be classified as unapplied during iOS Phase 0 discovery. See
-- docs/ios/DISCOVERY.md section 8.3 and docs/ios/DECISIONS.md D-07.

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

grant select, insert, update, delete on public.mushaf_annotations to authenticated;
grant select, insert, update, delete on public.mushaf_annotations to service_role;

alter table public.mushaf_annotations enable row level security;

drop policy if exists "Users can read their own mushaf annotations"
  on public.mushaf_annotations;
create policy "Users can read their own mushaf annotations"
  on public.mushaf_annotations
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own mushaf annotations"
  on public.mushaf_annotations;
create policy "Users can insert their own mushaf annotations"
  on public.mushaf_annotations
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own mushaf annotations"
  on public.mushaf_annotations;
create policy "Users can update their own mushaf annotations"
  on public.mushaf_annotations
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own mushaf annotations"
  on public.mushaf_annotations;
create policy "Users can delete their own mushaf annotations"
  on public.mushaf_annotations
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
