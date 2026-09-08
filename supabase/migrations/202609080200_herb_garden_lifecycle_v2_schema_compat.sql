-- YHCT HIU 4.0 - Herb Garden lifecycle v2
-- Server-authoritative 72h growth, watering every 6h, fertilizing once/day,
-- 6h harvest grace, automatic death/archive, internal reminders, and RPC ambiguity fix.

alter table public.herb_garden_plants add column if not exists status text not null default 'growing';
alter table public.herb_garden_plants add column if not exists expires_at timestamptz;
alter table public.herb_garden_plants add column if not exists water_count integer not null default 0;
alter table public.herb_garden_plants add column if not exists fertilizer_count integer not null default 0;
alter table public.herb_garden_plants add column if not exists last_watered_at timestamptz;
alter table public.herb_garden_plants add column if not exists last_fertilized_at timestamptz;
alter table public.herb_garden_plants add column if not exists last_water_slot integer not null default -1;
alter table public.herb_garden_plants add column if not exists last_fertilizer_day integer not null default -1;
alter table public.herb_garden_plants add column if not exists died_at timestamptz;
alter table public.herb_garden_plants add column if not exists death_reason text;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='herb_garden_plants_status_chk') then
    alter table public.herb_garden_plants add constraint herb_garden_plants_status_chk
      check(status in ('growing','mature','harvested','dead'));
  end if;
  if not exists(select 1 from pg_constraint where conname='herb_garden_plants_water_count_chk') then
    alter table public.herb_garden_plants add constraint herb_garden_plants_water_count_chk check(water_count between 0 and 12);
  end if;
  if not exists(select 1 from pg_constraint where conname='herb_garden_plants_fertilizer_count_chk') then
    alter table public.herb_garden_plants add constraint herb_garden_plants_fertilizer_count_chk check(fertilizer_count between 0 and 3);
  end if;
end $$;

update public.herb_garden_plants p
set expires_at=coalesce(p.expires_at,p.matures_at+interval '6 hours'),
    status=case when p.harvested_at is not null then 'harvested' when p.status in ('dead','mature') then p.status else 'growing' end,
    water_count=least(12,greatest(p.water_count,p.care_count)),
    last_watered_at=coalesce(p.last_watered_at,p.last_cared_at),
    last_water_slot=case
      when coalesce(p.last_watered_at,p.last_cared_at) is null then p.last_water_slot
      else greatest(p.last_water_slot,least(11,floor(extract(epoch from (coalesce(p.last_watered_at,p.last_cared_at)-p.planted_at))/21600)::integer))
    end;

-- Dead plants no longer block a new seed; history stays queryable for audit/learning.
drop index if exists public.herb_garden_one_active_idx;
create unique index if not exists herb_garden_one_active_v2_idx
  on public.herb_garden_plants(member_id)
  where status in ('growing','mature') and harvested_at is null and died_at is null;
create index if not exists herb_garden_plants_seed_key_idx on public.herb_garden_plants(seed_key);
create index if not exists herb_garden_inventory_seed_key_idx on public.herb_garden_inventory(seed_key);

