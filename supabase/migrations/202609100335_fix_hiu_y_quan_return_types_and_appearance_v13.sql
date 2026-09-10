-- HIU Y Quan V13: repair SETOF return-type mismatch and persist safe visual customization.
alter table public.hiu_y_quan_profiles add column if not exists outfit text not null default 'classic';
alter table public.hiu_y_quan_profiles drop constraint if exists hiu_y_quan_profiles_outfit_check;
alter table public.hiu_y_quan_profiles add constraint hiu_y_quan_profiles_outfit_check check (outfit in ('classic','academy','master'));

create or replace function public.hiu_y_quan_state_v1()
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); p public.hiu_y_quan_profiles%rowtype; bal integer:=0; total integer:=0; correct_count integer:=0;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.ensure_herb_garden_wallet(mid);
  select * into p from public.hiu_y_quan_profiles where member_id=mid;
  select balance into bal from public.herb_garden_wallets where member_id=mid;
  select count(*),count(*) filter(where a.correct) into total,correct_count from public.hiu_y_quan_attempts a where a.member_id=mid;
  return jsonb_build_object('active',p.member_id is not null,'display_name',p.display_name,'gender',p.gender,'outfit',coalesce(p.outfit,'classic'),'wallet_balance',coalesce(bal,0),'total_cases',total,'correct_cases',correct_count,'next_visit_at',date_trunc('hour',now())+interval '1 hour');
end $$;

create or replace function public.hiu_y_quan_customize_v1(p_gender text,p_outfit text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); clean_gender text:=lower(btrim(coalesce(p_gender,''))); clean_outfit text:=lower(btrim(coalesce(p_outfit,'')));
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if clean_gender not in ('male','female') then raise exception 'Giới tính nhân vật không hợp lệ.'; end if;
  if clean_outfit not in ('classic','academy','master') then raise exception 'Trang phục nhân vật không hợp lệ.'; end if;
  update public.hiu_y_quan_profiles set gender=clean_gender,outfit=clean_outfit,updated_at=now() where member_id=mid;
  if not found then raise exception 'Hãy kích hoạt nhân vật HIU - Y - Quán trước.'; end if;
  return jsonb_build_object('ok',true,'gender',clean_gender,'outfit',clean_outfit);
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
      insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender) values(mid,key,slot,i,picked_code,(6+((seed/20)%77))::smallint,case when ((seed/1540)%2)=0 then 'female' else 'male' end);
    end if;
  end loop;
  return query select c.case_key,c.patient_age,c.patient_gender,s.vong,s.van_am,s.van_hoi,s.thiet,
    (select jsonb_agg(jsonb_build_object('code',z.code,'label',z.label) order by z.rank_no) from (
      select s2.code,s2.label,0::bigint as rank_no from private.hiu_y_quan_syndrome_catalog s2 where s2.code=c.syndrome_code
      union all select d.code,d.label,1+(hashtext(c.case_key||d.code)::bigint & 2147483647) as rank_no from private.hiu_y_quan_syndrome_catalog d where d.code<>c.syndrome_code order by rank_no limit 4
    ) z) as options,
    (a.id is not null),coalesce(a.correct,false),coalesce(a.credits_awarded,0)::smallint
  from public.hiu_y_quan_cases c join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code left join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id where c.member_id=mid and c.hour_slot=slot order by c.ordinal;
end $$;

create or replace function public.hiu_y_quan_hourly_cases_v2()
returns table(case_key text,patient_age smallint,patient_gender text,vong text,van_am text,van_hoi text,thiet text,options jsonb,completed boolean,correct boolean,credits_awarded smallint,appointment_offered boolean,appointment_status text,appointment_for_at timestamptz,appointment_decided_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); slot timestamptz:=date_trunc('hour',now()); cnt integer; i integer; seed bigint; picked_code text; key text; offer boolean; appt_at timestamptz;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles p where p.member_id=mid) then raise exception 'Hãy kích hoạt nhân vật HIU - Y - Quán trước.'; end if;
  cnt:=1+(((hashtext(mid::text||slot::text)::bigint & 2147483647) % 2)::integer);
  for i in 1..cnt loop
    key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-'||i;
    offer:=private.hiu_y_quan_appointment_offer_v2(mid,slot,i::smallint); appt_at:=case when offer then private.hiu_y_quan_appointment_time_v2(mid,slot,i::smallint) else null end;
    if not exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.case_key=key) then
      seed:=(hashtext(mid::text||slot::text||':'||i)::bigint & 2147483647); select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed % 20)::integer limit 1;
      insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,appointment_offered,appointment_status,appointment_for_at) values(mid,key,slot,i,picked_code,(6+((seed/20)%77))::smallint,case when ((seed/1540)%2)=0 then 'female' else 'male' end,offer,case when offer then 'pending' else 'none' end,appt_at);
    else
      update public.hiu_y_quan_cases c set appointment_offered=offer,appointment_for_at=case when offer then coalesce(c.appointment_for_at,appt_at) else null end,appointment_status=case when offer and c.appointment_status='none' then 'pending' when not offer and c.appointment_status='pending' then 'none' else c.appointment_status end where c.member_id=mid and c.case_key=key;
    end if;
  end loop;
  return query select c.case_key,c.patient_age,c.patient_gender,s.vong,s.van_am,s.van_hoi,s.thiet,
    (select jsonb_agg(jsonb_build_object('code',z.code,'label',z.label) order by z.rank_no) from (
      select s2.code,s2.label,0::bigint as rank_no from private.hiu_y_quan_syndrome_catalog s2 where s2.code=c.syndrome_code
      union all select d.code,d.label,1+(hashtext(c.case_key||d.code)::bigint & 2147483647) as rank_no from private.hiu_y_quan_syndrome_catalog d where d.code<>c.syndrome_code order by rank_no limit 4
    ) z) as options,
    (a.id is not null),coalesce(a.correct,false),coalesce(a.credits_awarded,0)::smallint,c.appointment_offered,c.appointment_status,c.appointment_for_at,c.appointment_decided_at
  from public.hiu_y_quan_cases c join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code left join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id where c.member_id=mid and c.hour_slot=slot order by c.ordinal;
end $$;

revoke all on function public.hiu_y_quan_customize_v1(text,text) from public,anon;
grant execute on function public.hiu_y_quan_customize_v1(text,text) to authenticated;
