-- HIU Y Quan V17 — three persistent observation beds, explicit doctor disposition,
-- paused new arrivals while a patient remains in Dưong Tri, and recheck-safe lifecycle.
-- All timers and disposition labels are game mechanics for educational simulation only.

alter table public.hiu_y_quan_cases add column if not exists bed_slot smallint;

alter table public.hiu_y_quan_cases drop constraint if exists hiu_y_quan_cases_bed_slot_check;
alter table public.hiu_y_quan_cases add constraint hiu_y_quan_cases_bed_slot_check
  check (bed_slot is null or bed_slot between 1 and 3);

-- Reconcile any pre-V17 in-flight ward cases without deleting history. The oldest three keep
-- active beds; any overflow returns to the post-diagnosis disposition step instead of being hidden.
with ranked as (
  select c.id,
         row_number() over(partition by c.member_id order by coalesce(c.treatment_started_at,c.hour_slot),c.id) as rn
  from public.hiu_y_quan_cases c
  where c.archived_at is null and c.care_status in ('observing','recheck_due')
)
update public.hiu_y_quan_cases c
set bed_slot=case when r.rn<=3 then r.rn::smallint else null end,
    care_status=case when r.rn<=3 then c.care_status else 'awaiting_transfer' end,
    recheck_due_at=case when r.rn<=3 then c.recheck_due_at else null end
from ranked r
where c.id=r.id;

create unique index if not exists hiu_y_quan_active_bed_slot_uniq
  on public.hiu_y_quan_cases(member_id,bed_slot)
  where archived_at is null and bed_slot is not null and care_status in ('observing','recheck_due');

create index if not exists hiu_y_quan_cases_member_bed_idx
  on public.hiu_y_quan_cases(member_id,bed_slot,care_status)
  where archived_at is null;

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
  free_bed smallint;
  due_at timestamptz;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if action not in ('discharge','observe') then raise exception 'Lựa chọn xử lý ca không hợp lệ.'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(mid::text||':hiu-y-quan-beds-v17',0));
  select * into c
  from public.hiu_y_quan_cases
  where member_id=mid and case_key=btrim(coalesce(p_case_key,''))
  for update;

  if c.id is null then raise exception 'Ca bệnh không tồn tại.'; end if;
  if c.archived_at is not null then
    return jsonb_build_object('ok',true,'already_archived',true,'care_status','discharged','bed_slot',null);
  end if;
  if not exists(select 1 from public.hiu_y_quan_attempts a where a.member_id=mid and a.case_id=c.id) then
    raise exception 'Cần hoàn tất chẩn thể trước khi quyết định bước tiếp theo.';
  end if;

  if action='discharge' then
    update public.hiu_y_quan_cases
    set care_status='discharged',bed_slot=null,recheck_due_at=null,discharged_at=now(),archived_at=now()
    where id=c.id;
    perform private.audit_event(
      'hiu_y_quan.doctor_discharge','hiu_y_quan_case',c.id::text,'info',
      jsonb_build_object('game_outcome','doctor_discharge_after_diagnosis','had_bed',c.bed_slot is not null)
    );
    return jsonb_build_object(
      'ok',true,'care_status','discharged','outcome','doctor_discharge','bed_slot',null,
      'summary','Bác sĩ đã chọn cho bệnh nhân rời quán sau phần chẩn thể. Ca học tập được kết thúc và lưu vào Sổ bệnh án.'
    );
  end if;

  if c.care_status in ('observing','recheck_due') then
    return jsonb_build_object(
      'ok',true,'already_started',true,'care_status',c.care_status,'bed_slot',c.bed_slot,
      'treatment_started_at',c.treatment_started_at,'recheck_due_at',c.recheck_due_at
    );
  end if;
  if c.care_status<>'awaiting_transfer' then raise exception 'Ca bệnh chưa ở bước chọn xử lý sau chẩn thể.'; end if;

  select gs::smallint into free_bed
  from pg_catalog.generate_series(1,3) gs
  where not exists(
    select 1 from public.hiu_y_quan_cases w
    where w.member_id=mid and w.archived_at is null
      and w.care_status in ('observing','recheck_due') and w.bed_slot=gs
  )
  order by gs
  limit 1;

  if free_bed is null then
    raise exception 'Cả 3 giường Dưỡng Trị đang có bệnh nhân. Hãy tái khám hoặc kết thúc một ca trước.';
  end if;

  due_at:=now()+interval '10 minutes';
  update public.hiu_y_quan_cases
  set care_status='observing',bed_slot=free_bed,treatment_started_at=coalesce(treatment_started_at,now()),recheck_due_at=due_at
  where id=c.id;

  perform private.audit_event(
    'hiu_y_quan.bed_assign','hiu_y_quan_case',c.id::text,'info',
    jsonb_build_object('bed_slot',free_bed,'recheck_due_at',due_at,'game_timer_minutes',10)
  );
  return jsonb_build_object(
    'ok',true,'care_status','observing','bed_slot',free_bed,
    'treatment_started_at',coalesce(c.treatment_started_at,now()),'recheck_due_at',due_at
  );
