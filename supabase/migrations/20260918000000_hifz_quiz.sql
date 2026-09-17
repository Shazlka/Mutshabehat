-- Hifz training: additive schema. Apply transactionally; legacy test_answers stays intact.
-- Answer keys are server-only. Browser roles cannot read questions or write scores.
create table if not exists public.quiz_sessions (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 settings jsonb not null check (jsonb_typeof(settings) = 'object'),
 random_seed text not null, daily_date date,
 question_count integer not null check (question_count between 1 and 100),
 correct_count integer not null default 0, wrong_count integer not null default 0,
 started_at timestamptz not null default now(), completed_at timestamptz,
 duration_seconds integer not null default 0,
 check (correct_count >= 0 and wrong_count >= 0 and correct_count + wrong_count <= question_count)
);
create unique index if not exists quiz_sessions_daily_unique on public.quiz_sessions(user_id,daily_date) where daily_date is not null;
create index if not exists quiz_sessions_user_started on public.quiz_sessions(user_id,started_at desc);
create table if not exists public.quiz_questions (
 id uuid primary key, session_id uuid not null references public.quiz_sessions(id) on delete cascade,
 position integer not null check(position >= 0), ayah_key text not null check(ayah_key ~ '^[0-9]{1,3}:[0-9]{1,3}$'),
 surah_id integer not null check(surah_id between 1 and 114), question_type text not null,
 difficulty integer not null check(difficulty between 1 and 5), group_id text,
 fingerprint text not null, payload jsonb not null,
 correct_choice_id text not null, selected_choice_id text, is_correct boolean,
 response_time_ms integer check(response_time_ms between 0 and 3600000), answered_at timestamptz,
 unique(session_id,position), unique(session_id,fingerprint),
 check ((answered_at is null and selected_choice_id is null and is_correct is null) or
        (answered_at is not null and selected_choice_id is not null and is_correct is not null))
);
create index if not exists quiz_questions_ayah_type on public.quiz_questions(ayah_key,question_type);
create table if not exists public.quiz_choices (
 question_id uuid not null references public.quiz_questions(id) on delete cascade,
 id text not null, choice_text text not null check(length(trim(choice_text)) > 0),
 source jsonb, reference text, choice_order integer not null check(choice_order between 0 and 3),
 primary key(question_id,id), unique(question_id,choice_order)
);
create table if not exists public.user_ayah_performance (
 user_id uuid not null references auth.users(id) on delete cascade, ayah_key text not null,
 attempts integer not null default 0, correct_count integer not null default 0, wrong_count integer not null default 0,
 average_response_ms double precision not null default 0,
 last_seen timestamptz not null default now(), last_wrong timestamptz, last_correct timestamptz,
 streak integer not null default 0, primary key(user_id,ayah_key),
 check(attempts=correct_count+wrong_count and correct_count>=0 and wrong_count>=0)
);
create index if not exists user_ayah_performance_review on public.user_ayah_performance(user_id,last_wrong desc) where wrong_count>0;
create table if not exists public.user_question_type_performance (
 user_id uuid not null references auth.users(id) on delete cascade, question_type text not null,
 attempts integer not null default 0, correct_count integer not null default 0, wrong_count integer not null default 0,
 average_response_ms double precision not null default 0, primary key(user_id,question_type),
 check(attempts=correct_count+wrong_count and correct_count>=0 and wrong_count>=0)
);
create table if not exists public.user_mutashabihat_performance (
 user_id uuid not null references auth.users(id) on delete cascade, group_id text not null,
 attempts integer not null default 0, correct_count integer not null default 0, wrong_count integer not null default 0,
 last_wrong timestamptz, primary key(user_id,group_id),
 check(attempts=correct_count+wrong_count and correct_count>=0 and wrong_count>=0)
);

