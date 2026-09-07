create or replace function public.drl_deadline_public_v1()
returns table(semester_code text, semester_title text, lock_at timestamptz, is_locked boolean, starts_on date, ends_on date)
language sql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
  select ds.code, ds.title, ds.lock_at, (ds.locked_at is not null), ds.starts_on, ds.ends_on
  from public.drl_semesters ds
  where private.current_member_id() is not null
    and private.is_approved()
    and ds.is_published=false
  order by
    case when ds.lock_at is not null and ds.lock_at>now() then 0 else 1 end,
    ds.lock_at asc nulls last,
    ds.created_at desc
  limit 1
$function$;

create or replace function public.member_upcoming_schedule_v2(p_limit integer default 4)
returns table(id uuid, kind text, title text, starts_at timestamptz, ends_at timestamptz, location text, is_assigned boolean, checked_in boolean, can_check_in boolean)
language sql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
  with me as (select private.current_member_id() as id)
  select
    s.id,
    s.kind::text,
    s.title,
    s.starts_at,
    s.ends_at,
    s.location,
    (s.assignee_id=(select id from me) or exists(
      select 1 from public.schedule_assignments sa
      where sa.schedule_id=s.id and sa.member_id=(select id from me)
    )) as is_assigned,
    exists(
      select 1 from public.schedule_checkins sc
      where sc.schedule_id=s.id and sc.member_id=(select id from me)
    ) as checked_in,
    (
      (s.assignee_id=(select id from me) or exists(
        select 1 from public.schedule_assignments sa
        where sa.schedule_id=s.id and sa.member_id=(select id from me)
      ))
      and now() >= s.starts_at - interval '30 minutes'
      and now() <= s.ends_at
    ) as can_check_in
  from public.schedules s
  where (select id from me) is not null
    and private.is_approved()
    and s.status='scheduled'
    and s.ends_at>=now()
    and (
      s.visibility in ('public','members')
      or s.assignee_id=(select id from me)
      or exists(
        select 1 from public.schedule_assignments sa
        where sa.schedule_id=s.id and sa.member_id=(select id from me)
      )
    )
  order by s.starts_at asc
  limit least(greatest(coalesce(p_limit,4),1),8)
$function$;

