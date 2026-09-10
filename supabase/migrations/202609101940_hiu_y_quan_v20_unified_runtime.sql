-- HIU Y QUAN V20 — canonical gameplay contracts.
-- Goals:
-- 1) Ward capacity only blocks transfer into Dưỡng Trị, never intake/diagnosis.
-- 2) Keep the proven V17 three-bed allocator as the single source of bed assignment.
-- 3) Add a small, simulation-only core syndrome set with explicit internal provenance.

insert into private.hiu_y_quan_syndrome_catalog
  (code,label,vong,van_am,van_hoi,thiet,explanation,source_code,source_ref)
values
('PHE_AM_HU','Phế âm hư','Sắc hơi kém tươi; môi họng khô; lưỡi đỏ hoặc hơi đỏ, ít rêu.','Tiếng ho khan hoặc tiếng nói hơi khàn, âm lượng không mạnh.','Ho khan kéo dài, họng khô, có thể nóng âm ỉ về chiều, dễ mệt.','Mạch tế, có thể hơi sác.','Mô phỏng Phế âm bất túc, tân dịch kém nuôi dưỡng Phế; học viên nhận diện bằng tổng hợp Tứ chẩn.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only'),
('PHE_NHIET','Phế nhiệt','Mặt có thể hơi đỏ; lưỡi đỏ, rêu vàng.','Ho tiếng tương đối mạnh; hơi thở có thể gấp hơn bình thường trong tình huống mô phỏng.','Ho, cảm giác nóng, khát nước; đờm có thể vàng hoặc đặc hơn.','Mạch sác hoặc hoạt sác.','Mô phỏng nhiệt uất ở Phế làm tuyên giáng kém; dùng để luyện phân biệt với Phong nhiệt phạm Phế.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only'),
('TY_HU_THAP','Tỳ hư thấp thịnh','Sắc mặt nhợt hoặc vàng nhạt; lưỡi nhạt, bệu, rêu trắng nhớt.','Giọng nói nhỏ; bụng có thể sôi nhẹ.','Ăn kém, bụng đầy sau ăn, nặng người, dễ mệt, đại tiện lỏng hoặc không thành khuôn.','Mạch nhu hoặc hư hoãn.','Mô phỏng Tỳ khí suy kèm thấp trệ; trọng tâm là liên hệ vận hóa kém với biểu hiện thấp.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only'),
('TAM_KHI_HU','Tâm khí hư','Sắc mặt nhợt, thần sắc hơi mệt; lưỡi nhạt.','Tiếng nói nhỏ, hơi thở ngắn khi gắng sức trong tình huống mô phỏng.','Hồi hộp, dễ mệt, đoản hơi, tự ra mồ hôi, triệu chứng tăng khi hoạt động.','Mạch hư hoặc nhược.','Mô phỏng Tâm khí bất túc, vận hành huyết mạch và khí lực suy; học bằng đối chiếu Tứ chẩn.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only'),
('TAM_DUONG_HU','Tâm dương hư','Sắc mặt trắng nhợt; môi nhạt; lưỡi nhạt, có thể hơi bệu.','Giọng yếu, hơi thở ngắn.','Hồi hộp, mệt, sợ lạnh, tay chân lạnh, có thể tức ngực nhẹ trong tình huống mô phỏng.','Mạch trầm tế nhược hoặc trì nhược.','Mô phỏng Tâm dương suy, ôn vận và thúc đẩy huyết mạch kém; phân biệt với Tâm khí hư bằng dấu hàn rõ hơn.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only'),
('THAN_KHI_HU','Thận khí hư','Sắc mặt kém tươi; lưỡi nhạt.','Tiếng nói không mạnh, hơi thở có thể ngắn khi mệt.','Mỏi lưng gối, tiểu nhiều hoặc tiểu đêm, dễ mệt; khả năng cố nhiếp biểu hiện kém trong tình huống mô phỏng.','Mạch trầm nhược.','Mô phỏng Thận khí bất túc làm khí hóa và cố nhiếp suy; không dùng cho quyết định điều trị thực tế.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only'),
('THAN_TINH_KHUY_HU','Thận tinh khuy hư','Thần sắc kém sung mãn; lưỡi nhạt hoặc hơi đỏ tùy thiên lệch.','Tiếng nói nhỏ, phản ứng chậm hơn khi mệt.','Mỏi lưng gối, trí nhớ giảm, ù tai hoặc chóng mặt tái diễn; biểu hiện phát triển/lão hóa được mô phỏng theo độ tuổi.','Mạch trầm tế.','Mô phỏng Thận tinh bất túc; dùng để luyện liên hệ Thận với tủy, não, tai và quá trình sinh trưởng.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only'),
('CAN_DUONG_THUONG_CANG','Can dương thượng cang','Mặt có thể đỏ; mắt đỏ nhẹ; lưỡi đỏ, nhất là hai bên.','Giọng nói có thể nhanh hoặc căng khi khó chịu.','Đau đầu hoặc chóng mặt, dễ cáu, ù tai; cảm giác bốc nóng lên đầu trong tình huống mô phỏng.','Mạch huyền hữu lực, có thể sác.','Mô phỏng Can dương thăng vượt; học viên cần phân biệt với Can hỏa thượng viêm và các thể chóng mặt khác.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only'),
('DAM_HOA_NHIEU_TAM','Đàm hỏa nhiễu Tâm','Mặt có thể đỏ, mắt hơi sung; lưỡi đỏ, rêu vàng nhớt.','Lời nói nhanh, dễ kích thích hoặc khó tập trung trong tình huống mô phỏng.','Bồn chồn, ngủ kém, cảm giác ngực đầy, đầu nặng; có thể kèm đờm nhiều.','Mạch hoạt sác.','Mô phỏng đàm nhiệt/đàm hỏa quấy nhiễu Tâm thần; chỉ dùng cho luyện nhận diện thể bệnh.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only'),
('KHI_HUYET_LUONG_HU','Khí huyết lưỡng hư','Sắc mặt nhợt, môi nhạt; lưỡi nhạt.','Tiếng nói nhỏ, hơi thở yếu.','Mệt, hồi hộp, chóng mặt, ngủ không sâu, dễ hụt hơi khi hoạt động.','Mạch tế nhược hoặc hư.','Mô phỏng đồng thời khí hư và huyết hư; trọng tâm là nhận diện dấu suy giảm cả khí lực và nuôi dưỡng.','HIU-YQ-CORE-EDU','Core YHCT educational pattern set; simulation-only')
on conflict (code) do update set
  label=excluded.label,
  vong=excluded.vong,
  van_am=excluded.van_am,
  van_hoi=excluded.van_hoi,
  thiet=excluded.thiet,
  explanation=excluded.explanation,
  source_code=excluded.source_code,
  source_ref=excluded.source_ref;

