-- Gia Vien seed economy + on-time care rewards v1
-- Rules: starter 5 seeds; water on-time in first 2h of each 6h slot;
-- fertilize on-time in first 8h of each growth day; streak 3 => +1 credit;
-- streak 6 => +1 credit +1 random seed; successful harvest => +3 credits +1 same-species seed.

alter table public.herb_garden_plants
  add column if not exists care_streak integer not null default 0,
  add column if not exists best_care_streak integer not null default 0,
  add column if not exists reward_credits integer not null default 0,
  add column if not exists reward_seeds integer not null default 0;

alter table public.herb_garden_wallets
  add column if not exists starter_seed_granted_at timestamptz;

create table if not exists public.herb_garden_seed_inventory (
  member_id uuid not null,
  seed_key text not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (member_id,seed_key)
);
alter table public.herb_garden_seed_inventory enable row level security;
revoke all on table public.herb_garden_seed_inventory from anon,authenticated;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'comment'::text,'endorsement'::text,'follow'::text,'topic_post'::text,'repost'::text,'mod_verified'::text,'drl_published'::text,'system'::text,
  'academic_post_submitted'::text,'academic_post_review'::text,'academic_post_moderated'::text,'message_received'::text,'feedback_received'::text,'feedback_resolved'::text,
  'herb_garden_planted'::text,'herb_garden_water_due'::text,'herb_garden_fertilizer_due'::text,'herb_garden_mature'::text,'herb_garden_dead'::text,
  'herb_garden_seed_reward'::text,'herb_garden_care_reward'::text,'herb_garden_harvest_reward'::text
]));

create or replace function private.ensure_herb_garden_starter_seeds_v1(p_member_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare granted_at timestamptz; granted integer:=0;
begin
  if p_member_id is null then return 0; end if;
  perform private.ensure_herb_garden_wallet(p_member_id);
  select starter_seed_granted_at into granted_at from public.herb_garden_wallets where member_id=p_member_id for update;
  if granted_at is not null then return 0; end if;
  with picked as (
    select seed_key from private.herb_garden_species
    where seedable and source_code='QD4664-2014' order by random() limit 5
  )
  insert into public.herb_garden_seed_inventory(member_id,seed_key,quantity,updated_at)
  select p_member_id,seed_key,1,now() from picked
  on conflict(member_id,seed_key) do update set quantity=public.herb_garden_seed_inventory.quantity+1,updated_at=now();
  get diagnostics granted=row_count;
  update public.herb_garden_wallets set starter_seed_granted_at=now(),updated_at=now() where member_id=p_member_id;
  insert into public.notifications(member_id,kind,title,body)
  values(p_member_id,'herb_garden_seed_reward','Gói giống khởi đầu','Bạn nhận được '||granted||' hạt giống để bắt đầu Gia Viên.');
  return granted;
end $$;

create or replace function private.herb_garden_reward_care_v1(p_member_id uuid,p_plant_id uuid,p_on_time boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare new_streak integer:=0; credit_reward integer:=0; seed_reward integer:=0; reward_seed text;
begin
  if not coalesce(p_on_time,false) then
    update public.herb_garden_plants set care_streak=0 where id=p_plant_id and member_id=p_member_id;
    return jsonb_build_object('on_time',false,'streak',0,'credits',0,'seeds',0);
  end if;
  update public.herb_garden_plants
    set care_streak=care_streak+1,best_care_streak=greatest(best_care_streak,care_streak+1)
    where id=p_plant_id and member_id=p_member_id returning care_streak into new_streak;
  if new_streak>0 and new_streak%3=0 then
    credit_reward:=1;
    perform private.ensure_herb_garden_wallet(p_member_id);
    update public.herb_garden_wallets set balance=balance+1,updated_at=now() where member_id=p_member_id;
    update public.herb_garden_plants set reward_credits=reward_credits+1 where id=p_plant_id;
  end if;
  if new_streak>0 and new_streak%6=0 then
    select seed_key into reward_seed from private.herb_garden_species
    where seedable and source_code='QD4664-2014' order by random() limit 1;
    if reward_seed is not null then
      seed_reward:=1;
      insert into public.herb_garden_seed_inventory(member_id,seed_key,quantity,updated_at)
      values(p_member_id,reward_seed,1,now())
      on conflict(member_id,seed_key) do update set quantity=public.herb_garden_seed_inventory.quantity+1,updated_at=now();
      update public.herb_garden_plants set reward_seeds=reward_seeds+1 where id=p_plant_id;
    end if;
  end if;
  if credit_reward>0 or seed_reward>0 then
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata)
    values(p_plant_id,p_member_id,'care_reward',jsonb_build_object('streak',new_streak,'credits',credit_reward,'seeds',seed_reward,'seed_key',reward_seed));
    insert into public.notifications(member_id,kind,title,body)
    values(p_member_id,'herb_garden_care_reward','Thưởng chăm cây đúng hạn','Chuỗi '||new_streak||' lần: +'||credit_reward||' tín dụng'||case when seed_reward>0 then ' và +1 hạt giống' else '' end||'.');
  end if;
  return jsonb_build_object('on_time',true,'streak',new_streak,'credits',credit_reward,'seeds',seed_reward,'seed_key',reward_seed);
end $$;

create or replace function public.herb_garden_seed_inventory_v1()
returns table(seed_key text,name text,botanical_name text,quantity integer,visual_variant smallint)
language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id();
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.ensure_herb_garden_starter_seeds_v1(mid);
  return query select i.seed_key,s.name,s.botanical_name,i.quantity,s.visual_variant
  from public.herb_garden_seed_inventory i join private.herb_garden_species s on s.seed_key=i.seed_key
  where i.member_id=mid and i.quantity>0 order by i.updated_at desc,s.name;
end $$;

create or replace function public.herb_garden_reward_status_v1()
returns table(slot_no smallint,care_streak integer,best_care_streak integer,reward_credits integer,reward_seeds integer,wallet_balance integer,seed_total integer)
language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); bal integer; seeds integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.ensure_herb_garden_starter_seeds_v1(mid);
  bal:=private.ensure_herb_garden_wallet(mid);
  select coalesce(sum(quantity),0)::integer into seeds from public.herb_garden_seed_inventory where member_id=mid;
  return query select p.slot_no,p.care_streak,p.best_care_streak,p.reward_credits,p.reward_seeds,bal,seeds
  from public.herb_garden_plants p where p.member_id=mid and p.status in('growing','mature') and p.harvested_at is null and p.died_at is null order by p.slot_no;
