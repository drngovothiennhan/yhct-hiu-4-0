create or replace function private.herb_garden_maintenance_v2()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  member_row record;
  plant_row record;
  v_slot integer;
  v_day integer;
  v_event uuid;
  n_water integer:=0;
  n_fertilizer integer:=0;
  n_processed integer:=0;
begin
  for member_row in
    select distinct p.member_id
    from public.herb_garden_plants p
    where p.status in ('growing','mature') and p.harvested_at is null and p.died_at is null
  loop
    n_processed:=n_processed+1;
    perform private.herb_garden_sync_member_v2(member_row.member_id);
    for plant_row in
      select p.id,p.member_id,p.planted_at,p.matures_at,p.status,p.last_water_slot,p.last_fertilizer_day
      from public.herb_garden_plants p
      where p.member_id=member_row.member_id and p.status='growing' and p.harvested_at is null and p.died_at is null and now()<p.matures_at
      order by p.planted_at desc limit 1
    loop
      v_slot:=floor(extract(epoch from (now()-plant_row.planted_at))/21600)::integer;
      if v_slot between 0 and 11 and plant_row.last_water_slot<v_slot then
        v_event:=null;
        insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no)
          values(plant_row.id,plant_row.member_id,'reminder_water',v_slot) on conflict do nothing returning id into v_event;
        if v_event is not null then
          insert into public.notifications(member_id,kind,title,body)
            values(plant_row.member_id,'herb_garden_water_due','Đến giờ tưới cây','Gia Viên Dược Thảo đang ở chu kỳ tưới '||(v_slot+1)||'/12. Hãy tưới trong chu kỳ 6 giờ này.');
          n_water:=n_water+1;
        end if;
      end if;
      v_day:=floor(extract(epoch from (now()-plant_row.planted_at))/86400)::integer;
      if v_day between 0 and 2 and plant_row.last_fertilizer_day<v_day then
        v_event:=null;
        insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no)
          values(plant_row.id,plant_row.member_id,'reminder_fertilizer',v_day) on conflict do nothing returning id into v_event;
        if v_event is not null then
          insert into public.notifications(member_id,kind,title,body)
            values(plant_row.member_id,'herb_garden_fertilizer_due','Nhắc bón phân hôm nay','Cây cần 1 lần bón phân trong ngày sinh trưởng '||(v_day+1)||'/3.');
          n_fertilizer:=n_fertilizer+1;
        end if;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('processed_members',n_processed,'water_reminders',n_water,'fertilizer_reminders',n_fertilizer,'ran_at',now());
end $$;
revoke all on function private.herb_garden_maintenance_v2() from public,anon,authenticated;

-- Snapshot v4 adds the immutable catalog and care/death event history.
create or replace function private.augment_snapshot_modules_v4(p_snapshot_id uuid)
returns void
language plpgsql
security definer
set search_path='public','private','extensions','pg_catalog'
as $$
declare p jsonb; counts jsonb;
begin
  perform private.augment_snapshot_modules_v3(p_snapshot_id);
  select payload,row_counts into p,counts from private.app_snapshots where id=p_snapshot_id for update;
  if p is null then raise exception 'Snapshot not found'; end if;
  p:=p||jsonb_build_object(
    'schema_version',4,
    'herb_garden_species',coalesce((select jsonb_agg(to_jsonb(x)) from private.herb_garden_species x),'[]'::jsonb),
    'herb_garden_events',coalesce((select jsonb_agg(to_jsonb(x)) from public.herb_garden_events x),'[]'::jsonb)
  );
  counts:=counts||jsonb_build_object(
    'herb_garden_species',(select count(*) from private.herb_garden_species),
    'herb_garden_events',(select count(*) from public.herb_garden_events)
  );
  update private.app_snapshots set payload=p,row_counts=counts,checksum_sha256=encode(extensions.digest(p::text,'sha256'),'hex') where id=p_snapshot_id;
end $$;
revoke all on function private.augment_snapshot_modules_v4(uuid) from public,anon,authenticated;

create or replace function private.create_managed_snapshot(p_created_by uuid default null)
returns uuid
language plpgsql
security definer
set search_path='private','pg_catalog'
as $$
declare rid uuid;
begin
  rid:=private.create_operational_snapshot(case when p_created_by is null then 'daily_full_v2' else 'manual_full_v2' end,p_created_by);
  perform private.augment_snapshot_modules_v4(rid);
  return rid;
end $$;

create or replace function private.daily_managed_snapshot()
returns void
language plpgsql
security definer
set search_path='private','pg_catalog'
as $$
declare rid uuid;
begin
  rid:=private.create_operational_snapshot('daily_full_v2',null);
  perform private.augment_snapshot_modules_v4(rid);
  delete from private.app_snapshots where scope='daily_full_v2' and created_at<now()-interval '30 days';
end $$;

create or replace function private.monthly_managed_snapshot()
returns void
language plpgsql
security definer
set search_path='private','pg_catalog'
as $$
declare rid uuid;
begin
  rid:=private.create_operational_snapshot('monthly_full_v2',null);
  perform private.augment_snapshot_modules_v4(rid);
  delete from private.app_snapshots where scope='monthly_full_v2' and created_at<now()-interval '12 months';
end $$;

revoke all on function private.create_managed_snapshot(uuid) from public,anon,authenticated;
revoke all on function private.daily_managed_snapshot() from public,anon,authenticated;
revoke all on function private.monthly_managed_snapshot() from public,anon,authenticated;

do $$ begin
  begin perform cron.unschedule('yhct-herb-garden-maintenance-v2'); exception when others then null; end;
end $$;
select cron.schedule('yhct-herb-garden-maintenance-v2','7 * * * *','select private.herb_garden_maintenance_v2();');

comment on function public.herb_garden_state_v2() is 'Server-authoritative Herb Garden state. Species identity and medicinal information remain hidden until 72h; harvest requires 12 watering slots and 3 daily fertilizer slots.';
comment on function private.herb_garden_maintenance_v2() is 'Hourly care reminder/death finalizer. Emits at most one reminder per 6h watering slot and one per growth day using herb_garden_events uniqueness.';
