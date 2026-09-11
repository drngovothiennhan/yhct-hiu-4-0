-- Canonical quiz -> learning pipeline v3.
-- One approved bank (practice_questions) feeds both Daily Quick Review and continuous Practice Quiz.

create or replace function private.practice_promote_admin_confirmed_ai_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id();
begin
  if new.generation_method='ai_generated'
     and new.review_status='needs_review'
     and coalesce((new.provenance->>'adminConfirmed')::boolean,false)=true
     and mid is not null
     and exists(select 1 from public.club_members m where m.id=mid and m.role='admin' and m.status='approved') then
    new.review_status:='expert_approved';
    new.expert_verified_by:=mid;
    new.expert_verified_at:=coalesce(new.expert_verified_at,now());
    new.provenance:=new.provenance||jsonb_build_object('approvedBy',mid,'approvedAt',now(),'approvalGate','acc-explicit-confirm-v1');
  end if;
  return new;
end $$;

revoke all on function private.practice_promote_admin_confirmed_ai_v1() from public,anon,authenticated;

drop trigger if exists practice_promote_admin_confirmed_ai_v1 on public.practice_questions;
create trigger practice_promote_admin_confirmed_ai_v1
before insert or update of review_status,provenance,generation_method on public.practice_questions
for each row execute function private.practice_promote_admin_confirmed_ai_v1();

create or replace function public.practice_quiz_config_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  eligible integer:=0;
  subjects jsonb:='[]'::jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select count(*) into eligible
  from public.practice_questions
  where review_status in('source_verified','expert_approved');

  select coalesce(jsonb_agg(x.subject order by x.subject),'[]'::jsonb) into subjects
  from (
    select distinct subject
    from public.practice_questions
    where review_status in('source_verified','expert_approved') and btrim(subject)<>''
  ) x;

  return jsonb_build_object(
    'ready',eligible>0,
    'eligibleCount',eligible,
    'subjects',subjects,
    'pageSize',25,
    'continuous',true
  );
end $$;
revoke all on function public.practice_quiz_config_v1() from public,anon;
grant execute on function public.practice_quiz_config_v1() to authenticated;

create or replace function public.practice_quiz_page_v1(
  p_subject text default '',
  p_offset integer default 0,
  p_limit integer default 25,
  p_seed text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  subject_filter text:=left(btrim(coalesce(p_subject,'')),160);
  row_offset integer:=greatest(0,least(coalesce(p_offset,0),1000000));
  row_limit integer:=greatest(1,least(coalesce(p_limit,25),50));
  seed text:=left(coalesce(nullif(btrim(p_seed),''),mid::text),120);
  total integer:=0;
  rows jsonb:='[]'::jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;

  select count(*) into total
  from public.practice_questions q
  where q.review_status in('source_verified','expert_approved')
    and (subject_filter='' or q.subject=subject_filter);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'subject',p.subject,
    'topic',p.topic,
    'stem',p.stem,
    'options',to_jsonb(p.options),
    'sourceFileName',p.source_file_name,
    'generationMethod',p.generation_method,
    'reviewStatus',p.review_status
  ) order by p.ord),'[]'::jsonb) into rows
  from (
    select q.*,row_number() over(order by md5(seed||'|'||q.id::text),q.id)::integer as ord
    from public.practice_questions q
    where q.review_status in('source_verified','expert_approved')
      and (subject_filter='' or q.subject=subject_filter)
    order by md5(seed||'|'||q.id::text),q.id
    offset row_offset limit row_limit
  ) p;

  return jsonb_build_object(
    'ready',total>0,
    'subject',subject_filter,
    'offset',row_offset,
    'pageSize',row_limit,
    'total',total,
    'hasMore',row_offset+jsonb_array_length(rows)<total,
    'questions',rows
  );
end $$;
revoke all on function public.practice_quiz_page_v1(text,integer,integer,text) from public,anon;
grant execute on function public.practice_quiz_page_v1(text,integer,integer,text) to authenticated;

create or replace function public.practice_quiz_submit_v1(p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  item jsonb;
  q public.practice_questions%rowtype;
  qid uuid;
  selected integer;
  total integer:=0;
  correct_count integer:=0;
  review jsonb:='[]'::jsonb;
  seen uuid[]:='{}'::uuid[];
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'Answers must be an array'; end if;
  if jsonb_array_length(p_answers)<1 or jsonb_array_length(p_answers)>500 then raise exception 'Submit between 1 and 500 loaded questions per request'; end if;

  for item in select value from jsonb_array_elements(p_answers) loop
    begin qid:=(item->>'questionId')::uuid; exception when others then raise exception 'Invalid question id'; end;
    if qid=any(seen) then raise exception 'Duplicate question id'; end if;
    seen:=array_append(seen,qid);
    selected:=case when item ? 'selectedIndex' and item->>'selectedIndex' is not null then (item->>'selectedIndex')::integer else null end;
    if selected is not null and selected not between 0 and 3 then raise exception 'Invalid selected answer'; end if;

    select * into q from public.practice_questions
    where id=qid and review_status in('source_verified','expert_approved');
    if q.id is null then raise exception 'Question is not approved or no longer available'; end if;

    total:=total+1;
    if selected=q.correct_index then correct_count:=correct_count+1; end if;
    review:=review||jsonb_build_array(jsonb_build_object(
      'id',q.id,
      'subject',q.subject,
      'topic',q.topic,
      'selectedIndex',selected,
      'correctIndex',q.correct_index,
      'correct',selected=q.correct_index,
      'explanation',q.explanation,
      'sourceFileName',q.source_file_name,
      'evidenceText',coalesce(q.provenance->>'evidenceText',q.provenance->>'answerEvidence','')
    ));
  end loop;

  perform private.audit_event('practice.quiz.submit','practice_questions',mid::text,'info',jsonb_build_object('total',total,'correct',correct_count));
  return jsonb_build_object(
    'score',case when total=0 then 0 else round(100.0*correct_count/total)::integer end,
    'correctCount',correct_count,
    'total',total,
    'review',review,
    'submittedAt',now()
  );
end $$;
revoke all on function public.practice_quiz_submit_v1(jsonb) from public,anon;
grant execute on function public.practice_quiz_submit_v1(jsonb) to authenticated;
