-- Canonical Gia Vien watering rule v5.
-- One and only one rule: each 6-hour growth slot accepts one watering.
-- That same successful watering counts toward the required 12/72h AND the care streak.
-- Missing one or more complete slots breaks the streak before the next valid watering.

create or replace function public.herb_garden_plant_v3(p_slot_no smallint)
returns uuid language plpgsql security definer set search_path='' as $function$
declare mid uuid:=private.current_member_id();sk text;pid uuid;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_slot_no not between 1 and 9 then raise exception 'Ô vườn không hợp lệ'; end if;
  perform private.ensure_herb_garden_plots_v3(mid);perform private.herb_garden_sync_member_v3(mid);perform private.ensure_herb_garden_starter_seeds_v1(mid);
  if (select count(*) from public.herb_garden_plots where member_id=mid and initial_selected)<>3 then raise exception 'Hãy chọn 3 ô khởi đầu trước.'; end if;
  if not exists(select 1 from public.herb_garden_plots where member_id=mid and slot_no=p_slot_no and unlocked) then raise exception 'Ô này chưa được mở khóa.'; end if;
  if exists(select 1 from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status in('growing','mature') and harvested_at is null and died_at is null) then raise exception 'Ô này đang có cây.'; end if;
  select i.seed_key into sk from public.herb_garden_seed_inventory i join private.herb_garden_species s on s.seed_key=i.seed_key where i.member_id=mid and i.quantity>0 and s.seedable and s.source_code='QD4664-2014' order by random() limit 1 for update of i;
  if sk is null then raise exception 'Túi giống đã hết. Hãy chăm cây đúng hạn, thu hoạch hoặc nhận giống từ phần thưởng.'; end if;
  update public.herb_garden_seed_inventory set quantity=quantity-1,updated_at=now() where member_id=mid and seed_key=sk and quantity>0;
  insert into public.herb_garden_plants(member_id,seed_key,slot_no,matures_at,expires_at,status) values(mid,sk,p_slot_no,now()+interval '3 days',now()+interval '3 days 6 hours','growing') returning id into pid;
  insert into public.herb_garden_events(plant_id,member_id,event_type,metadata) values(pid,mid,'plant',jsonb_build_object('slot_no',p_slot_no,'seed_consumed',true,'water_rule','one-per-6h-slot')) on conflict do nothing;
  insert into public.notifications(member_id,kind,title,body) values(mid,'herb_garden_planted','Đã gieo 1 hạt tại ô '||p_slot_no,'Mỗi chu kỳ 6 giờ tưới 1 lần. Mỗi lần tưới hợp lệ vừa tính vào 1/12 vừa duy trì chuỗi thưởng; bón phân 1 lần mỗi ngày.');
  return pid;
end $function$;

create or replace function public.herb_garden_water_v3(p_slot_no smallint)
returns boolean language plpgsql security definer set search_path='' as $function$
declare mid uuid:=private.current_member_id();pid uuid;planted timestamptz;mature timestamptz;last_slot integer;slot_idx integer;missed_between integer:=0;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v3(mid);
  select id,planted_at,matures_at,last_water_slot into pid,planted,mature,last_slot from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status='growing' and harvested_at is null and died_at is null order by planted_at desc limit 1 for update;
  if pid is null then raise exception 'Ô này không có cây đang phát triển.'; end if;
  if now()>=mature then raise exception 'Đã hết giai đoạn tưới nước.'; end if;
  slot_idx:=floor(extract(epoch from(now()-planted))/21600)::integer;
  if slot_idx<0 or slot_idx>11 then raise exception 'Ngoài chu kỳ tưới hợp lệ.'; end if;
  if coalesce(last_slot,-1)>=slot_idx then raise exception 'Chu kỳ 6 giờ này đã được tưới.'; end if;
  missed_between:=greatest(0,slot_idx-coalesce(last_slot,-1)-1);
  if missed_between>0 then update public.herb_garden_plants set care_streak=0 where id=pid; end if;
  update public.herb_garden_plants set last_watered_at=now(),last_water_slot=slot_idx,water_count=least(12,water_count+1),last_cared_at=now(),care_count=care_count+1 where id=pid;
  insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata) values(pid,mid,'water',slot_idx,jsonb_build_object('plot',p_slot_no,'water_rule','one-per-6h-slot','valid',true,'missed_slots_before',missed_between,'streak_reset',missed_between>0)) on conflict do nothing;
  perform private.herb_garden_reward_care_v1(mid,pid,true);
  return true;
end $function$;

create or replace function public.herb_garden_water_v4(p_slot_no integer)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_state jsonb;v_message text;
begin
  if p_slot_no not between 1 and 9 then raise exception 'Ô vườn không hợp lệ'; end if;
  begin
    perform public.herb_garden_water_v3(p_slot_no::smallint);
    select coalesce(jsonb_agg(to_jsonb(s) order by s.slot_no),'[]'::jsonb) into v_state from public.herb_garden_state_v3() s;
    return jsonb_build_object('ok',true,'watered',true,'reason','watered','water_rule','one-per-6h-slot','state',v_state);
  exception when others then
    get stacked diagnostics v_message=message_text;
    if position('Chưa đến lượt tưới tiếp theo' in coalesce(v_message,''))>0 or position('Chu kỳ 6 giờ này đã được tưới' in coalesce(v_message,''))>0 then
      select coalesce(jsonb_agg(to_jsonb(s) order by s.slot_no),'[]'::jsonb) into v_state from public.herb_garden_state_v3() s;
      return jsonb_build_object('ok',true,'watered',false,'reason','already_watered','water_rule','one-per-6h-slot','message','Ô này đã được tưới trong chu kỳ 6 giờ hiện tại. Hãy chờ lượt tưới kế tiếp.','state',v_state);
    end if;
    raise;
  end;
end $function$;

revoke all on function public.herb_garden_plant_v3(smallint) from public,anon;
revoke all on function public.herb_garden_water_v3(smallint) from public,anon;
revoke all on function public.herb_garden_water_v4(integer) from public,anon;
grant execute on function public.herb_garden_plant_v3(smallint) to authenticated;
grant execute on function public.herb_garden_water_v3(smallint) to authenticated;
grant execute on function public.herb_garden_water_v4(integer) to authenticated;