end $$;

revoke all on function public.hiu_y_quan_disposition_v17(text,text) from public,anon;
grant execute on function public.hiu_y_quan_disposition_v17(text,text) to authenticated;

-- Backward-compatible V14 entry point now uses the same bed allocator.
create or replace function public.hiu_y_quan_start_treatment_v14(p_case_key text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  return public.hiu_y_quan_disposition_v17(p_case_key,'observe');
end $$;
revoke all on function public.hiu_y_quan_start_treatment_v14(text) from public,anon;
grant execute on function public.hiu_y_quan_start_treatment_v14(text) to authenticated;

-- V4 keeps V3 intact for rollback, adds bed_slot, and pauses generation of NEW hourly arrivals
-- whenever a patient is still in Dưong Tri or a diagnosed patient is awaiting disposition.
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
  cnt integer;i integer;seed bigint;picked_code text;key text;offer boolean;appt_at timestamptz;
  age_value smallint;variant_value smallint;syndrome_count integer;intake_paused boolean;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles p where p.member_id=mid) then raise exception 'Hãy kích hoạt nhân vật HIU - Y - Quán trước.'; end if;

  update public.hiu_y_quan_cases c
  set care_status='recheck_due'
  where c.member_id=mid and c.archived_at is null and c.care_status='observing' and c.recheck_due_at<=now();

  select exists(
    select 1 from public.hiu_y_quan_cases c
    where c.member_id=mid and c.archived_at is null and c.care_status in ('awaiting_transfer','observing','recheck_due')
  ) into intake_paused;

  if not intake_paused then
    select count(*)::integer into syndrome_count from private.hiu_y_quan_syndrome_catalog;
    if syndrome_count<4 then raise exception 'Syndrome catalog is not ready'; end if;
    cnt:=1+(((hashtext(mid::text||slot::text)::bigint & 2147483647)%2)::integer);
    for i in 1..cnt loop
      key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-'||i;
      offer:=private.hiu_y_quan_appointment_offer_v2(mid,slot,i::smallint);
      appt_at:=case when offer then private.hiu_y_quan_appointment_time_v2(mid,slot,i::smallint) else null end;
      if not exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.case_key=key) then
        seed:=(hashtext(mid::text||slot::text||':'||i)::bigint & 2147483647);
        select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed%syndrome_count)::integer limit 1;
        age_value:=case (seed%4)::integer when 0 then (5+((seed/4)%8))::smallint when 1 then (13+((seed/32)%5))::smallint when 2 then (18+((seed/160)%42))::smallint else (60+((seed/6720)%31))::smallint end;
        variant_value:=(1+((seed/208320)%3))::smallint;
        insert into public.hiu_y_quan_cases(
          member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,patient_variant,
          appointment_offered,appointment_status,appointment_for_at,care_status,bed_slot
        ) values(
          mid,key,slot,i,picked_code,age_value,case when ((seed/624960)%2)=0 then 'female' else 'male' end,variant_value,
          offer,case when offer then 'pending' else 'none' end,appt_at,'waiting_diagnosis',null
        );
      else
        update public.hiu_y_quan_cases c
        set appointment_offered=offer,
            appointment_for_at=case when offer then coalesce(c.appointment_for_at,appt_at) else null end,
            appointment_status=case when offer and c.appointment_status='none' then 'pending' when not offer and c.appointment_status='pending' then 'none' else c.appointment_status end
        where c.member_id=mid and c.case_key=key and c.archived_at is null;
      end if;
    end loop;
  end if;

  return query
  select c.case_key,c.patient_age,c.patient_gender,c.patient_variant,s.vong,s.van_am,s.van_hoi,s.thiet,
    (select jsonb_agg(jsonb_build_object('code',z.code,'label',z.label) order by z.rank_no) from (
      select s2.code,s2.label,0::bigint rank_no from private.hiu_y_quan_syndrome_catalog s2 where s2.code=c.syndrome_code
      union all
      select d.code,d.label,1+(hashtext(c.case_key||d.code)::bigint & 2147483647)
      from private.hiu_y_quan_syndrome_catalog d where d.code<>c.syndrome_code
      order by rank_no limit 4
    ) z) options,
    (a.id is not null),coalesce(a.correct,false),coalesce(a.credits_awarded,0)::smallint,
    c.appointment_offered,c.appointment_status,c.appointment_for_at,c.appointment_decided_at,
    c.care_status,c.treatment_started_at,c.recheck_due_at,c.rechecked_at,c.discharged_at,c.recheck_count,c.bed_slot
  from public.hiu_y_quan_cases c
  join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code
  left join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id
  where c.member_id=mid and c.archived_at is null
    and (c.hour_slot=slot or c.care_status in ('awaiting_transfer','observing','recheck_due'))
  order by case c.care_status when 'recheck_due' then 0 when 'awaiting_transfer' then 1 when 'waiting_diagnosis' then 2 else 3 end,
           coalesce(c.bed_slot,4),c.hour_slot,c.ordinal;
