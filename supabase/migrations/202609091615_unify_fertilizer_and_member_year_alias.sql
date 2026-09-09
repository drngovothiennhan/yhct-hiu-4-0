-- Unify Gia Vien fertilizing with the same single-rule care model as watering,
-- and replace herb-based random member aliases with deterministic cohort aliases from MSSV.

create or replace function private.cohort_alias_from_student_code_v1(p_student_code text)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare
  digits text:=regexp_replace(coalesce(p_student_code,''),'\D','','g');
  cohort text;
  suffix text;
begin
  cohort:=case left(digits,2)
    when '21' then 'Y6'
    when '22' then 'Y5'
    when '23' then 'Y4'
    when '24' then 'Y3'
    when '25' then 'Y2'
    when '26' then 'Y1'
    else null
  end;
  if cohort is null then return null; end if;
  suffix:=right(digits,least(4,length(digits)));
  return cohort||case when suffix<>'' then ' · #'||suffix else '' end;
end $$;

create or replace function private.herbal_alias_for_name(p_name text,p_member_id uuid default null)
returns text
language plpgsql
stable
set search_path=''
as $$
declare
  student_code_value text;
  alias_value text;
begin
  if p_member_id is not null then
    select m.student_code into student_code_value from public.club_members m where m.id=p_member_id;
    alias_value:=private.cohort_alias_from_student_code_v1(student_code_value);
    if alias_value is not null then return alias_value; end if;
  end if;
  return 'YHCT';
end $$;

create or replace function private.sync_member_cohort_alias_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare alias_value text;
begin
  alias_value:=private.cohort_alias_from_student_code_v1(new.student_code);
  if alias_value is not null then new.herbal_alias:=alias_value; end if;
  return new;
end $$;

drop trigger if exists club_members_sync_cohort_alias_v1 on public.club_members;
create trigger club_members_sync_cohort_alias_v1
before insert or update of student_code on public.club_members
for each row execute function private.sync_member_cohort_alias_v1();

update public.club_members m
set herbal_alias=private.cohort_alias_from_student_code_v1(m.student_code)
where private.cohort_alias_from_student_code_v1(m.student_code) is not null
  and m.herbal_alias is distinct from private.cohort_alias_from_student_code_v1(m.student_code);

create or replace function public.herb_garden_fertilize_v3(p_slot_no smallint)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  pid uuid;
  planted timestamptz;
  mature timestamptz;
  last_day integer;
  day_idx integer;
  missed_between integer:=0;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v3(mid);
  select id,planted_at,matures_at,last_fertilizer_day
    into pid,planted,mature,last_day
  from public.herb_garden_plants
  where member_id=mid and slot_no=p_slot_no and status='growing' and harvested_at is null and died_at is null
  order by planted_at desc limit 1 for update;
  if pid is null then raise exception 'Ô này không có cây đang phát triển.'; end if;
  if now()>=mature then raise exception 'Đã hết giai đoạn bón phân.'; end if;
  day_idx:=floor(extract(epoch from(now()-planted))/86400)::integer;
  if day_idx<0 or day_idx>2 then raise exception 'Ngoài ngày bón phân hợp lệ.'; end if;
  if coalesce(last_day,-1)>=day_idx then raise exception 'Ngày sinh trưởng này đã được bón phân.'; end if;

  missed_between:=greatest(0,day_idx-coalesce(last_day,-1)-1);
  if missed_between>0 then
    update public.herb_garden_plants set care_streak=0 where id=pid;
  end if;

  update public.herb_garden_plants
  set last_fertilized_at=now(),last_fertilizer_day=day_idx,fertilizer_count=least(3,fertilizer_count+1),last_cared_at=now(),care_count=care_count+1
  where id=pid;

  insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata)
  values(pid,mid,'fertilize',day_idx,jsonb_build_object('plot',p_slot_no,'fertilizer_rule','one-per-growth-day','valid',true,'missed_days_before',missed_between,'streak_reset',missed_between>0))
  on conflict do nothing;

  perform private.herb_garden_reward_care_v1(mid,pid,true);
  return true;
end $$;

revoke all on function public.herb_garden_fertilize_v3(smallint) from public,anon;
grant execute on function public.herb_garden_fertilize_v3(smallint) to authenticated;
