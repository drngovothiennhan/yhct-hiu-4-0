-- Exact MSSV lookup keeps unpublished DRL private from unrelated users,
-- while the owning member and DRL managers can verify newly-imported activity points immediately.

create or replace function public.drl_public_lookup_v2(p_student_code text)
returns table(
  student_code_masked text,
  semester_code text,
  semester_title text,
  is_published boolean,
  publication_status text,
  total_points numeric,
  activities jsonb
)
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare
  q text:=upper(regexp_replace(trim(coalesce(p_student_code,'')),'\s','','g'));
  mid uuid:=private.current_member_id();
  own_code text;
  own_lookup boolean:=false;
  manager_lookup boolean:=private.has_min_role('mod');
begin
  if q !~ '^[0-9]{8,14}$' then return; end if;

  if mid is not null then
    select upper(regexp_replace(trim(coalesce(m.student_code,'')),'\s','','g'))
      into own_code
      from public.club_members m
     where m.id=mid;
    own_lookup:=nullif(own_code,'') is not null and own_code=q;
  end if;

  return query
  with relevant as (
    select s.*
      from public.drl_semesters s
     where s.archived_at is null
       and (
         exists (
           select 1
             from public.drl_activities a
            where a.semester_id=s.id
              and upper(a.student_code)=q
         )
         or (
           own_lookup
           and s.is_published=false
           and s.id=(
             select x.id
               from public.drl_semesters x
              where x.archived_at is null
                and x.is_published=false
              order by x.created_at desc,x.id desc
              limit 1
           )
         )
       )
  ), aggregated as (
    select
      s.id,
      s.code,
      s.title,
      s.starts_on,
      s.created_at as semester_created_at,
      s.is_published,
      coalesce(sum(a.points),0)::numeric as live_total,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',a.id,
            'activity_name',a.activity_name,
            'points',a.points,
            'note',a.note,
            'occurred_at',a.occurred_at
          ) order by coalesce(a.occurred_at,a.created_at) desc,a.created_at desc
        ) filter (where a.id is not null),
        '[]'::jsonb
      ) as live_activities
    from relevant s
    left join public.drl_activities a
      on a.semester_id=s.id
     and upper(a.student_code)=q
    group by s.id,s.code,s.title,s.starts_on,s.created_at,s.is_published
  )
  select
    case when length(q)<=4 then repeat('*',length(q)) else left(q,2)||repeat('*',length(q)-4)||right(q,2) end,
    a.code,
    a.title,
    a.is_published,
    case
      when a.is_published then 'published'
      when own_lookup or manager_lookup then 'recording'
      else 'waiting'
    end::text,
    case when a.is_published or own_lookup or manager_lookup then a.live_total else null::numeric end,
    case when a.is_published or own_lookup or manager_lookup then a.live_activities else '[]'::jsonb end
  from aggregated a
  order by coalesce(a.starts_on,'1900-01-01'::date) desc,a.semester_created_at desc,a.code desc;
end
$function$;

revoke all on function public.drl_public_lookup_v2(text) from public;
grant execute on function public.drl_public_lookup_v2(text) to anon,authenticated,service_role;

comment on function public.drl_public_lookup_v2(text) is
'Exact MSSV lookup. Published scores are public. Unpublished live totals/details are visible only to the owning authenticated member or DRL managers so newly imported activity points can be verified immediately.';
