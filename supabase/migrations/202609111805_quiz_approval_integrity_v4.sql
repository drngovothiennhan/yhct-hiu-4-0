-- Quiz approval integrity v4
-- 1) Never carry expert approval across changed approved content.
-- 2) Repair an existing daily session if any question loses approved eligibility.

create or replace function public.practice_drive_ingest_admin_v1(
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
  file_name text:=btrim(coalesce(p_document->>'fileName',''));
  source_hash text:=btrim(coalesce(p_document->>'sourceHash',''));
  subject_hint text:=left(btrim(coalesce(p_document->>'subjectHint','Chưa phân loại')),160);
  sync_status text:=coalesce(nullif(btrim(p_document->>'syncStatus'),''),'synced');
  q jsonb;
  opts text[];
  ext text;
  method text;
  requested_review text;
  final_review text;
  inserted_count integer:=0;
  updated_count integer:=0;
  qid uuid;
  existing_status text;
begin
  if mid is null or not exists(
    select 1 from public.club_members m
    where m.id=mid and m.status='approved' and m.role='admin'
  ) then
    raise exception 'Admin required';
  end if;

  if file_id='' or file_name='' or source_hash='' then
    raise exception 'Invalid Drive document metadata';
  end if;

  if sync_status not in('synced','needs_ai_conversion','needs_review','ready','error') then
    sync_status:='error';
  end if;

  insert into public.practice_source_documents(
    drive_file_id,file_name,mime_type,source_modified_time,source_hash,subject_hint,
    sync_status,sync_message,question_count,last_synced_at,updated_at
  )
  values(
    file_id,
    left(file_name,300),
    left(coalesce(p_document->>'mimeType',''),180),
    nullif(p_document->>'modifiedTime','')::timestamptz,
    source_hash,
    subject_hint,
    sync_status,
    left(coalesce(p_document->>'syncMessage',''),500),
    case when jsonb_typeof(p_questions)='array' then jsonb_array_length(p_questions) else 0 end,
    now(),now()
  )
  on conflict(drive_file_id) do update set
    file_name=excluded.file_name,
    mime_type=excluded.mime_type,
    source_modified_time=excluded.source_modified_time,
    source_hash=excluded.source_hash,
    subject_hint=excluded.subject_hint,
    sync_status=excluded.sync_status,
    sync_message=excluded.sync_message,
    question_count=excluded.question_count,
    last_synced_at=now(),
    updated_at=now();

  if jsonb_typeof(p_questions)<>'array' then
    raise exception 'Questions must be an array';
  end if;

  for q in select value from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(q->'options')<>'array' or jsonb_array_length(q->'options')<>4 then
      continue;
    end if;

    select array_agg(left(btrim(value),1500) order by ord)
      into opts
    from jsonb_array_elements_text(q->'options') with ordinality x(value,ord);

    if exists(select 1 from unnest(opts) x where char_length(x)<1) then
      continue;
    end if;

    if coalesce((q->>'correctIndex')::integer,-1) not between 0 and 3 then
      continue;
    end if;

    ext:=left(btrim(coalesce(q->>'externalKey','')),240);
    if ext='' then
      continue;
    end if;

    method:=coalesce(nullif(btrim(q->>'generationMethod'),''),'ai_generated');
    if method not in('parsed','ai_generated') then
      method:='ai_generated';
    end if;

    requested_review:=coalesce(nullif(btrim(q->>'reviewStatus'),''),'needs_review');
    final_review:=case
      when method='parsed' and requested_review='source_verified' then 'source_verified'
      else 'needs_review'
    end;

    select review_status into existing_status
    from public.practice_questions
    where external_key=ext;

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
      (q->>'correctIndex')::smallint,
      left(coalesce(q->>'explanation',''),4000),
      file_id,
      left(file_name,300),
      nullif(p_document->>'modifiedTime','')::timestamptz,
      source_hash,
      method,
      final_review,
      coalesce(q->'provenance','{}'::jsonb),
      now()
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
      generation_method=excluded.generation_method,
      review_status=case
        when public.practice_questions.review_status='expert_approved'
         and public.practice_questions.content_hash is not distinct from excluded.content_hash
         and public.practice_questions.subject is not distinct from excluded.subject
         and public.practice_questions.topic is not distinct from excluded.topic
         and public.practice_questions.stem is not distinct from excluded.stem
         and public.practice_questions.options is not distinct from excluded.options
         and public.practice_questions.correct_index is not distinct from excluded.correct_index
         and public.practice_questions.explanation is not distinct from excluded.explanation
        then 'expert_approved'
        else excluded.review_status
      end,
      expert_verified_by=case
        when public.practice_questions.review_status='expert_approved'
         and public.practice_questions.content_hash is not distinct from excluded.content_hash
         and public.practice_questions.subject is not distinct from excluded.subject
         and public.practice_questions.topic is not distinct from excluded.topic
         and public.practice_questions.stem is not distinct from excluded.stem
         and public.practice_questions.options is not distinct from excluded.options
         and public.practice_questions.correct_index is not distinct from excluded.correct_index
         and public.practice_questions.explanation is not distinct from excluded.explanation
        then public.practice_questions.expert_verified_by
        else null
      end,
      expert_verified_at=case
        when public.practice_questions.review_status='expert_approved'
         and public.practice_questions.content_hash is not distinct from excluded.content_hash
         and public.practice_questions.subject is not distinct from excluded.subject
         and public.practice_questions.topic is not distinct from excluded.topic
         and public.practice_questions.stem is not distinct from excluded.stem
         and public.practice_questions.options is not distinct from excluded.options
         and public.practice_questions.correct_index is not distinct from excluded.correct_index
         and public.practice_questions.explanation is not distinct from excluded.explanation
        then public.practice_questions.expert_verified_at
        else null
      end,
      provenance=case
        when public.practice_questions.review_status='expert_approved'
         and public.practice_questions.content_hash is not distinct from excluded.content_hash
         and public.practice_questions.subject is not distinct from excluded.subject
         and public.practice_questions.topic is not distinct from excluded.topic
         and public.practice_questions.stem is not distinct from excluded.stem
         and public.practice_questions.options is not distinct from excluded.options
         and public.practice_questions.correct_index is not distinct from excluded.correct_index
         and public.practice_questions.explanation is not distinct from excluded.explanation
        then public.practice_questions.provenance || excluded.provenance
        when public.practice_questions.review_status='expert_approved'
        then excluded.provenance || jsonb_build_object(
          'approvalInvalidatedAt',now(),
          'approvalInvalidatedReason','content_changed',
          'priorApprovalStatus','expert_approved'
        )
        else excluded.provenance
      end,
      updated_at=now()
    returning id into qid;

    if existing_status is null then
      inserted_count:=inserted_count+1;
    else
      updated_count:=updated_count+1;
    end if;
  end loop;

  update public.practice_source_documents d
  set
    question_count=(select count(*) from public.practice_questions q2 where q2.source_file_id=file_id),
    sync_status=case
      when exists(select 1 from public.practice_questions q3 where q3.source_file_id=file_id and q3.review_status='needs_review') then 'needs_review'
      when exists(select 1 from public.practice_questions q4 where q4.source_file_id=file_id and q4.review_status in('source_verified','expert_approved')) then 'ready'
      else d.sync_status
    end,
    updated_at=now()
  where d.drive_file_id=file_id;

  perform private.audit_event(
    'practice.drive.ingest','practice_source_document',file_id,'info',
    jsonb_build_object('inserted',inserted_count,'updated',updated_count,'file_name',file_name)
  );

  return jsonb_build_object(
    'ok',true,'driveFileId',file_id,'inserted',inserted_count,'updated',updated_count
  );
end
$$;

create or replace function public.daily_practice_today_v1(p_count integer default 10)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  today_date date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  requested integer:=least(greatest(coalesce(p_count,10),1),30);
  target integer;
  eligible integer;
  retained uuid[]:='{}'::uuid[];
  refill uuid[]:='{}'::uuid[];
  ids uuid[]:='{}'::uuid[];
  clean_answers jsonb:='{}'::jsonb;
  answer_count integer:=0;
  questions jsonb;
  s public.daily_practice_sessions%rowtype;
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required';
  end if;

  select count(*) into eligible
  from public.practice_questions
  where review_status in('source_verified','expert_approved');

  if eligible=0 then
    return jsonb_build_object(
      'ready',false,'practiceDate',today_date,'available',0,'questions','[]'::jsonb
    );
  end if;

  select * into s
  from public.daily_practice_sessions
  where member_id=mid and practice_date=today_date
  for update;

  if s.id is null then
    target:=least(requested,eligible);

    select coalesce(array_agg(id),'{}'::uuid[]) into ids
    from (
      select q.id
      from public.practice_questions q
      left join public.daily_practice_question_stats st
        on st.member_id=mid and st.question_id=q.id
      where q.review_status in('source_verified','expert_approved')
      order by
        case when st.question_id is null then 0 when st.wrong_count>st.correct_count then 1 else 2 end,
        coalesce(st.wrong_count,0) desc,
        st.last_seen_at nulls first,
        md5(mid::text||'|'||today_date::text||'|'||q.id::text)
      limit target
    ) picked;

    insert into public.daily_practice_sessions(member_id,practice_date,question_ids)
    values(mid,today_date,ids)
    on conflict(member_id,practice_date) do nothing;

    select * into s
    from public.daily_practice_sessions
    where member_id=mid and practice_date=today_date
    for update;
  end if;

  -- The first created set fixes the user's daily size. It may shrink only if the
  -- currently approved bank has fewer eligible questions.
  target:=least(
    case when cardinality(s.question_ids)>0 then cardinality(s.question_ids) else requested end,
    eligible,
    30
  );

  -- Preserve order for still-approved questions from today's set.
  select coalesce(array_agg(u.id order by u.ord),'{}'::uuid[])
    into retained
  from unnest(s.question_ids) with ordinality u(id,ord)
  join public.practice_questions q on q.id=u.id
  where q.review_status in('source_verified','expert_approved');

  -- Deterministically top up only the invalidated/missing slots.
  if cardinality(retained)<target then
    select coalesce(array_agg(id),'{}'::uuid[]) into refill
    from (
      select q.id
      from public.practice_questions q
      left join public.daily_practice_question_stats st
        on st.member_id=mid and st.question_id=q.id
      where q.review_status in('source_verified','expert_approved')
        and not (q.id=any(retained))
      order by
        case when st.question_id is null then 0 when st.wrong_count>st.correct_count then 1 else 2 end,
        coalesce(st.wrong_count,0) desc,
        st.last_seen_at nulls first,
        md5(mid::text||'|'||today_date::text||'|'||q.id::text)
      limit greatest(target-cardinality(retained),0)
    ) picked;
  end if;

  ids:=retained||refill;

  select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb)
    into clean_answers
  from jsonb_each(coalesce(s.answers,'{}'::jsonb)) e
  where exists(
    select 1 from unnest(ids) x(id) where x.id::text=e.key
  );

  select count(*) into answer_count
  from jsonb_object_keys(clean_answers);

  if ids is distinct from s.question_ids or clean_answers is distinct from s.answers then
    update public.daily_practice_sessions
    set
      question_ids=ids,
      answers=clean_answers,
      status=case
        when cardinality(ids)>0 and answer_count>=cardinality(ids) then 'completed'
        else 'active'
      end,
      completed_at=case
        when cardinality(ids)>0 and answer_count>=cardinality(ids) then coalesce(s.completed_at,now())
        else null
      end
    where id=s.id
    returning * into s;

    perform private.audit_event(
      'practice.daily.refresh','daily_practice_session',s.id::text,'info',
      jsonb_build_object(
        'practice_date',today_date,
        'question_count',cardinality(ids),
        'removed_or_replaced',true
      )
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',q.id,
        'subject',q.subject,
        'topic',q.topic,
        'stem',q.stem,
        'options',to_jsonb(q.options),
        'sourceFileName',q.source_file_name,
        'generationMethod',q.generation_method,
        'reviewStatus',q.review_status
      ) order by u.ord
    ),
    '[]'::jsonb
  )
  into questions
  from unnest(s.question_ids) with ordinality u(id,ord)
  join public.practice_questions q on q.id=u.id
  where q.review_status in('source_verified','expert_approved');

  return jsonb_build_object(
    'ready',true,
    'sessionId',s.id,
    'practiceDate',today_date,
    'status',s.status,
    'questionCount',cardinality(s.question_ids),
    'answers',s.answers,
    'questions',questions
  );
end
$$;

comment on function public.practice_drive_ingest_admin_v1(jsonb,jsonb) is
'ACC ingest v4: expert approval is preserved only when approved content is byte-for-byte equivalent across approval-bearing fields.';
comment on function public.daily_practice_today_v1(integer) is
'Daily Quick Review v4: stable daily set with automatic pruning/top-up when eligibility changes.';
