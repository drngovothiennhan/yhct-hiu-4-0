-- Gia Vien Dược Thảo: harvest confirmation/progression hotfix.
-- Keep the approved 72h / 12 water / 3 fertilizer care contract.
-- Only extend the post-maturity harvest grace window from 6h to 24h.

update public.herb_garden_plants
set expires_at = matures_at + interval '24 hours'
where status in ('growing','mature')
  and harvested_at is null
  and died_at is null
  and (expires_at is null or expires_at < matures_at + interval '24 hours');

create or replace function private.herb_garden_sync_plant_v3(p_plant_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_member uuid;
  v_slot smallint;
  v_status text;
  v_matures timestamptz;
  v_expires timestamptz;
  v_water integer;
  v_fertilizer integer;
  v_reason text;
  v_event uuid;
begin
  select member_id,slot_no,status,matures_at,expires_at,water_count,fertilizer_count
    into v_member,v_slot,v_status,v_matures,v_expires,v_water,v_fertilizer
  from public.herb_garden_plants
  where id=p_plant_id
    and status in('growing','mature')
    and harvested_at is null
    and died_at is null
  for update;

  if not found then return; end if;

  if now()>=v_matures and v_status='growing' and (v_water<12 or v_fertilizer<3) then
    v_reason:=format('Ô %s: hết 72 giờ nhưng chưa đủ chăm sóc: tưới %s/12, bón phân %s/3.',v_slot,v_water,v_fertilizer);
    update public.herb_garden_plants
      set status='dead',died_at=now(),death_reason=v_reason
      where id=p_plant_id;
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata)
      values(p_plant_id,v_member,'dead',jsonb_build_object('slot_no',v_slot,'reason',v_reason,'water_count',v_water,'fertilizer_count',v_fertilizer))
      on conflict do nothing returning id into v_event;
    if v_event is not null then
      insert into public.notifications(member_id,kind,title,body)
      values(v_member,'herb_garden_dead','Cây ở ô '||v_slot||' đã chết',v_reason||' Ô đất đã được giải phóng.');
    end if;
    return;
  end if;

  if now()>=v_matures and v_status='growing' and v_water>=12 and v_fertilizer>=3 then
    update public.herb_garden_plants set status='mature' where id=p_plant_id;
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata)
      values(p_plant_id,v_member,'mature',jsonb_build_object('slot_no',v_slot,'water_count',v_water,'fertilizer_count',v_fertilizer))
      on conflict do nothing returning id into v_event;
    if v_event is not null then
      insert into public.notifications(member_id,kind,title,body)
      values(v_member,'herb_garden_mature','Cây ở ô '||v_slot||' đã trưởng thành','Đã đủ chăm sóc. Hãy thu hoạch trong 24 giờ để đưa dược liệu vào kho và nhận thưởng.');
    end if;
    v_status:='mature';
  end if;

  if now()>=coalesce(v_expires,v_matures+interval '24 hours') and v_status='mature' then
    v_reason:=format('Ô %s: quá 24 giờ sau khi trưởng thành mà chưa thu hoạch.',v_slot);
    update public.herb_garden_plants
      set status='dead',died_at=now(),death_reason=v_reason
      where id=p_plant_id;
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata)
      values(p_plant_id,v_member,'dead',jsonb_build_object('slot_no',v_slot,'reason',v_reason))
      on conflict do nothing returning id into v_event;
    if v_event is not null then
      insert into public.notifications(member_id,kind,title,body)
      values(v_member,'herb_garden_dead','Cây ở ô '||v_slot||' quá hạn thu hoạch',v_reason||' Ô đất đã được giải phóng.');
    end if;
  end if;
end
$function$;

revoke execute on function private.herb_garden_sync_plant_v3(uuid) from public,anon,authenticated;

create or replace function public.herb_garden_plant_v3(p_slot_no smallint)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  mid uuid:=private.current_member_id();
  sk text;
  pid uuid;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_slot_no not between 1 and 9 then raise exception 'Ô vườn không hợp lệ'; end if;
  perform private.ensure_herb_garden_plots_v3(mid);
  perform private.herb_garden_sync_member_v3(mid);
  perform private.ensure_herb_garden_starter_seeds_v1(mid);

  if (select count(*) from public.herb_garden_plots where member_id=mid and initial_selected)<>3 then
    raise exception 'Hãy chọn 3 ô khởi đầu trước.';
  end if;
  if not exists(select 1 from public.herb_garden_plots where member_id=mid and slot_no=p_slot_no and unlocked) then
    raise exception 'Ô này chưa được mở khóa.';
  end if;
  if exists(select 1 from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status in('growing','mature') and harvested_at is null and died_at is null) then
    raise exception 'Ô này đang có cây.';
  end if;

  select i.seed_key into sk
  from public.herb_garden_seed_inventory i
  join private.herb_garden_species s on s.seed_key=i.seed_key
  where i.member_id=mid and i.quantity>0 and s.seedable and s.source_code='QD4664-2014'
  order by random()
  limit 1
  for update of i;

  if sk is null then
    raise exception 'Túi giống đã hết. Hãy chăm cây đúng hạn, thu hoạch hoặc nhận giống từ phần thưởng.';
  end if;

  update public.herb_garden_seed_inventory
    set quantity=quantity-1,updated_at=now()
    where member_id=mid and seed_key=sk and quantity>0;

  insert into public.herb_garden_plants(member_id,seed_key,slot_no,matures_at,expires_at,status)
    values(mid,sk,p_slot_no,now()+interval '3 days',now()+interval '4 days','growing')
    returning id into pid;

  insert into public.herb_garden_events(plant_id,member_id,event_type,metadata)
    values(pid,mid,'plant',jsonb_build_object('slot_no',p_slot_no,'seed_consumed',true,'water_rule','one-per-6h-slot','harvest_grace_hours',24))
    on conflict do nothing;

  insert into public.notifications(member_id,kind,title,body)
    values(mid,'herb_garden_planted','Đã gieo 1 hạt tại ô '||p_slot_no,'Mỗi chu kỳ 6 giờ tưới 1 lần, mỗi ngày bón phân 1 lần. Sau khi đủ 72 giờ và đủ chăm sóc, bạn có 24 giờ để thu hoạch.');

  return pid;
end
$function$;

revoke execute on function public.herb_garden_plant_v3(smallint) from public,anon;
grant execute on function public.herb_garden_plant_v3(smallint) to authenticated;