end $$;
revoke all on function public.hiu_y_quan_hourly_cases_v4() from public,anon;
grant execute on function public.hiu_y_quan_hourly_cases_v4() to authenticated;

-- Recheck keeps the same V14 game semantics, but a finished case always releases its bed.
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
  stable boolean;next_due timestamptz;next_count smallint;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select * into c from public.hiu_y_quan_cases where member_id=mid and case_key=btrim(coalesce(p_case_key,'')) for update;
  if c.id is null then raise exception 'Ca bệnh không tồn tại.'; end if;
  if c.archived_at is not null then return jsonb_build_object('ok',true,'already_archived',true,'outcome','stable_discharge','care_status','discharged','bed_slot',null); end if;
  select * into a from public.hiu_y_quan_attempts where member_id=mid and case_id=c.id;
  if a.id is null then raise exception 'Chưa có kết quả chẩn thể để tái khám.'; end if;
  if c.treatment_started_at is null or c.recheck_due_at is null or c.bed_slot is null then raise exception 'Bệnh nhân chưa được bố trí giường Dưỡng Trị.'; end if;
  if now()<c.recheck_due_at then
    return jsonb_build_object('ok',false,'ready',false,'care_status','observing','bed_slot',c.bed_slot,'recheck_due_at',c.recheck_due_at,'seconds_remaining',greatest(0,ceil(extract(epoch from (c.recheck_due_at-now()))))::integer);
  end if;

  next_count:=(coalesce(c.recheck_count,0)+1)::smallint;
  stable:=a.correct or c.recheck_count>=1;
  if stable then
    update public.hiu_y_quan_cases
    set care_status='discharged',bed_slot=null,rechecked_at=now(),discharged_at=now(),archived_at=now(),recheck_count=next_count
    where id=c.id;
    perform private.audit_event('hiu_y_quan.discharge','hiu_y_quan_case',c.id::text,'info',jsonb_build_object('recheck_count',next_count,'game_outcome','stable_discharge','released_bed',c.bed_slot));
    return jsonb_build_object(
      'ok',true,'ready',true,'outcome','stable_discharge','care_status','discharged','bed_slot',null,'recheck_count',next_count,
      'summary','Tái khám mô phỏng đã hoàn tất. Ca học tập được kết thúc, giường được giải phóng và hồ sơ được lưu vào Sổ bệnh án.'
    );
  end if;

  next_due:=now()+interval '5 minutes';
  update public.hiu_y_quan_cases
  set care_status='observing',rechecked_at=now(),recheck_due_at=next_due,recheck_count=next_count
  where id=c.id;
  perform private.audit_event('hiu_y_quan.recheck_continue','hiu_y_quan_case',c.id::text,'info',jsonb_build_object('recheck_count',next_count,'bed_slot',c.bed_slot,'next_due_at',next_due,'game_timer_minutes',5));
  return jsonb_build_object(
    'ok',true,'ready',true,'outcome','observe_more','care_status','observing','bed_slot',c.bed_slot,'recheck_count',next_count,'recheck_due_at',next_due,
    'summary','Tái khám mô phỏng chưa kết thúc vòng học tập. Bệnh nhân tiếp tục ở cùng giường thêm 5 phút trước lần đánh giá kế tiếp.'
  );
end $$;
revoke all on function public.hiu_y_quan_recheck_v14(text) from public,anon;
grant execute on function public.hiu_y_quan_recheck_v14(text) to authenticated;

