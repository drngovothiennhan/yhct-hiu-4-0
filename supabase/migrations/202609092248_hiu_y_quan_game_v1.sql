-- HIU - Y - QUÁN v1: educational TCM diagnosis game.
-- Direct table access is intentionally denied; approved members interact via RPC only.

create table if not exists public.hiu_y_quan_profiles (
  member_id uuid primary key references public.club_members(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  gender text not null check (gender in ('male','female')),
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hiu_y_quan_profiles enable row level security;
revoke all on table public.hiu_y_quan_profiles from anon, authenticated;

create table if not exists private.hiu_y_quan_syndrome_catalog (
  code text primary key,
  label text not null,
  vong text not null,
  van_am text not null,
  van_hoi text not null,
  thiet text not null,
  explanation text not null
);

insert into private.hiu_y_quan_syndrome_catalog(code,label,vong,van_am,van_hoi,thiet,explanation) values
('PHONG_HAN_PHAM_PHE','Phong hàn phạm Phế','Sắc mặt hơi nhợt, sợ lạnh, rêu lưỡi trắng mỏng.','Tiếng ho rõ, hơi thở không gấp nhiều.','Sợ lạnh, không ra mồ hôi, ho đờm loãng trắng, đau đầu nhẹ.','Mạch phù khẩn.','Ngoại cảm phong hàn làm Phế khí tuyên giáng bất lợi.'),
('PHONG_NHIET_PHAM_PHE','Phong nhiệt phạm Phế','Mặt hơi đỏ, họng đỏ, đầu lưỡi đỏ, rêu mỏng vàng.','Ho tiếng khá vang, có thể khàn nhẹ.','Sốt, hơi sợ gió, khát, ho đờm vàng hoặc đặc.','Mạch phù sác.','Phong nhiệt phạm Phế thường biểu hiện sốt, khát, họng đỏ và mạch phù sác.'),
('DAM_THAP_TRO_PHE','Đàm thấp trở Phế','Thể trạng nặng nề, lưỡi bệu, rêu trắng nhớt.','Ho nhiều đờm, tiếng thở nặng.','Ngực đầy, ăn kém, đờm nhiều trắng dính, người nặng nề.','Mạch hoạt hoặc nhu.','Đàm thấp ứ trở làm Phế khí không tuyên giáng.'),
('PHE_KHI_HU','Phế khí hư','Sắc mặt nhợt, dễ mệt, lưỡi nhạt.','Tiếng nói nhỏ, hơi thở ngắn.','Dễ cảm, tự ra mồ hôi, ho yếu, mệt khi gắng sức.','Mạch hư nhược.','Phế khí hư biểu hiện khí đoản, tiếng nói nhỏ, tự hãn và sức vệ kém.'),
('TY_KHI_HU','Tỳ khí hư','Mặt vàng nhạt, lưỡi nhạt bệu có dấu răng.','Tiếng nói yếu.','Ăn kém, bụng trướng sau ăn, đại tiện lỏng, mệt.','Mạch hư hoãn.','Tỳ khí hư làm vận hóa kém nên ăn kém, đầy bụng và phân lỏng.'),
('TY_DUONG_HU','Tỳ dương hư','Sắc mặt nhợt, tay chân lạnh, lưỡi nhạt ướt.','Tiếng nói nhỏ.','Đau bụng thích ấm thích xoa, tiêu lỏng, sợ lạnh.','Mạch trầm trì vô lực.','Tỳ dương hư là mức hư hàn rõ hơn của Tỳ, có lạnh và đau thích ấm.'),
('VI_NHIET','Vị nhiệt','Mặt đỏ nhẹ, lợi có thể đỏ, lưỡi đỏ rêu vàng.','Hơi thở có mùi.','Khát thích uống mát, nhanh đói, nóng rát thượng vị, táo bón.','Mạch hoạt sác.','Vị nhiệt thường có khát, nhanh đói, miệng hôi và lưỡi đỏ rêu vàng.'),
('VI_AM_HU','Vị âm hư','Môi hơi khô, lưỡi đỏ ít rêu.','Giọng nói bình thường nhưng miệng khô.','Khô miệng họng, đói nhưng ăn ít, cồn cào âm ỉ.','Mạch tế sác.','Vị âm hư gây tân dịch kém, khô miệng và lưỡi đỏ ít rêu.'),
('CAN_KHI_UAT','Can khí uất','Sắc mặt thường, nét mặt căng thẳng, lưỡi hơi đỏ hai bên.','Hay thở dài.','Ngực sườn đầy tức, dễ cáu, triệu chứng tăng khi căng thẳng.','Mạch huyền.','Can khí uất có đặc trưng trướng tức, hay thở dài và liên quan cảm xúc.'),
('CAN_HOA_THUONG_VIEM','Can hỏa thượng viêm','Mặt mắt đỏ, lưỡi đỏ rêu vàng.','Giọng nói to, dễ kích thích.','Đau đầu hai bên, chóng mặt, miệng đắng, dễ nóng giận.','Mạch huyền sác.','Can hỏa bốc lên thường có đỏ, đau đầu, miệng đắng và mạch huyền sác.'),
('CAN_HUYET_HU','Can huyết hư','Mặt nhợt, móng nhợt, lưỡi nhạt.','Giọng nói bình thường.','Hoa mắt, tê bì, co rút cơ nhẹ, ngủ kém.','Mạch tế nhược.','Can huyết hư không nuôi dưỡng cân mạch và mắt gây hoa mắt, tê và co rút.'),
('CAN_THAN_AM_HU','Can Thận âm hư','Gò má hơi đỏ, lưỡi đỏ ít rêu.','Có thể ù tai âm nhỏ.','Hoa mắt, ù tai, lưng gối mỏi, nóng lòng bàn tay chân, khô miệng về chiều.','Mạch tế sác.','Âm dịch Can Thận cùng hư gây hư nhiệt, ù tai và lưng gối mỏi.'),
('THAN_DUONG_HU','Thận dương hư','Sắc mặt trắng, chi lạnh, lưỡi nhạt bệu ướt.','Tiếng nói yếu.','Lưng gối lạnh đau, sợ lạnh, tiểu trong dài, mệt.','Mạch trầm trì nhược.','Thận dương hư biểu hiện hư hàn, lưng gối lạnh và tiểu trong.'),
('THAN_AM_HU','Thận âm hư','Gò má đỏ nhẹ, lưỡi đỏ ít rêu.','Có thể ù tai.','Lưng gối mỏi, nóng trong, đạo hãn, khô họng về đêm.','Mạch tế sác.','Thận âm hư gây hư nhiệt, đạo hãn và lưng gối mỏi.'),
('TAM_HUYET_HU','Tâm huyết hư','Mặt môi nhợt, lưỡi nhạt.','Giọng nói bình thường.','Hồi hộp, hay quên, ngủ khó, dễ giật mình.','Mạch tế nhược.','Tâm huyết không đủ nuôi Tâm thần gây hồi hộp, mất ngủ và hay quên.'),
('TAM_AM_HU','Tâm âm hư','Gò má hơi đỏ, lưỡi đỏ ít rêu.','Giọng có thể khô.','Hồi hộp, bứt rứt, mất ngủ, nóng về chiều, đạo hãn.','Mạch tế sác.','Tâm âm hư có biểu hiện Tâm thần bất an kèm hư nhiệt.'),
('TAM_TY_LUONG_HU','Tâm Tỳ lưỡng hư','Mặt nhợt vàng, lưỡi nhạt.','Tiếng nói nhỏ.','Hồi hộp, mất ngủ, hay quên, ăn kém, mệt, dễ bầm.','Mạch tế nhược.','Tỳ khí hư sinh huyết kém phối hợp Tâm huyết hư tạo nhóm triệu chứng Tâm và tiêu hóa.'),
('KHI_TRE_HUYET_U','Khí trệ huyết ứ','Sắc mặt hơi tối, lưỡi có điểm ứ.','Hay thở dài.','Đau căng tức xen đau cố định, triệu chứng tăng khi stress.','Mạch huyền sáp.','Khí trệ kéo dài làm huyết hành không thông, xuất hiện đau cố định và dấu ứ.'),
('HAN_NGUNG_HUYET_U','Hàn ngưng huyết ứ','Sắc mặt nhợt tối, môi hơi tím, lưỡi tím nhạt.','Giọng nói thấp.','Đau cố định dữ, gặp lạnh tăng, chườm ấm dễ chịu.','Mạch trầm khẩn hoặc sáp.','Hàn làm khí huyết ngưng trệ nên đau tăng khi lạnh và giảm khi ấm.'),
('THAP_NHIET_HA_TIEU','Thấp nhiệt hạ tiêu','Mặt hơi đỏ, lưỡi đỏ rêu vàng nhớt.','Giọng bình thường.','Tiểu vàng ít, nóng rát, nặng tức hạ vị, miệng dính khát ít.','Mạch hoạt sác.','Thấp nhiệt kết ở hạ tiêu gây tiểu vàng nóng rát và rêu vàng nhớt.')
on conflict(code) do update set label=excluded.label,vong=excluded.vong,van_am=excluded.van_am,van_hoi=excluded.van_hoi,thiet=excluded.thiet,explanation=excluded.explanation;

create table if not exists public.hiu_y_quan_cases (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  case_key text not null,
  hour_slot timestamptz not null,
  ordinal smallint not null check (ordinal between 1 and 2),
  syndrome_code text not null references private.hiu_y_quan_syndrome_catalog(code),
  patient_age smallint not null check (patient_age between 1 and 100),
  patient_gender text not null check (patient_gender in ('male','female')),
  created_at timestamptz not null default now(),
  unique(member_id,case_key),
  unique(member_id,hour_slot,ordinal)
);
alter table public.hiu_y_quan_cases enable row level security;
revoke all on table public.hiu_y_quan_cases from anon, authenticated;

create table if not exists public.hiu_y_quan_attempts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  case_id uuid not null references public.hiu_y_quan_cases(id) on delete cascade,
  selected_code text not null,
  correct boolean not null,
  credits_awarded smallint not null default 0 check (credits_awarded between 0 and 1),
  answered_at timestamptz not null default now(),
  unique(member_id,case_id)
);
alter table public.hiu_y_quan_attempts enable row level security;
revoke all on table public.hiu_y_quan_attempts from anon, authenticated;
create index if not exists hiu_y_quan_cases_member_hour_idx on public.hiu_y_quan_cases(member_id,hour_slot desc);
create index if not exists hiu_y_quan_attempts_member_answered_idx on public.hiu_y_quan_attempts(member_id,answered_at desc);

create or replace function public.hiu_y_quan_activate_v1(p_display_name text,p_gender text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); clean_name text:=btrim(coalesce(p_display_name,'')); clean_gender text:=lower(btrim(coalesce(p_gender,'')));
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if char_length(clean_name) not between 2 and 40 then raise exception 'Tên nhân vật phải từ 2 đến 40 ký tự.'; end if;
  if clean_gender not in ('male','female') then raise exception 'Giới tính nhân vật không hợp lệ.'; end if;
  insert into public.hiu_y_quan_profiles(member_id,display_name,gender,activated_at,updated_at) values(mid,clean_name,clean_gender,now(),now())
  on conflict(member_id) do update set display_name=excluded.display_name,gender=excluded.gender,updated_at=now();
  perform private.ensure_herb_garden_wallet(mid);
  return jsonb_build_object('active',true,'display_name',clean_name,'gender',clean_gender,'wallet_balance',(select balance from public.herb_garden_wallets where member_id=mid));
end $$;

create or replace function public.hiu_y_quan_state_v1()
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); p public.hiu_y_quan_profiles%rowtype; bal integer:=0; total integer:=0; correct_count integer:=0;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.ensure_herb_garden_wallet(mid);
  select * into p from public.hiu_y_quan_profiles where member_id=mid;
  select balance into bal from public.herb_garden_wallets where member_id=mid;
  select count(*),count(*) filter(where a.correct) into total,correct_count from public.hiu_y_quan_attempts a where a.member_id=mid;
  return jsonb_build_object('active',p.member_id is not null,'display_name',p.display_name,'gender',p.gender,'wallet_balance',coalesce(bal,0),'total_cases',total,'correct_cases',correct_count,'next_visit_at',date_trunc('hour',now())+interval '1 hour');
