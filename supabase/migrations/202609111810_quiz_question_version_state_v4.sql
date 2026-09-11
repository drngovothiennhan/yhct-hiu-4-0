-- Question-version state integrity v4.
-- A stable external key keeps the same UUID, so any material content revision must
-- invalidate answer/stat state tied to the previous version of that UUID.

create or replace function private.practice_invalidate_changed_question_state_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.content_hash is distinct from new.content_hash
     or old.subject is distinct from new.subject
     or old.topic is distinct from new.topic
     or old.stem is distinct from new.stem
     or old.options is distinct from new.options
     or old.correct_index is distinct from new.correct_index
     or old.explanation is distinct from new.explanation then

    -- Mastery statistics are version-specific. Do not let attempts against an old
    -- stem/answer bias scheduling or scoring for the revised question.
    delete from public.daily_practice_question_stats
    where question_id=new.id;

    -- Keep the question ID in today's stable set so its target size is preserved,
    -- but remove any answer to the previous version. If the revised question is no
    -- longer approved, daily_practice_today_v1 will prune/top-up it on the next read.
    update public.daily_practice_sessions
    set
      answers=answers-new.id::text,
      status='active',
      completed_at=null
    where practice_date=(now() at time zone 'Asia/Ho_Chi_Minh')::date
      and new.id=any(question_ids)
      and answers ? new.id::text;
  end if;

  return new;
end
$$;

revoke all on function private.practice_invalidate_changed_question_state_v1() from public;
revoke all on function private.practice_invalidate_changed_question_state_v1() from anon;
revoke all on function private.practice_invalidate_changed_question_state_v1() from authenticated;

drop trigger if exists practice_invalidate_changed_question_state_v1 on public.practice_questions;
create trigger practice_invalidate_changed_question_state_v1
after update of content_hash,subject,topic,stem,options,correct_index,explanation
on public.practice_questions
for each row
execute function private.practice_invalidate_changed_question_state_v1();

comment on function private.practice_invalidate_changed_question_state_v1() is
'Clears version-specific Quick Review answers/stats whenever question content changes under a stable UUID.';
