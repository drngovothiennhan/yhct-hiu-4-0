-- Daily Study OS quizzes are generated only from a member's recently practiced,
-- approved question-bank items and always retain both source-question and source-document FKs.
do $$
begin
  if not exists(select 1 from vault.secrets where name='daily_study_review_cron_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),'daily_study_review_cron_secret','Internal credential for the Study OS daily source-grounded review job');
  end if;
end $$;

create or replace function public.daily_study_review_secret_valid_v1(p_secret text)
returns boolean language sql stable security definer set search_path=pg_catalog,vault as $$
  select coalesce(length(p_secret) between 32 and 256,false)
    and exists(select 1 from vault.decrypted_secrets where name='daily_study_review_cron_secret' and decrypted_secret=p_secret);
$$;
revoke all on function public.daily_study_review_secret_valid_v1(text) from public,authenticated;
grant execute on function public.daily_study_review_secret_valid_v1(text) to anon,service_role;

create table if not exists public.daily_study_review_sets_v1(
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  quiz_date date not null,
  status text not null default 'generated' check(status in('generated','completed')),
  generated_at timestamptz not null default now(),
  completed_at timestamptz,
  provider text not null default 'gemini' check(provider='gemini'),
  unique(member_id,quiz_date),
  unique(id,member_id)
);
create index if not exists daily_study_review_sets_member_date_idx on public.daily_study_review_sets_v1(member_id,quiz_date desc);
alter table public.daily_study_review_sets_v1 enable row level security;
revoke all on public.daily_study_review_sets_v1 from public,anon,authenticated;
grant select,insert,update on public.daily_study_review_sets_v1 to service_role;

create table if not exists public.daily_study_review_questions_v1(
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.daily_study_review_sets_v1(id) on delete cascade,
  member_id uuid not null references public.club_members(id) on delete cascade,
  source_question_id uuid not null references public.practice_questions(id) on delete cascade,
  source_file_id text not null references public.practice_source_documents(drive_file_id) on delete cascade,
  question_type text not null default 'multiple_choice' check(question_type in('multiple_choice','short_answer')),
  stem text not null check(char_length(btrim(stem)) between 12 and 700),
  options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
  correct_answer text not null check(char_length(btrim(correct_answer)) between 1 and 500),
  explanation text not null check(char_length(btrim(explanation)) between 1 and 1000),
  evidence_quote text not null check(char_length(btrim(evidence_quote)) between 8 and 600),
  source_title text not null,
  status text not null default 'pending' check(status in('pending','answered')),
  user_answer jsonb,
  is_correct boolean,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(set_id,source_question_id),
  unique(id,member_id),
  constraint daily_study_review_set_member_fk foreign key(set_id,member_id)
    references public.daily_study_review_sets_v1(id,member_id) on delete cascade
);
create index if not exists daily_study_review_questions_member_status_idx on public.daily_study_review_questions_v1(member_id,status,set_id);
create index if not exists daily_study_review_questions_source_idx on public.daily_study_review_questions_v1(source_question_id,source_file_id);
alter table public.daily_study_review_questions_v1 enable row level security;
revoke all on public.daily_study_review_questions_v1 from public,anon,authenticated;
grant select,insert,update on public.daily_study_review_questions_v1 to service_role;

create or replace function public.daily_study_review_candidates_v1(p_secret text,p_quiz_date date,p_limit integer default 200)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.daily_study_review_secret_valid_v1(p_secret) then raise exception 'Unauthorized'; end if;
  if p_quiz_date is distinct from (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Invalid quiz date'; end if;
  with active_members as(
    select distinct s.member_id
    from public.daily_practice_question_stats s
    join public.club_members m on m.id=s.member_id and m.status='approved'
    where s.last_seen_at >= now()-interval '30 days'
      and not exists(select 1 from public.daily_study_review_sets_v1 d where d.member_id=s.member_id and d.quiz_date=p_quiz_date)
    order by s.member_id
    limit least(greatest(coalesce(p_limit,200),1),1000)
  ), selected as(
    select a.member_id,src.*
    from active_members a
    cross join lateral(
      select q.id,q.source_file_id,d.file_name as source_title,q.subject,q.topic,q.stem,q.options,q.correct_index,q.explanation,
        s.last_seen_at,s.wrong_count,s.attempts,
        row_number() over(order by
          (s.wrong_count*8.0 + greatest(0,extract(epoch from (now()-coalesce(s.last_seen_at,now())))/86400.0) + random()*4.0) desc,
          q.id
        ) as source_order
      from public.daily_practice_question_stats s
      join public.practice_questions q on q.id=s.question_id and q.review_status in('source_verified','expert_approved')
      join public.practice_source_documents d on d.drive_file_id=q.source_file_id and d.sync_status in('ready','synced') and d.source_hash=q.source_hash
      where s.member_id=a.member_id and s.last_seen_at >= now()-interval '30 days'
        and nullif(btrim(q.explanation),'') is not null
      order by (s.wrong_count*8.0 + greatest(0,extract(epoch from (now()-coalesce(s.last_seen_at,now())))/86400.0) + random()*4.0) desc,q.id
      limit (3+floor(random()*3))::integer
    ) src
  )
  select coalesce(jsonb_agg(jsonb_build_object('memberId',grouped.member_id,'sources',grouped.sources) order by grouped.member_id),'[]'::jsonb)
  into result
  from(
    select member_id,jsonb_agg(jsonb_build_object(
      'id',id,'sourceFileId',source_file_id,'sourceFileName',source_title,'subject',subject,'topic',topic,
      'stem',stem,'options',to_jsonb(options),'correctIndex',correct_index,'explanation',explanation
    ) order by source_order) as sources
    from selected group by member_id
  ) grouped;
  return result;
end $$;
revoke all on function public.daily_study_review_candidates_v1(text,date,integer) from public,authenticated;
grant execute on function public.daily_study_review_candidates_v1(text,date,integer) to anon,service_role;

create or replace function public.daily_study_review_generate_v1(p_secret text,p_member_id uuid,p_quiz_date date,p_questions jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare set_row public.daily_study_review_sets_v1%rowtype; item jsonb; source_row public.practice_questions%rowtype; inserted integer:=0; qid uuid;
begin
  if not public.daily_study_review_secret_valid_v1(p_secret) then raise exception 'Unauthorized'; end if;
  if p_member_id is null or p_quiz_date is null or jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) not between 3 and 5 then raise exception 'Invalid daily review payload'; end if;
  if not exists(select 1 from public.club_members where id=p_member_id and status='approved') then raise exception 'Approved member required'; end if;
  insert into public.daily_study_review_sets_v1(member_id,quiz_date)
  values(p_member_id,p_quiz_date)
  on conflict(member_id,quiz_date) do nothing;
  select * into set_row from public.daily_study_review_sets_v1 where member_id=p_member_id and quiz_date=p_quiz_date for update;
  if exists(select 1 from public.daily_study_review_questions_v1 where set_id=set_row.id) then
    return jsonb_build_object('ok',true,'created',false,'setId',set_row.id);
  end if;

  for item in select value from jsonb_array_elements(p_questions) loop
    begin qid:=(item->>'sourceQuestionId')::uuid; exception when others then raise exception 'Invalid source question id'; end;
    select * into source_row from public.practice_questions where id=qid and review_status in('source_verified','expert_approved');
    if source_row.id is null then raise exception 'Unapproved source question'; end if;
    if not exists(select 1 from public.practice_source_documents d where d.drive_file_id=source_row.source_file_id and d.sync_status in('ready','synced') and d.source_hash=source_row.source_hash) then raise exception 'Source document has changed or is unavailable'; end if;
    if not exists(select 1 from public.daily_practice_question_stats where member_id=p_member_id and question_id=qid and last_seen_at >= now()-interval '30 days') then raise exception 'Source is not part of current learner progress'; end if;
    if item->>'questionType' not in('multiple_choice','short_answer') then raise exception 'Invalid question type'; end if;
    if item->>'questionType'<>'multiple_choice' or item->'options' is distinct from to_jsonb(source_row.options)
       or item->>'correctAnswer' is distinct from source_row.options[source_row.correct_index+1]
       or item->>'explanation' is distinct from source_row.explanation
       or position(lower(item->>'evidenceQuote') in lower(source_row.stem||' '||array_to_string(source_row.options,' ')||' '||source_row.explanation))=0 then
      raise exception 'Generated question failed canonical source checks';
    end if;
    insert into public.daily_study_review_questions_v1(set_id,member_id,source_question_id,source_file_id,question_type,stem,options,correct_answer,explanation,evidence_quote,source_title)
    values(set_row.id,p_member_id,qid,source_row.source_file_id,'multiple_choice',left(btrim(item->>'stem'),700),item->'options',left(btrim(item->>'correctAnswer'),500),left(btrim(item->>'explanation'),1000),left(btrim(item->>'evidenceQuote'),600),left(source_row.source_file_name,300));
    inserted:=inserted+1;
  end loop;
  if inserted not between 3 and 5 then raise exception 'Daily quiz must have three to five validated questions'; end if;
  return jsonb_build_object('ok',true,'created',true,'setId',set_row.id,'questionCount',inserted);
end $$;
revoke all on function public.daily_study_review_generate_v1(text,uuid,date,jsonb) from public,authenticated;
grant execute on function public.daily_study_review_generate_v1(text,uuid,date,jsonb) to anon,service_role;

create or replace function public.daily_study_review_today_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; set_row public.daily_study_review_sets_v1%rowtype; result jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select * into set_row from public.daily_study_review_sets_v1 where member_id=mid and quiz_date=today;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'sourceTitle',q.source_title,'sourceFileId',q.source_file_id,'questionType',q.question_type,'stem',q.stem,'options',q.options,
    'status',q.status,'userAnswer',q.user_answer,'isCorrect',q.is_correct,'correctAnswer',case when q.status='answered' then q.correct_answer else null end,
    'explanation',case when q.status='answered' then q.explanation else null end,'evidenceQuote',case when q.status='answered' then q.evidence_quote else null end
  ) order by q.created_at),'[]'::jsonb) into result
  from public.daily_study_review_questions_v1 q where q.set_id=set_row.id and q.member_id=mid;
  return jsonb_build_object(
    'date',today,'hasQuiz',set_row.id is not null,'status',coalesce(set_row.status,'empty'),'generatedAt',set_row.generated_at,
    'hasEligibleSource',exists(select 1 from public.daily_practice_question_stats s join public.practice_questions q on q.id=s.question_id and q.review_status in('source_verified','expert_approved') join public.practice_source_documents d on d.drive_file_id=q.source_file_id and d.sync_status in('ready','synced') and d.source_hash=q.source_hash where s.member_id=mid and s.attempts>0 and nullif(btrim(q.explanation),'') is not null and s.last_seen_at>=now()-interval '30 days'),
    'questions',result
  );
