-- HIU YHCT 4.0 Phase 16 — trusted marked-DOCX ingestion, answer-check requests and incremental Drive source lookup.

create table if not exists public.practice_answer_review_requests(
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.practice_questions(id) on delete cascade,
  member_id uuid not null references public.club_members(id) on delete cascade,
  reason text not null default '',
  status text not null default 'open' check(status in('open','confirmed','corrected','dismissed')),
  resolution_note text not null default '',
  resolved_by uuid references public.club_members(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists practice_answer_review_requests_status_idx
  on public.practice_answer_review_requests(status,created_at asc);
create index if not exists practice_answer_review_requests_question_idx
  on public.practice_answer_review_requests(question_id,created_at desc);
create unique index if not exists practice_answer_review_requests_one_open_per_member_idx
  on public.practice_answer_review_requests(question_id,member_id) where status='open';

alter table public.practice_answer_review_requests enable row level security;
revoke all on table public.practice_answer_review_requests from public,anon,authenticated;

create or replace function public.practice_source_sync_state_v1(p_file_ids text[])
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  result jsonb;
begin
  if mid is null or not private.is_learning_content_manager() then
    raise exception 'Learning content manager required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'fileId',d.drive_file_id,
    'sourceHash',d.source_hash,
    'modifiedTime',d.source_modified_time,
    'syncStatus',d.sync_status,
    'lastSyncedAt',d.last_synced_at
  )),'[]'::jsonb)
  into result
  from public.practice_source_documents d
  where d.drive_file_id=any(coalesce(p_file_ids,'{}'::text[]));
  return result;
end
$$;