create table if not exists public.herb_garden_events (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.herb_garden_plants(id) on delete cascade,
  member_id uuid not null references public.club_members(id) on delete cascade,
  event_type text not null check(event_type in ('plant','water','fertilize','mature','harvest','dead','reminder_water','reminder_fertilizer')),
  slot_no integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.herb_garden_events enable row level security;
revoke all on public.herb_garden_events from public,anon,authenticated;
create index if not exists herb_garden_events_member_created_idx on public.herb_garden_events(member_id,created_at desc);
create unique index if not exists herb_garden_events_once_idx on public.herb_garden_events(plant_id,event_type,coalesce(slot_no,-1));

create or replace function private.herb_garden_sync_member_v2(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_status text;
  v_matures timestamptz;
  v_expires timestamptz;
  v_water integer;
  v_fertilizer integer;
  v_reason text;
  v_event uuid;
begin
  if p_member_id is null then return; end if;
  select p.id,p.status,p.matures_at,p.expires_at,p.water_count,p.fertilizer_count
    into v_id,v_status,v_matures,v_expires,v_water,v_fertilizer
  from public.herb_garden_plants p
  where p.member_id=p_member_id and p.status in ('growing','mature')
    and p.harvested_at is null and p.died_at is null
  order by p.planted_at desc
  limit 1
  for update;
  if v_id is null then return; end if;

  -- At exactly 72h the care phase closes. Missing any required slot means the plant dies.
  if now()>=v_matures and v_status='growing' and (v_water<12 or v_fertilizer<3) then
    v_reason:=format('Hết 72 giờ nhưng chưa đủ chăm sóc: tưới %s/12, bón phân %s/3.',v_water,v_fertilizer);
    update public.herb_garden_plants p set status='dead',died_at=now(),death_reason=v_reason where p.id=v_id;
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata)
      values(v_id,p_member_id,'dead',jsonb_build_object('reason',v_reason,'water_count',v_water,'fertilizer_count',v_fertilizer))
      on conflict do nothing returning id into v_event;
    if v_event is not null then
      insert into public.notifications(member_id,kind,title,body)
        values(p_member_id,'herb_garden_dead','Cây trong Gia Viên đã chết',v_reason||' Ô trồng đã được giải phóng; bạn có thể gieo hạt mới.');
      perform private.audit_event('herb_garden.dead','herb_garden_plant',v_id::text,'info',jsonb_build_object('reason',v_reason));
    end if;
    return;
  end if;

  if now()>=v_matures and v_water>=12 and v_fertilizer>=3 and v_status='growing' then
    update public.herb_garden_plants p set status='mature' where p.id=v_id;
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata)
      values(v_id,p_member_id,'mature',jsonb_build_object('water_count',v_water,'fertilizer_count',v_fertilizer))
      on conflict do nothing returning id into v_event;
    if v_event is not null then
      insert into public.notifications(member_id,kind,title,body)
        values(p_member_id,'herb_garden_mature','Cây thuốc đã trưởng thành','Bạn đã đủ 12 lần tưới và 3 lần bón phân. Hãy thu hoạch trong 6 giờ để đưa cây vào kho dược thảo.');
    end if;
    v_status:='mature';
  end if;

  -- A fully cared plant gets a short collection window; if ignored, it is automatically reported dead.
  if now()>=coalesce(v_expires,v_matures+interval '6 hours') and v_status='mature' then
    v_reason:='Quá 6 giờ sau khi trưởng thành mà chưa thu hoạch.';
    update public.herb_garden_plants p set status='dead',died_at=now(),death_reason=v_reason where p.id=v_id;
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata)
      values(v_id,p_member_id,'dead',jsonb_build_object('reason',v_reason,'water_count',v_water,'fertilizer_count',v_fertilizer))
      on conflict do nothing returning id into v_event;
    if v_event is not null then
      insert into public.notifications(member_id,kind,title,body)
        values(p_member_id,'herb_garden_dead','Cây trưởng thành đã quá hạn thu hoạch',v_reason||' Ô trồng đã được giải phóng; bạn có thể gieo hạt mới.');
      perform private.audit_event('herb_garden.dead','herb_garden_plant',v_id::text,'info',jsonb_build_object('reason',v_reason));
    end if;
  end if;
end $$;
revoke all on function private.herb_garden_sync_member_v2(uuid) from public,anon,authenticated;

-- Compatibility hotfix: qualify id/seed_key columns so OUT parameter names cannot shadow table columns.
create or replace function public.herb_garden_care_v1()
returns table(id uuid,planted_at timestamptz,matures_at timestamptz,last_cared_at timestamptz,care_count integer,ready boolean,name text,botanical_name text,category text,traditional_actions text,caution text)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); pid uuid; last_at timestamptz;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select p.id,p.last_cared_at into pid,last_at
  from public.herb_garden_plants p
  where p.member_id=mid and p.harvested_at is null and p.died_at is null and p.status in ('growing','mature')
  order by p.planted_at desc limit 1 for update;
  if pid is null then raise exception 'Bạn chưa gieo hạt.'; end if;
  if last_at is not null and last_at>now()-interval '6 hours' then raise exception 'Cây vừa được chăm sóc. Hãy quay lại sau.'; end if;
  update public.herb_garden_plants p set last_cared_at=now(),care_count=p.care_count+1 where p.id=pid;
  return query select s.* from public.herb_garden_state_v1() s;
end $$;
revoke all on function public.herb_garden_care_v1() from public,anon;
grant execute on function public.herb_garden_care_v1() to authenticated;

create or replace function public.herb_garden_harvest_v1()
returns table(name text,botanical_name text,category text,traditional_actions text,caution text,quantity integer)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); pid uuid; sk text; mature timestamptz;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select p.id,p.seed_key,p.matures_at into pid,sk,mature
  from public.herb_garden_plants p
  where p.member_id=mid and p.harvested_at is null and p.died_at is null and p.status in ('growing','mature')
  order by p.planted_at desc limit 1 for update;
  if pid is null then raise exception 'Bạn chưa có cây để thu hoạch.'; end if;
  if now()<mature then raise exception 'Cây chưa trưởng thành.'; end if;
  update public.herb_garden_plants p set harvested_at=now(),status='harvested' where p.id=pid;
  insert into public.herb_garden_inventory(member_id,seed_key,quantity,updated_at) values(mid,sk,1,now())
    on conflict(member_id,seed_key) do update set quantity=public.herb_garden_inventory.quantity+1,updated_at=now();
  perform private.audit_event('herb_garden.harvest','member',mid::text,'info',jsonb_build_object('seed_key',sk));
  return query select s.name,s.botanical_name,s.category,s.traditional_actions,s.caution,i.quantity
    from private.herb_garden_species s join public.herb_garden_inventory i on i.seed_key=s.seed_key and i.member_id=mid where s.seed_key=sk;
end $$;
revoke all on function public.herb_garden_harvest_v1() from public,anon;
grant execute on function public.herb_garden_harvest_v1() to authenticated;
