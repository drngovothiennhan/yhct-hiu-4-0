-- Hotfix: older assistant clients parse "Điểm rèn luyện của tôi hiện tại"
-- through drl_public_search_v1 with query "toi hien tai". Keep the identity guard,
-- but resolve that self-query from the canonical current-semester RPC instead of
-- selecting the semester that merely has the latest activity timestamp.

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
  -- Always return the canonical current semester, including 0 points.
  if nq ~ '^(toi|minh|em|tui|ban than)([[:space:]]|$)' then
    mid := private.current_member_id();
    if mid is null then return; end if;

    return query
    with me as (
      select m.full_name::text as full_name,
             m.student_code::text as student_code
        from public.club_members m
       where m.id=mid
       limit 1
    ), current_score as (
      select c.semester_code,
             c.semester_title,
             coalesce(c.total_points,0)::numeric as total_points
        from public.drl_member_current_semester_v1() c
       limit 1
    )
    select
      me.full_name,
      case
        when length(me.student_code)<=4 then repeat('*',length(me.student_code))
        else left(me.student_code,2)||repeat('*',length(me.student_code)-4)||right(me.student_code,2)
      end,
      current_score.semester_code,
      current_score.semester_title,
      current_score.total_points,
      1.0::numeric
    from me
    cross join current_score;
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

revoke all on function public.drl_public_search_v1(text,integer) from public;
grant execute on function public.drl_public_search_v1(text,integer) to anon,authenticated,service_role;

comment on function public.drl_public_search_v1(text,integer) is
'Published DRL search. Self-intent queries from authenticated users are identity-guarded and resolve to the canonical current semester, including a zero-point current semester; they never fuzzy-match another member.';