end $$;

create or replace function public.herb_garden_plant_v3(p_slot_no smallint)
returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id();sk text;pid uuid;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_slot_no not between 1 and 9 then raise exception 'Ô vườn không hợp lệ'; end if;
  perform private.ensure_herb_garden_plots_v3(mid); perform private.herb_garden_sync_member_v3(mid); perform private.ensure_herb_garden_starter_seeds_v1(mid);
  if (select count(*) from public.herb_garden_plots where member_id=mid and initial_selected)<>3 then raise exception 'Hãy chọn 3 ô khởi đầu trước.'; end if;
  if not exists(select 1 from public.herb_garden_plots where member_id=mid and slot_no=p_slot_no and unlocked) then raise exception 'Ô này chưa được mở khóa.'; end if;
  if exists(select 1 from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status in('growing','mature') and harvested_at is null and died_at is null) then raise exception 'Ô này đang có cây.'; end if;
  select i.seed_key into sk from public.herb_garden_seed_inventory i join private.herb_garden_species s on s.seed_key=i.seed_key
  where i.member_id=mid and i.quantity>0 and s.seedable and s.source_code='QD4664-2014' order by random() limit 1 for update of i;
  if sk is null then raise exception 'Túi giống đã hết. Hãy chăm cây đúng hạn, thu hoạch hoặc nhận giống từ phần thưởng.'; end if;
  update public.herb_garden_seed_inventory set quantity=quantity-1,updated_at=now() where member_id=mid and seed_key=sk and quantity>0;
  insert into public.herb_garden_plants(member_id,seed_key,slot_no,matures_at,expires_at,status)
  values(mid,sk,p_slot_no,now()+interval '3 days',now()+interval '3 days 6 hours','growing') returning id into pid;
  insert into public.herb_garden_events(plant_id,member_id,event_type,metadata) values(pid,mid,'plant',jsonb_build_object('slot_no',p_slot_no,'seed_consumed',true)) on conflict do nothing;
  insert into public.notifications(member_id,kind,title,body) values(mid,'herb_garden_planted','Đã gieo 1 hạt tại ô '||p_slot_no,'Tưới trong 2 giờ đầu mỗi chu kỳ 6 giờ và bón trong 8 giờ đầu mỗi ngày để duy trì chuỗi thưởng.');
  return pid;
end $$;

create or replace function public.herb_garden_water_v3(p_slot_no smallint)
returns boolean language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id();pid uuid;planted timestamptz;mature timestamptz;last_slot integer;slot_idx integer;slot_open timestamptz;on_time boolean;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v3(mid);
  select id,planted_at,matures_at,last_water_slot into pid,planted,mature,last_slot from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status='growing' and harvested_at is null and died_at is null order by planted_at desc limit 1 for update;
  if pid is null then raise exception 'Ô này không có cây đang phát triển.'; end if;
  if now()>=mature then raise exception 'Đã hết giai đoạn tưới nước.'; end if;
  slot_idx:=floor(extract(epoch from(now()-planted))/21600)::integer;
  if slot_idx<0 or slot_idx>11 or last_slot>=slot_idx then raise exception 'Chưa đến lượt tưới tiếp theo.'; end if;
  slot_open:=planted+slot_idx*interval '6 hours'; on_time:=now()<slot_open+interval '2 hours';
  update public.herb_garden_plants set last_watered_at=now(),last_water_slot=slot_idx,water_count=least(12,water_count+1),last_cared_at=now(),care_count=care_count+1 where id=pid;
  insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata) values(pid,mid,'water',slot_idx,jsonb_build_object('plot',p_slot_no,'on_time',on_time)) on conflict do nothing;
  perform private.herb_garden_reward_care_v1(mid,pid,on_time); return true;
