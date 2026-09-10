-- HIU Y Quan V17 — three-bed ward, intake gate while beds are occupied, doctor-controlled disposition.
-- All timers and disposition choices are game mechanics for educational simulation only.

alter table public.hiu_y_quan_cases add column if not exists bed_no smallint;
alter table public.hiu_y_quan_cases drop constraint if exists hiu_y_quan_cases_bed_no_check;
alter table public.hiu_y_quan_cases add constraint hiu_y_quan_cases_bed_no_check check (bed_no is null or bed_no between 1 and 3);

-- Backfill any currently observed cases into the three visible beds without altering diagnosis/history.
with ranked as (
  select id,row_number() over(partition by member_id order by coalesce(treatment_started_at,hour_slot),id)::smallint as rn
  from public.hiu_y_quan_cases
  where archived_at is null and care_status in ('observing','recheck_due') and bed_no is null
)
update public.hiu_y_quan_cases c set bed_no=r.rn
from ranked r where c.id=r.id and r.rn between 1 and 3;

create unique index if not exists hiu_y_quan_cases_member_active_bed_uq
  on public.hiu_y_quan_cases(member_id,bed_no)
  where archived_at is null and bed_no is not null and care_status in ('observing','recheck_due');
create index if not exists hiu_y_quan_cases_member_bed_idx
  on public.hiu_y_quan_cases(member_id,bed_no,recheck_due_at)
  where archived_at is null and bed_no is not null;

