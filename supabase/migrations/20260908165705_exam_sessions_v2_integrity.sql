create table if not exists public.exam_questions_v2(
  id uuid primary key default gen_random_uuid(),
  external_key text unique,
  domain text not null check(domain in('Bệnh học Đông-Tây y','Biện chứng luận trị','Phương tễ','Châm cứu')),
  topic text not null,
  stem text not null,
  options text[] not null check(cardinality(options)=4),
  correct_index smallint not null check(correct_index between 0 and 3),
  explanation text not null default '',
  source_ref text not null default '',
  review_status text not null default 'needs_review' check(review_status in('needs_review','legacy_validated','expert_approved','rejected')),
  expert_verified_by uuid references public.club_members(id),
  expert_verified_at timestamptz,
  source_document_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.exam_questions_v2 enable row level security;
revoke all on public.exam_questions_v2 from anon,authenticated;

create table if not exists public.exam_sessions_v2(
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  mode text not null check(mode in('mock','practice')),
  question_ids uuid[] not null,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'active' check(status in('active','submitted','expired')),
  result jsonb
);
create index if not exists exam_sessions_v2_member_idx on public.exam_sessions_v2(member_id,started_at desc);
alter table public.exam_sessions_v2 enable row level security;
revoke all on public.exam_sessions_v2 from anon,authenticated;

insert into public.exam_questions_v2(external_key,domain,topic,stem,options,correct_index,explanation,source_ref,review_status)
values
('LL01','Biện chứng luận trị','Âm Dương','Biểu hiện nào phù hợp nhất với chứng Âm hư?',array['Sợ lạnh, tay chân lạnh, mạch trầm trì','Ngũ tâm phiền nhiệt, triều nhiệt, đạo hãn','Phù, tiểu ít, lưỡi bệu','Đau cố định, lưỡi tím'],1,'Âm hư làm mất khả năng chế ước dương, tạo hư nhiệt: ngũ tâm phiền nhiệt, triều nhiệt, đạo hãn, lưỡi đỏ ít rêu, mạch tế sác.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated'),
('LL02','Biện chứng luận trị','Bát cương','Sốt nhẹ về chiều, đạo hãn, lưỡi đỏ ít rêu, mạch tế sác thuộc cặp cương lĩnh nào?',array['Biểu - Hàn - Thực','Lý - Hàn - Hư','Lý - Nhiệt - Hư','Biểu - Nhiệt - Thực'],2,'Triệu chứng kéo dài, không ở phần biểu; có dấu hư nhiệt và âm dịch suy nên xếp Lý - Nhiệt - Hư.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated'),
('LL03','Biện chứng luận trị','Tạng Tượng','Tạng nào chủ sơ tiết và tàng huyết?',array['Tâm','Can','Tỳ','Thận'],1,'Can chủ sơ tiết, điều đạt khí cơ và tàng huyết.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated'),
('NO01','Bệnh học Đông-Tây y','Cảm mạo phong hàn','Cảm mạo: ác hàn nhiều, phát nhiệt nhẹ, không mồ hôi, đau đầu, rêu trắng mỏng, mạch phù khẩn. Pháp trị phù hợp?',array['Tân lương giải biểu','Tân ôn giải biểu','Thanh nhiệt tả hỏa','Ích khí cố biểu'],1,'Phong hàn thúc biểu, vệ dương bị uất; pháp trị là tân ôn giải biểu.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated'),
('NO02','Bệnh học Đông-Tây y','Mất ngủ','Mất ngủ, hồi hộp, hay quên, ăn kém, mệt, sắc mặt nhợt, lưỡi nhạt, mạch tế nhược gợi ý thể nào?',array['Tâm hỏa vượng','Can uất hóa hỏa','Tâm tỳ lưỡng hư','Đàm nhiệt nhiễu tâm'],2,'Tâm huyết bất túc gây hồi hộp, mất ngủ; Tỳ khí hư gây ăn kém, mệt, phối hợp thành Tâm tỳ lưỡng hư.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated'),
('NO03','Bệnh học Đông-Tây y','Đau lưng','Đau lưng nặng nề, gặp lạnh tăng, chườm ấm dễ chịu, lưỡi nhạt rêu trắng nhớt, mạch trầm khẩn phù hợp nhất với?',array['Thận âm hư','Hàn thấp tý trở','Thấp nhiệt hạ tiêu','Huyết ứ'],1,'Đau tăng khi lạnh, nặng nề và rêu trắng nhớt gợi hàn thấp; mạch trầm khẩn củng cố hàn tà ở lý/kinh lạc.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated'),
('AC01','Châm cứu','Kinh lạc','Huyệt Hợp cốc (LI4) thuộc kinh nào?',array['Thủ Thái âm Phế','Thủ Dương minh Đại trường','Túc Dương minh Vị','Túc Thái âm Tỳ'],1,'Hợp cốc là nguyên huyệt của kinh Thủ Dương minh Đại trường.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated'),
('AC02','Châm cứu','An toàn châm cứu','Nguyên tắc an toàn ưu tiên khi châm vùng ngực - lưng trên là gì?',array['Châm sâu vuông góc mọi trường hợp','Châm theo hướng và độ sâu an toàn, tránh tổn thương màng phổi','Luôn cứu nóng trước khi châm','Không cần sát khuẩn nếu kim vô trùng'],1,'Vùng có phổi cần kiểm soát góc và độ sâu để giảm nguy cơ tràn khí màng phổi; tuân thủ vô khuẩn.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated'),
('PT01','Phương tễ','Thập Bát Phản','Cặp phối hợp nào thuộc nhóm Thập Bát Phản cần cảnh báo?',array['Cam thảo - Cam toại','Nhân sâm - Bạch truật','Đương quy - Xuyên khung','Hoàng kỳ - Phòng phong'],0,'Cam thảo phản Cam toại, Đại kích, Hải tảo, Nguyên hoa.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated'),
('PT02','Phương tễ','Quân Thần Tá Sứ','Trong cấu trúc phương tễ, vị trực tiếp điều trị chủ chứng được gọi là?',array['Quân','Thần','Tá','Sứ'],0,'Quân dược là vị chủ lực điều trị chủ bệnh/chủ chứng.','Ngân hàng legacy YHCT HIU 4.0','legacy_validated')
on conflict(external_key) do nothing;

create or replace function public.exam_config_v2()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_member uuid;v_eligible int;v_expert int;v_candidates int;
begin
  v_member:=private.current_member_id();
  if v_member is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select count(*) filter(where review_status in('legacy_validated','expert_approved')),
         count(*) filter(where review_status='expert_approved'),
         count(*)
  into v_eligible,v_expert,v_candidates
  from public.exam_questions_v2 where review_status<>'rejected';
  return jsonb_build_object('questionCount',50,'durationMinutes',60,'domains',jsonb_build_array('Bệnh học Đông-Tây y','Biện chứng luận trị','Phương tễ','Châm cứu'),'eligibleCount',v_eligible,'expertApprovedCount',v_expert,'candidateCount',v_candidates,'ready',v_eligible>=50);
end $function$;
revoke all on function public.exam_config_v2() from public,anon;
grant execute on function public.exam_config_v2() to authenticated;

create or replace function public.exam_session_start_v2(p_mode text default 'mock')
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_member uuid;v_count int;v_ids uuid[];v_session uuid;v_mode text:=lower(coalesce(p_mode,'mock'));v_questions jsonb;v_deadline timestamptz:=now()+interval '60 minutes';
begin
  v_member:=private.current_member_id();if v_member is null or not private.is_approved() then raise exception 'Approved member required';end if;
  if v_mode not in('mock','practice') then raise exception 'Invalid exam mode';end if;
  select count(*) into v_count from public.exam_questions_v2 where review_status in('legacy_validated','expert_approved');
  if v_count<50 then raise exception 'Ngân hàng câu hỏi đã duyệt hiện có %, cần tối thiểu 50 câu để mở phiên thi chuẩn.',v_count;end if;
  with picked as(
    (select id from public.exam_questions_v2 where review_status in('legacy_validated','expert_approved') and domain='Bệnh học Đông-Tây y' order by random() limit 13)
    union all (select id from public.exam_questions_v2 where review_status in('legacy_validated','expert_approved') and domain='Biện chứng luận trị' order by random() limit 13)
    union all (select id from public.exam_questions_v2 where review_status in('legacy_validated','expert_approved') and domain='Phương tễ' order by random() limit 12)
    union all (select id from public.exam_questions_v2 where review_status in('legacy_validated','expert_approved') and domain='Châm cứu' order by random() limit 12)
  ),remaining as(
    select q.id from public.exam_questions_v2 q
    where q.review_status in('legacy_validated','expert_approved') and not exists(select 1 from picked p where p.id=q.id)
    order by random() limit greatest(0,50-(select count(*) from picked))
  ),combined as(select id from picked union all select id from remaining)
  select array_agg(id order by random()) into v_ids from (select id from combined limit 50)s;
  if coalesce(cardinality(v_ids),0)<>50 then raise exception 'Không đủ 50 câu phân tầng hợp lệ.';end if;
  insert into public.exam_sessions_v2(member_id,mode,question_ids,deadline_at) values(v_member,v_mode,v_ids,v_deadline) returning id into v_session;
  select jsonb_agg(jsonb_build_object('id',q.id,'domain',q.domain,'topic',q.topic,'stem',q.stem,'options',to_jsonb(q.options),'sourceRef',q.source_ref) order by u.ord) into v_questions from unnest(v_ids) with ordinality u(id,ord) join public.exam_questions_v2 q on q.id=u.id;
  return jsonb_build_object('sessionId',v_session,'questionCount',50,'durationMinutes',60,'deadlineAt',v_deadline,'questions',coalesce(v_questions,'[]'::jsonb));
end $function$;
revoke all on function public.exam_session_start_v2(text) from public,anon;
grant execute on function public.exam_session_start_v2(text) to authenticated;

create or replace function public.exam_session_answer_v2(p_session_id uuid,p_question_id uuid,p_selected_index integer)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_member uuid;v_session public.exam_sessions_v2%rowtype;v_q public.exam_questions_v2%rowtype;
begin
  v_member:=private.current_member_id();if v_member is null then raise exception 'Member required';end if;
  select * into v_session from public.exam_sessions_v2 where id=p_session_id and member_id=v_member for update;
  if v_session.id is null then raise exception 'Exam session not found';end if;
  if v_session.status<>'active' or now()>v_session.deadline_at then update public.exam_sessions_v2 set status='expired' where id=v_session.id and status='active';raise exception 'Exam session expired';end if;
  if p_selected_index not between 0 and 3 or not(p_question_id=any(v_session.question_ids)) then raise exception 'Invalid answer';end if;
  update public.exam_sessions_v2 set answers=answers||jsonb_build_object(p_question_id::text,p_selected_index) where id=v_session.id;
  if v_session.mode='practice' then select * into v_q from public.exam_questions_v2 where id=p_question_id;return jsonb_build_object('accepted',true,'correct',p_selected_index=v_q.correct_index,'correctIndex',v_q.correct_index,'explanation',v_q.explanation,'sourceRef',v_q.source_ref);end if;
  return jsonb_build_object('accepted',true);
end $function$;
revoke all on function public.exam_session_answer_v2(uuid,uuid,integer) from public,anon;
grant execute on function public.exam_session_answer_v2(uuid,uuid,integer) to authenticated;

create or replace function public.exam_session_submit_v2(p_session_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_member uuid;v_session public.exam_sessions_v2%rowtype;v_correct int;v_review jsonb;v_result jsonb;
begin
  v_member:=private.current_member_id();if v_member is null then raise exception 'Member required';end if;
  select * into v_session from public.exam_sessions_v2 where id=p_session_id and member_id=v_member for update;
  if v_session.id is null then raise exception 'Exam session not found';end if;
  if v_session.status='submitted' then return v_session.result;end if;
  select count(*) filter(where coalesce((v_session.answers->>q.id::text)::int,-1)=q.correct_index),jsonb_agg(jsonb_build_object('id',q.id,'domain',q.domain,'topic',q.topic,'selectedIndex',case when v_session.answers?q.id::text then (v_session.answers->>q.id::text)::int else null end,'correctIndex',q.correct_index,'correct',coalesce((v_session.answers->>q.id::text)::int,-1)=q.correct_index,'explanation',q.explanation,'sourceRef',q.source_ref) order by u.ord)
  into v_correct,v_review from unnest(v_session.question_ids) with ordinality u(id,ord) join public.exam_questions_v2 q on q.id=u.id;
  v_result:=jsonb_build_object('score',round(v_correct*100.0/50),'correctCount',v_correct,'total',50,'review',coalesce(v_review,'[]'::jsonb),'submittedAt',now());
  update public.exam_sessions_v2 set status='submitted',submitted_at=now(),result=v_result where id=v_session.id;
  return v_result;
end $function$;
revoke all on function public.exam_session_submit_v2(uuid) from public,anon;
grant execute on function public.exam_session_submit_v2(uuid) to authenticated;