do $$ declare t text; begin
 foreach t in array array['quiz_sessions','quiz_questions','quiz_choices','user_ayah_performance','user_question_type_performance','user_mutashabihat_performance'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['quiz_sessions','user_ayah_performance','user_question_type_performance','user_mutashabihat_performance'] loop
  execute format('drop policy if exists hifz_owner_read on public.%I',t);
  execute format('create policy hifz_owner_read on public.%I for select to authenticated using (auth.uid()=user_id)',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

create or replace function public.hifz_create_session(p_user uuid,p_session jsonb,p_questions jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare sid uuid; q jsonb; c jsonb; pos integer:=0; cp integer;
begin
 if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> (p_session->>'questionCount')::integer then
  raise exception 'invalid question count';
 end if;
 -- Serialize daily creation per user/date; a concurrent request returns the existing session.
 if p_session->>'dailyDate' is not null then
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || (p_session->>'dailyDate'),0));
  select id into sid from quiz_sessions where user_id=p_user and daily_date=(p_session->>'dailyDate')::date;
  if sid is not null then return sid; end if;
 end if;
 sid := (p_session->>'id')::uuid;
 insert into quiz_sessions(id,user_id,settings,random_seed,daily_date,question_count)
 values(sid,p_user,p_session->'settings',p_session->>'seed',(p_session->>'dailyDate')::date,(p_session->>'questionCount')::integer);
 for q in select value from jsonb_array_elements(p_questions) loop
  if jsonb_array_length(q->'choices') <> 4 or
     (select count(*) from jsonb_array_elements(q->'choices') v where v->>'id'=q->>'correctChoiceId') <> 1 or
     (select count(distinct v->>'text') from jsonb_array_elements(q->'choices') v) <> 4 then
   raise exception 'invalid choices';
  end if;
  insert into quiz_questions(id,session_id,position,ayah_key,surah_id,question_type,difficulty,group_id,fingerprint,payload,correct_choice_id)
  values((q->>'id')::uuid,sid,pos,q->>'ayahKey',(q->>'surahId')::integer,q->>'type',(q->>'difficulty')::integer,q->>'groupId',q->>'fingerprint',q,q->>'correctChoiceId');
  cp:=0;
  for c in select value from jsonb_array_elements(q->'choices') loop
   insert into quiz_choices(question_id,id,choice_text,source,reference,choice_order)
   values((q->>'id')::uuid,c->>'id',c->>'text',c->'source',c->>'reference',cp);
   cp:=cp+1;
  end loop;
  pos:=pos+1;
 end loop;
 return sid;
end $$;

create or replace function public.hifz_answer(p_user uuid,p_session uuid,p_question uuid,p_choice text,p_elapsed integer)
returns void language plpgsql security invoker set search_path=public as $$
declare s quiz_sessions; q quiz_questions; ok boolean; elapsed integer; stamped timestamptz:=clock_timestamp();
begin
 select * into s from quiz_sessions where id=p_session and user_id=p_user for update;
 if not found then raise exception 'session not found' using errcode='P0002'; end if;
 select * into q from quiz_questions where id=p_question and session_id=s.id for update;
 if not found then raise exception 'question not found' using errcode='P0002'; end if;
 if q.answered_at is not null then
  if q.selected_choice_id<>p_choice then raise exception 'answer already saved' using errcode='22023'; end if;
  return;
 end if;
 if s.completed_at is not null or q.position<>s.correct_count+s.wrong_count then
  raise exception 'answer questions in order' using errcode='22023';
 end if;
 if not exists(select 1 from quiz_choices where question_id=q.id and id=p_choice) then
  raise exception 'choice not found' using errcode='22023';
 end if;
 elapsed:=greatest(0,least(coalesce(p_elapsed,0),3600000, (extract(epoch from stamped-s.started_at)*1000)::integer));
 ok:=p_choice=q.correct_choice_id;
 update quiz_questions set selected_choice_id=p_choice,is_correct=ok,response_time_ms=elapsed,answered_at=stamped where id=q.id;
 update quiz_sessions set correct_count=correct_count+ok::integer,wrong_count=wrong_count+(not ok)::integer,
  duration_seconds=round((select sum(response_time_ms) from quiz_questions where session_id=s.id)/1000.0),
  completed_at=case when correct_count+wrong_count+1=question_count then stamped else null end where id=s.id;
 insert into user_ayah_performance(user_id,ayah_key,attempts,correct_count,wrong_count,average_response_ms,last_seen,last_wrong,last_correct,streak)
 values(p_user,q.ayah_key,1,ok::integer,(not ok)::integer,elapsed,stamped,case when not ok then stamped end,case when ok then stamped end,ok::integer)
 on conflict(user_id,ayah_key) do update set
 attempts=user_ayah_performance.attempts+1,correct_count=user_ayah_performance.correct_count+ok::integer,
 wrong_count=user_ayah_performance.wrong_count+(not ok)::integer,
 average_response_ms=(user_ayah_performance.average_response_ms*user_ayah_performance.attempts+elapsed)/(user_ayah_performance.attempts+1),
 last_seen=stamped,last_wrong=case when not ok then stamped else user_ayah_performance.last_wrong end,
 last_correct=case when ok then stamped else user_ayah_performance.last_correct end,
 streak=case when ok then user_ayah_performance.streak+1 else 0 end;
 insert into user_question_type_performance(user_id,question_type,attempts,correct_count,wrong_count,average_response_ms)
 values(p_user,q.question_type,1,ok::integer,(not ok)::integer,elapsed)
 on conflict(user_id,question_type) do update set
 attempts=user_question_type_performance.attempts+1,correct_count=user_question_type_performance.correct_count+ok::integer,
 wrong_count=user_question_type_performance.wrong_count+(not ok)::integer,
 average_response_ms=(user_question_type_performance.average_response_ms*user_question_type_performance.attempts+elapsed)/(user_question_type_performance.attempts+1);
 if q.group_id is not null then
  insert into user_mutashabihat_performance(user_id,group_id,attempts,correct_count,wrong_count,last_wrong)
  values(p_user,q.group_id,1,ok::integer,(not ok)::integer,case when not ok then stamped end)
  on conflict(user_id,group_id) do update set
  attempts=user_mutashabihat_performance.attempts+1,correct_count=user_mutashabihat_performance.correct_count+ok::integer,
  wrong_count=user_mutashabihat_performance.wrong_count+(not ok)::integer,
  last_wrong=case when not ok then stamped else user_mutashabihat_performance.last_wrong end;
 end if;
 -- Preserve the existing stats page's answer totals. Insert in this same transaction.
 insert into test_answers(user_id,source,kind,correct,surah,ayah,group_id)
 values(p_user,case when q.group_id is not null then 'personal' else 'quran' end,'mcq',ok,q.payload->>'surahName',(q.payload->>'ayahNumber')::integer,
 case when q.group_id ~ '^[0-9a-f-]{36}$' and exists(select 1 from groups where id::text=q.group_id) then q.group_id::uuid else null end);
end $$;
revoke all on function public.hifz_create_session(uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.hifz_answer(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.hifz_create_session(uuid,jsonb,jsonb) to service_role;
grant execute on function public.hifz_answer(uuid,uuid,uuid,text,integer) to service_role;
notify pgrst,'reload schema';
-- Compact reference-only projection: never transfer editorial verse text into the generator.
create or replace function public.hifz_automated_references()
returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('id','auto:'||a.id,'title',a.title,'verses',(
  select coalesce(jsonb_agg(jsonb_build_object('surah',v->>'surah','ayah',v->>'ayah')),'[]'::jsonb)
  from jsonb_array_elements(coalesce(a.payload->'verses','[]'::jsonb)) v
 ))),'[]'::jsonb) from automated_groups a;
$$;
revoke all on function public.hifz_automated_references() from public,anon,authenticated;
grant execute on function public.hifz_automated_references() to service_role;
notify pgrst,'reload schema';
create or replace function public.hifz_dashboard(p_user uuid,p_timezone text)
returns jsonb language sql stable security invoker set search_path=public as $$
 select jsonb_build_object(
 'totalQuizzes',(select count(*) from quiz_sessions where user_id=p_user and completed_at is not null),
 'byType',(select coalesce(jsonb_agg(jsonb_build_object('key',question_type,'attempts',attempts,'correct',correct_count,'accuracy',round(100.0*correct_count/greatest(1,attempts)))),'[]'::jsonb) from user_question_type_performance where user_id=p_user),
 'bySurah',(select coalesce(jsonb_agg(jsonb_build_object('key',surah,'attempts',a,'correct',c,'accuracy',round(100.0*c/greatest(1,a)))),'[]'::jsonb) from (select split_part(ayah_key,':',1) surah,sum(attempts) a,sum(correct_count) c from user_ayah_performance where user_id=p_user group by 1) x),
 'recentAccuracy',(select coalesce(round(100.0*count(*) filter(where is_correct)/nullif(count(*),0)),0) from (select q.is_correct from quiz_questions q join quiz_sessions s on s.id=q.session_id where s.user_id=p_user and q.answered_at is not null order by q.answered_at desc limit 100) recent),
 'trend',(select coalesce(jsonb_agg(jsonb_build_object('date',d,'attempts',a,'accuracy',round(100.0*c/greatest(1,a))) order by d),'[]'::jsonb) from (select (q.answered_at at time zone p_timezone)::date d,count(*) a,count(*) filter(where q.is_correct) c from quiz_questions q join quiz_sessions s on s.id=q.session_id where s.user_id=p_user and q.answered_at>now()-interval '30 days' group by 1) days)
 );
$$;
revoke all on function public.hifz_dashboard(uuid,text) from public,anon,authenticated;
grant execute on function public.hifz_dashboard(uuid,text) to service_role;
notify pgrst,'reload schema';
