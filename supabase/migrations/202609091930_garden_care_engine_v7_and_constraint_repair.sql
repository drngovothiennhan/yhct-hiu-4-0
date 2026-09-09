-- Gia Vien care engine v7
-- RCA: fertilizer and social assistance still used separate mutation paths. In addition,
-- live CHECK constraints did not allow assist_fertilize/assist_water/care_reward events or
-- garden_help/garden_trade_sold/herb_garden_plot_unlocked notifications, so valid care
-- could roll back exactly when a reward or social-help side effect was inserted.

alter table public.herb_garden_events drop constraint if exists herb_garden_events_event_type_check;
alter table public.herb_garden_events
  add constraint herb_garden_events_event_type_check check (event_type = any (array[
    'plant'::text,'water'::text,'fertilize'::text,'mature'::text,'harvest'::text,'dead'::text,
    'reminder_water'::text,'reminder_fertilizer'::text,'assist_water'::text,'assist_fertilize'::text,
    'care_reward'::text
  ]));

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind = any (array[
    'comment'::text,'endorsement'::text,'follow'::text,'topic_post'::text,'repost'::text,'mod_verified'::text,
    'drl_published'::text,'system'::text,'academic_post_submitted'::text,'academic_post_review'::text,
    'academic_post_moderated'::text,'message_received'::text,'feedback_received'::text,'feedback_resolved'::text,
    'herb_garden_planted'::text,'herb_garden_water_due'::text,'herb_garden_fertilizer_due'::text,
    'herb_garden_mature'::text,'herb_garden_dead'::text,'herb_garden_seed_reward'::text,
    'herb_garden_care_reward'::text,'herb_garden_harvest_reward'::text,
    'garden_help'::text,'garden_trade_sold'::text,'herb_garden_plot_unlocked'::text
  ]));

-- Store achieved streak in slot_no. This makes care_reward compatible with the
-- existing unique event index (plant_id,event_type,coalesce(slot_no,-1)) so
-- streak 3, 6, 9... can be recorded independently.
create or replace function private.herb_garden_reward_care_v1(p_member_id uuid,p_plant_id uuid,p_on_time boolean)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  new_streak integer:=0;
  credit_reward integer:=0;
  seed_reward integer:=0;
  reward_seed text;
begin
  if not coalesce(p_on_time,false) then
    update public.herb_garden_plants set care_streak=0 where id=p_plant_id and member_id=p_member_id;
    return jsonb_build_object('on_time',false,'streak',0,'credits',0,'seeds',0);
  end if;

  update public.herb_garden_plants
    set care_streak=care_streak+1,
        best_care_streak=greatest(best_care_streak,care_streak+1)
  where id=p_plant_id and member_id=p_member_id
  returning care_streak into new_streak;

  if new_streak>0 and new_streak%3=0 then
    credit_reward:=1;
    perform private.ensure_herb_garden_wallet(p_member_id);
    update public.herb_garden_wallets set balance=balance+1,updated_at=now() where member_id=p_member_id;
    update public.herb_garden_plants set reward_credits=reward_credits+1 where id=p_plant_id;
  end if;

  if new_streak>0 and new_streak%6=0 then
    select seed_key into reward_seed
    from private.herb_garden_species
    where seedable and source_code='QD4664-2014'
    order by random() limit 1;
    if reward_seed is not null then
      seed_reward:=1;
      insert into public.herb_garden_seed_inventory(member_id,seed_key,quantity,updated_at)
      values(p_member_id,reward_seed,1,now())
      on conflict(member_id,seed_key) do update
        set quantity=public.herb_garden_seed_inventory.quantity+1,updated_at=now();
      update public.herb_garden_plants set reward_seeds=reward_seeds+1 where id=p_plant_id;
    end if;
  end if;

  if credit_reward>0 or seed_reward>0 then
    insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata)
    values(
      p_plant_id,p_member_id,'care_reward',new_streak,
      jsonb_build_object('streak',new_streak,'credits',credit_reward,'seeds',seed_reward,'seed_key',reward_seed)
    ) on conflict do nothing;
    insert into public.notifications(member_id,kind,title,body)
    values(
      p_member_id,'herb_garden_care_reward','Thưởng chăm cây đúng hạn',
      'Chuỗi '||new_streak||' lần: +'||credit_reward||' tín dụng'||case when seed_reward>0 then ' và +1 hạt giống' else '' end||'.'
    );
  end if;

  return jsonb_build_object('on_time',true,'streak',new_streak,'credits',credit_reward,'seeds',seed_reward,'seed_key',reward_seed);