create or replace function public.practice_trusted_quiz_ingest_v1(
  p_document jsonb,
  p_questions jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  file_id text:=btrim(coalesce(p_document->>'driveFileId',''));
  file_name text:=left(btrim(coalesce(p_document->>'fileName','')),300);
  source_hash text:=left(btrim(coalesce(p_document->>'sourceHash','')),160);
  subject_hint text:=left(btrim(coalesce(p_document->>'subjectHint','Chưa phân loại')),160);
  modified_time timestamptz:=nullif(p_document->>'modifiedTime','')::timestamptz;
  q jsonb;
  prov jsonb;
  opts text[];
  ext text;
  marked_answer text;
  correct_idx integer;
  existing_status text;
  unchanged boolean:=false;
  inserted_count integer:=0;
  updated_count integer:=0;
begin
  if mid is null or not private.is_learning_content_manager() then
    raise exception 'Learning content manager required';
  end if;
  if file_id='' or file_name='' or source_hash='' then
    raise exception 'Invalid trusted source metadata';
  end if;
  if jsonb_typeof(p_questions)<>'array' or jsonb_array_length(p_questions)<1 then
    raise exception 'Trusted questions required';
  end if;

  insert into public.practice_source_documents(
    drive_file_id,file_name,mime_type,source_modified_time,source_hash,subject_hint,
    sync_status,sync_message,question_count,last_synced_at,updated_at
  )
  values(
    file_id,file_name,left(coalesce(p_document->>'mimeType',''),180),modified_time,source_hash,subject_hint,
    'ready',left(coalesce(p_document->>'syncMessage','Trusted marked DOCX'),500),jsonb_array_length(p_questions),now(),now()
  )
  on conflict(drive_file_id) do update set
    file_name=excluded.file_name,
    mime_type=excluded.mime_type,
    source_modified_time=excluded.source_modified_time,
    source_hash=excluded.source_hash,
    subject_hint=excluded.subject_hint,
    sync_status='ready',
    sync_message=excluded.sync_message,
    question_count=excluded.question_count,
    last_synced_at=now(),
    updated_at=now();

  for q in select value from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(q->'options')<>'array' or jsonb_array_length(q->'options')<>4 then
      raise exception 'Trusted question must have exactly four options';
    end if;
    select array_agg(left(btrim(value),1500) order by ord)
      into opts
    from jsonb_array_elements_text(q->'options') with ordinality x(value,ord);
    if exists(select 1 from unnest(opts) x where char_length(x)<1) then
      raise exception 'Trusted question contains blank option';
    end if;

    correct_idx:=coalesce((q->>'correctIndex')::integer,-1);
    if correct_idx not between 0 and 3 then raise exception 'Trusted correct answer invalid'; end if;
    if btrim(coalesce(q->>'generationMethod',''))<>'parsed' or btrim(coalesce(q->>'reviewStatus',''))<>'source_verified' then
      raise exception 'Trusted question state invalid';
    end if;

    prov:=case when jsonb_typeof(q->'provenance')='object' then q->'provenance' else '{}'::jsonb end;
    marked_answer:=chr(65+correct_idx);
    if coalesce(prov->>'sourceMark','')<>'word-font-color-red-v1'
       or upper(coalesce(prov->>'sourceMarkColor',''))<>'FF0000'
       or coalesce((prov->>'trustedApprovedSource')::boolean,false) is not true
       or coalesce(prov->>'sourceHash','')<>source_hash
       or upper(coalesce(prov->>'markedAnswer',''))<>marked_answer then
      raise exception 'Trusted question provenance invalid';
    end if;

    ext:=left(btrim(coalesce(q->>'externalKey','')),240);
    if ext='' or ext not like ('trusted:'||file_id||':%') then
      raise exception 'Trusted external key invalid';
    end if;

    select p.review_status,
           p.content_hash is not distinct from left(coalesce(q->>'contentHash',source_hash),64)
           and p.subject is not distinct from left(coalesce(nullif(btrim(q->>'subject'),''),subject_hint),160)
           and p.topic is not distinct from left(coalesce(nullif(btrim(q->>'topic'),''),'Tổng hợp'),180)
           and p.stem is not distinct from left(btrim(coalesce(q->>'stem','')),4000)
           and p.options is not distinct from opts
           and p.correct_index is not distinct from correct_idx::smallint
           and p.explanation is not distinct from left(coalesce(q->>'explanation',''),4000)
      into existing_status,unchanged
    from public.practice_questions p
    where p.external_key=ext;

    insert into public.practice_questions(
      external_key,content_hash,subject,topic,stem,options,correct_index,explanation,
      source_file_id,source_file_name,source_modified_time,source_hash,
      generation_method,review_status,provenance,updated_at
    )
    values(
      ext,
      left(coalesce(q->>'contentHash',source_hash),64),
      left(coalesce(nullif(btrim(q->>'subject'),''),subject_hint),160),
      left(coalesce(nullif(btrim(q->>'topic'),''),'Tổng hợp'),180),
      left(btrim(coalesce(q->>'stem','')),4000),
      opts,
      correct_idx::smallint,
      left(coalesce(q->>'explanation',''),4000),
      file_id,file_name,modified_time,source_hash,
      'parsed','source_verified',prov||jsonb_build_object('trustedIngestedBy',mid,'trustedIngestedAt',now()),now()
    )
    on conflict(external_key) do update set
      content_hash=excluded.content_hash,
      subject=excluded.subject,
      topic=excluded.topic,
      stem=excluded.stem,
      options=excluded.options,
      correct_index=excluded.correct_index,
      explanation=excluded.explanation,
      source_file_id=excluded.source_file_id,
      source_file_name=excluded.source_file_name,
      source_modified_time=excluded.source_modified_time,
      source_hash=excluded.source_hash,
      generation_method='parsed',
      review_status=case when public.practice_questions.review_status='expert_approved' and unchanged then 'expert_approved' else 'source_verified' end,
      expert_verified_by=case when public.practice_questions.review_status='expert_approved' and unchanged then public.practice_questions.expert_verified_by else null end,
      expert_verified_at=case when public.practice_questions.review_status='expert_approved' and unchanged then public.practice_questions.expert_verified_at else null end,
      provenance=case when public.practice_questions.review_status='expert_approved' and unchanged then public.practice_questions.provenance||excluded.provenance else excluded.provenance end,
      updated_at=now();

    if existing_status is null then inserted_count:=inserted_count+1; else updated_count:=updated_count+1; end if;
  end loop;

  update public.practice_source_documents
  set question_count=(select count(*) from public.practice_questions q where q.source_file_id=file_id),
      sync_status='ready',last_synced_at=now(),updated_at=now()
  where drive_file_id=file_id;

  perform private.audit_event('practice.trusted.ingest','practice_source_document',file_id,'info',jsonb_build_object('inserted',inserted_count,'updated',updated_count,'file_name',file_name,'source_mark','word-font-color-red-v1'));
  return jsonb_build_object('ok',true,'driveFileId',file_id,'inserted',inserted_count,'updated',updated_count);
end
$$;

create or replace function public.practice_answer_review_request_v1(
  p_question_id uuid,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  rid uuid;
  q_status text;
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required';
  end if;
  select review_status into q_status
  from public.practice_questions
  where id=p_question_id and review_status in('source_verified','expert_approved');
  if q_status is null then raise exception 'Question not eligible'; end if;

  insert into public.practice_answer_review_requests(question_id,member_id,reason)
  values(p_question_id,mid,left(btrim(coalesce(p_reason,'')),1000))
  on conflict(question_id,member_id) where status='open'
  do update set reason=case when btrim(excluded.reason)<>'' then excluded.reason else public.practice_answer_review_requests.reason end,updated_at=now()
  returning id into rid;

  perform private.audit_event('practice.answer.review.request','practice_question',p_question_id::text,'info',jsonb_build_object('request_id',rid));
  return jsonb_build_object('ok',true,'requestId',rid,'questionId',p_question_id,'status','open');
end
$$;

create or replace function public.practice_answer_review_queue_v1(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  result jsonb;
begin
  if mid is null or not private.is_learning_content_manager() then
    raise exception 'Learning content manager required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId',x.request_id,
    'questionId',x.question_id,
    'subject',x.subject,
    'topic',x.topic,
    'stem',x.stem,
    'options',to_jsonb(x.options),
    'correctIndex',x.correct_index,
    'sourceFileName',x.source_file_name,
    'reviewStatus',x.review_status,
    'reason',x.reason,
    'requestedAt',x.created_at,
    'requestCount',x.request_count
  ) order by x.created_at asc),'[]'::jsonb)
  into result
  from (
    select
      (array_agg(r.id order by r.created_at asc))[1] request_id,
      r.question_id,
      q.subject,q.topic,q.stem,q.options,q.correct_index,q.source_file_name,q.review_status,
      left(coalesce(string_agg(nullif(btrim(r.reason),''),E'\n' order by r.created_at) filter(where btrim(r.reason)<>''),''),2000) reason,
      min(r.created_at) created_at,
      count(*)::integer request_count
    from public.practice_answer_review_requests r
    join public.practice_questions q on q.id=r.question_id
    where r.status='open'
    group by r.question_id,q.subject,q.topic,q.stem,q.options,q.correct_index,q.source_file_name,q.review_status
    order by min(r.created_at) asc
    limit least(greatest(coalesce(p_limit,20),1),50)
  ) x;
  return result;
