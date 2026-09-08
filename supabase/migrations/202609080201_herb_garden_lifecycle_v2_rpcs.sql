create or replace function public.herb_garden_state_v2()
returns table(
  id uuid,planted_at timestamptz,matures_at timestamptz,expires_at timestamptz,status text,
  water_count integer,fertilizer_count integer,required_water_count integer,required_fertilizer_count integer,
  last_watered_at timestamptz,last_fertilized_at timestamptz,next_water_at timestamptz,next_fertilizer_at timestamptz,
  can_water boolean,can_fertilize boolean,ready_for_harvest boolean,missed_water_slots integer,missed_fertilizer_days integer,
  died_at timestamptz,death_reason text,name text,other_names text,botanical_name text,family text,used_part text,
  traditional_actions text,dosage text,caution text,source_ref text,source_page integer,visual_variant smallint
)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id();
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v2(mid);
  return query
  with latest as (
    select p.*
    from public.herb_garden_plants p
    where p.member_id=mid
    order by case when p.status in ('growing','mature') and p.harvested_at is null and p.died_at is null then 0 else 1 end,p.planted_at desc
    limit 1
  ), calc as (
    select p.*,
      greatest(0,least(11,floor(extract(epoch from (now()-p.planted_at))/21600)::integer)) as current_water_slot,
      greatest(0,least(2,floor(extract(epoch from (now()-p.planted_at))/86400)::integer)) as current_fertilizer_day
    from latest p
  )
  select p.id,p.planted_at,p.matures_at,p.expires_at,p.status,
    p.water_count,p.fertilizer_count,12,3,
    p.last_watered_at,p.last_fertilized_at,
    case when p.status='growing' and now()<p.matures_at then
      case when p.last_water_slot<p.current_water_slot then now() else p.planted_at+(p.current_water_slot+1)*interval '6 hours' end
    end,
    case when p.status='growing' and now()<p.matures_at then
      case when p.last_fertilizer_day<p.current_fertilizer_day then now() else p.planted_at+(p.current_fertilizer_day+1)*interval '1 day' end
    end,
    p.status='growing' and now()<p.matures_at and p.last_water_slot<p.current_water_slot,
    p.status='growing' and now()<p.matures_at and p.last_fertilizer_day<p.current_fertilizer_day,
    p.status='mature' and now()<p.expires_at and p.water_count>=12 and p.fertilizer_count>=3,
    greatest(0,(p.current_water_slot+1)-p.water_count),
    greatest(0,(p.current_fertilizer_day+1)-p.fertilizer_count),
    p.died_at,p.death_reason,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.name end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.other_names end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.botanical_name end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.family end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.used_part end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.traditional_actions end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.dosage end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.caution end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.source_ref end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.source_page end,
    case when now()>=p.matures_at or p.status in ('dead','harvested') then s.visual_variant end
  from calc p join private.herb_garden_species s on s.seed_key=p.seed_key;
end $$;
revoke all on function public.herb_garden_state_v2() from public,anon;
grant execute on function public.herb_garden_state_v2() to authenticated;

create or replace function public.herb_garden_plant_v2()
returns table(
  id uuid,planted_at timestamptz,matures_at timestamptz,expires_at timestamptz,status text,
  water_count integer,fertilizer_count integer,required_water_count integer,required_fertilizer_count integer,
  last_watered_at timestamptz,last_fertilized_at timestamptz,next_water_at timestamptz,next_fertilizer_at timestamptz,
  can_water boolean,can_fertilize boolean,ready_for_harvest boolean,missed_water_slots integer,missed_fertilizer_days integer,
  died_at timestamptz,death_reason text,name text,other_names text,botanical_name text,family text,used_part text,
  traditional_actions text,dosage text,caution text,source_ref text,source_page integer,visual_variant smallint
)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); sk text; pid uuid;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v2(mid);
  if exists(select 1 from public.herb_garden_plants p where p.member_id=mid and p.status in ('growing','mature') and p.harvested_at is null and p.died_at is null) then
    raise exception 'Bạn đang có một cây trong vườn. Hãy hoàn tất lượt hiện tại trước khi gieo hạt mới.';
  end if;
  select s.seed_key into sk from private.herb_garden_species s where s.seedable and s.source_code='QD4664-2014' order by random() limit 1;
  if sk is null then raise exception 'Danh mục hạt giống QĐ 4664 chưa sẵn sàng.'; end if;
  insert into public.herb_garden_plants(member_id,seed_key,matures_at,expires_at,status)
    values(mid,sk,now()+interval '3 days',now()+interval '3 days 6 hours','growing') returning id into pid;
  insert into public.herb_garden_events(plant_id,member_id,event_type) values(pid,mid,'plant') on conflict do nothing;
  insert into public.notifications(member_id,kind,title,body)
    values(mid,'herb_garden_planted','Đã gieo một hạt giống bí ẩn','Hãy tưới lần đầu trong chu kỳ hiện tại và bón phân 1 lần trong ngày. Tên cây sẽ mở sau đủ 72 giờ.');
  perform private.audit_event('herb_garden.plant_v2','herb_garden_plant',pid::text,'info',jsonb_build_object('source','QD4664-2014'));
  return query select * from public.herb_garden_state_v2();
