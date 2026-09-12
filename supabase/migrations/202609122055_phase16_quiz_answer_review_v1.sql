-- HIU YHCT 4.0 Phase 16 — answer-check requests and incremental Drive source lookup.

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
    select r.id request_id,r.question_id,q.subject,q.topic,q.stem,q.options,q.correct_index,q.source_file_name,q.review_status,r.reason,r.created_at,
      count(*) over(partition by r.question_id) request_count
    from public.practice_answer_review_requests r
    join public.practice_questions q on q.id=r.question_id
    where r.status='open'
    order by r.created_at asc
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
    next_hash:=encode(digest(convert_to(row_question.stem||'|'||array_to_string(row_question.options,'|')||'|'||p_correct_index::text,'UTF8'),'sha256'),'hex');
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
  where id=p_request_id;

  perform private.audit_event('practice.answer.review.resolve','practice_question',row_question.id::text,'info',jsonb_build_object('request_id',p_request_id,'resolution',resolution));
  return jsonb_build_object('ok',true,'requestId',p_request_id,'questionId',row_question.id,'resolution',resolution);
end
$$;

revoke all on function public.practice_source_sync_state_v1(text[]) from public,anon;
revoke all on function public.practice_answer_review_request_v1(uuid,text) from public,anon;
revoke all on function public.practice_answer_review_queue_v1(integer) from public,anon;
revoke all on function public.practice_answer_review_resolve_v1(uuid,text,integer,text) from public,anon;
grant execute on function public.practice_source_sync_state_v1(text[]) to authenticated;
grant execute on function public.practice_answer_review_request_v1(uuid,text) to authenticated;
grant execute on function public.practice_answer_review_queue_v1(integer) to authenticated;
grant execute on function public.practice_answer_review_resolve_v1(uuid,text,integer,text) to authenticated;

comment on function public.practice_answer_review_request_v1(uuid,text) is 'Phase 16: member answer-check ticket; does not mutate the canonical answer.';
comment on function public.practice_source_sync_state_v1(text[]) is 'Phase 16: manager-only source registry lookup for incremental Drive sync.';