end $$;
revoke all on function public.daily_study_review_today_v1() from public,anon;
grant execute on function public.daily_study_review_today_v1() to authenticated;

create or replace function public.daily_study_review_submit_v1(p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; item jsonb; q public.daily_study_review_questions_v1%rowtype; selected integer; total integer:=0; correct_count integer:=0; review jsonb:='[]'::jsonb; qid uuid;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers) not between 1 and 5 then raise exception 'Submit one to five answers'; end if;
  for item in select value from jsonb_array_elements(p_answers) loop
    begin qid:=(item->>'questionId')::uuid; selected:=(item->>'selectedIndex')::integer; exception when others then raise exception 'Invalid answer'; end;
    if selected not between 0 and 3 then raise exception 'Invalid answer choice'; end if;
    select * into q from public.daily_study_review_questions_v1 where id=qid and member_id=mid and status='pending' and set_id in(select id from public.daily_study_review_sets_v1 where member_id=mid and quiz_date=today) for update;
    if q.id is null then raise exception 'Question missing, already answered, or not from today'; end if;
    update public.daily_study_review_questions_v1 set status='answered',user_answer=jsonb_build_object('selectedIndex',selected),is_correct=(q.options->>selected)=q.correct_answer,answered_at=now() where id=q.id returning * into q;
    total:=total+1; if q.is_correct then correct_count:=correct_count+1; end if;
    review:=review||jsonb_build_array(jsonb_build_object('id',q.id,'selectedIndex',selected,'correctAnswer',q.correct_answer,'correct',q.is_correct,'explanation',q.explanation,'evidenceQuote',q.evidence_quote,'sourceTitle',q.source_title,'sourceFileId',q.source_file_id));
  end loop;
  if not exists(select 1 from public.daily_study_review_questions_v1 where member_id=mid and status='pending' and set_id in(select id from public.daily_study_review_sets_v1 where member_id=mid and quiz_date=today)) then
    update public.daily_study_review_sets_v1 set status='completed',completed_at=now() where member_id=mid and quiz_date=today;
  end if;
  return jsonb_build_object('score',round(100.0*correct_count/total)::integer,'correctCount',correct_count,'total',total,'review',review,'submittedAt',now());
end $$;
revoke all on function public.daily_study_review_submit_v1(jsonb) from public,anon;
grant execute on function public.daily_study_review_submit_v1(jsonb) to authenticated;

select cron.unschedule(jobid) from cron.job where jobname='daily-study-os-grounded-review';
select cron.schedule(
  'daily-study-os-grounded-review',
  '0 1 * * *',
  $job$
    select net.http_post(
      url:='https://yhct-hiu-final4-stage-hiu-yhct.vercel.app/api/ai/assistant',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'X-YHCT-Daily-Review-Key',(select decrypted_secret from vault.decrypted_secrets where name='daily_study_review_cron_secret')
      ),
      body:='{"task":"daily_review_cron"}'::jsonb,
      timeout_milliseconds:=55000
    );
  $job$
);

