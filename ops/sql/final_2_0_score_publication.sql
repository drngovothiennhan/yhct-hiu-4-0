-- Production migration already applied as: final_2_0_score_publication_gate
-- YHCT HIU Final 2.0: explicit Mod/Admin publication gate for DRL scores.

alter table public.drl_semesters
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references public.club_members(id);

create index if not exists drl_semesters_published_idx
  on public.drl_semesters(published_at desc)
  where published_at is not null;

create or replace function private.guard_drl_published_semester()
returns trigger
language plpgsql
security definer
set search_path='public','pg_catalog'
as $$
declare
  v_semester_id uuid;
  v_published_at timestamptz;
begin
  if tg_op='DELETE' then v_semester_id:=old.semester_id; else v_semester_id:=new.semester_id; end if;
  select s.published_at into v_published_at from public.drl_semesters s where s.id=v_semester_id for share;
  if v_published_at is not null then
    raise exception 'Published semester is read-only. Unpublish scores before changing data.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

revoke all on function private.guard_drl_published_semester() from public;
drop trigger if exists drl_activities_publication_guard on public.drl_activities;
create trigger drl_activities_publication_guard
before insert or update or delete on public.drl_activities
for each row execute function private.guard_drl_published_semester();

create or replace function public.drl_admin_publish_semester_v1(p_semester_id uuid,p_published boolean)
returns boolean
language plpgsql
security definer
set search_path='public','private','pg_catalog'
as $$
declare
  v_mid uuid:=private.current_member_id();
  v_count integer;
begin
  if not private.has_min_role('mod') then raise exception 'Moderator role required'; end if;
  if p_published is null then raise exception 'Publication state is required'; end if;
  perform 1 from public.drl_semesters s where s.id=p_semester_id for update;
  if not found then raise exception 'Semester not found'; end if;
  if p_published then
    select count(*)::integer into v_count from public.drl_activities a where a.semester_id=p_semester_id;
    if v_count=0 then raise exception 'Cannot publish an empty semester'; end if;
    update public.drl_semesters
      set published_at=coalesce(published_at,now()),published_by=case when published_at is null then v_mid else published_by end,updated_at=now()
      where id=p_semester_id;
  else
    update public.drl_semesters set published_at=null,published_by=null,updated_at=now() where id=p_semester_id;
  end if;
  perform private.audit_event(
    case when p_published then 'drl.semester.publish' else 'drl.semester.unpublish' end,
    'drl_semester',p_semester_id::text,
    case when p_published then 'info' else 'warning' end,
    jsonb_build_object('published',p_published,'row_count',coalesce(v_count,0))
  );
  return true;
end $$;

comment on function public.drl_admin_publish_semester_v1(uuid,boolean)
is 'Final 2.0 publication gate: Mod/Admin explicitly publish or unpublish a DRL semester; published rows are read-only.';
revoke all on function public.drl_admin_publish_semester_v1(uuid,boolean) from public,anon;
grant execute on function public.drl_admin_publish_semester_v1(uuid,boolean) to authenticated,service_role;

drop function if exists public.drl_semester_list_v1();
create function public.drl_semester_list_v1()
returns table(
  id uuid,code text,title text,starts_on date,ends_on date,lock_at timestamptz,locked_at timestamptz,is_locked boolean,
  published_at timestamptz,published_by uuid,is_published boolean,row_count integer,student_count integer
)
language plpgsql
security definer
set search_path='public','private','pg_catalog'
as $$
begin
  if not private.has_min_role('mod') then raise exception 'Moderator role required'; end if;
  return query
  select s.id,s.code,s.title,s.starts_on,s.ends_on,s.lock_at,s.locked_at,
         (s.locked_at is not null or (s.lock_at is not null and s.lock_at<=now())) as is_locked,
         s.published_at,s.published_by,(s.published_at is not null) as is_published,
         count(a.id)::integer as row_count,count(distinct a.student_code)::integer as student_count
  from public.drl_semesters s left join public.drl_activities a on a.semester_id=s.id
  group by s.id
  order by coalesce(s.starts_on,'1900-01-01'::date) desc,s.code desc;
end $$;
revoke all on function public.drl_semester_list_v1() from public,anon;
grant execute on function public.drl_semester_list_v1() to authenticated,service_role;

create or replace function public.drl_public_search_v1(p_query text,p_limit integer default 10)
returns table(full_name text,student_code_masked text,semester_code text,semester_title text,total_points numeric,match_score numeric)
language plpgsql
security definer
set search_path='public','private','extensions','pg_catalog'
as $$
declare q text:=trim(coalesce(p_query,'')); nq text;
begin
  if length(q)<2 then return; end if;
  nq:=extensions.unaccent(lower(regexp_replace(q,'[^[:alnum:] ]','','g')));
  return query
  with agg as (
    select a.student_code,max(a.full_name) full_name,s.code semester_code,s.title semester_title,sum(a.points)::numeric total_points
    from public.drl_activities a join public.drl_semesters s on s.id=a.semester_id
    where s.published_at is not null
    group by a.student_code,s.code,s.title
  ), scored as (
    select x.*,greatest(
      case when x.student_code=q then 1.0 when x.student_code like q||'%' then 0.92 else 0 end,
      extensions.similarity(extensions.unaccent(lower(x.full_name)),nq)
    )::numeric match_score
    from agg x
    where x.student_code like q||'%' or extensions.similarity(extensions.unaccent(lower(x.full_name)),nq)>=0.20 or extensions.unaccent(lower(x.full_name)) like '%'||nq||'%'
  )
  select s.full_name,case when length(s.student_code)<=4 then repeat('*',length(s.student_code)) else left(s.student_code,2)||repeat('*',length(s.student_code)-4)||right(s.student_code,2) end,s.semester_code,s.semester_title,s.total_points,s.match_score
  from scored s order by s.match_score desc,s.full_name limit greatest(1,least(coalesce(p_limit,10),20));
end $$;
revoke all on function public.drl_public_search_v1(text,integer) from public;
grant execute on function public.drl_public_search_v1(text,integer) to anon,authenticated,service_role;

create or replace function public.drl_member_history_v1()
returns table(id uuid,semester_code text,semester_title text,activity_name text,points numeric,note text,occurred_at timestamptz,created_at timestamptz)
language plpgsql
security definer
set search_path='public','private','pg_catalog'
as $$
declare mid uuid:=private.current_member_id();
begin
  if mid is null then raise exception 'Authentication required'; end if;
  return query
  select a.id,s.code,s.title,a.activity_name,a.points,a.note,a.occurred_at,a.created_at
  from public.drl_activities a join public.drl_semesters s on s.id=a.semester_id
  where a.member_id=mid and s.published_at is not null
  order by coalesce(a.occurred_at,a.created_at) desc;
end $$;
revoke all on function public.drl_member_history_v1() from public,anon;
grant execute on function public.drl_member_history_v1() to authenticated,service_role;