end $$;
revoke all on function public.herb_garden_plant_v2() from public,anon;
grant execute on function public.herb_garden_plant_v2() to authenticated;

create or replace function public.herb_garden_water_v2()
returns table(
  id uuid,planted_at timestamptz,matures_at timestamptz,expires_at timestamptz,status text,
  water_count integer,fertilizer_count integer,required_water_count integer,required_fertilizer_count integer,
  last_watered_at timestamptz,last_fertilized_at timestamptz,next_water_at timestamptz,next_fertilizer_at timestamptz,
  can_water boolean,can_fertilize boolean,ready_for_harvest boolean,missed_water_slots integer,missed_fertilizer_days integer,
  died_at timestamptz,death_reason text,name text,other_names text,botanical_name text,family text,used_part text,
  traditional_actions text,dosage text,caution text,source_ref text,source_page integer,visual_variant smallint
)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); pid uuid; planted timestamptz; mature timestamptz; last_slot integer; slot_no integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v2(mid);
  select p.id,p.planted_at,p.matures_at,p.last_water_slot into pid,planted,mature,last_slot
  from public.herb_garden_plants p
  where p.member_id=mid and p.status='growing' and p.harvested_at is null and p.died_at is null
  order by p.planted_at desc limit 1 for update;
  if pid is null then raise exception 'Không có cây đang phát triển để tưới.'; end if;
  if now()>=mature then raise exception 'Đã hết giai đoạn tưới nước.'; end if;
  slot_no:=floor(extract(epoch from (now()-planted))/21600)::integer;
  if slot_no<0 or slot_no>11 then raise exception 'Ngoài chu kỳ tưới hợp lệ.'; end if;
  if last_slot>=slot_no then raise exception 'Bạn đã tưới cây trong chu kỳ 6 giờ này.'; end if;
  update public.herb_garden_plants p
    set last_watered_at=now(),last_water_slot=slot_no,water_count=least(12,p.water_count+1),
        last_cared_at=now(),care_count=p.care_count+1
  where p.id=pid;
  insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no) values(pid,mid,'water',slot_no) on conflict do nothing;
  return query select * from public.herb_garden_state_v2();
end $$;
revoke all on function public.herb_garden_water_v2() from public,anon;
grant execute on function public.herb_garden_water_v2() to authenticated;

