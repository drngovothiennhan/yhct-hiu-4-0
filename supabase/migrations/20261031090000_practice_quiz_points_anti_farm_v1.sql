-- Điểm xác minh Quiz (bảng thi đua Study OS và top 5 trên hiutmc.com) — chống cày điểm.
-- Chủ dự án duyệt 2026-10-31: câu bỏ trống không có điểm; mỗi câu chỉ tính một lần mỗi ngày
-- (đúng 4, sai 1); bỏ +2 mỗi lần nộp; giữ +5 mỗi ngày hoạt động; trần 300 điểm/ngày.
-- Additive: một bảng mới trong private, thay thân 3 hàm cùng tham số và kiểu trả về.
-- Không DROP, DELETE, TRUNCATE. Lượt nộp cũ (trước migration) vẫn được tính theo số liệu đã ghi,
-- không có +2 mỗi lần nộp, cùng trần 300 điểm/ngày.

create table if not exists private.practice_quiz_daily_credit (
  member_id uuid not null references public.club_members(id) on delete cascade,
  day date not null,
  question_id uuid not null,
  points smallint not null check (points in (1, 4)),
  created_at timestamptz not null default now(),
  primary key (member_id, day, question_id)
);
create index if not exists practice_quiz_daily_credit_day_idx
  on private.practice_quiz_daily_credit (day, member_id);
alter table private.practice_quiz_daily_credit enable row level security;
revoke all on table private.practice_quiz_daily_credit from public, anon, authenticated;

