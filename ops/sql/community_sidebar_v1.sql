-- Production migration already applied as: community_sidebar_v1
create or replace function public.community_sidebar_v1()
returns table(
  group_key text,
  rank_no integer,
  member_id uuid,
  full_name text,
  position_title text,
  avatar_url text,
  total_points integer
)
language sql
stable
security definer
set search_path='public','pg_catalog'
as $$
with point_totals as (
  select st.member_id, coalesce(sum(st.points),0)::integer as total_points
  from public.score_transactions st
  group by st.member_id
),
leadership as (
  select
    'leadership'::text as group_key,
    row_number() over (
      order by case m.role when 'admin' then 0 when 'super_mod' then 1 else 2 end,
               lower(m.full_name),
               m.id
    )::integer as rank_no,
    m.id as member_id,
    m.full_name,
    coalesce(nullif(btrim(m.position_title),''),case when m.role='admin' then 'Chủ nhiệm' else 'Phó Chủ nhiệm' end)::text as position_title,
    m.avatar_url,
    coalesce(p.total_points,0)::integer as total_points
  from public.club_members m
  left join point_totals p on p.member_id=m.id
  where m.status='approved' and m.role in ('admin','super_mod')
  order by case m.role when 'admin' then 0 when 'super_mod' then 1 else 2 end,
           lower(m.full_name),
           m.id
  limit 3
),
management as (
  select
    'management'::text as group_key,
    row_number() over (order by lower(m.full_name),m.id)::integer as rank_no,
    m.id as member_id,
    m.full_name,
    coalesce(nullif(btrim(m.position_title),''),'Ban quản lý')::text as position_title,
    m.avatar_url,
    coalesce(p.total_points,0)::integer as total_points
  from public.club_members m
  left join point_totals p on p.member_id=m.id
  where m.status='approved' and m.role='mod'
),
active_members as (
  select
    'active'::text as group_key,
    row_number() over (
      order by coalesce(p.total_points,0) desc,
               lower(m.full_name),
               m.id
    )::integer as rank_no,
    m.id as member_id,
    m.full_name,
    'Thành viên'::text as position_title,
    m.avatar_url,
    coalesce(p.total_points,0)::integer as total_points
  from public.club_members m
  left join point_totals p on p.member_id=m.id
  where m.status='approved' and m.role='member'
  order by coalesce(p.total_points,0) desc,
           lower(m.full_name),
           m.id
  limit 10
),
combined as (
  select * from leadership
  union all
  select * from management
  union all
  select * from active_members
)
select *
from combined
order by case group_key when 'leadership' then 1 when 'management' then 2 else 3 end,rank_no;
$$;

comment on function public.community_sidebar_v1() is 'Public-safe desktop community sidebar: 3 leadership, all management, top 10 active members by score_transactions total.';

revoke all on function public.community_sidebar_v1() from public;
grant execute on function public.community_sidebar_v1() to anon,authenticated,service_role;
