create index if not exists exam_questions_v2_expert_verified_by_idx on public.exam_questions_v2(expert_verified_by) where expert_verified_by is not null;
create index if not exists ai_assistant_reminders_member_id_idx on public.ai_assistant_reminders(member_id);
create index if not exists ai_auto_post_runs_post_id_idx on public.ai_auto_post_runs(post_id) where post_id is not null;