create or replace function public.herb_garden_fertilize_v2()
returns table(
  id uuid,planted_at timestamptz,matures_at timestamptz,expires_at timestamptz,status text,
  water_count integer,fertilizer_count integer,required_water_count integer,required_fertilizer_count integer,
  last_watered_at timestamptz,last_fertilized_at timestamptz,next_water_at timestamptz,next_fertilizer_at timestamptz,
  can_water boolean,can_fertilize boolean,ready_for_harvest boolean,missed_water_slots integer,missed_fertilizer_days integer,
  died_at timestamptz,death_reason text,name text,other_names text,botanical_name text,family text,used_part text,
  traditional_actions text,dosage text,caution text,source_ref text,source_page integer,visual_variant smallint
)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); pid uuid; planted timestamptz; mature timestamptz; last_day integer; day_no integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v2(mid);
  select p.id,p.planted_at,p.matures_at,p.last_fertilizer_day into pid,planted,mature,last_day
  from public.herb_garden_plants p
  where p.member_id=mid and p.status='growing' and p.harvested_at is null and p.died_at is null
  order by p.planted_at desc limit 1 for update;
  if pid is null then raise exception 'Không có cây đang phát triển để bón phân.'; end if;
  if now()>=mature then raise exception 'Đã hết giai đoạn bón phân.'; end if;
  day_no:=floor(extract(epoch from (now()-planted))/86400)::integer;
  if day_no<0 or day_no>2 then raise exception 'Ngoài ngày chăm sóc hợp lệ.'; end if;
  if last_day>=day_no then raise exception 'Bạn đã bón phân trong ngày sinh trưởng này.'; end if;
  update public.herb_garden_plants p
    set last_fertilized_at=now(),last_fertilizer_day=day_no,fertilizer_count=least(3,p.fertilizer_count+1),
        last_cared_at=now(),care_count=p.care_count+1
  where p.id=pid;
  insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no) values(pid,mid,'fertilize',day_no) on conflict do nothing;
  return query select * from public.herb_garden_state_v2();
end $$;
revoke all on function public.herb_garden_fertilize_v2() from public,anon;
grant execute on function public.herb_garden_fertilize_v2() to authenticated;

create or replace function public.herb_garden_harvest_v2()
returns table(name text,other_names text,botanical_name text,family text,used_part text,traditional_actions text,dosage text,caution text,source_ref text,source_page integer,quantity integer)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); pid uuid; sk text; st text; exp timestamptz; wc integer; fc integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v2(mid);
  select p.id,p.seed_key,p.status,p.expires_at,p.water_count,p.fertilizer_count into pid,sk,st,exp,wc,fc
  from public.herb_garden_plants p
  where p.member_id=mid and p.harvested_at is null and p.died_at is null and p.status in ('growing','mature')
  order by p.planted_at desc limit 1 for update;
  if pid is null then raise exception 'Bạn chưa có cây để thu hoạch.'; end if;
  if st<>'mature' or wc<12 or fc<3 then raise exception 'Chưa đủ điều kiện: cần 12 lần tưới, 3 lần bón phân và đủ 72 giờ.'; end if;
  if now()>=exp then
    perform private.herb_garden_sync_member_v2(mid);
    raise exception 'Đã quá thời hạn thu hoạch; cây đã chết.';
  end if;
  update public.herb_garden_plants p set harvested_at=now(),status='harvested' where p.id=pid;
  insert into public.herb_garden_inventory(member_id,seed_key,quantity,updated_at) values(mid,sk,1,now())
    on conflict(member_id,seed_key) do update set quantity=public.herb_garden_inventory.quantity+1,updated_at=now();
  insert into public.herb_garden_events(plant_id,member_id,event_type) values(pid,mid,'harvest') on conflict do nothing;
  perform private.audit_event('herb_garden.harvest_v2','herb_garden_plant',pid::text,'info',jsonb_build_object('seed_key',sk));
  return query select s.name,s.other_names,s.botanical_name,s.family,s.used_part,s.traditional_actions,s.dosage,s.caution,s.source_ref,s.source_page,i.quantity
    from private.herb_garden_species s join public.herb_garden_inventory i on i.seed_key=s.seed_key and i.member_id=mid where s.seed_key=sk;
end $$;
revoke all on function public.herb_garden_harvest_v2() from public,anon;
grant execute on function public.herb_garden_harvest_v2() to authenticated;

create or replace function public.herb_garden_inventory_v2()
returns table(name text,other_names text,botanical_name text,family text,used_part text,traditional_actions text,dosage text,caution text,source_ref text,source_page integer,quantity integer,updated_at timestamptz,visual_variant smallint)
language sql
security definer
set search_path=''
as $$
  select s.name,s.other_names,s.botanical_name,s.family,s.used_part,s.traditional_actions,s.dosage,s.caution,s.source_ref,s.source_page,i.quantity,i.updated_at,s.visual_variant
  from public.herb_garden_inventory i join private.herb_garden_species s on s.seed_key=i.seed_key
  where private.is_approved() and i.member_id=private.current_member_id() and i.quantity>0
  order by i.updated_at desc
$$;
revoke all on function public.herb_garden_inventory_v2() from public,anon;
grant execute on function public.herb_garden_inventory_v2() to authenticated;
