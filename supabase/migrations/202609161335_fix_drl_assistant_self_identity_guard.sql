create or replace function public.drl_public_search_v1(p_query text, p_limit integer default 10)
returns table(full_name text, student_code_masked text, semester_code text, semester_title text, total_points numeric, match_score numeric)
language plpgsql
security definer
set search_path to 'public', 'private', 'extensions', 'pg_catalog'
as $function$
declare
  q text := trim(coalesce(p_query,''));
  nq text;
  mid uuid;
begin
  if length(q)<2 then return; end if;
  nq:=extensions.unaccent(lower(regexp_replace(q,'[^[:alnum:] ]','','g')));

  -- Identity guard for assistant phrases that mean "my score" but older
  -- clients may parse as public search, e.g. "điểm rèn luyện của tôi hiện tại".
  -- These queries must never fuzzy-match another member.
  if nq ~ '^(toi|minh|em|tui|ban than)([[:space:]]|$)' then
    mid := private.current_member_id();
    if mid is null then return; end if;

    return query
    with own as (
      select
        max(a.full_name)::text as full_name,
        max(a.student_code)::text as student_code,
        s.code::text as semester_code,
        s.title::text as semester_title,
        sum(a.points)::numeric as total_points,
        max(coalesce(a.occurred_at,a.created_at)) as latest_at
      from public.drl_activities a
      join public.drl_semesters s on s.id=a.semester_id
      where a.member_id=mid
        and s.archived_at is null
      group by s.code,s.title
      order by latest_at desc
      limit 1
    )
    select
      o.full_name,
      case when length(o.student_code)<=4 then repeat('*',length(o.student_code)) else left(o.student_code,2)||repeat('*',length(o.student_code)-4)||right(o.student_code,2) end,
      o.semester_code,
      o.semester_title,
      o.total_points,
      1.0::numeric
    from own o;
    return;
  end if;

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
