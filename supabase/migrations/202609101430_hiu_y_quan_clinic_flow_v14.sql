-- HIU Y Quan V14: persistent 10-minute educational observation flow, archived case book,
-- age-varied patients, and an interactive herb cabinet.
-- Herb learning cards are curated against current Vietnamese Pharmacopoeia VI terminology
-- and official Chinese-medicine monograph conventions. Source provenance is intentionally
-- not returned by the public RPC because the in-game card is a compact learning surface.
-- The 10-minute/5-minute timers below are GAME MECHANICS, not clinical protocols.

alter table public.hiu_y_quan_cases add column if not exists care_status text not null default 'waiting_diagnosis';
alter table public.hiu_y_quan_cases add column if not exists treatment_started_at timestamptz;
alter table public.hiu_y_quan_cases add column if not exists recheck_due_at timestamptz;
alter table public.hiu_y_quan_cases add column if not exists rechecked_at timestamptz;
alter table public.hiu_y_quan_cases add column if not exists discharged_at timestamptz;
alter table public.hiu_y_quan_cases add column if not exists archived_at timestamptz;
alter table public.hiu_y_quan_cases add column if not exists recheck_count smallint not null default 0;
alter table public.hiu_y_quan_cases add column if not exists patient_variant smallint not null default 1;

alter table public.hiu_y_quan_cases drop constraint if exists hiu_y_quan_cases_care_status_check;
alter table public.hiu_y_quan_cases add constraint hiu_y_quan_cases_care_status_check
  check (care_status in ('waiting_diagnosis','awaiting_transfer','observing','recheck_due','discharged'));
alter table public.hiu_y_quan_cases drop constraint if exists hiu_y_quan_cases_recheck_count_check;
alter table public.hiu_y_quan_cases add constraint hiu_y_quan_cases_recheck_count_check check (recheck_count between 0 and 3);
alter table public.hiu_y_quan_cases drop constraint if exists hiu_y_quan_cases_patient_variant_check;
alter table public.hiu_y_quan_cases add constraint hiu_y_quan_cases_patient_variant_check check (patient_variant between 1 and 3);

update public.hiu_y_quan_cases c
set care_status='awaiting_transfer'
where c.archived_at is null
  and c.care_status='waiting_diagnosis'
  and exists(select 1 from public.hiu_y_quan_attempts a where a.case_id=c.id and a.member_id=c.member_id);

update public.hiu_y_quan_cases
set patient_variant=(1+((hashtext(case_key)::bigint & 2147483647)%3))::smallint
where patient_variant=1;

create index if not exists hiu_y_quan_cases_member_care_idx
  on public.hiu_y_quan_cases(member_id,care_status,recheck_due_at)
  where archived_at is null;
create index if not exists hiu_y_quan_cases_member_archive_idx
  on public.hiu_y_quan_cases(member_id,archived_at desc)
  where archived_at is not null;