end
$function$;

-- ONE authoritative care mutation engine for both self-care and community help.
-- Growth windows are relative to planted_at, never calendar dates:
-- water      = one valid action per 6-hour growth slot (12/72h)
-- fertilizer = one valid action per 24-hour growth day (3/72h)
create or replace function private.herb_garden_apply_care_v7(
  p_owner_id uuid,
  p_actor_id uuid,
  p_slot_no smallint,
  p_kind text,
  p_is_assist boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  pid uuid;
  planted timestamptz;
  mature timestamptz;
  last_idx integer;
  idx integer;
  missed integer:=0;
  next_at timestamptz;
  event_kind text;
  care_rule text;
  reward jsonb:='{}'::jsonb;
  wc integer:=0;
  fc integer:=0;
  streak integer:=0;
begin
  if p_owner_id is null or p_actor_id is null then raise exception 'Thiếu thông tin người chăm vườn.'; end if;
  if p_slot_no not between 1 and 9 then raise exception 'Ô vườn không hợp lệ'; end if;
  if p_kind not in ('water','fertilize') then raise exception 'Hành động chăm cây không hợp lệ'; end if;
  if not exists(
    select 1 from public.club_members m
    where m.id=p_owner_id and m.status='approved' and m.login_enabled and not m.data_conflict
  ) then raise exception 'Chủ vườn không khả dụng'; end if;

  perform private.herb_garden_sync_member_v3(p_owner_id);

  if p_kind='water' then
    select id,planted_at,matures_at,last_water_slot
      into pid,planted,mature,last_idx
    from public.herb_garden_plants
    where member_id=p_owner_id and slot_no=p_slot_no and status='growing'
      and harvested_at is null and died_at is null
    order by planted_at desc limit 1 for update;
  else
    select id,planted_at,matures_at,last_fertilizer_day
      into pid,planted,mature,last_idx
    from public.herb_garden_plants
    where member_id=p_owner_id and slot_no=p_slot_no and status='growing'
      and harvested_at is null and died_at is null
    order by planted_at desc limit 1 for update;
  end if;

  if pid is null then raise exception 'Ô này không có cây đang phát triển.'; end if;
  if now()>=mature then raise exception 'Đã hết giai đoạn chăm cây.'; end if;

  if p_kind='water' then
    idx:=floor(extract(epoch from(now()-planted))/21600)::integer;
    if idx<0 or idx>11 then raise exception 'Ngoài chu kỳ tưới hợp lệ.'; end if;
    if coalesce(last_idx,-1)>=idx then raise exception 'Chu kỳ 6 giờ này đã được tưới.'; end if;
    missed:=greatest(0,idx-coalesce(last_idx,-1)-1);
    next_at:=least(mature,planted+(idx+1)*interval '6 hours');
    event_kind:=case when p_is_assist then 'assist_water' else 'water' end;
    care_rule:='one-per-6h-growth-slot';
  else
    idx:=floor(extract(epoch from(now()-planted))/86400)::integer;
    if idx<0 or idx>2 then raise exception 'Ngoài ngày bón phân hợp lệ.'; end if;
    if coalesce(last_idx,-1)>=idx then raise exception 'Ngày sinh trưởng này đã được bón phân.'; end if;
    missed:=greatest(0,idx-coalesce(last_idx,-1)-1);
    next_at:=least(mature,planted+(idx+1)*interval '1 day');
    event_kind:=case when p_is_assist then 'assist_fertilize' else 'fertilize' end;
    care_rule:='one-per-24h-growth-day';
  end if;

  if missed>0 then
    update public.herb_garden_plants set care_streak=0 where id=pid;
  end if;

  if p_kind='water' then
    update public.herb_garden_plants
      set last_watered_at=now(),last_water_slot=idx,water_count=least(12,water_count+1),
          last_cared_at=now(),care_count=care_count+1
    where id=pid;
  else
    update public.herb_garden_plants
      set last_fertilized_at=now(),last_fertilizer_day=idx,fertilizer_count=least(3,fertilizer_count+1),
          last_cared_at=now(),care_count=care_count+1
    where id=pid;
  end if;

  insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata)
  values(
    pid,p_actor_id,event_kind,idx,
    jsonb_build_object(
      'owner_id',p_owner_id,'actor_id',p_actor_id,'plot',p_slot_no,'care_rule',care_rule,
      'growth_index',idx,'assist',p_is_assist,'valid',true,'missed_before',missed,'streak_reset',missed>0
    )
  ) on conflict do nothing;

  reward:=private.herb_garden_reward_care_v1(p_owner_id,pid,true);

  select water_count,fertilizer_count,care_streak into wc,fc,streak
  from public.herb_garden_plants where id=pid;

  return jsonb_build_object(
    'ok',true,'applied',true,'care_kind',p_kind,
    'watered',p_kind='water','fertilized',p_kind='fertilize',
    'assist',p_is_assist,'slot_no',p_slot_no,'growth_index',idx,
    'water_count',wc,'fertilizer_count',fc,'care_streak',streak,
    'next_at',next_at,'care_rule',care_rule,'missed_before',missed,'reward',reward
  );