create or replace function public.hiu_y_quan_hourly_cases_v4()
returns table(
  case_key text,patient_age smallint,patient_gender text,patient_variant smallint,
  vong text,van_am text,van_hoi text,thiet text,options jsonb,
  completed boolean,correct boolean,credits_awarded smallint,
  appointment_offered boolean,appointment_status text,appointment_for_at timestamptz,appointment_decided_at timestamptz,
  care_status text,treatment_started_at timestamptz,recheck_due_at timestamptz,rechecked_at timestamptz,discharged_at timestamptz,
  recheck_count smallint,bed_slot smallint
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
  syndrome_count integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles p where p.member_id=mid) then raise exception 'Hãy kích hoạt nhân vật HIU - Y - Quán trước.'; end if;

  update public.hiu_y_quan_cases c
  set care_status='recheck_due'
  where c.member_id=mid
    and c.archived_at is null
    and c.care_status='observing'
    and c.recheck_due_at<=now();

  -- V20 invariant: bed occupancy never pauses intake. We always materialize the
  -- current hour's normal 1-2 educational cases idempotently. Capacity is enforced
  -- later by the disposition allocator when a user attempts to transfer a patient.
  select count(*)::integer into syndrome_count from private.hiu_y_quan_syndrome_catalog;
  if syndrome_count<4 then raise exception 'Syndrome catalog is not ready'; end if;

  cnt:=1+(((hashtext(mid::text||slot::text)::bigint & 2147483647)%2)::integer);
  for i in 1..cnt loop
    key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-'||i;
    offer:=private.hiu_y_quan_appointment_offer_v2(mid,slot,i::smallint);
    appt_at:=case when offer then private.hiu_y_quan_appointment_time_v2(mid,slot,i::smallint) else null end;

    if not exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.case_key=key) then
      seed:=(hashtext(mid::text||slot::text||':'||i)::bigint & 2147483647);
      select s.code into picked_code
      from private.hiu_y_quan_syndrome_catalog s
      order by s.code
      offset (seed%syndrome_count)::integer
      limit 1;

      age_value:=case (seed%4)::integer
        when 0 then (5+((seed/4)%8))::smallint
        when 1 then (13+((seed/32)%5))::smallint
        when 2 then (18+((seed/160)%42))::smallint
        else (60+((seed/6720)%31))::smallint
      end;
      variant_value:=(1+((seed/208320)%3))::smallint;

      insert into public.hiu_y_quan_cases(
        member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,patient_variant,
        appointment_offered,appointment_status,appointment_for_at,care_status,bed_slot
      ) values(
        mid,key,slot,i,picked_code,age_value,
        case when ((seed/624960)%2)=0 then 'female' else 'male' end,
        variant_value,offer,case when offer then 'pending' else 'none' end,appt_at,'waiting_diagnosis',null
      );
    else
      update public.hiu_y_quan_cases c
      set appointment_offered=offer,
          appointment_for_at=case when offer then coalesce(c.appointment_for_at,appt_at) else null end,
          appointment_status=case
            when offer and c.appointment_status='none' then 'pending'
            when not offer and c.appointment_status='pending' then 'none'
            else c.appointment_status
          end
      where c.member_id=mid and c.case_key=key and c.archived_at is null;
    end if;
  end loop;

  return query
  select c.case_key,c.patient_age,c.patient_gender,c.patient_variant,
    s.vong,s.van_am,s.van_hoi,s.thiet,
    (select jsonb_agg(jsonb_build_object('code',z.code,'label',z.label) order by z.rank_no)
     from (
       select s2.code,s2.label,0::bigint rank_no
       from private.hiu_y_quan_syndrome_catalog s2
       where s2.code=c.syndrome_code
       union all
       select d.code,d.label,1+(hashtext(c.case_key||d.code)::bigint & 2147483647)
       from private.hiu_y_quan_syndrome_catalog d
       where d.code<>c.syndrome_code
       order by rank_no
       limit 4
     ) z) options,
    (a.id is not null),coalesce(a.correct,false),coalesce(a.credits_awarded,0)::smallint,
    c.appointment_offered,c.appointment_status,c.appointment_for_at,c.appointment_decided_at,
    c.care_status,c.treatment_started_at,c.recheck_due_at,c.rechecked_at,c.discharged_at,c.recheck_count,c.bed_slot
  from public.hiu_y_quan_cases c
  join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code
  left join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id
  where c.member_id=mid
    and c.archived_at is null
    and (c.hour_slot=slot or c.care_status in ('awaiting_transfer','observing','recheck_due'))
  order by
    case c.care_status
      when 'recheck_due' then 0
      when 'waiting_diagnosis' then 1
      when 'awaiting_transfer' then 2
      else 3
    end,
    coalesce(c.bed_slot,4),c.hour_slot,c.ordinal;
