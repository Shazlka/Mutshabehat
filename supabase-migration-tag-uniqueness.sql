-- Run this once in Supabase SQL Editor.
-- Adds a case-insensitive unique constraint on tags per user.
-- Existing duplicates (if any) must be resolved before running.

create unique index if not exists tags_user_name_unique
  on public.tags (user_id, lower(name));