end
$function$;

create or replace function public.herb_garden_water_v3(p_slot_no smallint)
returns boolean language plpgsql security definer set search_path='' as $function$
declare mid uuid:=private.current_member_id();
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_apply_care_v7(mid,mid,p_slot_no,'water',false);
  return true;
end
$function$;

create or replace function public.herb_garden_fertilize_v3(p_slot_no smallint)
returns boolean language plpgsql security definer set search_path='' as $function$
declare mid uuid:=private.current_member_id();
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_apply_care_v7(mid,mid,p_slot_no,'fertilize',false);
  return true;
end
$function$;

create or replace function public.herb_garden_water_v4(p_slot_no integer)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare mid uuid:=private.current_member_id(); result jsonb; state jsonb; message text;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_slot_no not between 1 and 9 then raise exception 'Ô vườn không hợp lệ'; end if;
  begin
    result:=private.herb_garden_apply_care_v7(mid,mid,p_slot_no::smallint,'water',false);
    select coalesce(jsonb_agg(to_jsonb(s) order by s.slot_no),'[]'::jsonb) into state from public.herb_garden_state_v3() s;
    return result||jsonb_build_object('state',state);
  exception when others then
    get stacked diagnostics message=message_text;
    if position('Chu kỳ 6 giờ này đã được tưới.' in coalesce(message,''))>0 then
      select coalesce(jsonb_agg(to_jsonb(s) order by s.slot_no),'[]'::jsonb) into state from public.herb_garden_state_v3() s;
      return jsonb_build_object(
        'ok',true,'applied',false,'watered',false,'care_kind','water','reason','already_watered',
        'message','Ô này đã được tưới trong lượt 6 giờ hiện tại. Bạn hoặc bạn bè chỉ cần tưới một lần cho cùng lượt.',
        'care_rule','one-per-6h-growth-slot','state',state
      );
    end if;
    raise;
  end;
end
$function$;

create or replace function public.herb_garden_fertilize_v4(p_slot_no integer)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare mid uuid:=private.current_member_id(); result jsonb; state jsonb; message text;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_slot_no not between 1 and 9 then raise exception 'Ô vườn không hợp lệ'; end if;
  begin
    result:=private.herb_garden_apply_care_v7(mid,mid,p_slot_no::smallint,'fertilize',false);
    select coalesce(jsonb_agg(to_jsonb(s) order by s.slot_no),'[]'::jsonb) into state from public.herb_garden_state_v3() s;
    return result||jsonb_build_object('state',state);
  exception when others then
    get stacked diagnostics message=message_text;
    if position('Ngày sinh trưởng này đã được bón phân.' in coalesce(message,''))>0 then
      select coalesce(jsonb_agg(to_jsonb(s) order by s.slot_no),'[]'::jsonb) into state from public.herb_garden_state_v3() s;
      return jsonb_build_object(
        'ok',true,'applied',false,'fertilized',false,'care_kind','fertilize','reason','already_fertilized',
        'message','Ô này đã được bón phân trong ngày sinh trưởng hiện tại. Bạn hoặc bạn bè chỉ cần bón một lần cho cùng ngày.',
        'care_rule','one-per-24h-growth-day','state',state
      );
    end if;
    raise;
  end;