create or replace function public.hiu_y_quan_herbs_v14()
returns table(
  herb_key text,
  name text,
  latin_name text,
  nature_flavor text,
  meridians text,
  actions text,
  indications text
)
language sql
security definer
set search_path=''
as $$
  select * from (values
    ('que','Quế (Nhục quế)','Cinnamomi Cortex','Vị cay, ngọt; tính đại nhiệt.','Thận, Tỳ, Tâm, Can.','Bổ hỏa trợ dương; ôn thông kinh mạch; tán hàn chỉ thống; dẫn hỏa quy nguyên.','Mô tả YHCT dùng trong các chứng hư hàn, tay chân lạnh, đau do hàn, dương hư và hàn ngưng.'),
    ('cam-thao','Cam thảo','Glycyrrhizae Radix et Rhizoma','Vị ngọt; tính bình.','Tâm, Phế, Tỳ, Vị.','Bổ Tỳ ích khí; nhuận Phế chỉ khái; thanh nhiệt giải độc; hoãn cấp chỉ thống; điều hòa các vị thuốc.','Mô tả YHCT dùng trong Tỳ khí hư, ho, co quắp đau và phối hợp điều hòa phương thuốc.'),
    ('tran-bi','Trần bì','Citri Reticulatae Pericarpium','Vị cay, đắng; tính ôn.','Phế, Tỳ.','Lý khí kiện Tỳ; táo thấp hóa đàm.','Mô tả YHCT dùng khi ngực bụng đầy trướng, ăn kém, nôn ợ và đàm thấp gây ho nhiều đờm.'),
    ('bach-truat','Bạch truật','Atractylodis Macrocephalae Rhizoma','Vị đắng, ngọt; tính ôn.','Tỳ, Vị.','Kiện Tỳ ích khí; táo thấp lợi thủy; chỉ hãn; an thai theo lý luận YHCT.','Mô tả YHCT dùng trong Tỳ khí hư, ăn kém, đại tiện lỏng, phù do thấp và tự hãn.'),
    ('duong-quy','Đương quy','Angelicae Sinensis Radix','Vị ngọt, cay; tính ôn.','Can, Tâm, Tỳ.','Bổ huyết; hoạt huyết; điều kinh; chỉ thống; nhuận táo hoạt trường.','Mô tả YHCT dùng trong huyết hư, kinh nguyệt không đều, đau do huyết ứ và táo bón do huyết hư.'),
    ('phuc-linh','Phục linh','Poria','Vị ngọt, nhạt; tính bình.','Tâm, Phế, Tỳ, Thận.','Lợi thủy thẩm thấp; kiện Tỳ; an thần.','Mô tả YHCT dùng trong thủy thấp, phù, tiểu tiện bất lợi, Tỳ hư ăn kém, đàm ẩm và tâm thần bất an.'),
    ('sa-nhan','Sa nhân','Amomi Fructus','Vị cay; tính ôn.','Tỳ, Vị, Thận.','Hóa thấp hành khí; ôn trung; chỉ ẩu; an thai theo lý luận YHCT.','Mô tả YHCT dùng khi thấp trở trung tiêu, bụng đầy, ăn kém, nôn, tiêu lỏng và khí trệ.'),
    ('y-di','Ý dĩ','Coicis Semen','Vị ngọt, nhạt; tính hơi hàn.','Tỳ, Vị, Phế.','Lợi thủy thẩm thấp; kiện Tỳ; trừ tý; thanh nhiệt bài nùng theo lý luận YHCT.','Mô tả YHCT dùng trong phù, tiểu ít, Tỳ hư tiêu lỏng, thấp tý và các chứng thấp nhiệt theo biện chứng.'),
    ('mach-mon','Mạch môn','Ophiopogonis Radix','Vị ngọt, hơi đắng; tính hơi hàn.','Tâm, Phế, Vị.','Dưỡng âm; nhuận Phế; dưỡng Vị sinh tân; thanh Tâm.','Mô tả YHCT dùng trong Phế táo ho khan, tân dịch tổn thương, khô miệng khát và tâm phiền mất ngủ.'),
    ('dan-sam','Đan sâm','Salviae Miltiorrhizae Radix et Rhizoma','Vị đắng; tính hơi hàn.','Tâm, Can.','Hoạt huyết khứ ứ; thông kinh chỉ thống; lương huyết; an thần theo lý luận YHCT.','Mô tả YHCT dùng trong các chứng huyết ứ, đau cố định, kinh nguyệt không đều và tâm phiền mất ngủ do huyết nhiệt/ứ.'),
    ('ich-mau','Ích mẫu','Leonuri Herba','Vị cay, đắng; tính hơi hàn.','Can, Tâm, Bàng quang.','Hoạt huyết điều kinh; lợi thủy tiêu thũng; thanh nhiệt giải độc theo lý luận YHCT.','Mô tả YHCT dùng trong kinh nguyệt không đều do huyết ứ, phù và tiểu tiện bất lợi theo biện chứng.'),
    ('kim-ngan','Kim ngân hoa','Lonicerae Japonicae Flos','Vị ngọt; tính hàn.','Phế, Tâm, Vị.','Thanh nhiệt giải độc; sơ tán phong nhiệt.','Mô tả YHCT dùng trong phong nhiệt, biểu hiện nhiệt độc và các chứng nhiệt theo biện chứng YHCT.')
  ) as h(herb_key,name,latin_name,nature_flavor,meridians,actions,indications)
  order by array_position(array['que','cam-thao','tran-bi','bach-truat','duong-quy','phuc-linh','sa-nhan','y-di','mach-mon','dan-sam','ich-mau','kim-ngan'],herb_key);
$$;

