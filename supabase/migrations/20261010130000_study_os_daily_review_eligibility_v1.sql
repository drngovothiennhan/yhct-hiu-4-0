-- Study OS daily grounded review v1 (2026-10-10). Replaces three functions; signatures, grants and security settings are unchanged.
--  1) Trusted questions only: expert_approved, or source_verified AND parsed from an expert red-answer document.
--     AI-generated drafts never enter a learner's daily review.
--  2) One question per content_hash inside each member's set, so a duplicate copy is never drawn twice.
--  3) Learner progress is matched by content_hash, so collapsing duplicate copies never removes a member's pool.

create or replace function public.daily_study_review_candidates_v1(p_secret text, p_quiz_date date, p_limit integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
      select x.id,x.source_file_id,x.source_title,x.subject,x.topic,x.stem,x.options,x.correct_index,x.explanation,
        x.last_seen_at,x.wrong_count,x.attempts,
        row_number() over(order by x.score desc,x.id) as source_order
      from(
        select distinct on(q.content_hash)
          q.id,q.source_file_id,d.file_name as source_title,q.subject,q.topic,q.stem,q.options,q.correct_index,q.explanation,
          s.last_seen_at,s.wrong_count,s.attempts,
          (s.wrong_count*8.0+greatest(0,extract(epoch from (now()-coalesce(s.last_seen_at,now())))/86400.0)+random()*4.0) as score
        from public.daily_practice_question_stats s
        join public.practice_questions sq on sq.id=s.question_id
        join public.practice_questions q on q.content_hash=sq.content_hash
          and (q.review_status='expert_approved' or (q.review_status='source_verified' and q.generation_method='parsed'))
        join public.practice_source_documents d on d.drive_file_id=q.source_file_id and d.sync_status in('ready','synced') and d.source_hash=q.source_hash
        where s.member_id=a.member_id and s.last_seen_at >= now()-interval '30 days'
          and nullif(btrim(q.explanation),'') is not null
        order by q.content_hash,score desc,q.id
      ) x
      order by x.score desc,x.id
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
end $function$;

create or replace function public.daily_study_review_generate_v1(p_secret text, p_member_id uuid, p_quiz_date date, p_questions jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare set_row public.daily_study_review_sets_v1%rowtype; item jsonb; source_row public.practice_questions%rowtype; inserted integer:=0; qid uuid; seen_hashes text[]:='{}';
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
    select * into source_row from public.practice_questions where id=qid and (review_status='expert_approved' or (review_status='source_verified' and generation_method='parsed'));
    if source_row.id is null then raise exception 'Unapproved source question'; end if;
    if not exists(select 1 from public.practice_source_documents d where d.drive_file_id=source_row.source_file_id and d.sync_status in('ready','synced') and d.source_hash=source_row.source_hash) then raise exception 'Source document has changed or is unavailable'; end if;
    if not exists(select 1 from public.daily_practice_question_stats s join public.practice_questions sq on sq.id=s.question_id where s.member_id=p_member_id and sq.content_hash=source_row.content_hash and s.last_seen_at >= now()-interval '30 days') then raise exception 'Source is not part of current learner progress'; end if;
    if source_row.content_hash=any(seen_hashes) then continue; end if;
    if item->>'questionType' not in('multiple_choice','short_answer') then raise exception 'Invalid question type'; end if;
    if item->>'questionType'<>'multiple_choice' or item->'options' is distinct from to_jsonb(source_row.options)
       or item->>'correctAnswer' is distinct from source_row.options[source_row.correct_index+1]
       or item->>'explanation' is distinct from source_row.explanation
       or position(lower(item->>'evidenceQuote') in lower(source_row.stem||' '||array_to_string(source_row.options,' ')||' '||source_row.explanation))=0 then
      raise exception 'Generated question failed canonical source checks';
    end if;
    seen_hashes:=array_append(seen_hashes,source_row.content_hash);
    insert into public.daily_study_review_questions_v1(set_id,member_id,source_question_id,source_file_id,question_type,stem,options,correct_answer,explanation,evidence_quote,source_title)
    values(set_row.id,p_member_id,qid,source_row.source_file_id,'multiple_choice',left(btrim(item->>'stem'),700),item->'options',left(btrim(item->>'correctAnswer'),500),left(btrim(item->>'explanation'),1000),left(btrim(item->>'evidenceQuote'),600),left(source_row.source_file_name,300));
    inserted:=inserted+1;
  end loop;
  if inserted not between 3 and 5 then raise exception 'Daily quiz must have three to five validated questions'; end if;
  return jsonb_build_object('ok',true,'created',true,'setId',set_row.id,'questionCount',inserted);
end $function$;

create or replace function public.daily_study_review_today_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
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
    'hasEligibleSource',exists(
      select 1 from public.daily_practice_question_stats s
      join public.practice_questions sq on sq.id=s.question_id
      join public.practice_questions q on q.content_hash=sq.content_hash
        and (q.review_status='expert_approved' or (q.review_status='source_verified' and q.generation_method='parsed'))
      join public.practice_source_documents d on d.drive_file_id=q.source_file_id and d.sync_status in('ready','synced') and d.source_hash=q.source_hash
      where s.member_id=mid and s.attempts>0 and nullif(btrim(q.explanation),'') is not null and s.last_seen_at>=now()-interval '30 days'
    ),
    'questions',result
  );
end $function$;
