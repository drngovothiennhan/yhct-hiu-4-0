-- Drive-backed daily practice v1.
-- Drive is provenance/source storage; Supabase is the runtime source of truth.
-- Direct table reads are denied. Student sessions never expose correct_index before answering.

create table if not exists public.practice_source_documents(
  drive_file_id text primary key,
  file_name text not null,
  mime_type text not null default '',
  source_modified_time timestamptz,
  source_hash text not null,
  subject_hint text not null default 'Chưa phân loại',
  sync_status text not null default 'synced' check(sync_status in('synced','needs_ai_conversion','needs_review','ready','error')),
  sync_message text not null default '',
  question_count integer not null default 0 check(question_count>=0),
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.practice_source_documents enable row level security;
revoke all on public.practice_source_documents from anon,authenticated;

create table if not exists public.practice_questions(
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  content_hash text not null,
  subject text not null,
  topic text not null default 'Tổng hợp',
  stem text not null check(char_length(btrim(stem)) between 4 and 4000),
  options text[] not null check(cardinality(options)=4),
  correct_index smallint not null check(correct_index between 0 and 3),
  explanation text not null default '',
  source_file_id text not null references public.practice_source_documents(drive_file_id) on delete cascade,
  source_file_name text not null,
  source_modified_time timestamptz,
  source_hash text not null,
  generation_method text not null check(generation_method in('parsed','ai_generated')),
  review_status text not null default 'needs_review' check(review_status in('needs_review','source_verified','expert_approved','rejected')),
  provenance jsonb not null default '{}'::jsonb,
  expert_verified_by uuid references public.club_members(id),
  expert_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists practice_questions_subject_idx on public.practice_questions(subject,topic);
create index if not exists practice_questions_review_idx on public.practice_questions(review_status,updated_at desc);
create index if not exists practice_questions_source_idx on public.practice_questions(source_file_id);
alter table public.practice_questions enable row level security;
revoke all on public.practice_questions from anon,authenticated;

create table if not exists public.daily_practice_sessions(
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  practice_date date not null,
  question_ids uuid[] not null,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'active' check(status in('active','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(member_id,practice_date)
);
create index if not exists daily_practice_sessions_member_idx on public.daily_practice_sessions(member_id,practice_date desc);
alter table public.daily_practice_sessions enable row level security;
revoke all on public.daily_practice_sessions from anon,authenticated;

create table if not exists public.daily_practice_question_stats(
  member_id uuid not null references public.club_members(id) on delete cascade,
  question_id uuid not null references public.practice_questions(id) on delete cascade,
  attempts integer not null default 0 check(attempts>=0),
  correct_count integer not null default 0 check(correct_count>=0),
  wrong_count integer not null default 0 check(wrong_count>=0),
  last_seen_at timestamptz,
  last_correct_at timestamptz,
  primary key(member_id,question_id)
);
alter table public.daily_practice_question_stats enable row level security;
revoke all on public.daily_practice_question_stats from anon,authenticated;

create or replace function public.practice_drive_ingest_admin_v1(p_document jsonb,p_questions jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  mid uuid:=private.current_member_id();
  file_id text:=btrim(coalesce(p_document->>'driveFileId',''));
  file_name text:=btrim(coalesce(p_document->>'fileName',''));
  source_hash text:=btrim(coalesce(p_document->>'sourceHash',''));
  subject_hint text:=left(btrim(coalesce(p_document->>'subjectHint','Chưa phân loại')),160);
  sync_status text:=coalesce(nullif(btrim(p_document->>'syncStatus'),''),'synced');
  q jsonb; opts text[]; ext text; method text; requested_review text; final_review text; inserted_count integer:=0; updated_count integer:=0; qid uuid; existing_status text;
begin
  if mid is null or not exists(select 1 from public.club_members m where m.id=mid and m.status='approved' and m.role='admin') then raise exception 'Admin required'; end if;
  if file_id='' or file_name='' or source_hash='' then raise exception 'Invalid Drive document metadata'; end if;
  if sync_status not in('synced','needs_ai_conversion','needs_review','ready','error') then sync_status:='error'; end if;
  insert into public.practice_source_documents(drive_file_id,file_name,mime_type,source_modified_time,source_hash,subject_hint,sync_status,sync_message,question_count,last_synced_at,updated_at)
  values(file_id,left(file_name,300),left(coalesce(p_document->>'mimeType',''),180),nullif(p_document->>'modifiedTime','')::timestamptz,source_hash,subject_hint,sync_status,left(coalesce(p_document->>'syncMessage',''),500),case when jsonb_typeof(p_questions)='array' then jsonb_array_length(p_questions) else 0 end,now(),now())
  on conflict(drive_file_id) do update set file_name=excluded.file_name,mime_type=excluded.mime_type,source_modified_time=excluded.source_modified_time,source_hash=excluded.source_hash,subject_hint=excluded.subject_hint,sync_status=excluded.sync_status,sync_message=excluded.sync_message,question_count=excluded.question_count,last_synced_at=now(),updated_at=now();

  if jsonb_typeof(p_questions)<>'array' then raise exception 'Questions must be an array'; end if;
  for q in select value from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(q->'options')<>'array' or jsonb_array_length(q->'options')<>4 then continue; end if;
    select array_agg(left(btrim(value),1500) order by ord) into opts from jsonb_array_elements_text(q->'options') with ordinality x(value,ord);
    if exists(select 1 from unnest(opts) x where char_length(x)<1) then continue; end if;
    if coalesce((q->>'correctIndex')::integer,-1) not between 0 and 3 then continue; end if;
    ext:=left(btrim(coalesce(q->>'externalKey','')),240); if ext='' then continue; end if;
    method:=coalesce(nullif(btrim(q->>'generationMethod'),''),'ai_generated'); if method not in('parsed','ai_generated') then method:='ai_generated'; end if;
    requested_review:=coalesce(nullif(btrim(q->>'reviewStatus'),''),'needs_review');
    final_review:=case when method='parsed' and requested_review='source_verified' then 'source_verified' else 'needs_review' end;
    select review_status into existing_status from public.practice_questions where external_key=ext;
    insert into public.practice_questions(external_key,content_hash,subject,topic,stem,options,correct_index,explanation,source_file_id,source_file_name,source_modified_time,source_hash,generation_method,review_status,provenance,updated_at)
    values(ext,left(coalesce(q->>'contentHash',source_hash),64),left(coalesce(nullif(btrim(q->>'subject'),''),subject_hint),160),left(coalesce(nullif(btrim(q->>'topic'),''),'Tổng hợp'),180),left(btrim(coalesce(q->>'stem','')),4000),opts,(q->>'correctIndex')::smallint,left(coalesce(q->>'explanation',''),4000),file_id,left(file_name,300),nullif(p_document->>'modifiedTime','')::timestamptz,source_hash,method,final_review,coalesce(q->'provenance','{}'::jsonb),now())
    on conflict(external_key) do update set content_hash=excluded.content_hash,subject=excluded.subject,topic=excluded.topic,stem=excluded.stem,options=excluded.options,correct_index=excluded.correct_index,explanation=excluded.explanation,source_file_name=excluded.source_file_name,source_modified_time=excluded.source_modified_time,source_hash=excluded.source_hash,generation_method=excluded.generation_method,review_status=case when public.practice_questions.review_status='expert_approved' then 'expert_approved' else excluded.review_status end,provenance=excluded.provenance,updated_at=now()
    returning id into qid;
    if existing_status is null then inserted_count:=inserted_count+1; else updated_count:=updated_count+1; end if;
  end loop;
  update public.practice_source_documents d set question_count=(select count(*) from public.practice_questions q2 where q2.source_file_id=file_id),sync_status=case when exists(select 1 from public.practice_questions q3 where q3.source_file_id=file_id and q3.review_status='needs_review') then 'needs_review' when exists(select 1 from public.practice_questions q4 where q4.source_file_id=file_id and q4.review_status in('source_verified','expert_approved')) then 'ready' else d.sync_status end,updated_at=now() where d.drive_file_id=file_id;
  perform private.audit_event('practice.drive.ingest','practice_source_document',file_id,'info',jsonb_build_object('inserted',inserted_count,'updated',updated_count,'file_name',file_name));
  return jsonb_build_object('ok',true,'driveFileId',file_id,'inserted',inserted_count,'updated',updated_count);
end $$;

create or replace function public.practice_question_review_v1(p_question_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); role_name text; next_status text:=lower(btrim(coalesce(p_status,''))); row_count_now integer;
begin
  select role into role_name from public.club_members where id=mid and status='approved';
  if role_name not in('admin','super_mod','mod','leader') then raise exception 'Moderator required'; end if;
  if next_status not in('expert_approved','rejected') then raise exception 'Invalid review status'; end if;
  update public.practice_questions set review_status=next_status,expert_verified_by=case when next_status='expert_approved' then mid else null end,expert_verified_at=case when next_status='expert_approved' then now() else null end,updated_at=now() where id=p_question_id;
  get diagnostics row_count_now=row_count;
  if row_count_now=0 then raise exception 'Question not found'; end if;
  return jsonb_build_object('ok',true,'questionId',p_question_id,'status',next_status);
end $$;

create or replace function public.daily_practice_config_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); eligible integer; candidate integer; today_date date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; existing uuid;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select count(*) filter(where review_status in('source_verified','expert_approved')),count(*) filter(where review_status='needs_review') into eligible,candidate from public.practice_questions where review_status<>'rejected';
  select id into existing from public.daily_practice_sessions where member_id=mid and practice_date=today_date;
  return jsonb_build_object('ready',eligible>0,'eligibleCount',eligible,'needsReviewCount',candidate,'practiceDate',today_date,'hasTodaySession',existing is not null,'defaultCount',least(10,eligible));
end $$;

create or replace function public.daily_practice_today_v1(p_count integer default 10)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); today_date date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date; requested integer:=least(greatest(coalesce(p_count,10),1),30); s public.daily_practice_sessions%rowtype; ids uuid[]; questions jsonb; eligible integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select count(*) into eligible from public.practice_questions where review_status in('source_verified','expert_approved');
  if eligible=0 then return jsonb_build_object('ready',false,'practiceDate',today_date,'available',0,'questions','[]'::jsonb); end if;
  select * into s from public.daily_practice_sessions where member_id=mid and practice_date=today_date;
  if s.id is null then
    select array_agg(id) into ids from (
      select q.id
      from public.practice_questions q
      left join public.daily_practice_question_stats st on st.member_id=mid and st.question_id=q.id
      where q.review_status in('source_verified','expert_approved')
      order by case when st.question_id is null then 0 when st.wrong_count>st.correct_count then 1 else 2 end,
               coalesce(st.wrong_count,0) desc,
               st.last_seen_at nulls first,
               md5(mid::text||'|'||today_date::text||'|'||q.id::text)
      limit least(requested,eligible)
    ) picked;
    insert into public.daily_practice_sessions(member_id,practice_date,question_ids) values(mid,today_date,coalesce(ids,'{}'::uuid[])) returning * into s;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'subject',q.subject,'topic',q.topic,'stem',q.stem,'options',to_jsonb(q.options),'sourceFileName',q.source_file_name,'generationMethod',q.generation_method,'reviewStatus',q.review_status) order by u.ord),'[]'::jsonb)
  into questions from unnest(s.question_ids) with ordinality u(id,ord) join public.practice_questions q on q.id=u.id;
  return jsonb_build_object('ready',true,'sessionId',s.id,'practiceDate',today_date,'status',s.status,'questionCount',cardinality(s.question_ids),'answers',s.answers,'questions',questions);