end $$;

create or replace function public.herb_garden_fertilize_v3(p_slot_no smallint)
returns boolean language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id();pid uuid;planted timestamptz;mature timestamptz;last_day integer;day_idx integer;day_open timestamptz;on_time boolean;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v3(mid);
  select id,planted_at,matures_at,last_fertilizer_day into pid,planted,mature,last_day from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status='growing' and harvested_at is null and died_at is null order by planted_at desc limit 1 for update;
  if pid is null then raise exception 'Ô này không có cây đang phát triển.'; end if;
  if now()>=mature then raise exception 'Đã hết giai đoạn bón phân.'; end if;
  day_idx:=floor(extract(epoch from(now()-planted))/86400)::integer;
  if day_idx<0 or day_idx>2 or last_day>=day_idx then raise exception 'Chưa đến lượt bón phân tiếp theo.'; end if;
  day_open:=planted+day_idx*interval '1 day'; on_time:=now()<day_open+interval '8 hours';
  update public.herb_garden_plants set last_fertilized_at=now(),last_fertilizer_day=day_idx,fertilizer_count=least(3,fertilizer_count+1),last_cared_at=now(),care_count=care_count+1 where id=pid;
  insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata) values(pid,mid,'fertilize',day_idx,jsonb_build_object('plot',p_slot_no,'on_time',on_time)) on conflict do nothing;
  perform private.herb_garden_reward_care_v1(mid,pid,on_time); return true;
end $$;

create or replace function public.herb_garden_harvest_v3(p_slot_no smallint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id();pid uuid;sk text;st text;exp timestamptz;wc integer;fc integer;next_slot smallint;herb_name text;qty integer;seed_qty integer;bal integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.herb_garden_sync_member_v3(mid);
  select id,seed_key,status,expires_at,water_count,fertilizer_count into pid,sk,st,exp,wc,fc from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status in('growing','mature') and harvested_at is null and died_at is null order by planted_at desc limit 1 for update;
  if pid is null then raise exception 'Ô này chưa có cây để thu hoạch.'; end if;
  if st<>'mature' or wc<12 or fc<3 or now()>=exp then raise exception 'Cây chưa đủ điều kiện thu hoạch.'; end if;
  update public.herb_garden_plants set harvested_at=now(),status='harvested',reward_credits=reward_credits+3,reward_seeds=reward_seeds+1 where id=pid;
  insert into public.herb_garden_inventory(member_id,seed_key,quantity,updated_at) values(mid,sk,1,now()) on conflict(member_id,seed_key) do update set quantity=public.herb_garden_inventory.quantity+1,updated_at=now();
  insert into public.herb_garden_seed_inventory(member_id,seed_key,quantity,updated_at) values(mid,sk,1,now()) on conflict(member_id,seed_key) do update set quantity=public.herb_garden_seed_inventory.quantity+1,updated_at=now();
  perform private.ensure_herb_garden_wallet(mid);
  update public.herb_garden_wallets set balance=balance+3,updated_at=now() where member_id=mid returning balance into bal;
  update public.herb_garden_plots set harvest_count=harvest_count+1,updated_at=now() where member_id=mid and slot_no=p_slot_no;
  insert into public.herb_garden_events(plant_id,member_id,event_type,metadata) values(pid,mid,'harvest',jsonb_build_object('slot_no',p_slot_no,'credits_reward',3,'seed_reward',1)) on conflict do nothing;
  insert into public.notifications(member_id,kind,title,body) values(mid,'herb_garden_harvest_reward','Thu hoạch thành công','+3 tín dụng vườn và +1 hạt giống cùng loài.');
  next_slot:=private.herb_garden_unlock_progress_v3(mid);
  select s.name,i.quantity into herb_name,qty from private.herb_garden_species s join public.herb_garden_inventory i on i.seed_key=s.seed_key and i.member_id=mid where s.seed_key=sk;
  select quantity into seed_qty from public.herb_garden_seed_inventory where member_id=mid and seed_key=sk;
  return jsonb_build_object('name',herb_name,'quantity',qty,'plot',p_slot_no,'unlocked_slot',next_slot,'credits_reward',3,'seed_reward',1,'seed_quantity',seed_qty,'wallet_balance',bal);
end $$;

grant execute on function public.herb_garden_seed_inventory_v1() to authenticated;
grant execute on function public.herb_garden_reward_status_v1() to authenticated;
