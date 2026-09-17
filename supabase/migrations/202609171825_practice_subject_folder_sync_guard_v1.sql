create or replace function public.practice_subject_folders_sync_admin_v1(p_subjects text[])
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  mid uuid:=private.current_member_id();
  result jsonb:='[]'::jsonb;
  active_count integer:=0;
begin
  if mid is null or not private.is_learning_content_manager() then
    raise exception 'Learning content manager required';
  end if;

  update private.practice_subject_folders_v1
    set active=false
    where active is true;

  insert into private.practice_subject_folders_v1(folder_name,active,first_seen_at,last_seen_at)
  select s.folder_name,true,now(),now()
  from (
    select distinct left(btrim(u.value),160) as folder_name
    from unnest(coalesce(p_subjects,'{}'::text[])) as u(value)
    where btrim(u.value)<>''
      and lower(btrim(u.value)) not in ('ngân hàng hiu','ngân hàng trắc nghiệm','thêm thủ công','them thu cong')
  ) s
  on conflict(folder_name) do update set active=true,last_seen_at=now();

  select count(*),coalesce(jsonb_agg(x.folder_name order by lower(x.folder_name),x.folder_name),'[]'::jsonb)
  into active_count,result
  from (
    select folder_name
    from private.practice_subject_folders_v1
    where active
  ) x;

  perform private.audit_event(
    'practice.subject_folders.sync',
    'practice_subject_folders',
    mid::text,
    'info',
    jsonb_build_object('active_count',active_count,'subjects',result)
  );

  return jsonb_build_object('ok',true,'count',active_count,'subjects',result);
end
$function$;

revoke all on function public.practice_subject_folders_sync_admin_v1(text[]) from public;
grant execute on function public.practice_subject_folders_sync_admin_v1(text[]) to authenticated,service_role;
