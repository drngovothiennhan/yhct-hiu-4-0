-- Study OS: vòng học khép kín cho Quiz (Luyện thi tự do).
-- Vấn đề đo được trên production ngày 2026-11-13: practice_quiz_submit_v1 chỉ ghi điểm theo ngày,
-- không ghi câu nào đúng/sai. Vì vậy máy chủ không biết câu còn sai (137 câu sai chưa từng được ôn lại),
-- và gợi ý "Hôm nay nên ôn gì" (study_os_personalization_summary_v1) không có dữ liệu từ luồng quiz chính.
-- Thay đổi (chỉ thêm): 1) practice_quiz_submit_v1 cùng tham số, cùng kiểu trả về, thêm ghi
-- daily_practice_question_stats cho câu đã chọn đáp án; 2) hai hàm đọc mới. Không DROP, DELETE, TRUNCATE.
-- Điểm thi đua không đổi (vẫn theo private.practice_quiz_daily_credit). Hai hàm đọc không trả đáp án.

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
      -- Ghi kết quả từng câu để máy chủ biết câu nào còn sai (vòng ôn lại câu sai, gợi ý cá nhân hoá).
      insert into public.daily_practice_question_stats as s(member_id, question_id, attempts, correct_count, wrong_count, last_seen_at, last_correct_at)
      values (mid, qid, 1,
        case when selected=q.correct_index then 1 else 0 end,
        case when selected=q.correct_index then 0 else 1 end,
        now(),
        case when selected=q.correct_index then now() else null end)
      on conflict (member_id, question_id) do update
        set attempts = s.attempts + 1,
            correct_count = s.correct_count + excluded.correct_count,
            wrong_count = s.wrong_count + excluded.wrong_count,
            last_seen_at = excluded.last_seen_at,
            last_correct_at = coalesce(excluded.last_correct_at, s.last_correct_at);
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

revoke all on function public.practice_quiz_submit_v1(jsonb) from public, anon;
grant execute on function public.practice_quiz_submit_v1(jsonb) to authenticated;

-- Câu còn sai: lần trả lời gần nhất là sai. Trả đúng định dạng câu hỏi của practice_quiz_page_v1 (không có đáp án).
create or replace function public.practice_quiz_mistakes_v1(p_subject text default '', p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mid uuid:=private.current_member_id();
  subject_filter text:=left(btrim(coalesce(p_subject,'')),160);
  row_limit integer:=greatest(1,least(coalesce(p_limit,20),50));
  total integer:=0;
  rows jsonb:='[]'::jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;

  with open_rows as (
    select q.id, f.folder_name as display_subject, q.topic, q.stem, q.options, q.generation_method,
           q.review_status, q.source_file_id, s.wrong_count, s.last_seen_at
    from public.daily_practice_question_stats s
    join public.practice_questions q
      on q.id=s.question_id and q.review_status in('source_verified','expert_approved')
    join private.practice_subject_folders_v1 f
      on f.active=true and lower(btrim(f.folder_name))=lower(btrim(coalesce(q.subject,'')))
    where s.member_id=mid
      and s.wrong_count>0
      and (s.last_correct_at is null or s.last_correct_at<s.last_seen_at)
      and (subject_filter='' or lower(f.folder_name)=lower(subject_filter))
  ), picked as (
    select o.*, row_number() over(order by o.wrong_count desc, o.last_seen_at asc, o.id)::integer as ord
    from open_rows o
    order by o.wrong_count desc, o.last_seen_at asc, o.id
    limit row_limit
  )
  select (select count(*) from open_rows),
         coalesce(jsonb_agg(jsonb_build_object(
           'id',p.id,
           'subject',p.display_subject,
           'topic',p.topic,
           'stem',p.stem,
           'options',to_jsonb(p.options),
           'generationMethod',p.generation_method,
           'reviewStatus',p.review_status,
           'referenceOnly',coalesce(d.sync_status='needs_review',false)
         ) order by p.ord),'[]'::jsonb)
    into total, rows
  from picked p
  left join public.practice_source_documents d on d.drive_file_id=p.source_file_id;

  return jsonb_build_object('subject',subject_filter,'total',coalesce(total,0),'pageSize',row_limit,'questions',rows);
end
$$;

revoke all on function public.practice_quiz_mistakes_v1(text, integer) from public, anon;
grant execute on function public.practice_quiz_mistakes_v1(text, integer) to authenticated;

-- Mức nắm bài theo thư mục: số câu trong ngân hàng, đã làm, đang đúng, còn sai. Chỉ số đếm, không có nội dung.
create or replace function public.practice_quiz_mastery_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  mid uuid:=private.current_member_id();
  subjects jsonb:='[]'::jsonb;
  totals jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;

  with bank as (
    select f.folder_name as subject, q.id
    from public.practice_questions q
    join private.practice_subject_folders_v1 f
      on f.active=true and lower(btrim(f.folder_name))=lower(btrim(coalesce(q.subject,'')))
    where q.review_status in('source_verified','expert_approved')
  ), per_subject as (
    select b.subject,
      count(*)::integer as bank_count,
      count(s.question_id)::integer as seen,
      count(*) filter (where s.last_correct_at is not null and s.last_correct_at>=s.last_seen_at)::integer as correct_now,
      count(*) filter (where s.wrong_count>0 and (s.last_correct_at is null or s.last_correct_at<s.last_seen_at))::integer as open_mistakes,
      max(s.last_seen_at) as last_seen_at
    from bank b
    left join public.daily_practice_question_stats s on s.member_id=mid and s.question_id=b.id and s.attempts>0
    group by b.subject
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'subject',p.subject,'bankCount',p.bank_count,'seen',p.seen,
           'correctNow',p.correct_now,'openMistakes',p.open_mistakes,'lastSeenAt',p.last_seen_at
         ) order by p.open_mistakes desc, p.seen desc, lower(p.subject)),'[]'::jsonb),
         jsonb_build_object(
           'bankCount',coalesce(sum(p.bank_count),0),'seen',coalesce(sum(p.seen),0),
           'correctNow',coalesce(sum(p.correct_now),0),'openMistakes',coalesce(sum(p.open_mistakes),0),
           'lastSeenAt',max(p.last_seen_at))
    into subjects, totals
  from per_subject p;

  return jsonb_build_object('generatedAt',now(),'totals',totals,'subjects',subjects);
end
$$;

revoke all on function public.practice_quiz_mastery_v1() from public, anon;
grant execute on function public.practice_quiz_mastery_v1() to authenticated;
