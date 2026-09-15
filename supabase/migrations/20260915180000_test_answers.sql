-- Test-mode answer log for the statistics tab (2026-09-15).
-- One row per answered question. Idempotent; safe to re-run.

create table if not exists public.test_answers (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null check (source in ('personal', 'quran')),
  kind text not null check (kind in ('mcq', 'flash', 'words')),
  correct boolean not null,
  surah text,
  ayah integer,
  group_id uuid references public.groups(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists test_answers_user_created_idx
  on public.test_answers (user_id, created_at desc);

alter table public.test_answers enable row level security;

drop policy if exists test_answers_select on public.test_answers;
create policy test_answers_select on public.test_answers
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists test_answers_insert on public.test_answers;
create policy test_answers_insert on public.test_answers
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists test_answers_delete on public.test_answers;
create policy test_answers_delete on public.test_answers
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, delete on public.test_answers to authenticated;

-- Per-user totals for the stats page, grouped by source and kind.
create or replace function public.get_test_answer_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'correct', count(*) filter (where correct),
    'wrong', count(*) filter (where not correct),
    'by_kind', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'kind', kind, 'correct', c, 'wrong', w) order by source, kind)
      from (
        select source, kind, count(*) filter (where correct) as c, count(*) filter (where not correct) as w
        from public.test_answers where user_id = auth.uid()
        group by source, kind
      ) k
    ), '[]'::jsonb)
  )
  from public.test_answers
  where user_id = auth.uid();
$$;

grant execute on function public.get_test_answer_stats() to authenticated;

notify pgrst, 'reload schema';