end $$;

create or replace function public.daily_practice_answer_v1(p_session_id uuid,p_question_id uuid,p_selected_index integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); s public.daily_practice_sessions%rowtype; q public.practice_questions%rowtype; prior text; is_correct boolean; answer_count integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_selected_index not between 0 and 3 then raise exception 'Invalid answer'; end if;
  select * into s from public.daily_practice_sessions where id=p_session_id and member_id=mid for update;
  if s.id is null then raise exception 'Practice session not found'; end if;
  if not(p_question_id=any(s.question_ids)) then raise exception 'Question is not in this session'; end if;
  select * into q from public.practice_questions where id=p_question_id and review_status in('source_verified','expert_approved');
  if q.id is null then raise exception 'Question is no longer eligible'; end if;
  prior:=s.answers->>p_question_id::text;
  is_correct:=p_selected_index=q.correct_index;
  if prior is null then
    update public.daily_practice_sessions set answers=answers||jsonb_build_object(p_question_id::text,p_selected_index) where id=s.id returning * into s;
    insert into public.daily_practice_question_stats(member_id,question_id,attempts,correct_count,wrong_count,last_seen_at,last_correct_at)
    values(mid,p_question_id,1,case when is_correct then 1 else 0 end,case when is_correct then 0 else 1 end,now(),case when is_correct then now() else null end)
    on conflict(member_id,question_id) do update set attempts=public.daily_practice_question_stats.attempts+1,correct_count=public.daily_practice_question_stats.correct_count+(case when is_correct then 1 else 0 end),wrong_count=public.daily_practice_question_stats.wrong_count+(case when is_correct then 0 else 1 end),last_seen_at=now(),last_correct_at=case when is_correct then now() else public.daily_practice_question_stats.last_correct_at end;
    select count(*) into answer_count from jsonb_object_keys(s.answers);
    if answer_count>=cardinality(s.question_ids) then update public.daily_practice_sessions set status='completed',completed_at=coalesce(completed_at,now()) where id=s.id; end if;
  else
    is_correct:=(prior::integer)=q.correct_index;
  end if;
  return jsonb_build_object('accepted',true,'alreadyAnswered',prior is not null,'correct',is_correct,'selectedIndex',case when prior is null then p_selected_index else prior::integer end,'correctIndex',q.correct_index,'explanation',q.explanation,'sourceFileName',q.source_file_name,'reviewStatus',q.review_status);
end $$;

revoke all on function public.practice_drive_ingest_admin_v1(jsonb,jsonb),public.practice_question_review_v1(uuid,text),public.daily_practice_config_v1(),public.daily_practice_today_v1(integer),public.daily_practice_answer_v1(uuid,uuid,integer) from public,anon;
grant execute on function public.practice_drive_ingest_admin_v1(jsonb,jsonb),public.practice_question_review_v1(uuid,text) to authenticated;
grant execute on function public.daily_practice_config_v1(),public.daily_practice_today_v1(integer),public.daily_practice_answer_v1(uuid,uuid,integer) to authenticated;