create or replace function public.hiu_y_quan_hourly_cases_v3()
returns table(
  case_key text,
  patient_age smallint,
  patient_gender text,
  patient_variant smallint,
  vong text,
  van_am text,
  van_hoi text,
  thiet text,
  options jsonb,
  completed boolean,
  correct boolean,
  credits_awarded smallint,
  appointment_offered boolean,
  appointment_status text,
  appointment_for_at timestamptz,
  appointment_decided_at timestamptz,
  care_status text,
  treatment_started_at timestamptz,
  recheck_due_at timestamptz,
  rechecked_at timestamptz,
  discharged_at timestamptz,
  recheck_count smallint
)
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  slot timestamptz:=date_trunc('hour',now());
  cnt integer;
  i integer;
  seed bigint;
  picked_code text;
  key text;
  offer boolean;
  appt_at timestamptz;
  age_value smallint;
  variant_value smallint;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles p where p.member_id=mid) then raise exception 'Hãy kích hoạt nhân vật HIU - Y - Quán trước.'; end if;

  update public.hiu_y_quan_cases c
  set care_status='recheck_due'
  where c.member_id=mid and c.archived_at is null and c.care_status='observing' and c.recheck_due_at<=now();

  cnt:=1+(((hashtext(mid::text||slot::text)::bigint & 2147483647)%2)::integer);
  for i in 1..cnt loop
    key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-'||i;
    offer:=private.hiu_y_quan_appointment_offer_v2(mid,slot,i::smallint);
    appt_at:=case when offer then private.hiu_y_quan_appointment_time_v2(mid,slot,i::smallint) else null end;
    if not exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.case_key=key) then
      seed:=(hashtext(mid::text||slot::text||':'||i)::bigint & 2147483647);
      select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed%20)::integer limit 1;
      age_value:=case (seed%4)::integer
        when 0 then (5+((seed/4)%8))::smallint
        when 1 then (13+((seed/32)%5))::smallint
        when 2 then (18+((seed/160)%42))::smallint
        else (60+((seed/6720)%31))::smallint
      end;
      variant_value:=(1+((seed/208320)%3))::smallint;
      insert into public.hiu_y_quan_cases(
        member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,patient_variant,
        appointment_offered,appointment_status,appointment_for_at,care_status
      ) values(
        mid,key,slot,i,picked_code,age_value,case when ((seed/624960)%2)=0 then 'female' else 'male' end,variant_value,
        offer,case when offer then 'pending' else 'none' end,appt_at,'waiting_diagnosis'
      );
    else
      update public.hiu_y_quan_cases c
      set appointment_offered=offer,
          appointment_for_at=case when offer then coalesce(c.appointment_for_at,appt_at) else null end,
          appointment_status=case when offer and c.appointment_status='none' then 'pending' when not offer and c.appointment_status='pending' then 'none' else c.appointment_status end
      where c.member_id=mid and c.case_key=key and c.archived_at is null;
    end if;
  end loop;

  return query
  select c.case_key,c.patient_age,c.patient_gender,c.patient_variant,s.vong,s.van_am,s.van_hoi,s.thiet,
    (select jsonb_agg(jsonb_build_object('code',z.code,'label',z.label) order by z.rank_no) from (
      select s2.code,s2.label,0::bigint as rank_no from private.hiu_y_quan_syndrome_catalog s2 where s2.code=c.syndrome_code
      union all
      select d.code,d.label,1+(hashtext(c.case_key||d.code)::bigint & 2147483647) as rank_no
      from private.hiu_y_quan_syndrome_catalog d where d.code<>c.syndrome_code
      order by rank_no limit 4
    ) z) as options,
    (a.id is not null),coalesce(a.correct,false),coalesce(a.credits_awarded,0)::smallint,
    c.appointment_offered,c.appointment_status,c.appointment_for_at,c.appointment_decided_at,
    c.care_status,c.treatment_started_at,c.recheck_due_at,c.rechecked_at,c.discharged_at,c.recheck_count
  from public.hiu_y_quan_cases c
  join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code
  left join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id
  where c.member_id=mid
    and c.archived_at is null
    and (c.hour_slot=slot or c.care_status in ('awaiting_transfer','observing','recheck_due'))
  order by case c.care_status when 'recheck_due' then 0 when 'awaiting_transfer' then 1 when 'waiting_diagnosis' then 2 else 3 end,
           c.hour_slot,c.ordinal;
end $$;

