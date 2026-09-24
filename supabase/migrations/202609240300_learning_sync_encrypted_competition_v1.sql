-- 2026-09-24: encrypted learning snapshots + server-verified competition

create table if not exists public.learning_sync_snapshots (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  snapshot_day date not null default current_date,
  schema_version integer not null default 1 check (schema_version between 1 and 10),
  codec text not null default 'gzip+aes-gcm' check (codec='gzip+aes-gcm'),
  payload_ciphertext text not null,
  iv_base64 text not null,
  checksum_sha256 text not null,
  compressed_bytes integer not null default 0 check (compressed_bytes >= 0),
  source_version text,
  client_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_id, snapshot_day)
);

create index if not exists learning_sync_snapshots_member_updated_idx
on public.learning_sync_snapshots(member_id, updated_at desc);

alter table public.learning_sync_snapshots enable row level security;
revoke all on public.learning_sync_snapshots from anon;
grant select on public.learning_sync_snapshots to authenticated;

drop policy if exists learning_sync_snapshot_read on public.learning_sync_snapshots;
create policy learning_sync_snapshot_read
on public.learning_sync_snapshots
for select to authenticated
using (member_id=private.current_member_id() or private.has_min_role('mod'::app_role));

create table if not exists public.learning_sync_stats (
  member_id uuid primary key references public.club_members(id) on delete cascade,
  synced_at timestamptz not null default now(),
  client_active_date date,
  client_streak integer not null default 0 check (client_streak between 0 and 5000),
  client_xp integer not null default 0 check (client_xp between 0 and 100000000),
  client_today_questions integer not null default 0 check (client_today_questions between 0 and 100000),
  client_exam_attempts integer not null default 0 check (client_exam_attempts between 0 and 1000000),
  client_last_exam_score integer check (client_last_exam_score between 0 and 100),
  client_ai_uses integer not null default 0 check (client_ai_uses between 0 and 1000000),
  review_card_count integer not null default 0 check (review_card_count between 0 and 5000),
  snapshot_checksum text not null,
  source_version text
);

alter table public.learning_sync_stats enable row level security;
revoke all on public.learning_sync_stats from anon;
grant select on public.learning_sync_stats to authenticated;

drop policy if exists learning_sync_stats_read on public.learning_sync_stats;
create policy learning_sync_stats_read
on public.learning_sync_stats
for select to authenticated
using (member_id=private.current_member_id() or private.has_min_role('mod'::app_role));

create or replace function public.learning_competition_leaderboard_v1(
  p_days integer default 30,
  p_limit integer default 100
)
returns table(
  rank bigint,
  member_id uuid,
  full_name text,
  avatar_url text,
  role text,
  verified_points bigint,
  verified_questions bigint,
  verified_correct bigint,
  accuracy numeric,
  active_days bigint,
  submissions bigint,
  latest_activity timestamptz,
  synced_streak integer
)
language sql
security definer
set search_path=''
as $$
  with auth_gate as (
    select private.current_member_id() as current_member
  ),
  bounded as (
    select greatest(1,least(coalesce(p_days,30),365)) as days,
           greatest(1,least(coalesce(p_limit,100),500)) as lim
  ),
  quiz as (
    select
      l.actor_member_id as member_id,
      sum(greatest(0,least(coalesce((l.metadata->>'total')::integer,0),500)))::bigint as questions,
      sum(greatest(0,least(coalesce((l.metadata->>'correct')::integer,0),500)))::bigint as correct,
      count(*)::bigint as submissions,
      count(distinct (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date)::bigint as active_days,
      max(l.created_at) as latest_activity
    from public.system_audit_logs l, bounded b
    where l.action='practice.quiz.submit'
      and l.actor_member_id is not null
      and l.created_at >= now() - make_interval(days=>b.days)
    group by l.actor_member_id
  ),
  scored as (
    select
      m.id as member_id,m.full_name,m.avatar_url,m.role::text as role,
      (coalesce(q.correct,0)*4
        + greatest(coalesce(q.questions,0)-coalesce(q.correct,0),0)
        + coalesce(q.submissions,0)*2
        + coalesce(q.active_days,0)*5)::bigint as verified_points,
      coalesce(q.questions,0)::bigint as verified_questions,
      coalesce(q.correct,0)::bigint as verified_correct,
      case when coalesce(q.questions,0)>0 then round(100.0*q.correct/q.questions,1) else 0::numeric end as accuracy,
      coalesce(q.active_days,0)::bigint as active_days,
      coalesce(q.submissions,0)::bigint as submissions,
      q.latest_activity,
      coalesce(s.client_streak,0) as synced_streak,
      s.synced_at
    from public.club_members m
    left join quiz q on q.member_id=m.id
    left join public.learning_sync_stats s on s.member_id=m.id
    where m.status='approved' and m.login_enabled and not m.data_conflict
  ),
  active as (
    select s.*
    from scored s, bounded b, auth_gate a
    where s.verified_questions>0
       or s.synced_at >= now() - make_interval(days=>b.days)
       or s.member_id=a.current_member
  ),
  ranked as (
    select dense_rank() over (
      order by verified_points desc, verified_correct desc, active_days desc
    ) as rank, *
    from active
  ),
  selected as (
    select r.*
    from ranked r, auth_gate a, bounded b
    where r.rank <= b.lim or r.member_id=a.current_member
  )
  select s.rank,s.member_id,s.full_name,s.avatar_url,s.role,
         s.verified_points,s.verified_questions,s.verified_correct,s.accuracy,
         s.active_days,s.submissions,s.latest_activity,s.synced_streak
  from selected s
  order by s.rank,s.full_name;
$$;

revoke all on function public.learning_competition_leaderboard_v1(integer,integer) from public;
grant execute on function public.learning_competition_leaderboard_v1(integer,integer) to authenticated;
