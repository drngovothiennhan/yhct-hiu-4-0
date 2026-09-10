-- HIU Y Quán v2: deterministic random appointment offers + replay-safe member decision.
-- Appointment status is educational game state only; it is not a real clinical booking.

alter table public.hiu_y_quan_cases
  add column if not exists appointment_offered boolean not null default false,
  add column if not exists appointment_status text not null default 'none',
  add column if not exists appointment_decided_at timestamptz;

alter table public.hiu_y_quan_cases drop constraint if exists hiu_y_quan_cases_appointment_status_check;
alter table public.hiu_y_quan_cases add constraint hiu_y_quan_cases_appointment_status_check
  check (appointment_status in ('none','pending','accepted','declined'));

create or replace function private.hiu_y_quan_appointment_offer_v2(p_member uuid,p_slot timestamptz,p_ordinal smallint)
returns boolean language sql immutable set search_path='' as $$
  select ((hashtext(p_member::text||'|'||p_slot::text||'|'||p_ordinal::text||'|appointment')::bigint & 2147483647) % 100) < 45
$$;

create or replace function public.hiu_y_quan_hourly_cases_v2()
returns table(
  case_key text,patient_age smallint,patient_gender text,vong text,van_am text,van_hoi text,thiet text,
  options jsonb,completed boolean,correct boolean,credits_awarded smallint,
  appointment_offered boolean,appointment_status text,appointment_decided_at timestamptz
)
language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); slot timestamptz:=date_trunc('hour',now()); cnt integer; i integer; seed bigint; picked_code text; key text; offer boolean;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles p where p.member_id=mid) then raise exception 'Hãy kích hoạt nhân vật HIU - Y - Quán trước.'; end if;
  cnt:=1+(((hashtext(mid::text||slot::text)::bigint & 2147483647) % 2)::integer);
  for i in 1..cnt loop
    key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-'||i;
    offer:=private.hiu_y_quan_appointment_offer_v2(mid,slot,i::smallint);
    if not exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.case_key=key) then
      seed:=(hashtext(mid::text||slot::text||':'||i)::bigint & 2147483647);
      select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed % 20)::integer limit 1;
      insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,appointment_offered,appointment_status)
      values(mid,key,slot,i,picked_code,(6+((seed/20)%77))::smallint,case when ((seed/1540)%2)=0 then 'female' else 'male' end,offer,case when offer then 'pending' else 'none' end);
    else
      update public.hiu_y_quan_cases c
      set appointment_offered=offer,
          appointment_status=case when offer and c.appointment_status='none' then 'pending' when not offer and c.appointment_status='pending' then 'none' else c.appointment_status end
      where c.member_id=mid and c.case_key=key;
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
    (a.id is not null),coalesce(a.correct,false),coalesce(a.credits_awarded,0),
    c.appointment_offered,c.appointment_status,c.appointment_decided_at
  from public.hiu_y_quan_cases c
  join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code
  left join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id
  where c.member_id=mid and c.hour_slot=slot
  order by c.ordinal;
end $$;

create or replace function public.hiu_y_quan_appointment_decide_v2(p_case_key text,p_accept boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); c public.hiu_y_quan_cases%rowtype; next_status text;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select * into c from public.hiu_y_quan_cases where member_id=mid and case_key=btrim(coalesce(p_case_key,'')) for update;
  if c.id is null then raise exception 'Ca bệnh không tồn tại.'; end if;
  if not c.appointment_offered then return jsonb_build_object('ok',false,'reason','not_offered','status',c.appointment_status); end if;
  if c.appointment_status in ('accepted','declined') then return jsonb_build_object('ok',true,'already_decided',true,'status',c.appointment_status,'decided_at',c.appointment_decided_at); end if;
  next_status:=case when coalesce(p_accept,false) then 'accepted' else 'declined' end;
  update public.hiu_y_quan_cases set appointment_status=next_status,appointment_decided_at=now() where id=c.id;
  perform private.audit_event('hiu_y_quan.appointment_decide','hiu_y_quan_case',c.id::text,'info',jsonb_build_object('status',next_status));
  return jsonb_build_object('ok',true,'already_decided',false,'status',next_status,'decided_at',now());
end $$;

revoke all on function public.hiu_y_quan_hourly_cases_v2() from public,anon;
revoke all on function public.hiu_y_quan_appointment_decide_v2(text,boolean) from public,anon;
grant execute on function public.hiu_y_quan_hourly_cases_v2() to authenticated;
grant execute on function public.hiu_y_quan_appointment_decide_v2(text,boolean) to authenticated;