end
$$;

create or replace function public.practice_answer_review_resolve_v1(
  p_request_id uuid,
  p_resolution text,
  p_correct_index integer default null,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  resolution text:=lower(btrim(coalesce(p_resolution,'')));
  row_request public.practice_answer_review_requests%rowtype;
  row_question public.practice_questions%rowtype;
  next_hash text;
  closed_count integer:=0;
begin
  if mid is null or not private.is_learning_content_manager() then
    raise exception 'Learning content manager required';
  end if;
  if resolution not in('confirmed','corrected','dismissed') then raise exception 'Invalid resolution'; end if;

  select * into row_request from public.practice_answer_review_requests where id=p_request_id and status='open' for update;
  if row_request.id is null then raise exception 'Open review request not found'; end if;
  select * into row_question from public.practice_questions where id=row_request.question_id for update;
  if row_question.id is null then raise exception 'Question not found'; end if;

  if resolution='corrected' then
    if p_correct_index is null or p_correct_index not between 0 and 3 then raise exception 'Corrected answer required'; end if;
    next_hash:=encode(extensions.digest(convert_to(row_question.stem||'|'||array_to_string(row_question.options,'|')||'|'||p_correct_index::text,'UTF8'),'sha256'),'hex');
    update public.practice_questions
    set correct_index=p_correct_index,
        content_hash=next_hash,
        review_status='expert_approved',
        expert_verified_by=mid,
        expert_verified_at=now(),
        provenance=provenance||jsonb_build_object('answerReviewCorrectedAt',now(),'answerReviewCorrectedBy',mid,'answerReviewRequestId',p_request_id),
        updated_at=now()
    where id=row_question.id;
  elsif resolution='confirmed' then
    update public.practice_questions
    set review_status='expert_approved',expert_verified_by=mid,expert_verified_at=now(),
        provenance=provenance||jsonb_build_object('answerReviewConfirmedAt',now(),'answerReviewConfirmedBy',mid,'answerReviewRequestId',p_request_id),updated_at=now()
    where id=row_question.id;
  end if;

  update public.practice_answer_review_requests
  set status=resolution,resolution_note=left(btrim(coalesce(p_note,'')),2000),resolved_by=mid,resolved_at=now(),updated_at=now()
  where question_id=row_request.question_id and status='open';
  get diagnostics closed_count=row_count;

  perform private.audit_event('practice.answer.review.resolve','practice_question',row_question.id::text,'info',jsonb_build_object('request_id',p_request_id,'resolution',resolution,'closed_count',closed_count));
  return jsonb_build_object('ok',true,'requestId',p_request_id,'questionId',row_question.id,'resolution',resolution,'closedCount',closed_count);
end
$$;

revoke all on function public.practice_source_sync_state_v1(text[]) from public,anon;
revoke all on function public.practice_trusted_quiz_ingest_v1(jsonb,jsonb) from public,anon;
revoke all on function public.practice_answer_review_request_v1(uuid,text) from public,anon;
revoke all on function public.practice_answer_review_queue_v1(integer) from public,anon;
revoke all on function public.practice_answer_review_resolve_v1(uuid,text,integer,text) from public,anon;
grant execute on function public.practice_source_sync_state_v1(text[]) to authenticated;
grant execute on function public.practice_trusted_quiz_ingest_v1(jsonb,jsonb) to authenticated;
grant execute on function public.practice_answer_review_request_v1(uuid,text) to authenticated;
grant execute on function public.practice_answer_review_queue_v1(integer) to authenticated;
grant execute on function public.practice_answer_review_resolve_v1(uuid,text,integer,text) to authenticated;

comment on function public.practice_trusted_quiz_ingest_v1(jsonb,jsonb) is 'Phase 16: capability-scoped trusted marked-DOCX ingestion; requires deterministic red-answer provenance.';
comment on function public.practice_answer_review_request_v1(uuid,text) is 'Phase 16: member answer-check ticket; does not mutate the canonical answer.';
comment on function public.practice_source_sync_state_v1(text[]) is 'Phase 16: manager-only source registry lookup for incremental Drive sync.';
