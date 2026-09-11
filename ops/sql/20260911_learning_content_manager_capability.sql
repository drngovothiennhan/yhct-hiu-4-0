-- HIU YHCT 4.0 — scoped learning-content capability
-- Keeps app_role unchanged. The exact appointment title grants only learning-content operations.

create or replace function private.is_learning_content_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.club_members m
    where m.id = private.current_member_id()
      and m.status = 'approved'
      and m.login_enabled
      and not m.data_conflict
      and (m.role = 'admin' or m.position_title = 'Ban Quản lý Học tập')
  );
$$;

revoke all on function private.is_learning_content_manager() from public;

create or replace function public.current_member_access_v1()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'private', 'pg_catalog'
as $function$
declare m public.club_members%rowtype;
begin
  select * into m from public.club_members where auth_user_id=(select auth.uid()) limit 1;
  if not found then return jsonb_build_object('authenticated',false); end if;
  return jsonb_build_object(
    'authenticated',true,
    'memberId',m.id,
    'role',m.role,
    'status',m.status,
    'loginEnabled',m.login_enabled,
    'dataConflict',m.data_conflict,
    'positionTitle',m.position_title,
    'approved',(m.status='approved' and m.login_enabled and not m.data_conflict),
    'learningContentManager',(m.status='approved' and m.login_enabled and not m.data_conflict and (m.role='admin' or m.position_title='Ban Quản lý Học tập'))
  );
end
$function$;