end
$function$;

create or replace function public.herb_garden_help_v2(p_owner_id uuid,p_slot_no smallint,p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  helper uuid:=private.current_member_id();
  helper_name text;
  care jsonb;
  visit jsonb;
  message text;
begin
  if helper is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_owner_id is null or p_owner_id=helper then raise exception 'Hãy chăm sóc ở vườn của bạn'; end if;
  if p_slot_no not between 1 and 9 or p_kind not in('water','fertilize') then raise exception 'Invalid care action'; end if;
  if (select count(*) from public.herb_garden_events where member_id=helper and event_type like 'assist_%' and created_at>now()-interval '1 day')>=8 then
    raise exception 'Bạn đã đạt giới hạn 8 lượt hỗ trợ trong 24 giờ.';
  end if;

  begin
    care:=private.herb_garden_apply_care_v7(p_owner_id,helper,p_slot_no,p_kind,true);
  exception when others then
    get stacked diagnostics message=message_text;
    if position('Chu kỳ 6 giờ này đã được tưới.' in coalesce(message,''))>0
       or position('Ngày sinh trưởng này đã được bón phân.' in coalesce(message,''))>0 then
      visit:=public.herb_garden_visit_v2(p_owner_id);
      return visit||jsonb_build_object('last_care',jsonb_build_object(
        'ok',true,'applied',false,'care_kind',p_kind,
        'message',case when p_kind='water'
          then 'Lượt 6 giờ này đã được chăm. Một lần tưới từ chủ vườn hoặc bạn bè là đủ.'
          else 'Ngày sinh trưởng này đã được chăm. Một lần bón phân từ chủ vườn hoặc bạn bè là đủ.' end
      ));
    end if;
    raise;
  end;

  select full_name into helper_name from public.club_members where id=helper;
  insert into public.notifications(member_id,actor_member_id,kind,title,body)
  values(
    p_owner_id,helper,'garden_help','Có bạn ghé Gia Viên',
    coalesce(helper_name,'Một thành viên')||case when p_kind='water' then ' đã giúp tưới ô ' else ' đã giúp bón phân ô ' end||p_slot_no||'. Lượt chăm này dùng chung tiến độ với chủ vườn.'
  );

  visit:=public.herb_garden_visit_v2(p_owner_id);
  return visit||jsonb_build_object('last_care',care);
end
$function$;

create or replace function public.herb_garden_help_v1(p_owner_id uuid,p_kind text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  helper uuid:=private.current_member_id();
  target_slot smallint;
begin
  if helper is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_owner_id is null or p_owner_id=helper then raise exception 'Hãy dùng nút chăm sóc ở vườn của bạn'; end if;
  select p.slot_no into target_slot
  from public.herb_garden_plants p
  where p.member_id=p_owner_id and p.status='growing' and p.harvested_at is null and p.died_at is null
  order by p.planted_at desc limit 1;
  if target_slot is null then raise exception 'Vườn này hiện không có cây cần chăm sóc.'; end if;
  perform public.herb_garden_help_v2(p_owner_id,target_slot,p_kind);
  return public.herb_garden_visit_v1(p_owner_id);
end
$function$;

revoke all on function public.herb_garden_water_v3(smallint) from public,anon;
revoke all on function public.herb_garden_water_v4(integer) from public,anon;
revoke all on function public.herb_garden_fertilize_v3(smallint) from public,anon;
revoke all on function public.herb_garden_fertilize_v4(integer) from public,anon;
revoke all on function public.herb_garden_help_v1(uuid,text) from public,anon;
revoke all on function public.herb_garden_help_v2(uuid,smallint,text) from public,anon;
grant execute on function public.herb_garden_water_v3(smallint) to authenticated;
grant execute on function public.herb_garden_water_v4(integer) to authenticated;
grant execute on function public.herb_garden_fertilize_v3(smallint) to authenticated;
grant execute on function public.herb_garden_fertilize_v4(integer) to authenticated;
grant execute on function public.herb_garden_help_v1(uuid,text) to authenticated;
grant execute on function public.herb_garden_help_v2(uuid,smallint,text) to authenticated;