-- Records distinguish direct doctor discharge from cases that entered Dưong Tri.
create or replace function public.hiu_y_quan_records_v14(p_query text default '',p_limit integer default 50)
returns table(
  case_key text,patient_age smallint,patient_gender text,patient_variant smallint,syndrome_label text,selected_label text,
  correct boolean,credits_awarded smallint,vong text,van_am text,van_hoi text,thiet text,answered_at timestamptz,
  treatment_started_at timestamptz,rechecked_at timestamptz,discharged_at timestamptz,recheck_count smallint,outcome text
)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id();term text:=lower(btrim(coalesce(p_query,'')));lim integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  return query
  select c.case_key,c.patient_age,c.patient_gender,c.patient_variant,s.label,coalesce(sel.label,a.selected_code),a.correct,a.credits_awarded,
         s.vong,s.van_am,s.van_hoi,s.thiet,a.answered_at,c.treatment_started_at,c.rechecked_at,c.discharged_at,c.recheck_count,
         case when c.treatment_started_at is null
              then 'Bác sĩ chọn cho về sau chẩn thể · ca học tập đã kết thúc'::text
              else 'Ổn định sau tái khám mô phỏng · đã kết thúc ca'::text end
  from public.hiu_y_quan_cases c
  join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id
  join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code
  left join private.hiu_y_quan_syndrome_catalog sel on sel.code=a.selected_code
  where c.member_id=mid and c.archived_at is not null
    and (term='' or lower(c.case_key) like '%'||term||'%' or lower(s.label) like '%'||term||'%' or lower(coalesce(sel.label,a.selected_code)) like '%'||term||'%' or c.patient_age::text=term)
  order by c.archived_at desc
  limit lim;
end $$;
revoke all on function public.hiu_y_quan_records_v14(text,integer) from public,anon;
grant execute on function public.hiu_y_quan_records_v14(text,integer) to authenticated;

-- V15 busy shift must obey the V17 intake pause as well.
create or replace function public.hiu_y_quan_busy_shift_v15()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();slot timestamptz:=date_trunc('hour',now());seed bigint;picked_code text;key text;
  age_value smallint;variant_value smallint;inserted integer:=0;total_now integer:=0;
  p public.hiu_y_quan_engagement_profiles%rowtype;syndrome_count integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles hp where hp.member_id=mid) then raise exception 'Hãy kích hoạt HIU - Y - Quán trước.'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);

  if exists(
    select 1 from public.hiu_y_quan_cases c
    where c.member_id=mid and c.archived_at is null and c.care_status in ('awaiting_transfer','observing','recheck_due')
  ) then
    select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.archived_at is null;
    select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
    return jsonb_build_object(
      'ok',true,'added',false,'reason','Tạm dừng nhận ca: còn bệnh nhân tại Dưỡng Trị hoặc đang chờ bác sĩ quyết định cho về/chuyển giường.',
      'active_cases',total_now,'level',case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end
    );
  end if;

  if exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.ordinal=3) then
    select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
    select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
    return jsonb_build_object('ok',true,'added',false,'reason','Ca đông khách trong giờ này đã được kích hoạt','active_cases',total_now,'level',case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end);
  end if;
  select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
  if total_now>=3 then return jsonb_build_object('ok',true,'added',false,'reason','Đã đủ 3 ca mô phỏng trong giờ hiện tại','active_cases',total_now); end if;
  select count(*)::integer into syndrome_count from private.hiu_y_quan_syndrome_catalog;
  if syndrome_count<4 then raise exception 'Syndrome catalog is not ready'; end if;
  seed:=(hashtext(mid::text||slot::text||':busy-v15')::bigint & 2147483647);
  select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed%syndrome_count)::integer limit 1;
  age_value:=case (seed%4)::integer when 0 then (5+((seed/4)%8))::smallint when 1 then (13+((seed/32)%5))::smallint when 2 then (18+((seed/160)%42))::smallint else (60+((seed/6720)%31))::smallint end;
  variant_value:=(1+((seed/208320)%3))::smallint;
  key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-busy3';
  insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,patient_variant,appointment_offered,appointment_status,appointment_for_at,care_status,bed_slot)
  values(mid,key,slot,3,picked_code,age_value,case when ((seed/624960)%2)=0 then 'female' else 'male' end,variant_value,false,'none',null,'waiting_diagnosis',null)
  on conflict do nothing;
  get diagnostics inserted=row_count;
  select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
  select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
  return jsonb_build_object('ok',true,'added',inserted=1,'active_cases',total_now,'level',case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end,'message',case when inserted=1 then 'Đã mở Ca đông khách: thêm 1 bệnh nhân mô phỏng.' else 'Ca đông khách đã tồn tại; không tạo trùng.' end);
end $$;
revoke all on function public.hiu_y_quan_busy_shift_v15() from public,anon;
grant execute on function public.hiu_y_quan_busy_shift_v15() to authenticated;