end $$;

revoke all on function public.hiu_y_quan_hourly_cases_v4() from public,anon;
grant execute on function public.hiu_y_quan_hourly_cases_v4() to authenticated;

create or replace function public.hiu_y_quan_hourly_cases_v20()
returns table(
  case_key text,patient_age smallint,patient_gender text,patient_variant smallint,
  vong text,van_am text,van_hoi text,thiet text,options jsonb,
  completed boolean,correct boolean,credits_awarded smallint,
  appointment_offered boolean,appointment_status text,appointment_for_at timestamptz,appointment_decided_at timestamptz,
  care_status text,treatment_started_at timestamptz,recheck_due_at timestamptz,rechecked_at timestamptz,discharged_at timestamptz,
  recheck_count smallint,bed_slot smallint
)
language sql
security definer
set search_path=''
as $$
  select * from public.hiu_y_quan_hourly_cases_v4();
$$;

revoke all on function public.hiu_y_quan_hourly_cases_v20() from public,anon;
grant execute on function public.hiu_y_quan_hourly_cases_v20() to authenticated;

create or replace function public.hiu_y_quan_disposition_v20(p_case_key text,p_action text)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select public.hiu_y_quan_disposition_v17(p_case_key,p_action);
$$;

revoke all on function public.hiu_y_quan_disposition_v20(text,text) from public,anon;
grant execute on function public.hiu_y_quan_disposition_v20(text,text) to authenticated;