create or replace function public.hiu_y_quan_start_treatment_v14(p_case_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  c public.hiu_y_quan_cases%rowtype;
  free_bed smallint;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform pg_advisory_xact_lock(hashtext(mid::text||':hiu-y-quan-bed-v17'));
  select * into c from public.hiu_y_quan_cases
  where member_id=mid and case_key=p_case_key and archived_at is null for update;
  if not found then raise exception 'Không tìm thấy ca đang hoạt động.'; end if;
  if not exists(select 1 from public.hiu_y_quan_attempts a where a.member_id=mid and a.case_id=c.id) then
    raise exception 'Hãy hoàn tất chẩn thể trước khi chuyển Dưỡng Trị.';
  end if;
  if c.care_status in ('observing','recheck_due') and c.bed_no is not null then
    return jsonb_build_object('ok',true,'care_status',c.care_status,'bed_no',c.bed_no,'treatment_started_at',c.treatment_started_at,'recheck_due_at',c.recheck_due_at,'already_started',true);
  end if;
  if c.care_status<>'awaiting_transfer' then raise exception 'Ca này chưa ở trạng thái có thể chuyển giường.'; end if;
  select g::smallint into free_bed from generate_series(1,3) g
  where not exists(
    select 1 from public.hiu_y_quan_cases x
    where x.member_id=mid and x.archived_at is null and x.bed_no=g and x.care_status in ('observing','recheck_due')
  ) order by g limit 1;
  if free_bed is null then raise exception 'Ba giường Dưỡng Trị đang có bệnh nhân. Hãy xử lý ca trên giường trước.'; end if;
  update public.hiu_y_quan_cases
  set care_status='observing',bed_no=free_bed,treatment_started_at=coalesce(treatment_started_at,now()),recheck_due_at=now()+interval '10 minutes'
  where id=c.id returning * into c;
  return jsonb_build_object('ok',true,'care_status',c.care_status,'bed_no',c.bed_no,'treatment_started_at',c.treatment_started_at,'recheck_due_at',c.recheck_due_at,'already_started',false);
end $$;

create or replace function public.hiu_y_quan_beds_v17()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  payload jsonb;
  due_count integer;
  occupied_count integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  update public.hiu_y_quan_cases c set care_status='recheck_due'
  where c.member_id=mid and c.archived_at is null and c.care_status='observing' and c.recheck_due_at<=now();
  select count(*)::integer,count(*) filter(where c.care_status='recheck_due')::integer
  into occupied_count,due_count
  from public.hiu_y_quan_cases c
  where c.member_id=mid and c.archived_at is null and c.bed_no is not null and c.care_status in ('observing','recheck_due');
  select jsonb_agg(
    case when c.id is null then jsonb_build_object('bed_no',g,'occupied',false)
    else jsonb_build_object(
      'bed_no',g,'occupied',true,'case_key',c.case_key,'patient_age',c.patient_age,
      'patient_gender',c.patient_gender,'patient_variant',c.patient_variant,
      'care_status',c.care_status,'recheck_due_at',c.recheck_due_at,
      'recheck_count',c.recheck_count,'ready',(c.care_status='recheck_due' or (c.recheck_due_at is not null and c.recheck_due_at<=now()))
    ) end order by g
  ) into payload
  from generate_series(1,3) g
  left join public.hiu_y_quan_cases c
    on c.member_id=mid and c.archived_at is null and c.bed_no=g and c.care_status in ('observing','recheck_due');
  return jsonb_build_object(
    'beds',coalesce(payload,'[]'::jsonb),'occupied_count',coalesce(occupied_count,0),
    'due_count',coalesce(due_count,0),'intake_blocked',coalesce(occupied_count,0)>0,
    'intake_message',case when coalesce(occupied_count,0)>0 then 'Tạm dừng tiếp nhận ca mới: còn bệnh nhân trên giường Dưỡng Trị.' else 'Ba giường trống: có thể tiếp nhận ca mới.' end
  );
end $$;

create or replace function public.hiu_y_quan_disposition_v17(p_case_key text,p_action text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  c public.hiu_y_quan_cases%rowtype;
  action text:=lower(btrim(coalesce(p_action,'')));
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if action not in ('discharge','observe') then raise exception 'Lựa chọn không hợp lệ.'; end if;
  select * into c from public.hiu_y_quan_cases
  where member_id=mid and case_key=p_case_key and archived_at is null and bed_no is not null and care_status in ('observing','recheck_due')
  for update;
  if not found then raise exception 'Không tìm thấy bệnh nhân trên giường.'; end if;
  if action='discharge' then
    update public.hiu_y_quan_cases
    set care_status='discharged',discharged_at=now(),archived_at=now(),bed_no=null
    where id=c.id;
    return jsonb_build_object('ok',true,'action','discharge','case_key',c.case_key,'bed_no',c.bed_no,'summary','Bác sĩ đã cho bệnh nhân mô phỏng về. Ca được lưu vào Sổ bệnh án.');
  end if;
  update public.hiu_y_quan_cases
  set care_status='observing',rechecked_at=case when recheck_due_at<=now() then now() else rechecked_at end,
      recheck_count=least(3,(coalesce(recheck_count,0)+case when recheck_due_at<=now() then 1 else 0 end)::smallint),
      recheck_due_at=now()+interval '10 minutes'
  where id=c.id returning * into c;
  return jsonb_build_object('ok',true,'action','observe','case_key',c.case_key,'bed_no',c.bed_no,'care_status',c.care_status,'recheck_due_at',c.recheck_due_at,'recheck_count',c.recheck_count,'summary','Đã chuyển bệnh nhân sang nhịp chờ tái khám 10 phút của game.');
end $$;

-- Upgrade the current V16 case API in place. New cases are not generated or surfaced while any bed remains occupied.
create or replace function public.hiu_y_quan_hourly_cases_v3()
returns table(case_key text,patient_age smallint,patient_gender text,patient_variant smallint,vong text,van_am text,van_hoi text,thiet text,options jsonb,completed boolean,correct boolean,credits_awarded smallint,appointment_offered boolean,appointment_status text,appointment_for_at timestamptz,appointment_decided_at timestamptz,care_status text,treatment_started_at timestamptz,recheck_due_at timestamptz,rechecked_at timestamptz,discharged_at timestamptz,recheck_count smallint)
language plpgsql security definer set search_path='' as $$
declare
  mid uuid:=private.current_member_id(); slot timestamptz:=date_trunc('hour',now()); cnt integer; i integer; seed bigint; picked_code text; key text; offer boolean; appt_at timestamptz; age_value smallint; variant_value smallint; syndrome_count integer; bed_occupied boolean;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles p where p.member_id=mid) then raise exception 'Hãy kích hoạt nhân vật HIU - Y - Quán trước.'; end if;
  update public.hiu_y_quan_cases c set care_status='recheck_due' where c.member_id=mid and c.archived_at is null and c.care_status='observing' and c.recheck_due_at<=now();
  select exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.archived_at is null and c.bed_no is not null and c.care_status in ('observing','recheck_due')) into bed_occupied;
  select count(*)::integer into syndrome_count from private.hiu_y_quan_syndrome_catalog; if syndrome_count<4 then raise exception 'Syndrome catalog is not ready'; end if;
  if not bed_occupied then
    cnt:=1+(((hashtext(mid::text||slot::text)::bigint & 2147483647)%2)::integer);
    for i in 1..cnt loop
      key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-'||i;
      offer:=private.hiu_y_quan_appointment_offer_v2(mid,slot,i::smallint); appt_at:=case when offer then private.hiu_y_quan_appointment_time_v2(mid,slot,i::smallint) else null end;
      if not exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.case_key=key) then
        seed:=(hashtext(mid::text||slot::text||':'||i)::bigint & 2147483647);
        select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed%syndrome_count)::integer limit 1;
        age_value:=case (seed%4)::integer when 0 then (5+((seed/4)%8))::smallint when 1 then (13+((seed/32)%5))::smallint when 2 then (18+((seed/160)%42))::smallint else (60+((seed/6720)%31))::smallint end;
        variant_value:=(1+((seed/208320)%3))::smallint;
        insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,patient_variant,appointment_offered,appointment_status,appointment_for_at,care_status)
        values(mid,key,slot,i,picked_code,age_value,case when ((seed/624960)%2)=0 then 'female' else 'male' end,variant_value,offer,case when offer then 'pending' else 'none' end,appt_at,'waiting_diagnosis');
      end if;
    end loop;
  end if;
  return query
  select c.case_key,c.patient_age,c.patient_gender,c.patient_variant,s.vong,s.van_am,s.van_hoi,s.thiet,
    (select jsonb_agg(jsonb_build_object('code',z.code,'label',z.label) order by z.rank_no) from (
      select s2.code,s2.label,0::bigint rank_no from private.hiu_y_quan_syndrome_catalog s2 where s2.code=c.syndrome_code
      union all select d.code,d.label,1+(hashtext(c.case_key||d.code)::bigint & 2147483647) from private.hiu_y_quan_syndrome_catalog d where d.code<>c.syndrome_code order by rank_no limit 4
    ) z) options,
    (a.id is not null),coalesce(a.correct,false),coalesce(a.credits_awarded,0)::smallint,c.appointment_offered,c.appointment_status,c.appointment_for_at,c.appointment_decided_at,c.care_status,c.treatment_started_at,c.recheck_due_at,c.rechecked_at,c.discharged_at,c.recheck_count
  from public.hiu_y_quan_cases c join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code left join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id
  where c.member_id=mid and c.archived_at is null and (
    c.care_status in ('awaiting_transfer','observing','recheck_due') or (not bed_occupied and c.hour_slot=slot)
  )
  order by case c.care_status when 'recheck_due' then 0 when 'observing' then 1 when 'awaiting_transfer' then 2 when 'waiting_diagnosis' then 3 else 4 end,c.hour_slot,c.ordinal;
