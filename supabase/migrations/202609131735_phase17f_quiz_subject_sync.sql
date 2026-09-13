-- Phase 17F: resumable manual quiz intake.
-- Folder name under `Thêm thủ công` is the canonical subject.
-- Files without deterministic red-answer evidence are registered as waiting, not fatal.

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
    'fileName',d.file_name,
    'sourceHash',d.source_hash,
    'modifiedTime',d.source_modified_time,
    'subjectHint',d.subject_hint,
    'syncStatus',d.sync_status,
    'questionCount',d.question_count,
    'lastSyncedAt',d.last_synced_at
  )),'[]'::jsonb)
  into result
  from public.practice_source_documents d
  where d.drive_file_id=any(coalesce(p_file_ids,'{}'::text[]));
  return result;
end
$$;

create or replace function public.practice_source_pending_admin_v1(p_document jsonb)
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
  message text:=left(coalesce(nullif(btrim(p_document->>'syncMessage'),''),'Chờ admin bổ sung đáp án tô đỏ.'),500);
  current_count integer:=0;
begin
  if mid is null or not private.is_learning_content_manager() then
    raise exception 'Learning content manager required';
  end if;
  if file_id='' or file_name='' or source_hash='' then
    raise exception 'Invalid pending source metadata';
  end if;

  select count(*) into current_count
  from public.practice_questions q
  where q.source_file_id=file_id and q.review_status<>'rejected';

  insert into public.practice_source_documents(
    drive_file_id,file_name,mime_type,source_modified_time,source_hash,subject_hint,
    sync_status,sync_message,question_count,last_synced_at,updated_at
  ) values(
    file_id,file_name,left(coalesce(p_document->>'mimeType',''),180),modified_time,source_hash,subject_hint,
    'needs_review',message,current_count,now(),now()
  )
  on conflict(drive_file_id) do update set
    file_name=excluded.file_name,
    mime_type=excluded.mime_type,
    source_modified_time=excluded.source_modified_time,
    source_hash=excluded.source_hash,
    subject_hint=excluded.subject_hint,
    sync_status='needs_review',
    sync_message=excluded.sync_message,
    question_count=(select count(*) from public.practice_questions q where q.source_file_id=file_id and q.review_status<>'rejected'),
    last_synced_at=now(),
    updated_at=now();

  perform private.audit_event(
    'practice.source.waiting_red_answer',
    'practice_source_document',
    file_id,
    'info',
    jsonb_build_object('file_name',file_name,'subject',subject_hint,'source_hash',source_hash,'question_count',current_count)
  );

  return jsonb_build_object(
    'ok',true,
    'driveFileId',file_id,
    'syncStatus','needs_review',
    'subjectHint',subject_hint,
    'questionCount',current_count
  );
end
$$;

revoke all on function public.practice_source_sync_state_v1(text[]) from public,anon;
revoke all on function public.practice_source_pending_admin_v1(jsonb) from public,anon;
grant execute on function public.practice_source_sync_state_v1(text[]) to authenticated;
grant execute on function public.practice_source_pending_admin_v1(jsonb) to authenticated;
