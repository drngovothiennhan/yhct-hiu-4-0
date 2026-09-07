create or replace function public.drl_admin_lock_semester_v1(p_semester_id uuid, p_locked boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare
  mid uuid:=private.current_member_id();
  previous_lock_at timestamptz;
  previous_locked_at timestamptz;
  current_published boolean;
begin
  if not private.has_min_role('admin') then
    raise exception 'Admin role required';
  end if;

  select lock_at,locked_at,is_published
    into previous_lock_at,previous_locked_at,current_published
  from public.drl_semesters
  where id=p_semester_id
  for update;

  if not found then raise exception 'Semester not found'; end if;

  if p_locked and current_published then
    raise exception 'Published semester is already immutable';
  end if;

  update public.drl_semesters
  set locked_at=case when p_locked then now() else null end,
      locked_by=case when p_locked then mid else null end,
      lock_at=case when p_locked then lock_at else null end,
      updated_at=now()
  where id=p_semester_id;

  perform private.audit_event(
    case when p_locked then 'drl.semester.lock' else 'drl.semester.unlock' end,
    'drl_semester',
    p_semester_id::text,
    'warning',
    jsonb_build_object(
      'previous_lock_at',previous_lock_at,
      'previous_locked_at',previous_locked_at,
      'cleared_scheduled_lock',case when not p_locked and previous_lock_at is not null then true else false end
    )
  );

  return true;
end
$function$;

revoke all on function public.drl_admin_lock_semester_v1(uuid,boolean) from public,anon;
grant execute on function public.drl_admin_lock_semester_v1(uuid,boolean) to authenticated,service_role;

comment on function public.drl_admin_lock_semester_v1(uuid,boolean) is
'Admin-only lock/unlock contract. Unlock clears both locked_at and scheduled lock_at so subsequent DRL imports are not rejected as semester_locked.';