create or replace function public.hiu_y_quan_submit_v1(p_case_key text,p_selected_code text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  c public.hiu_y_quan_cases%rowtype;
  old public.hiu_y_quan_attempts%rowtype;
  is_correct boolean;
  award smallint:=0;
  expected_label text;
  explain text;
  bal integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select * into c from public.hiu_y_quan_cases where member_id=mid and case_key=btrim(coalesce(p_case_key,'')) for update;
  if c.id is null then raise exception 'Ca bệnh không tồn tại.'; end if;
  if c.archived_at is not null then raise exception 'Ca bệnh đã được lưu vào sổ bệnh.'; end if;
  if c.hour_slot < date_trunc('hour',now())-interval '1 hour' and c.care_status='waiting_diagnosis' then raise exception 'Ca bệnh này đã hết thời gian xử lý.'; end if;
  select * into old from public.hiu_y_quan_attempts where member_id=mid and case_id=c.id;
  select label,explanation into expected_label,explain from private.hiu_y_quan_syndrome_catalog where code=c.syndrome_code;
  if old.id is not null then
    if c.care_status='waiting_diagnosis' then update public.hiu_y_quan_cases set care_status='awaiting_transfer' where id=c.id; end if;
    select balance into bal from public.herb_garden_wallets where member_id=mid;
    return jsonb_build_object('already_answered',true,'correct',old.correct,'credits_awarded',old.credits_awarded,'expected_label',expected_label,'explanation',explain,'wallet_balance',coalesce(bal,0),'care_status','awaiting_transfer');
  end if;
  is_correct:=upper(btrim(coalesce(p_selected_code,'')))=c.syndrome_code;
  perform private.ensure_herb_garden_wallet(mid);
  if is_correct then
    update public.herb_garden_wallets set balance=balance+1,updated_at=now() where member_id=mid returning balance into bal;
    award:=1;
  else
    select balance into bal from public.herb_garden_wallets where member_id=mid;
  end if;
  insert into public.hiu_y_quan_attempts(member_id,case_id,selected_code,correct,credits_awarded)
  values(mid,c.id,upper(btrim(coalesce(p_selected_code,''))),is_correct,award);
  update public.hiu_y_quan_cases set care_status='awaiting_transfer' where id=c.id;
  return jsonb_build_object('already_answered',false,'correct',is_correct,'credits_awarded',award,'expected_label',expected_label,'explanation',explain,'wallet_balance',coalesce(bal,0),'care_status','awaiting_transfer');
end $$;

create or replace function public.hiu_y_quan_start_treatment_v14(p_case_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  c public.hiu_y_quan_cases%rowtype;
  due_at timestamptz;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select * into c from public.hiu_y_quan_cases where member_id=mid and case_key=btrim(coalesce(p_case_key,'')) for update;
  if c.id is null then raise exception 'Ca bệnh không tồn tại.'; end if;
  if c.archived_at is not null then return jsonb_build_object('ok',true,'already_archived',true,'care_status','discharged'); end if;
  if not exists(select 1 from public.hiu_y_quan_attempts a where a.member_id=mid and a.case_id=c.id) then raise exception 'Cần hoàn tất chẩn thể trước khi đưa bệnh nhân vào Dưỡng Trị.'; end if;
  if c.care_status in ('observing','recheck_due') then
    return jsonb_build_object('ok',true,'already_started',true,'care_status',c.care_status,'treatment_started_at',c.treatment_started_at,'recheck_due_at',c.recheck_due_at);
  end if;
  due_at:=now()+interval '10 minutes';
  update public.hiu_y_quan_cases
  set care_status='observing',treatment_started_at=coalesce(treatment_started_at,now()),recheck_due_at=due_at
  where id=c.id;
  perform private.audit_event('hiu_y_quan.treatment_start','hiu_y_quan_case',c.id::text,'info',jsonb_build_object('recheck_due_at',due_at,'game_timer_minutes',10));
  return jsonb_build_object('ok',true,'care_status','observing','treatment_started_at',coalesce(c.treatment_started_at,now()),'recheck_due_at',due_at);
end $$;

create or replace function public.hiu_y_quan_recheck_v14(p_case_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  c public.hiu_y_quan_cases%rowtype;
  a public.hiu_y_quan_attempts%rowtype;
  stable boolean;
  next_due timestamptz;
  next_count smallint;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select * into c from public.hiu_y_quan_cases where member_id=mid and case_key=btrim(coalesce(p_case_key,'')) for update;
  if c.id is null then raise exception 'Ca bệnh không tồn tại.'; end if;
  if c.archived_at is not null then return jsonb_build_object('ok',true,'already_archived',true,'outcome','stable_discharge','care_status','discharged'); end if;
  select * into a from public.hiu_y_quan_attempts where member_id=mid and case_id=c.id;
  if a.id is null then raise exception 'Chưa có kết quả chẩn thể để tái khám.'; end if;
  if c.treatment_started_at is null or c.recheck_due_at is null then raise exception 'Bệnh nhân chưa được đưa vào Dưỡng Trị.'; end if;
  if now()<c.recheck_due_at then
    return jsonb_build_object('ok',false,'ready',false,'care_status','observing','recheck_due_at',c.recheck_due_at,'seconds_remaining',greatest(0,ceil(extract(epoch from (c.recheck_due_at-now()))))::integer);
  end if;

  next_count:=(coalesce(c.recheck_count,0)+1)::smallint;
  -- Pedagogical state machine: a correct first syndrome identification closes at first
  -- reassessment; an incorrect one forces one extra five-minute learning observation.
  -- This is deliberately not presented as a real-world treatment/discharge algorithm.
  stable:=a.correct or c.recheck_count>=1;
  if stable then
    update public.hiu_y_quan_cases
    set care_status='discharged',rechecked_at=now(),discharged_at=now(),archived_at=now(),recheck_count=next_count
    where id=c.id;
    perform private.audit_event('hiu_y_quan.discharge','hiu_y_quan_case',c.id::text,'info',jsonb_build_object('recheck_count',next_count,'game_outcome','stable_discharge'));
    return jsonb_build_object(
      'ok',true,'ready',true,'outcome','stable_discharge','care_status','discharged','recheck_count',next_count,
      'summary','Tái khám mô phỏng: tỉnh táo, giao tiếp tốt, triệu chứng chính không tăng và không xuất hiện dấu hiệu cảnh báo trong tình huống. Ca được kết thúc và lưu vào sổ bệnh.'
    );
  end if;

  next_due:=now()+interval '5 minutes';
  update public.hiu_y_quan_cases
  set care_status='observing',rechecked_at=now(),recheck_due_at=next_due,recheck_count=next_count
  where id=c.id;
  perform private.audit_event('hiu_y_quan.recheck_continue','hiu_y_quan_case',c.id::text,'info',jsonb_build_object('recheck_count',next_count,'next_due_at',next_due,'game_timer_minutes',5));
  return jsonb_build_object(
    'ok',true,'ready',true,'outcome','observe_more','care_status','observing','recheck_count',next_count,'recheck_due_at',next_due,
    'summary','Tái khám mô phỏng chưa đạt điều kiện kết thúc ca học tập. Tiếp tục theo dõi 5 phút và đối chiếu lại chẩn thể trước lần đánh giá kế tiếp.'
  );
end $$;

create or replace function public.hiu_y_quan_records_v14(p_query text default '',p_limit integer default 50)
returns table(
  case_key text,
  patient_age smallint,
  patient_gender text,
  patient_variant smallint,
  syndrome_label text,
  selected_label text,
  correct boolean,
  credits_awarded smallint,
  vong text,
  van_am text,
  van_hoi text,
  thiet text,
  answered_at timestamptz,
  treatment_started_at timestamptz,
  rechecked_at timestamptz,
  discharged_at timestamptz,
  recheck_count smallint,
  outcome text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  term text:=lower(btrim(coalesce(p_query,'')));
  lim integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  return query
  select c.case_key,c.patient_age,c.patient_gender,c.patient_variant,s.label,coalesce(sel.label,a.selected_code),a.correct,a.credits_awarded,
         s.vong,s.van_am,s.van_hoi,s.thiet,a.answered_at,c.treatment_started_at,c.rechecked_at,c.discharged_at,c.recheck_count,
         'Ổn định sau tái khám mô phỏng · đã kết thúc ca'::text
  from public.hiu_y_quan_cases c
  join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id
  join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code
  left join private.hiu_y_quan_syndrome_catalog sel on sel.code=a.selected_code
  where c.member_id=mid and c.archived_at is not null
    and (term='' or lower(c.case_key) like '%'||term||'%' or lower(s.label) like '%'||term||'%' or lower(coalesce(sel.label,a.selected_code)) like '%'||term||'%' or c.patient_age::text=term)
  order by c.archived_at desc
  limit lim;
end $$;

revoke all on function public.hiu_y_quan_herbs_v14() from public,anon;
revoke all on function public.hiu_y_quan_hourly_cases_v3() from public,anon;
revoke all on function public.hiu_y_quan_start_treatment_v14(text) from public,anon;
revoke all on function public.hiu_y_quan_recheck_v14(text) from public,anon;
revoke all on function public.hiu_y_quan_records_v14(text,integer) from public,anon;
grant execute on function public.hiu_y_quan_herbs_v14() to authenticated;
grant execute on function public.hiu_y_quan_hourly_cases_v3() to authenticated;
grant execute on function public.hiu_y_quan_start_treatment_v14(text) to authenticated;
grant execute on function public.hiu_y_quan_recheck_v14(text) to authenticated;
grant execute on function public.hiu_y_quan_records_v14(text,integer) to authenticated;
