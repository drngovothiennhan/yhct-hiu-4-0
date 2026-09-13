-- Phase 19.1 parser-revision retry metadata.
-- The trusted Drive updater needs the prior sync message so a file that failed under
-- an older deterministic parser can be retried exactly once after a parser upgrade.

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
    'syncMessage',d.sync_message,
    'questionCount',d.question_count,
    'lastSyncedAt',d.last_synced_at
  )),'[]'::jsonb)
  into result
  from public.practice_source_documents d
  where d.drive_file_id=any(coalesce(p_file_ids,'{}'::text[]));

  return result;
end
$$;

revoke all on function public.practice_source_sync_state_v1(text[]) from public,anon;
grant execute on function public.practice_source_sync_state_v1(text[]) to authenticated;