create or replace function public.practice_drive_ingest_admin_v1(p_document jsonb, p_questions jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
 mid uuid:=private.current_member_id(); file_id text:=btrim(coalesce(p_document->>'driveFileId','')); file_name text:=btrim(coalesce(p_document->>'fileName','')); source_hash text:=btrim(coalesce(p_document->>'sourceHash','')); subject_hint text:=left(btrim(coalesce(p_document->>'subjectHint','Chưa phân loại')),160); sync_status text:=coalesce(nullif(btrim(p_document->>'syncStatus'),''),'synced'); q jsonb; opts text[]; ext text; method text; requested_review text; final_review text; inserted_count integer:=0; updated_count integer:=0; qid uuid; existing_status text;
begin
 if mid is null or not private.is_learning_content_manager() then raise exception 'Learning content manager required'; end if;
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
  on conflict(external_key) do update set
   content_hash=excluded.content_hash,subject=excluded.subject,topic=excluded.topic,stem=excluded.stem,options=excluded.options,correct_index=excluded.correct_index,explanation=excluded.explanation,source_file_id=excluded.source_file_id,source_file_name=excluded.source_file_name,source_modified_time=excluded.source_modified_time,source_hash=excluded.source_hash,generation_method=excluded.generation_method,
   review_status=case when public.practice_questions.review_status='expert_approved' and public.practice_questions.content_hash is not distinct from excluded.content_hash and public.practice_questions.subject is not distinct from excluded.subject and public.practice_questions.topic is not distinct from excluded.topic and public.practice_questions.stem is not distinct from excluded.stem and public.practice_questions.options is not distinct from excluded.options and public.practice_questions.correct_index is not distinct from excluded.correct_index and public.practice_questions.explanation is not distinct from excluded.explanation then 'expert_approved' else excluded.review_status end,
   expert_verified_by=case when public.practice_questions.review_status='expert_approved' and public.practice_questions.content_hash is not distinct from excluded.content_hash and public.practice_questions.subject is not distinct from excluded.subject and public.practice_questions.topic is not distinct from excluded.topic and public.practice_questions.stem is not distinct from excluded.stem and public.practice_questions.options is not distinct from excluded.options and public.practice_questions.correct_index is not distinct from excluded.correct_index and public.practice_questions.explanation is not distinct from excluded.explanation then public.practice_questions.expert_verified_by else null end,
   expert_verified_at=case when public.practice_questions.review_status='expert_approved' and public.practice_questions.content_hash is not distinct from excluded.content_hash and public.practice_questions.subject is not distinct from excluded.subject and public.practice_questions.topic is not distinct from excluded.topic and public.practice_questions.stem is not distinct from excluded.stem and public.practice_questions.options is not distinct from excluded.options and public.practice_questions.correct_index is not distinct from excluded.correct_index and public.practice_questions.explanation is not distinct from excluded.explanation then public.practice_questions.expert_verified_at else null end,
   provenance=case when public.practice_questions.review_status='expert_approved' and public.practice_questions.content_hash is not distinct from excluded.content_hash and public.practice_questions.subject is not distinct from excluded.subject and public.practice_questions.topic is not distinct from excluded.topic and public.practice_questions.stem is not distinct from excluded.stem and public.practice_questions.options is not distinct from excluded.options and public.practice_questions.correct_index is not distinct from excluded.correct_index and public.practice_questions.explanation is not distinct from excluded.explanation then public.practice_questions.provenance||excluded.provenance when public.practice_questions.review_status='expert_approved' then excluded.provenance||jsonb_build_object('approvalInvalidatedAt',now(),'approvalInvalidatedReason','content_changed','priorApprovalStatus','expert_approved') else excluded.provenance end,
   updated_at=now()
  returning id into qid;
  if existing_status is null then inserted_count:=inserted_count+1; else updated_count:=updated_count+1; end if;
 end loop;
 update public.practice_source_documents d set question_count=(select count(*) from public.practice_questions q2 where q2.source_file_id=file_id),sync_status=case when exists(select 1 from public.practice_questions q3 where q3.source_file_id=file_id and q3.review_status='needs_review') then 'needs_review' when exists(select 1 from public.practice_questions q4 where q4.source_file_id=file_id and q4.review_status in('source_verified','expert_approved')) then 'ready' else d.sync_status end,updated_at=now() where d.drive_file_id=file_id;
 perform private.audit_event('practice.drive.ingest','practice_source_document',file_id,'info',jsonb_build_object('inserted',inserted_count,'updated',updated_count,'file_name',file_name));
 return jsonb_build_object('ok',true,'driveFileId',file_id,'inserted',inserted_count,'updated',updated_count);
end
$function$;

create or replace function public.practice_import_workspace_v2(p_action text, p_key text default ''::text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare mid uuid:=private.current_member_id(); d public.practice_import_drafts_v2%rowtype; result jsonb; ids jsonb; remaining integer;
begin
 if mid is null or not private.is_learning_content_manager() then raise exception 'Learning content manager required'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'fileName',x.payload->'document'->>'fileName','subject',x.payload->'document'->>'subjectHint','total',jsonb_array_length(x.payload->'questions'),'pending',(select count(*) from jsonb_array_elements(x.payload->'questions') q where coalesce((q->>'imported')::boolean,false)=false),'updatedAt',x.updated_at) order by x.updated_at desc),'[]'::jsonb) into result from (select * from public.practice_import_drafts_v2 order by updated_at desc limit 100) x;
  return result;
 end if;
 if char_length(p_key) not between 1 and 240 then raise exception 'Invalid draft key'; end if;
 if p_action='save' then
  if jsonb_typeof(p_payload->'questions') is distinct from 'array' or jsonb_array_length(p_payload->'questions')>1000 or octet_length(p_payload::text)>3000000 then raise exception 'Invalid or oversized draft'; end if;
  insert into public.practice_import_drafts_v2(id,payload,created_by) values(p_key,p_payload,mid) on conflict(id) do nothing;
 end if;
 select * into d from public.practice_import_drafts_v2 where id=p_key for update;
 if d.id is null then raise exception 'Draft not found'; end if;
 if p_action in('get','save') then return d.payload||jsonb_build_object('id',d.id,'revision',d.revision); end if;
 if p_action='commit' then
  if coalesce((p_payload->>'revision')::integer,-1)<>d.revision then raise exception 'Draft changed. Reload before importing.'; end if;
  ids:=p_payload->'ids';
  if jsonb_typeof(ids) is distinct from 'array' or jsonb_typeof(p_payload->'questions') is distinct from 'array' then raise exception 'Invalid questions'; end if;
  if jsonb_array_length(ids)=0 or jsonb_array_length(ids)>200 or (select count(distinct value) from jsonb_array_elements_text(ids))<>jsonb_array_length(ids) or jsonb_array_length(ids)<>jsonb_array_length(p_payload->'questions') then raise exception 'Invalid selection'; end if;
  if exists(select 1 from jsonb_array_elements_text(ids) i where not exists(select 1 from jsonb_array_elements(d.payload->'questions') q where q->>'id'=i and coalesce((q->>'imported')::boolean,false)=false)) then raise exception 'Question already imported or missing'; end if;
  result:=public.practice_drive_ingest_admin_v1(d.payload->'document',p_payload->'questions');
  update public.practice_import_drafts_v2 set payload=jsonb_set(payload,'{questions}',(select jsonb_agg(case when ids ? (q->>'id') then q||jsonb_build_object('imported',true,'importedSnapshot',(select v from jsonb_array_elements(p_payload->'questions') with ordinality z(v,n) where n=(select k from jsonb_array_elements_text(ids) with ordinality i(t,k) where t=q->>'id'))) else q end order by ord) from jsonb_array_elements(payload->'questions') with ordinality a(q,ord))),revision=revision+1,updated_at=now() where id=p_key;
  select count(*) into remaining from public.practice_import_drafts_v2 x cross join lateral jsonb_array_elements(x.payload->'questions') q where x.id=p_key and coalesce((q->>'imported')::boolean,false)=false;
  update public.practice_source_documents set question_count=(select count(*) from public.practice_questions where source_file_id=d.payload->'document'->>'driveFileId'),sync_status=case when remaining>0 then 'needs_review' else 'ready' end where drive_file_id=d.payload->'document'->>'driveFileId';
  return result||jsonb_build_object('remaining',remaining);
 end if;
 raise exception 'Invalid action';
