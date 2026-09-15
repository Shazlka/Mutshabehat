-- PROPOSAL ONLY — DO NOT RUN.
-- Future schema idea for storing Mushaf Al-Madinah 1441 ayah notes in Supabase.
-- Phase 3 stores notes in browser localStorage only and does not modify production DB.

-- create table public.mushaf_ayah_notes (
--   id uuid primary key default gen_random_uuid(),
--   user_id uuid not null references auth.users(id) on delete cascade,
--   ayah_key text not null check (ayah_key ~ '^[0-9]+:[0-9]+$'),
--   title text,
--   body text not null,
--   tags text[] not null default '{}',
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now()
-- );

-- create index mushaf_ayah_notes_user_ayah_idx
--   on public.mushaf_ayah_notes (user_id, ayah_key, updated_at desc);

-- alter table public.mushaf_ayah_notes enable row level security;

-- create policy "mushaf_ayah_notes_select"
--   on public.mushaf_ayah_notes
--   for select
--   to authenticated
--   using ((select auth.uid()) = user_id);

-- create policy "mushaf_ayah_notes_insert"
--   on public.mushaf_ayah_notes
--   for insert
--   to authenticated
--   with check ((select auth.uid()) = user_id);

-- create policy "mushaf_ayah_notes_update"
--   on public.mushaf_ayah_notes
--   for update
--   to authenticated
--   using ((select auth.uid()) = user_id)
--   with check ((select auth.uid()) = user_id);

-- create policy "mushaf_ayah_notes_delete"
--   on public.mushaf_ayah_notes
--   for delete
--   to authenticated
--   using ((select auth.uid()) = user_id);
