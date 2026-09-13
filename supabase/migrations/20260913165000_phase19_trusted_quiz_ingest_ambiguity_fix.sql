-- Phase 19.1: repair PL/pgSQL ambiguity in the canonical trusted quiz ingest RPC.
-- Keep the existing security/provenance contract unchanged; only disambiguate the local source-hash variable.
create or replace function public.practice_trusted_quiz_ingest_v1(p_document jsonb, p_questions jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  mid uuid:=private.current_member_id();
  file_id text:=btrim(coalesce(p_document->>'driveFileId',''));
  file_name text:=left(btrim(coalesce(p_document->>'fileName','')),300);
  v_source_hash text:=left(btrim(coalesce(p_document->>'sourceHash','')),160);
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
  if file_id='' or file_name='' or v_source_hash='' then
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
    file_id,file_name,left(coalesce(p_document->>'mimeType',''),180),modified_time,v_source_hash,subject_hint,
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
       or coalesce(prov->>'sourceHash','')<>v_source_hash
       or upper(coalesce(prov->>'markedAnswer',''))<>marked_answer then
      raise exception 'Trusted question provenance invalid';
    end if;

    ext:=left(btrim(coalesce(q->>'externalKey','')),240);
    if ext='' or ext not like ('trusted:'||file_id||':%') then
      raise exception 'Trusted external key invalid';
    end if;

    select p.review_status,
           p.content_hash is not distinct from left(coalesce(q->>'contentHash',v_source_hash),64)
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
      left(coalesce(q->>'contentHash',v_source_hash),64),
      left(coalesce(nullif(btrim(q->>'subject'),''),subject_hint),160),
      left(coalesce(nullif(btrim(q->>'topic'),''),'Tổng hợp'),180),
      left(btrim(coalesce(q->>'stem','')),4000),
      opts,
      correct_idx::smallint,
      left(coalesce(q->>'explanation',''),4000),
      file_id,file_name,modified_time,v_source_hash,
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
  set question_count=(select count(*) from public.practice_questions q2 where q2.source_file_id=file_id),
      sync_status='ready',last_synced_at=now(),updated_at=now()
  where drive_file_id=file_id;

  perform private.audit_event('practice.trusted.ingest','practice_source_document',file_id,'info',jsonb_build_object('inserted',inserted_count,'updated',updated_count,'file_name',file_name,'source_mark','word-font-color-red-v1'));
  return jsonb_build_object('ok',true,'driveFileId',file_id,'inserted',inserted_count,'updated',updated_count);
end
$function$;