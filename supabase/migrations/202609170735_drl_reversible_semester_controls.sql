-- DRL semester controls are independent, explicit Admin actions.
-- Publication confirms the semester total and can be withdrawn.
-- Lock/unlock remains the Admin write-control for the semester.

create or replace function public.drl_admin_publish_semester_v1(p_semester_id uuid, p_published boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  v_mid uuid := private.current_member_id();
  v_count integer := 0;
  v_title text;
  v_inserted integer := 0;
  v_is_published boolean;
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  if p_published is null then raise exception 'Publication state is required'; end if;

  select title,is_published into v_title,v_is_published
    from public.drl_semesters
   where id=p_semester_id
   for update;
  if not found then raise exception 'Semester not found'; end if;

  if p_published = false then
    if not v_is_published then return true; end if;

    update public.drl_semesters
       set is_published=false,
           published_at=null,
           published_by=null,
           archived_at=null,
           drive_backup_file_id=null,
           drive_backup_checksum_sha256=null,
           drive_backup_at=null,
           updated_at=now()
     where id=p_semester_id;

    perform private.audit_event(
      'drl.semester.unpublish','drl_semester',p_semester_id::text,'warning',
      jsonb_build_object('published',false,'actor_member_id',v_mid)
    );
    return true;
  end if;

  if v_is_published then return true; end if;

  select count(*)::integer into v_count
    from public.drl_activities
   where semester_id=p_semester_id;
  if v_count=0 then raise exception 'Cannot publish an empty semester'; end if;

  update public.drl_semesters
     set is_published=true,
         published_at=now(),
         published_by=v_mid,
         archived_at=null,
         updated_at=now()
   where id=p_semester_id;

  insert into public.notifications(member_id,actor_member_id,kind,title,body)
  select distinct a.member_id,v_mid,'drl_published','Điểm rèn luyện đã được công bố',
         'Điểm rèn luyện hoạt động '||v_title||' của bạn đã được công bố chính thức. Nhấn để xem chi tiết.'
    from public.drl_activities a
   where a.semester_id=p_semester_id and a.member_id is not null
     and not exists (
       select 1 from public.notifications n
        where n.member_id=a.member_id
          and n.kind='drl_published'
          and n.title='Điểm rèn luyện đã được công bố'
          and n.body like '%'||v_title||'%'
     );
  get diagnostics v_inserted=row_count;

  insert into public.notification_outbox(kind,member_id,title,body,href,payload)
  select distinct 'drl_published',a.member_id,'Điểm rèn luyện đã được công bố',
         'Điểm rèn luyện hoạt động '||v_title||' của bạn đã được công bố chính thức. Nhấn để xem chi tiết.',
         '/drl',jsonb_build_object('semester_id',p_semester_id,'semester_title',v_title)
    from public.drl_activities a
   where a.semester_id=p_semester_id and a.member_id is not null
     and not exists (
       select 1 from public.notification_outbox o
        where o.member_id=a.member_id
          and o.kind='drl_published'
          and o.payload->>'semester_id'=p_semester_id::text
          and o.status in ('pending','processing','sent')
     );

  perform private.audit_event(
    'drl.semester.publish','drl_semester',p_semester_id::text,'info',
    jsonb_build_object('published',true,'row_count',v_count,'notifications',v_inserted)
  );
  return true;
end
$function$;

revoke all on function public.drl_admin_publish_semester_v1(uuid,boolean) from public,anon;
grant execute on function public.drl_admin_publish_semester_v1(uuid,boolean) to authenticated,service_role;

comment on function public.drl_admin_publish_semester_v1(uuid,boolean) is
'Admin-only reversible publication contract. Publish confirms the current semester total; unpublish withdraws that confirmation without deleting DRL activities.';

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
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  if p_locked is null then raise exception 'Lock state is required'; end if;

  select lock_at,locked_at
    into previous_lock_at,previous_locked_at
    from public.drl_semesters
   where id=p_semester_id
   for update;

  if not found then raise exception 'Semester not found'; end if;

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
'Admin-only reversible lock contract. Lock/unlock is available regardless of publication state; unlock clears both manual and scheduled locks.';