end $$;

create or replace function public.hiu_y_quan_hourly_cases_v1()
returns table(case_key text,patient_age smallint,patient_gender text,vong text,van_am text,van_hoi text,thiet text,options jsonb,completed boolean,correct boolean,credits_awarded smallint)
language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); slot timestamptz:=date_trunc('hour',now()); cnt integer; i integer; seed bigint; picked_code text; key text;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles p where p.member_id=mid) then raise exception 'Hãy kích hoạt nhân vật HIU - Y - Quán trước.'; end if;
  cnt:=1+(((hashtext(mid::text||slot::text)::bigint & 2147483647) % 2)::integer);
  for i in 1..cnt loop
    key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-'||i;
    if not exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.case_key=key) then
      seed:=(hashtext(mid::text||slot::text||':'||i)::bigint & 2147483647);
      select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed % 20)::integer limit 1;
      insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender)
      values(mid,key,slot,i,picked_code,(6+((seed/20)%77))::smallint,case when ((seed/1540)%2)=0 then 'female' else 'male' end);
    end if;
  end loop;
  return query
  select c.case_key,c.patient_age,c.patient_gender,s.vong,s.van_am,s.van_hoi,s.thiet,
    (select jsonb_agg(jsonb_build_object('code',z.code,'label',z.label) order by z.rank_no) from (
      select s2.code,s2.label,0::bigint as rank_no from private.hiu_y_quan_syndrome_catalog s2 where s2.code=c.syndrome_code
      union all
      select d.code,d.label,1+(hashtext(c.case_key||d.code)::bigint & 2147483647) as rank_no from private.hiu_y_quan_syndrome_catalog d where d.code<>c.syndrome_code
      order by rank_no limit 4
    ) z) as options,
    (a.id is not null),coalesce(a.correct,false),coalesce(a.credits_awarded,0)
  from public.hiu_y_quan_cases c
  join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code
  left join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id
  where c.member_id=mid and c.hour_slot=slot
  order by c.ordinal;
