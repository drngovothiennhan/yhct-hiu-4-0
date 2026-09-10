-- V11 daily-practice covering indexes identified by the Supabase performance advisor.
create index if not exists daily_practice_question_stats_question_id_idx
  on public.daily_practice_question_stats(question_id);

create index if not exists practice_questions_expert_verified_by_idx
  on public.practice_questions(expert_verified_by);
