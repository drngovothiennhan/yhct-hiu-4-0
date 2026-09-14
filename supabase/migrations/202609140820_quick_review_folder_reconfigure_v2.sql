-- Quick review v2: member-facing content is folder-based and can be reselected during the day.
-- Existing v1 answer contract is preserved; v2 only changes how today's question set is created/reset.

alter table public.daily_practice_sessions
  add column if not exists subject text not null default '';

create or replace function public.daily_practice_config_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  eligible integer:=0;
  candidate integer:=0;
  today_date date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  existing uuid;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;

  select
    count(*) filter(where q.review_status in('source_verified','expert_approved')),
    count(*) filter(where q.review_status='needs_review')
  into eligible,candidate
  from public.practice_questions q
  join private.practice_subject_folders_v1 f on f.active and f.folder_name=q.subject
  where q.review_status<>'rejected';

  select id into existing
  from public.daily_practice_sessions
  where member_id=mid and practice_date=today_date;

  return jsonb_build_object(
    'ready',eligible>0,
    'eligibleCount',eligible,
    'needsReviewCount',candidate,
    'practiceDate',today_date,
    'hasTodaySession',existing is not null,
    'defaultCount',least(10,eligible)
  );
end
$$;

create or replace function public.daily_practice_today_v2(
  p_count integer default 10,
  p_subject text default '',
  p_reset boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  today_date date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  requested integer:=least(greatest(coalesce(p_count,10),1),30);
  requested_subject text:=left(btrim(coalesce(p_subject,'')),160);
  target_subject text:=requested_subject;
  s public.daily_practice_sessions%rowtype;
  ids uuid[];
  questions jsonb;
  eligible integer:=0;
  invalid_session boolean:=false;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;

  if requested_subject<>'' and not exists(
    select 1 from private.practice_subject_folders_v1 f
    where f.active and f.folder_name=requested_subject
  ) then
    raise exception 'Nội dung HIU không còn trong lần cập nhật mới nhất';
  end if;

  select * into s
  from public.daily_practice_sessions
  where member_id=mid and practice_date=today_date
  for update;

  -- Restoring today's session keeps its original folder/count. A user-triggered reset
  -- applies the newly selected folder/count.
  if s.id is not null and not coalesce(p_reset,false) then
    target_subject:=left(btrim(coalesce(s.subject,'')),160);
    if target_subject<>'' and not exists(
      select 1 from private.practice_subject_folders_v1 f
      where f.active and f.folder_name=target_subject
    ) then
      target_subject:='';
    end if;
    requested:=least(greatest(coalesce(cardinality(s.question_ids),requested),1),30);
  end if;

  select count(*) into eligible
  from public.practice_questions q
  join private.practice_subject_folders_v1 f on f.active and f.folder_name=q.subject
  where q.review_status in('source_verified','expert_approved')
    and (target_subject='' or q.subject=target_subject);

  if eligible=0 then
    return jsonb_build_object(
      'ready',false,
      'practiceDate',today_date,
      'subject',target_subject,
      'available',0,
      'questions','[]'::jsonb
    );
  end if;

  if s.id is not null then
    select exists(
      select 1
      from unnest(s.question_ids) u(id)
      left join public.practice_questions q on q.id=u.id
      left join private.practice_subject_folders_v1 f on f.active and f.folder_name=q.subject
      where q.id is null
         or q.review_status not in('source_verified','expert_approved')
         or f.folder_name is null
         or (target_subject<>'' and q.subject<>target_subject)
    ) into invalid_session;
  end if;

  if s.id is null or coalesce(p_reset,false) or invalid_session then
    select array_agg(p.id order by p.ord) into ids
    from (
      select q.id,
             row_number() over(
               order by
                 case when st.question_id is null then 0 when st.wrong_count>st.correct_count then 1 else 2 end,
                 coalesce(st.wrong_count,0) desc,
                 st.last_seen_at nulls first,
                 md5(mid::text||'|'||today_date::text||'|'||target_subject||'|'||requested::text||'|'||q.id::text)
             ) as ord
      from public.practice_questions q
      join private.practice_subject_folders_v1 f on f.active and f.folder_name=q.subject
      left join public.daily_practice_question_stats st on st.member_id=mid and st.question_id=q.id
      where q.review_status in('source_verified','expert_approved')
        and (target_subject='' or q.subject=target_subject)
      order by
        case when st.question_id is null then 0 when st.wrong_count>st.correct_count then 1 else 2 end,
        coalesce(st.wrong_count,0) desc,
        st.last_seen_at nulls first,
        md5(mid::text||'|'||today_date::text||'|'||target_subject||'|'||requested::text||'|'||q.id::text)
      limit least(requested,eligible)
    ) p;

    if s.id is null then
      insert into public.daily_practice_sessions(member_id,practice_date,question_ids,subject)
      values(mid,today_date,coalesce(ids,'{}'::uuid[]),target_subject)
      returning * into s;
    else
      update public.daily_practice_sessions
      set question_ids=coalesce(ids,'{}'::uuid[]),
          answers='{}'::jsonb,
          status='active',
          subject=target_subject,
          started_at=now(),
          completed_at=null
      where id=s.id
      returning * into s;
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,
    'subject',q.subject,
    'topic',q.topic,
    'stem',q.stem,
    'options',to_jsonb(q.options),
    'sourceFileName',q.source_file_name,
    'generationMethod',q.generation_method,
    'reviewStatus',q.review_status
  ) order by u.ord),'[]'::jsonb)
  into questions
  from unnest(s.question_ids) with ordinality u(id,ord)
  join public.practice_questions q on q.id=u.id
  join private.practice_subject_folders_v1 f on f.active and f.folder_name=q.subject
  where q.review_status in('source_verified','expert_approved');

  return jsonb_build_object(
    'ready',true,
    'sessionId',s.id,
    'practiceDate',today_date,
    'status',s.status,
    'subject',coalesce(s.subject,''),
    'questionCount',jsonb_array_length(questions),
    'available',eligible,
    'answers',s.answers,
    'questions',questions
  );
end
$$;

revoke all on function public.daily_practice_today_v2(integer,text,boolean) from public,anon;
grant execute on function public.daily_practice_today_v2(integer,text,boolean) to authenticated;