end $$;

create or replace function public.hiu_y_quan_submit_v1(p_case_key text,p_selected_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); c public.hiu_y_quan_cases%rowtype; old public.hiu_y_quan_attempts%rowtype; is_correct boolean; award smallint:=0; expected_label text; explain text; bal integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select * into c from public.hiu_y_quan_cases where member_id=mid and case_key=btrim(coalesce(p_case_key,'')) for update;
  if c.id is null then raise exception 'Ca bệnh không tồn tại.'; end if;
  if c.hour_slot < date_trunc('hour',now())-interval '1 hour' then raise exception 'Ca bệnh này đã hết thời gian xử lý.'; end if;
  select * into old from public.hiu_y_quan_attempts where member_id=mid and case_id=c.id;
  select label,explanation into expected_label,explain from private.hiu_y_quan_syndrome_catalog where code=c.syndrome_code;
  if old.id is not null then
    select balance into bal from public.herb_garden_wallets where member_id=mid;
    return jsonb_build_object('already_answered',true,'correct',old.correct,'credits_awarded',old.credits_awarded,'expected_label',expected_label,'explanation',explain,'wallet_balance',coalesce(bal,0));
  end if;
  is_correct:=upper(btrim(coalesce(p_selected_code,'')))=c.syndrome_code;
  perform private.ensure_herb_garden_wallet(mid);
  if is_correct then update public.herb_garden_wallets set balance=balance+1,updated_at=now() where member_id=mid returning balance into bal; award:=1;
  else select balance into bal from public.herb_garden_wallets where member_id=mid; end if;
  insert into public.hiu_y_quan_attempts(member_id,case_id,selected_code,correct,credits_awarded) values(mid,c.id,upper(btrim(coalesce(p_selected_code,''))),is_correct,award);
  return jsonb_build_object('already_answered',false,'correct',is_correct,'credits_awarded',award,'expected_label',expected_label,'explanation',explain,'wallet_balance',coalesce(bal,0));
end $$;

revoke all on function public.hiu_y_quan_activate_v1(text,text) from public,anon;
revoke all on function public.hiu_y_quan_state_v1() from public,anon;
revoke all on function public.hiu_y_quan_hourly_cases_v1() from public,anon;
revoke all on function public.hiu_y_quan_submit_v1(text,text) from public,anon;
grant execute on function public.hiu_y_quan_activate_v1(text,text) to authenticated;
grant execute on function public.hiu_y_quan_state_v1() to authenticated;
grant execute on function public.hiu_y_quan_hourly_cases_v1() to authenticated;
grant execute on function public.hiu_y_quan_submit_v1(text,text) to authenticated;