end $$;

create or replace function public.hiu_y_quan_busy_shift_v15()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  mid uuid:=private.current_member_id(); slot timestamptz:=date_trunc('hour',now()); seed bigint; picked_code text; key text; age_value smallint; variant_value smallint; inserted integer:=0; total_now integer:=0; p public.hiu_y_quan_engagement_profiles%rowtype; syndrome_count integer; bed_occupied boolean;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles hp where hp.member_id=mid) then raise exception 'Hãy kích hoạt HIU - Y - Quán trước.'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  select exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.archived_at is null and c.bed_no is not null and c.care_status in ('observing','recheck_due')) into bed_occupied;
  if bed_occupied then
    return jsonb_build_object('ok',true,'added',false,'reason','Tạm dừng tiếp nhận ca mới: còn bệnh nhân trên giường Dưỡng Trị.','active_cases',0,'intake_blocked',true);
  end if;
  if exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.ordinal=3) then
    select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
    select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
    return jsonb_build_object('ok',true,'added',false,'reason','Ca đông khách trong giờ này đã được kích hoạt','active_cases',total_now,'level',case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end);
  end if;
  select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
  if total_now>=3 then return jsonb_build_object('ok',true,'added',false,'reason','Đã đủ 3 ca mô phỏng trong giờ hiện tại','active_cases',total_now); end if;
  select count(*)::integer into syndrome_count from private.hiu_y_quan_syndrome_catalog; if syndrome_count<4 then raise exception 'Syndrome catalog is not ready'; end if;
  seed:=(hashtext(mid::text||slot::text||':busy-v15')::bigint & 2147483647);
  select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed%syndrome_count)::integer limit 1;
  age_value:=case (seed%4)::integer when 0 then (5+((seed/4)%8))::smallint when 1 then (13+((seed/32)%5))::smallint when 2 then (18+((seed/160)%42))::smallint else (60+((seed/6720)%31))::smallint end;
  variant_value:=(1+((seed/208320)%3))::smallint;
  key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-busy3';
  insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,patient_variant,appointment_offered,appointment_status,appointment_for_at,care_status)
  values(mid,key,slot,3,picked_code,age_value,case when ((seed/624960)%2)=0 then 'female' else 'male' end,variant_value,false,'none',null,'waiting_diagnosis') on conflict do nothing;
  get diagnostics inserted=row_count;
  select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
  select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
  return jsonb_build_object('ok',true,'added',inserted=1,'active_cases',total_now,'level',case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end,'message',case when inserted=1 then 'Đã mở Ca đông khách: thêm 1 bệnh nhân mô phỏng.' else 'Ca đông khách đã tồn tại; không tạo trùng.' end);
end $$;

revoke all on function public.hiu_y_quan_beds_v17() from public,anon;
revoke all on function public.hiu_y_quan_disposition_v17(text,text) from public,anon;
revoke all on function public.hiu_y_quan_start_treatment_v14(text) from public,anon;
revoke all on function public.hiu_y_quan_hourly_cases_v3() from public,anon;
revoke all on function public.hiu_y_quan_busy_shift_v15() from public,anon;
grant execute on function public.hiu_y_quan_beds_v17() to authenticated;
grant execute on function public.hiu_y_quan_disposition_v17(text,text) to authenticated;
grant execute on function public.hiu_y_quan_start_treatment_v14(text) to authenticated;
grant execute on function public.hiu_y_quan_hourly_cases_v3() to authenticated;
grant execute on function public.hiu_y_quan_busy_shift_v15() to authenticated;
