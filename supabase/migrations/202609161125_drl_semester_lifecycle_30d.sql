-- DRL semester lifecycle: publish is final; keep visible for 30 days;
-- archive from the active score view only after a verified Drive backup exists.
-- Historical activities remain intact in PostgreSQL and are never zeroed/deleted.

alter table public.drl_semesters
  add column if not exists archived_at timestamptz,
  add column if not exists drive_backup_file_id text,
  add column if not exists drive_backup_checksum_sha256 text,
  add column if not exists drive_backup_at timestamptz;

create index if not exists drl_semesters_lifecycle_idx
  on public.drl_semesters (is_published, published_at, archived_at);

create or replace function private.drl_archive_due_semesters_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare
  v_count integer := 0;
  v_ids uuid[] := '{}'::uuid[];
begin
  with moved as (
    update public.drl_semesters s
       set archived_at = now(),
           updated_at = now()
     where s.is_published = true
       and s.published_at is not null
       and s.published_at <= now() - interval '30 days'
       and s.archived_at is null
       and s.drive_backup_at is not null
       and nullif(trim(s.drive_backup_file_id),'') is not null
       and s.drive_backup_checksum_sha256 ~ '^[0-9a-fA-F]{64}$'
    returning s.id
  )
  select count(*)::integer, coalesce(array_agg(id),'{}'::uuid[])
    into v_count, v_ids
    from moved;

  return jsonb_build_object(
    'archived_count',v_count,
    'semester_ids',to_jsonb(v_ids),
    'ran_at',now()
  );
end
$function$;

revoke all on function private.drl_archive_due_semesters_v1() from public,anon,authenticated;

create or replace function public.drl_admin_register_drive_backup_v1(
  p_semester_id uuid,
  p_file_id text,
  p_checksum_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare
  v_mid uuid := private.current_member_id();
  v_published boolean;
  v_file_id text := trim(coalesce(p_file_id,''));
  v_checksum text := lower(trim(coalesce(p_checksum_sha256,'')));
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  if v_file_id = '' or length(v_file_id) > 256 then raise exception 'Valid Drive file id required'; end if;
  if v_checksum !~ '^[0-9a-f]{64}$' then raise exception 'Valid SHA-256 checksum required'; end if;

  select is_published into v_published
    from public.drl_semesters
   where id = p_semester_id
   for update;
  if not found then raise exception 'Semester not found'; end if;
  if not v_published then raise exception 'Semester must be published before final backup'; end if;

  update public.drl_semesters
     set drive_backup_file_id = v_file_id,
         drive_backup_checksum_sha256 = v_checksum,
         drive_backup_at = now(),
         updated_at = now()
   where id = p_semester_id;

  perform private.audit_event(
    'drl.semester.drive_backup',
    'drl_semester',
    p_semester_id::text,
    'info',
    jsonb_build_object('file_id',v_file_id,'checksum_sha256',v_checksum,'actor_member_id',v_mid)
  );

  perform private.drl_archive_due_semesters_v1();
  return true;
end
$function$;

revoke all on function public.drl_admin_register_drive_backup_v1(uuid,text,text) from public,anon;
grant execute on function public.drl_admin_register_drive_backup_v1(uuid,text,text) to authenticated,service_role;

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

  -- Once published, a semester is final. It cannot be reopened/unpublished.
  if p_published = false then
    if v_is_published then raise exception 'Published semester is final and cannot be unpublished'; end if;
    return true;
  end if;

  -- Publishing an already-final semester is idempotent.
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

create or replace function public.drl_member_history_v1()
returns table(
  id uuid,
  semester_code text,
  semester_title text,
  activity_name text,
  points numeric,
  note text,
  occurred_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare
  mid uuid := private.current_member_id();
begin
  if mid is null then raise exception 'Authentication required'; end if;
  return query
  select a.id,s.code,s.title,a.activity_name,a.points,a.note,a.occurred_at,a.created_at
    from public.drl_activities a
    join public.drl_semesters s on s.id=a.semester_id
   where a.member_id=mid
     and s.archived_at is null
   order by coalesce(a.occurred_at,a.created_at) desc;
end
$function$;

create or replace function public.drl_public_search_v1(p_query text, p_limit integer default 10)
returns table(
  full_name text,
  student_code_masked text,
  semester_code text,
  semester_title text,
  total_points numeric,
  match_score numeric
)
language plpgsql
security definer
set search_path to 'public','private','extensions','pg_catalog'
as $function$
declare
  q text := trim(coalesce(p_query,''));
  nq text;
begin
  if length(q)<2 then return; end if;
  nq:=extensions.unaccent(lower(regexp_replace(q,'[^[:alnum:] ]','','g')));
  return query
  with agg as (
    select a.student_code,max(a.full_name) full_name,s.code semester_code,s.title semester_title,sum(a.points)::numeric total_points
      from public.drl_activities a
      join public.drl_semesters s on s.id=a.semester_id
     where s.is_published
       and s.archived_at is null
     group by a.student_code,s.code,s.title
  ), scored as (
    select x.*,greatest(
      case when upper(x.student_code)=upper(q) then 1.0 when upper(x.student_code) like upper(q)||'%' then 0.92 else 0 end,
      extensions.similarity(extensions.unaccent(lower(x.full_name)),nq)
    )::numeric match_score
      from agg x
     where upper(x.student_code) like upper(q)||'%'
        or extensions.similarity(extensions.unaccent(lower(x.full_name)),nq)>=0.20
        or extensions.unaccent(lower(x.full_name)) like '%'||nq||'%'
  )
  select s.full_name,
         case when length(s.student_code)<=4 then repeat('*',length(s.student_code)) else left(s.student_code,2)||repeat('*',length(s.student_code)-4)||right(s.student_code,2) end,
         s.semester_code,s.semester_title,s.total_points,s.match_score
    from scored s
   order by s.match_score desc,s.full_name
   limit greatest(1,least(coalesce(p_limit,10),20));
end
$function$;

do $do$
begin
  begin perform cron.unschedule('yhct-drl-semester-lifecycle-daily'); exception when others then null; end;
end
$do$;

select cron.schedule(
  'yhct-drl-semester-lifecycle-daily',
  '53 18 * * *',
  'select private.drl_archive_due_semesters_v1();'
);

comment on function private.drl_archive_due_semesters_v1() is
  'Archives published DRL semesters from active/current score views after 30 days, but only after a verified Drive backup has been registered. Historical rows remain intact.';
comment on function public.drl_admin_register_drive_backup_v1(uuid,text,text) is
  'Registers the immutable Google Drive archive identity/checksum for a published DRL semester and then runs the fail-closed 30-day lifecycle check.';