end
$function$;

create or replace function public.practice_question_review_queue_v1(p_limit integer default 5)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare mid uuid:=private.current_member_id(); role_name text; result jsonb;
begin
  select role into role_name from public.club_members where id=mid and status='approved';
  if role_name not in('admin','super_mod','mod','leader') and not private.is_learning_content_manager() then raise exception 'Moderator or learning content manager required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'subject',q.subject,'topic',q.topic,'stem',q.stem,'options',to_jsonb(q.options),'correctIndex',q.correct_index,
    'explanation',q.explanation,'sourceFileName',q.source_file_name,'sourceModifiedTime',q.source_modified_time,
    'generationMethod',q.generation_method,'provenance',q.provenance,'createdAt',q.created_at
  ) order by q.created_at asc),'[]'::jsonb) into result
  from (select * from public.practice_questions where review_status='needs_review' order by created_at asc limit least(greatest(coalesce(p_limit,5),1),20)) q;
  return result;
end
$function$;

create or replace function public.practice_question_review_v1(p_question_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare mid uuid:=private.current_member_id(); role_name text; next_status text:=lower(btrim(coalesce(p_status,''))); row_count_now integer;
begin
  select role into role_name from public.club_members where id=mid and status='approved';
  if role_name not in('admin','super_mod','mod','leader') and not private.is_learning_content_manager() then raise exception 'Moderator or learning content manager required'; end if;
  if next_status not in('expert_approved','rejected') then raise exception 'Invalid review status'; end if;
  update public.practice_questions set review_status=next_status,expert_verified_by=case when next_status='expert_approved' then mid else null end,expert_verified_at=case when next_status='expert_approved' then now() else null end,updated_at=now() where id=p_question_id;
  get diagnostics row_count_now=row_count;
  if row_count_now=0 then raise exception 'Question not found'; end if;
  return jsonb_build_object('ok',true,'questionId',p_question_id,'status',next_status);
end
$function$;
