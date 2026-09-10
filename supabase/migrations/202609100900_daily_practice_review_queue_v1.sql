-- Moderation queue for Drive-generated practice questions.
create or replace function public.practice_question_review_queue_v1(p_limit integer default 5)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); role_name text; result jsonb;
begin
  select role into role_name from public.club_members where id=mid and status='approved';
  if role_name not in('admin','super_mod','mod','leader') then raise exception 'Moderator required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'subject',q.subject,'topic',q.topic,'stem',q.stem,'options',to_jsonb(q.options),'correctIndex',q.correct_index,
    'explanation',q.explanation,'sourceFileName',q.source_file_name,'sourceModifiedTime',q.source_modified_time,
    'generationMethod',q.generation_method,'provenance',q.provenance,'createdAt',q.created_at
  ) order by q.created_at asc),'[]'::jsonb) into result
  from (select * from public.practice_questions where review_status='needs_review' order by created_at asc limit least(greatest(coalesce(p_limit,5),1),20)) q;
  return result;
end $$;
revoke all on function public.practice_question_review_queue_v1(integer) from public,anon;
grant execute on function public.practice_question_review_queue_v1(integer) to authenticated;