-- Nộp bài: giữ nguyên kiểm tra và phần review trả về; thêm ghi điểm theo câu/ngày.
create or replace function public.practice_quiz_submit_v1(p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid:=private.current_member_id();
  item jsonb;
  q public.practice_questions%rowtype;
  qid uuid;
  selected integer;
  total integer:=0;
  answered integer:=0;
  correct_count integer:=0;
  review jsonb:='[]'::jsonb;
  seen uuid[]:='{}'::uuid[];
  v_day date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if jsonb_typeof(p_answers) is distinct from 'array' then raise exception 'Answers must be an array'; end if;
  if jsonb_array_length(p_answers)<1 or jsonb_array_length(p_answers)>500 then raise exception 'Submit between 1 and 500 loaded questions per request'; end if;

  for item in select value from jsonb_array_elements(p_answers) loop
    begin qid:=(item->>'questionId')::uuid; exception when others then raise exception 'Invalid question id'; end;
    if qid=any(seen) then raise exception 'Duplicate question id'; end if;
    seen:=array_append(seen,qid);
    selected:=case when item ? 'selectedIndex' and item->>'selectedIndex' is not null then (item->>'selectedIndex')::integer else null end;
    if selected is not null and selected not between 0 and 3 then raise exception 'Invalid selected answer'; end if;

    select * into q from public.practice_questions
    where id=qid and review_status in('source_verified','expert_approved');
    if q.id is null then raise exception 'Question is not approved or no longer available'; end if;

    total:=total+1;
    if selected=q.correct_index then correct_count:=correct_count+1; end if;
    -- Chỉ câu đã chọn đáp án mới có điểm; mỗi câu một lần mỗi ngày, đúng thì nâng lên 4.
    if selected is not null then
      answered:=answered+1;
      insert into private.practice_quiz_daily_credit as c(member_id, day, question_id, points)
      values (mid, v_day, qid, case when selected=q.correct_index then 4 else 1 end)
      on conflict (member_id, day, question_id) do update
        set points = excluded.points
        where c.points < excluded.points;
    end if;
    review:=review||jsonb_build_array(jsonb_build_object(
      'id',q.id,
      'subject',q.subject,
      'topic',q.topic,
      'selectedIndex',selected,
      'correctIndex',q.correct_index,
      'correct',selected=q.correct_index,
      'explanation',q.explanation,
      'sourceFileName',q.source_file_name,
      'evidenceText',coalesce(q.provenance->>'evidenceText',q.provenance->>'answerEvidence','')
    ));
  end loop;

  perform private.audit_event('practice.quiz.submit','practice_questions',mid::text,'info',
    jsonb_build_object('total',total,'answered',answered,'correct',correct_count));
  return jsonb_build_object(
    'score',case when total=0 then 0 else round(100.0*correct_count/total)::integer end,
    'correctCount',correct_count,
    'total',total,
    'review',review,
    'submittedAt',now()
  );
end
$$;

-- Một nơi tính điểm xác minh cho cả bảng thi đua và top 5 công khai.
create or replace function private.practice_quiz_points_v2(p_since timestamptz)
returns table(member_id uuid, points bigint, questions bigint, correct bigint, submissions bigint, active_days bigint, latest_activity timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with logs as (
    select
      l.actor_member_id as mid,
      (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
      l.created_at,
      l.metadata ? 'answered' as v2,
      greatest(0,least(coalesce((l.metadata->>'total')::integer,0),500)) as total,
      greatest(0,least(coalesce((l.metadata->>'answered')::integer,0),500)) as answered,
      greatest(0,least(coalesce((l.metadata->>'correct')::integer,0),500)) as correct
    from public.system_audit_logs l
    where l.action='practice.quiz.submit'
      and l.actor_member_id is not null
      and l.created_at >= p_since
  ),
  -- Lượt nộp trước migration: không có dữ liệu từng câu, tính từ tổng đã ghi (không còn +2/lượt).
  legacy_day as (
    select mid, d, sum(correct*4 + greatest(total-correct,0))::bigint as pts
    from logs where not v2 group by mid, d
  ),
  credit_day as (
    select c.member_id as mid, c.day as d, sum(c.points)::bigint as pts
    from private.practice_quiz_daily_credit c
    where c.day >= (p_since at time zone 'Asia/Ho_Chi_Minh')::date
    group by c.member_id, c.day
  ),
  day_points as (
    select mid, d, sum(pts) as pts
    from (select * from legacy_day union all select * from credit_day) x
    group by mid, d
    having sum(pts) > 0
  ),
  member_points as (
    -- +5 mỗi ngày có câu được tính điểm; trần 300 điểm mỗi ngày.
    select mid, sum(least(300, pts + 5))::bigint as points, count(*)::bigint as active_days
    from day_points group by mid
  ),
  stats as (
    select mid,
      sum(case when v2 then answered else total end)::bigint as questions,
      sum(correct)::bigint as correct,
      count(*)::bigint as submissions,
      max(created_at) as latest_activity
    from logs group by mid
  )
  select s.mid, coalesce(p.points,0), s.questions, s.correct, s.submissions, coalesce(p.active_days,0), s.latest_activity
  from stats s left join member_points p on p.mid = s.mid
$$;
revoke all on function private.practice_quiz_points_v2(timestamptz) from public, anon, authenticated;

create or replace function public.learning_competition_leaderboard_v1(p_days integer default 30, p_limit integer default 100)
returns table(rank bigint, member_id uuid, full_name text, avatar_url text, role text, verified_points bigint, verified_questions bigint, verified_correct bigint, accuracy numeric, active_days bigint, submissions bigint, latest_activity timestamp with time zone, synced_streak integer)
language sql
security definer
set search_path = ''
as $$
  with auth_gate as (
    select private.current_member_id() as current_member
  ),
  bounded as (
    select greatest(1,least(coalesce(p_days,30),365)) as days,
           greatest(1,least(coalesce(p_limit,100),500)) as lim
  ),
  quiz as (
    select pts.*
    from bounded b, private.practice_quiz_points_v2(now() - make_interval(days=>b.days)) pts
  ),
  scored as (
    select
      m.id as member_id,
      m.full_name,
      m.avatar_url,
      m.role::text as role,
      coalesce(q.points,0)::bigint as verified_points,
      coalesce(q.questions,0)::bigint as verified_questions,
      coalesce(q.correct,0)::bigint as verified_correct,
      case when coalesce(q.questions,0)>0
        then round(100.0*q.correct/q.questions,1)
        else 0::numeric
      end as accuracy,
      coalesce(q.active_days,0)::bigint as active_days,
      coalesce(q.submissions,0)::bigint as submissions,
      q.latest_activity,
      coalesce(s.client_streak,0) as synced_streak,
      s.synced_at
    from public.club_members m
    left join quiz q on q.member_id=m.id
    left join public.learning_sync_stats s on s.member_id=m.id
    where m.status='approved'
      and m.login_enabled
      and not m.data_conflict
  ),
  active as (
    select s.*
    from scored s, bounded b, auth_gate a
    where s.verified_questions>0
       or s.synced_at >= now() - make_interval(days=>b.days)
       or s.member_id=a.current_member
  ),
  ranked as (
    select
      dense_rank() over (
        order by verified_points desc, verified_correct desc, active_days desc
      ) as rank,
      *
    from active
  ),
  selected as (
    select r.*
    from ranked r, auth_gate a, bounded b
    where r.rank <= b.lim or r.member_id=a.current_member
  )
  select
    s.rank,s.member_id,s.full_name,s.avatar_url,s.role,
    s.verified_points,s.verified_questions,s.verified_correct,s.accuracy,
    s.active_days,s.submissions,s.latest_activity,s.synced_streak
  from selected s
  order by s.rank,s.full_name;
$$;

create or replace function public.public_showcase_v1()
returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_bank jsonb; v_learners bigint; v_gift jsonb; v_top jsonb;
begin
  select jsonb_build_object('questions',count(*),'subjects',count(distinct subject))
    into v_bank from public.practice_questions where review_status is distinct from 'rejected';

  select count(distinct l.actor_member_id) into v_learners
    from public.system_audit_logs l
   where l.action='practice.quiz.submit' and l.actor_member_id is not null
     and l.created_at>=now()-interval '30 days';

  select jsonb_build_object('credits',c.amount,'validDays',c.credit_valid_days,'endsAt',c.ends_at)
    into v_gift from private.ai_credit_campaign_v1 c
   where c.enabled and now()<c.ends_at order by c.starts_at desc limit 1;

  with scored as (
    select m.full_name, q.points pts, q.correct ok
      from private.practice_quiz_points_v2(now()-interval '30 days') q
      join public.club_members m on m.id=q.member_id
     where m.status='approved' and m.login_enabled and not m.data_conflict and q.questions>0),
  ranked as (select dense_rank() over(order by pts desc, ok desc) rk, * from scored)
  select case when (select count(*) from ranked)>=3
           then coalesce((select jsonb_agg(jsonb_build_object('rank',rk,'name',private.mask_initials_v1(full_name),'points',pts) order by rk)
                            from (select * from ranked order by rk limit 5) t),'[]'::jsonb)
           else '[]'::jsonb end
    into v_top;

  return jsonb_build_object(
    'generatedAt',now(),
    'bank',coalesce(v_bank,'{}'::jsonb),
    'activeLearners30d',coalesce(v_learners,0),
    'gift',v_gift,
    'top',v_top
  );
end
$$;
