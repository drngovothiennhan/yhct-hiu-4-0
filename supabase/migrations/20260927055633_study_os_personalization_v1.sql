-- Store the learner's real progress through the currently published Study OS lesson,
-- and expose a member-scoped summary based on quiz attempts and review history.

create table if not exists public.study_lesson_progress_v1 (
  member_id uuid not null references public.club_members(id) on delete cascade,
  lesson_id text not null check (lesson_id = 'tcm-herbs-formulas-v1'),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  last_section_id text not null default 'overview'
    check (last_section_id in ('overview', 'herbs', 'classification', 'preparation', 'formulas', 'usage', 'flashcards', 'quiz')),
  progress_pct smallint not null default 0 check (progress_pct between 0 and 100),
  active_seconds integer not null default 0 check (active_seconds between 0 and 31536000),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (member_id, lesson_id),
  check ((status = 'completed') = (completed_at is not null))
);

alter table public.study_lesson_progress_v1 enable row level security;
revoke all on public.study_lesson_progress_v1 from public, anon, authenticated;

create or replace function public.study_lesson_progress_read_v1(p_lesson_id text default 'tcm-herbs-formulas-v1')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mid uuid := private.current_member_id();
  progress_row public.study_lesson_progress_v1%rowtype;
begin
  if mid is null or not private.is_approved() then
    return jsonb_build_object('hasProgress', false, 'status', 'empty');
  end if;
  if p_lesson_id is distinct from 'tcm-herbs-formulas-v1' then
    raise exception 'Unknown lesson';
  end if;

  select * into progress_row
  from public.study_lesson_progress_v1
  where member_id = mid and lesson_id = p_lesson_id;

  if progress_row.member_id is null then
    return jsonb_build_object('hasProgress', false, 'status', 'empty');
  end if;
  return jsonb_build_object(
    'hasProgress', true,
    'lessonId', progress_row.lesson_id,
    'status', progress_row.status,
    'lastSectionId', progress_row.last_section_id,
    'progressPct', progress_row.progress_pct,
    'activeSeconds', progress_row.active_seconds,
    'startedAt', progress_row.started_at,
    'lastActivityAt', progress_row.last_activity_at,
    'completedAt', progress_row.completed_at
  );
end;
$$;

