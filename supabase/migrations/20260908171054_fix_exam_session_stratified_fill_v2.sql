create or replace function public.exam_session_start_v2(p_mode text default 'mock')
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_member uuid;
  v_count int;
  v_ids uuid[];
  v_session uuid;
  v_mode text:=lower(coalesce(p_mode,'mock'));
  v_questions jsonb;
  v_deadline timestamptz:=now()+interval '60 minutes';
begin
  v_member:=private.current_member_id();
  if v_member is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if v_mode not in('mock','practice') then raise exception 'Invalid exam mode'; end if;

  select count(*) into v_count
  from public.exam_questions_v2
  where review_status in('legacy_validated','expert_approved');
  if v_count<50 then raise exception 'Ngân hàng câu hỏi đã duyệt hiện có %, cần tối thiểu 50 câu để mở phiên thi chuẩn.',v_count; end if;

  with picked as(
    (select id from public.exam_questions_v2 where review_status in('legacy_validated','expert_approved') and domain='Bệnh học Đông-Tây y' order by random() limit 13)
    union all
    (select id from public.exam_questions_v2 where review_status in('legacy_validated','expert_approved') and domain='Biện chứng luận trị' order by random() limit 13)
    union all
    (select id from public.exam_questions_v2 where review_status in('legacy_validated','expert_approved') and domain='Phương tễ' order by random() limit 12)
    union all
    (select id from public.exam_questions_v2 where review_status in('legacy_validated','expert_approved') and domain='Châm cứu' order by random() limit 12)
  ),remaining as(
    select q.id
    from public.exam_questions_v2 q
    where q.review_status in('legacy_validated','expert_approved')
      and not exists(select 1 from picked p where p.id=q.id)
    order by random()
    limit greatest(0,50-(select count(*) from picked))
  ),combined as(
    select id from picked
    union all
    select id from remaining
  )
  select array_agg(id order by random()) into v_ids
  from (select id from combined limit 50) s;

  if coalesce(cardinality(v_ids),0)<>50 then raise exception 'Không đủ 50 câu phân tầng hợp lệ.'; end if;

  insert into public.exam_sessions_v2(member_id,mode,question_ids,deadline_at)
  values(v_member,v_mode,v_ids,v_deadline)
  returning id into v_session;

  select jsonb_agg(jsonb_build_object(
    'id',q.id,'domain',q.domain,'topic',q.topic,'stem',q.stem,
    'options',to_jsonb(q.options),'sourceRef',q.source_ref
  ) order by u.ord)
  into v_questions
  from unnest(v_ids) with ordinality u(id,ord)
  join public.exam_questions_v2 q on q.id=u.id;

  return jsonb_build_object(
    'sessionId',v_session,'questionCount',50,'durationMinutes',60,
    'deadlineAt',v_deadline,'questions',coalesce(v_questions,'[]'::jsonb)
  );
end $function$;
revoke all on function public.exam_session_start_v2(text) from public,anon;
grant execute on function public.exam_session_start_v2(text) to authenticated;