create or replace function public.research_apply_v1(p_opportunity_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  mid uuid:=private.current_member_id();
  v_slots integer;
  v_accepted integer;
  v_existing text;
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required' using errcode='42501';
  end if;

  select slots into v_slots
  from public.research_opportunities
  where id=p_opportunity_id
    and status='open'
    and (deadline_at is null or deadline_at>now())
  for share;

  if not found then
    raise exception 'Research opportunity is not open' using errcode='P0002';
  end if;

  select status into v_existing
  from public.research_applications
  where opportunity_id=p_opportunity_id and member_id=mid;

  if v_existing='accepted' then
    return true;
  end if;

  select count(*)::integer into v_accepted
  from public.research_applications
  where opportunity_id=p_opportunity_id and status='accepted';

  if v_accepted>=v_slots then
    raise exception 'Research opportunity has filled all accepted slots' using errcode='P0002';
  end if;

  insert into public.research_applications(opportunity_id,member_id,status)
  values(p_opportunity_id,mid,'requested')
  on conflict(opportunity_id,member_id) do update
    set status=case when research_applications.status in ('declined','withdrawn') then 'requested' else research_applications.status end,
        updated_at=now();
  return true;
end
$function$;

create or replace function public.research_opportunities_feed_v1(p_limit integer default 6)
returns table(id uuid, title text, summary text, slots integer, deadline_at timestamptz, applicant_count integer, my_status text)
language sql
stable security definer
set search_path to 'public','private','pg_temp'
as $function$
  with me as (
    select cm.id
    from public.club_members cm
    where cm.auth_user_id = auth.uid()
      and cm.status = 'approved'
    limit 1
  )
  select
    ro.id,
    ro.title,
    ro.summary,
    ro.slots,
    ro.deadline_at,
    count(ra.member_id) filter (where ra.status in ('requested','accepted'))::integer as applicant_count,
    max(ra.status) filter (where ra.member_id = (select id from me)) as my_status
  from public.research_opportunities ro
  left join public.research_applications ra on ra.opportunity_id = ro.id
  where ro.status = 'open'
    and (ro.deadline_at is null or ro.deadline_at > now())
  group by ro.id, ro.title, ro.summary, ro.slots, ro.deadline_at
  order by ro.deadline_at asc nulls last, ro.created_at desc
  limit least(greatest(coalesce(p_limit,6),1),12)
$function$;

create or replace function public.schedule_checkin_v1(p_schedule_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  mid uuid:=private.current_member_id();
  v_start timestamptz;
  v_end timestamptz;
  v_status text;
  v_assigned boolean;
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required' using errcode='42501';
  end if;

  select s.starts_at,s.ends_at,s.status,
    (s.assignee_id=mid or exists(
      select 1 from public.schedule_assignments sa
      where sa.schedule_id=s.id and sa.member_id=mid
    ))
  into v_start,v_end,v_status,v_assigned
  from public.schedules s
  where s.id=p_schedule_id;

  if not found or v_status<>'scheduled' then
    raise exception 'Schedule is not available' using errcode='P0002';
  end if;
  if not v_assigned then
    raise exception 'Member is not assigned to this schedule' using errcode='42501';
  end if;
  if now()<v_start-interval '30 minutes' or now()>v_end then
    raise exception 'Check-in is outside the allowed time window' using errcode='22023';
  end if;

  insert into public.schedule_checkins(schedule_id,member_id,checked_in_at)
  values(p_schedule_id,mid,now())
  on conflict(schedule_id,member_id) do nothing;

  return true;
end
$function$;

revoke execute on function public.research_opportunities_feed_v1(integer) from public;
grant execute on function public.research_opportunities_feed_v1(integer) to anon, authenticated;
revoke execute on function public.research_apply_v1(uuid) from public, anon;
grant execute on function public.research_apply_v1(uuid) to authenticated;
revoke execute on function public.drl_deadline_public_v1() from public, anon;
grant execute on function public.drl_deadline_public_v1() to authenticated;
revoke execute on function public.member_upcoming_schedule_v2(integer) from public, anon;
grant execute on function public.member_upcoming_schedule_v2(integer) to authenticated;
revoke execute on function public.schedule_checkin_v1(uuid) from public, anon;
grant execute on function public.schedule_checkin_v1(uuid) to authenticated;

do $contract$
declare
  checkin_def text;
begin
  if has_function_privilege('anon','public.schedule_checkin_v1(uuid)'::regprocedure,'execute') then
    raise exception 'contract violation: anon may execute schedule_checkin_v1';
  end if;
  if not has_function_privilege('authenticated','public.schedule_checkin_v1(uuid)'::regprocedure,'execute') then
    raise exception 'contract violation: authenticated cannot execute schedule_checkin_v1';
  end if;
  if has_function_privilege('anon','public.research_apply_v1(uuid)'::regprocedure,'execute') then
    raise exception 'contract violation: anon may execute research_apply_v1';
  end if;
  if not has_function_privilege('anon','public.research_opportunities_feed_v1(integer)'::regprocedure,'execute') then
    raise exception 'contract violation: anon cannot read research feed';
  end if;
  if has_function_privilege('anon','public.drl_deadline_public_v1()'::regprocedure,'execute') then
    raise exception 'contract violation: anon may execute DRL deadline RPC';
  end if;
  if has_function_privilege('anon','public.member_upcoming_schedule_v2(integer)'::regprocedure,'execute') then
    raise exception 'contract violation: anon may execute member schedule RPC';
  end if;

  select pg_get_functiondef('public.schedule_checkin_v1(uuid)'::regprocedure) into checkin_def;
  if position('30 minutes' in checkin_def)=0 or position('Member is not assigned' in checkin_def)=0 then
    raise exception 'contract violation: check-in server guards missing';
  end if;
end
$contract$;