create or replace function public.study_lesson_progress_save_v1(
  p_lesson_id text,
  p_section_id text,
  p_progress_pct integer,
  p_active_seconds integer default 0,
  p_completed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid := private.current_member_id();
  saved public.study_lesson_progress_v1%rowtype;
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required';
  end if;
  if p_lesson_id is distinct from 'tcm-herbs-formulas-v1'
     or p_section_id not in ('overview', 'herbs', 'classification', 'preparation', 'formulas', 'usage', 'flashcards', 'quiz')
     or p_progress_pct not between 0 and 100
     or p_active_seconds not between 0 and 120
     or (p_completed and p_progress_pct < 100) then
    raise exception 'Invalid lesson progress';
  end if;

  insert into public.study_lesson_progress_v1(
    member_id, lesson_id, status, last_section_id, progress_pct, active_seconds,
    last_activity_at, completed_at
  ) values (
    mid, p_lesson_id, case when p_completed then 'completed' else 'in_progress' end,
    p_section_id, p_progress_pct, p_active_seconds, now(), case when p_completed then now() else null end
  )
  on conflict (member_id, lesson_id) do update set
    status = case when public.study_lesson_progress_v1.status = 'completed' or p_completed then 'completed' else 'in_progress' end,
    last_section_id = case when public.study_lesson_progress_v1.status = 'completed' then public.study_lesson_progress_v1.last_section_id else excluded.last_section_id end,
    progress_pct = greatest(public.study_lesson_progress_v1.progress_pct, excluded.progress_pct),
    active_seconds = least(31536000, public.study_lesson_progress_v1.active_seconds + excluded.active_seconds),
    last_activity_at = now(),
    completed_at = case when public.study_lesson_progress_v1.status = 'completed' or p_completed then coalesce(public.study_lesson_progress_v1.completed_at, now()) else null end
  returning * into saved;

  return jsonb_build_object(
    'hasProgress', true,
    'lessonId', saved.lesson_id,
    'status', saved.status,
    'lastSectionId', saved.last_section_id,
    'progressPct', saved.progress_pct,
    'activeSeconds', saved.active_seconds,
    'startedAt', saved.started_at,
    'lastActivityAt', saved.last_activity_at,
    'completedAt', saved.completed_at
  );
end;
$$;

create or replace function public.study_os_personalization_summary_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mid uuid := private.current_member_id();
  lesson_row public.study_lesson_progress_v1%rowtype;
  weak_topic jsonb;
  stale_topic jsonb;
  recommendation jsonb;
  quiz_count bigint := 0;
  latest_quiz_at timestamptz;
begin
  if mid is null or not private.is_approved() then
    return jsonb_build_object('hasData', false, 'state', 'empty', 'generatedFor', (now() at time zone 'Asia/Ho_Chi_Minh')::date);
  end if;

  select * into lesson_row
  from public.study_lesson_progress_v1
  where member_id = mid and lesson_id = 'tcm-herbs-formulas-v1';

  with attempt_rows as (
    select q.subject, q.topic, s.correct_count::bigint as correct_count,
      s.wrong_count::bigint as wrong_count, s.attempts::bigint as attempts, s.last_seen_at
    from public.daily_practice_question_stats s
    join public.practice_questions q on q.id = s.question_id and q.review_status in ('source_verified', 'expert_approved')
    where s.member_id = mid and s.attempts > 0 and s.last_seen_at is not null
    union all
    select q.subject, q.topic,
      count(*) filter (where r.is_correct)::bigint, count(*) filter (where not r.is_correct)::bigint,
      count(*)::bigint, max(r.answered_at)
    from public.daily_study_review_questions_v1 r
    join public.daily_study_review_sets_v1 ds on ds.id = r.set_id and ds.member_id = mid and ds.status = 'completed'
    join public.practice_questions q on q.id = r.source_question_id and q.review_status in ('source_verified', 'expert_approved')
    where r.member_id = mid and r.status = 'answered' and r.is_correct is not null
    group by q.subject, q.topic
  ), topic_totals as (
    select subject, topic, sum(correct_count)::bigint as correct_count,
      sum(wrong_count)::bigint as wrong_count, sum(attempts)::bigint as attempts,
      max(last_seen_at) as last_seen_at,
      round(100.0 * sum(correct_count) / nullif(sum(attempts), 0), 1) as accuracy_pct
    from attempt_rows group by subject, topic
  ), topic_sources as (
    select q.subject, q.topic,
      (array_agg(q.source_file_id order by s.wrong_count desc, s.last_seen_at desc nulls last))[1] as source_file_id,
      (array_agg(q.source_file_name order by s.wrong_count desc, s.last_seen_at desc nulls last))[1] as source_title
    from public.daily_practice_question_stats s
    join public.practice_questions q on q.id = s.question_id and q.review_status in ('source_verified', 'expert_approved')
    join public.practice_source_documents d on d.drive_file_id = q.source_file_id and d.sync_status in ('ready', 'synced') and d.source_hash = q.source_hash
    where s.member_id = mid and s.attempts > 0 group by q.subject, q.topic
  ), topics as (
    select t.*, ts.source_file_id, ts.source_title,
      greatest(0, (now() at time zone 'Asia/Ho_Chi_Minh')::date - t.last_seen_at::date) as days_since_seen
    from topic_totals t left join topic_sources ts using (subject, topic)
  )
  select
    count(*),
    (select to_jsonb(t) from topics t order by t.accuracy_pct asc, t.wrong_count desc, t.attempts desc, t.last_seen_at desc limit 1),
    (select to_jsonb(t) from topics t where t.last_seen_at <= now() - interval '7 days' order by t.last_seen_at asc, t.accuracy_pct asc, t.wrong_count desc limit 1)
  into quiz_count, weak_topic, stale_topic
  from topics;

  select greatest(
    (select max(s.last_seen_at) from public.daily_practice_question_stats s where s.member_id = mid),
    (select max(r.answered_at)
      from public.daily_study_review_questions_v1 r
      join public.daily_study_review_sets_v1 ds on ds.id = r.set_id and ds.member_id = mid and ds.status = 'completed'
      where r.member_id = mid and r.status = 'answered')
  ) into latest_quiz_at;

  if lesson_row.status = 'in_progress' then
    recommendation := jsonb_build_object(
      'kind', 'resume_lesson', 'lessonId', lesson_row.lesson_id,
      'sectionId', lesson_row.last_section_id, 'progressPct', lesson_row.progress_pct,
      'activeSeconds', lesson_row.active_seconds, 'lastActivityAt', lesson_row.last_activity_at,
      'label', 'Tiếp tục bài học đang dở: Dược liệu & Phương tễ'
    );
  elsif coalesce((weak_topic->>'wrong_count')::bigint, 0) > 0 then
    recommendation := jsonb_build_object(
      'kind', 'review_weak_topic', 'subject', weak_topic->>'subject', 'topic', weak_topic->>'topic',
      'accuracyPct', (weak_topic->>'accuracy_pct')::numeric, 'wrongCount', (weak_topic->>'wrong_count')::bigint,
      'attemptCount', (weak_topic->>'attempts')::bigint, 'lastSeenAt', weak_topic->>'last_seen_at',
      'sourceFileId', weak_topic->>'source_file_id', 'sourceTitle', weak_topic->>'source_title',
      'label', 'Củng cố chủ đề quiz sai nhiều nhất'
    );
  elsif lesson_row.status is null then
    recommendation := jsonb_build_object(
      'kind', 'standard_lesson', 'lessonId', 'tcm-herbs-formulas-v1',
      'label', 'Bắt đầu bài học hiện có: Dược liệu & Phương tễ'
    );
  else
    recommendation := jsonb_build_object(
      'kind', 'curriculum_missing',
      'label', 'Chưa có bài tiếp theo trong lộ trình đã kết nối'
    );
  end if;

  if quiz_count = 0 then
    return jsonb_build_object(
      'hasData', lesson_row.member_id is not null, 'state', case when lesson_row.member_id is null then 'empty' else 'lesson_only' end,
      'generatedFor', (now() at time zone 'Asia/Ho_Chi_Minh')::date,
      'lessonProgress', case when lesson_row.member_id is null then null else jsonb_build_object(
        'status', lesson_row.status, 'lastSectionId', lesson_row.last_section_id,
        'progressPct', lesson_row.progress_pct, 'activeSeconds', lesson_row.active_seconds,
        'lastActivityAt', lesson_row.last_activity_at, 'completedAt', lesson_row.completed_at
      ) end,
      'recommendation', recommendation, 'reviewSummary', null
    );
  else
    return jsonb_build_object(
      'hasData', true, 'state', 'personalized',
      'generatedFor', (now() at time zone 'Asia/Ho_Chi_Minh')::date,
      'lessonProgress', case when lesson_row.member_id is null then null else jsonb_build_object(
        'status', lesson_row.status, 'lastSectionId', lesson_row.last_section_id,
        'progressPct', lesson_row.progress_pct, 'activeSeconds', lesson_row.active_seconds,
        'lastActivityAt', lesson_row.last_activity_at, 'completedAt', lesson_row.completed_at
      ) end,
      'recommendation', recommendation,
      'reviewSummary', jsonb_build_object(
        'weakestTopic', weak_topic,
        'staleTopic', stale_topic,
        'lastQuizAt', latest_quiz_at
      )
    );
  end if;
end;
$$;

revoke all on function public.study_lesson_progress_read_v1(text) from public, anon;
revoke all on function public.study_lesson_progress_save_v1(text, text, integer, integer, boolean) from public, anon;
revoke all on function public.study_os_personalization_summary_v1() from public, anon;
grant execute on function public.study_lesson_progress_read_v1(text) to authenticated;
grant execute on function public.study_lesson_progress_save_v1(text, text, integer, integer, boolean) to authenticated;
grant execute on function public.study_os_personalization_summary_v1() to authenticated;
