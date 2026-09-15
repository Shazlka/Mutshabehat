-- Track which automated candidate a personal group was copied from (2026-09-15).
-- Idempotent; safe to re-run.

alter table public.groups
  add column if not exists source_automated_id bigint
  references public.automated_groups(id) on delete set null;

create index if not exists groups_source_automated_idx
  on public.groups (user_id, source_automated_id)
  where source_automated_id is not null;

-- Backfill earlier copies: the copy route kept the automated title verbatim.
-- If several automated rows share a title, link the lowest id.
update public.groups g
set source_automated_id = m.automated_id
from (
  select distinct on (g2.id) g2.id as group_id, a.id as automated_id
  from public.groups g2
  join public.automated_groups a on a.title = g2.title
  where g2.source_automated_id is null
  order by g2.id, a.id
) m
where g.id = m.group_id;

-- Automated candidates with a per-user "copied" flag (RLS on groups scopes it to auth.uid()).
create or replace view public.automated_groups_with_copy
with (security_invoker = true) as
  select
    a.id, a.legacy_id, a.title, a.color, a.surahs, a.payload, a.created_at,
    exists (
      select 1 from public.groups g
      where g.source_automated_id = a.id and g.user_id = auth.uid()
    ) as copied
  from public.automated_groups a;

grant select on public.automated_groups_with_copy to anon, authenticated;

notify pgrst, 'reload schema';
