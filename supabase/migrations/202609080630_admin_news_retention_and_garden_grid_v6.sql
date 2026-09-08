-- Social/Game V6: compact admin news, 48h retention, server-authoritative 3x3 garden progression.
alter table public.herb_garden_plants add column if not exists slot_no smallint;
update public.herb_garden_plants set slot_no=1 where slot_no is null;
alter table public.herb_garden_plants alter column slot_no set default 1;
alter table public.herb_garden_plants alter column slot_no set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.herb_garden_plants'::regclass and conname='herb_garden_plants_slot_no_chk') then
    alter table public.herb_garden_plants add constraint herb_garden_plants_slot_no_chk check(slot_no between 1 and 9);
  end if;
end $$;
drop index if exists public.herb_garden_one_active_v2_idx;
create unique index if not exists herb_garden_one_active_plot_v3_idx on public.herb_garden_plants(member_id,slot_no) where status in('growing','mature') and harvested_at is null and died_at is null;
create index if not exists herb_garden_plants_member_slot_created_idx on public.herb_garden_plants(member_id,slot_no,planted_at desc);

create table if not exists public.herb_garden_plots(
  member_id uuid not null references public.club_members(id) on delete cascade,
  slot_no smallint not null check(slot_no between 1 and 9),
  unlocked boolean not null default false,
  initial_selected boolean not null default false,
  harvest_count integer not null default 0 check(harvest_count>=0),
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(member_id,slot_no)
);
alter table public.herb_garden_plots enable row level security;
revoke all on public.herb_garden_plots from anon,authenticated;
create index if not exists herb_garden_plots_progress_idx on public.herb_garden_plots(member_id,unlocked,slot_no);

insert into public.herb_garden_plots(member_id,slot_no,unlocked,initial_selected,unlocked_at)
select distinct p.member_id,g.slot_no,g.slot_no between 1 and 3,g.slot_no between 1 and 3,case when g.slot_no between 1 and 3 then now() end
from public.herb_garden_plants p cross join generate_series(1,9) as g(slot_no)
on conflict(member_id,slot_no) do nothing;
update public.herb_garden_plots gp set harvest_count=x.n,updated_at=now()
from (select member_id,slot_no,count(*)::integer n from public.herb_garden_plants where status='harvested' group by member_id,slot_no) x
where gp.member_id=x.member_id and gp.slot_no=x.slot_no and gp.harvest_count<x.n;

create or replace function private.ensure_herb_garden_plots_v3(p_member_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if p_member_id is null then return; end if;
  insert into public.herb_garden_plots(member_id,slot_no) select p_member_id,g from generate_series(1,9) g on conflict(member_id,slot_no) do nothing;
  if exists(select 1 from public.herb_garden_plants where member_id=p_member_id)
     and not exists(select 1 from public.herb_garden_plots where member_id=p_member_id and initial_selected) then
    update public.herb_garden_plots set unlocked=true,initial_selected=true,unlocked_at=coalesce(unlocked_at,now()),updated_at=now() where member_id=p_member_id and slot_no between 1 and 3;
  end if;
end $$;

create or replace function public.herb_garden_select_initial_plots_v3(p_slots smallint[])
returns jsonb language plpgsql security definer set search_path to '' as $$
declare mid uuid:=private.current_member_id();clean smallint[];
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.ensure_herb_garden_plots_v3(mid);
  select array_agg(v order by v) into clean from (select distinct x as v from unnest(coalesce(p_slots,'{}'::smallint[])) x) q;
  if coalesce(cardinality(clean),0)<>3 or exists(select 1 from unnest(clean) x where x not between 1 and 9) then raise exception 'Hãy chọn đúng 3 ô khác nhau trong lưới 1-9.'; end if;
  perform 1 from public.herb_garden_plots where member_id=mid for update;
  if exists(select 1 from public.herb_garden_plots where member_id=mid and initial_selected) then raise exception 'Ba ô khởi đầu đã được chọn.'; end if;
  update public.herb_garden_plots set initial_selected=slot_no=any(clean),unlocked=slot_no=any(clean),unlocked_at=case when slot_no=any(clean) then now() else null end,updated_at=now() where member_id=mid;
  perform private.audit_event('herb_garden.initial_plots','member',mid::text,'info',jsonb_build_object('slots',to_jsonb(clean)));
  return jsonb_build_object('selected',to_jsonb(clean),'unlocked',3);
end $$;

create or replace function private.herb_garden_sync_plant_v3(p_plant_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v_member uuid;v_slot smallint;v_status text;v_matures timestamptz;v_expires timestamptz;v_water integer;v_fertilizer integer;v_reason text;v_event uuid;
begin
  select member_id,slot_no,status,matures_at,expires_at,water_count,fertilizer_count into v_member,v_slot,v_status,v_matures,v_expires,v_water,v_fertilizer from public.herb_garden_plants where id=p_plant_id and status in('growing','mature') and harvested_at is null and died_at is null for update;
  if not found then return; end if;
  if now()>=v_matures and v_status='growing' and (v_water<12 or v_fertilizer<3) then
    v_reason:=format('Ô %s: hết 72 giờ nhưng chưa đủ chăm sóc: tưới %s/12, bón phân %s/3.',v_slot,v_water,v_fertilizer);
    update public.herb_garden_plants set status='dead',died_at=now(),death_reason=v_reason where id=p_plant_id;
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata) values(p_plant_id,v_member,'dead',jsonb_build_object('slot_no',v_slot,'reason',v_reason,'water_count',v_water,'fertilizer_count',v_fertilizer)) on conflict do nothing returning id into v_event;
    if v_event is not null then insert into public.notifications(member_id,kind,title,body) values(v_member,'herb_garden_dead','Cây ở ô '||v_slot||' đã chết',v_reason||' Ô đất đã được giải phóng.'); end if;
    return;
  end if;
  if now()>=v_matures and v_status='growing' and v_water>=12 and v_fertilizer>=3 then
    update public.herb_garden_plants set status='mature' where id=p_plant_id;
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata) values(p_plant_id,v_member,'mature',jsonb_build_object('slot_no',v_slot,'water_count',v_water,'fertilizer_count',v_fertilizer)) on conflict do nothing returning id into v_event;
    if v_event is not null then insert into public.notifications(member_id,kind,title,body) values(v_member,'herb_garden_mature','Cây ở ô '||v_slot||' đã trưởng thành','Đã đủ chăm sóc. Hãy thu hoạch trong 6 giờ để đưa cây vào kho.'); end if;
    v_status:='mature';
  end if;
  if now()>=coalesce(v_expires,v_matures+interval '6 hours') and v_status='mature' then
    v_reason:=format('Ô %s: quá 6 giờ sau khi trưởng thành mà chưa thu hoạch.',v_slot);
    update public.herb_garden_plants set status='dead',died_at=now(),death_reason=v_reason where id=p_plant_id;
    insert into public.herb_garden_events(plant_id,member_id,event_type,metadata) values(p_plant_id,v_member,'dead',jsonb_build_object('slot_no',v_slot,'reason',v_reason)) on conflict do nothing returning id into v_event;
    if v_event is not null then insert into public.notifications(member_id,kind,title,body) values(v_member,'herb_garden_dead','Cây ở ô '||v_slot||' quá hạn thu hoạch',v_reason||' Ô đất đã được giải phóng.'); end if;
  end if;
end $$;

create or replace function private.herb_garden_sync_member_v3(p_member_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare r record;begin if p_member_id is null then return; end if;for r in select id from public.herb_garden_plants where member_id=p_member_id and status in('growing','mature') and harvested_at is null and died_at is null order by slot_no loop perform private.herb_garden_sync_plant_v3(r.id);end loop;end $$;

create or replace function private.herb_garden_unlock_progress_v3(p_member_id uuid)
returns smallint language plpgsql security definer set search_path to '' as $$
declare unlocked_n integer;harvested_n integer;initial_n integer;next_slot smallint;
begin
  perform private.ensure_herb_garden_plots_v3(p_member_id);
  select count(*) filter(where initial_selected),count(*) filter(where unlocked),count(*) filter(where unlocked and harvest_count>0) into initial_n,unlocked_n,harvested_n from public.herb_garden_plots where member_id=p_member_id;
  if initial_n<>3 or unlocked_n<3 or unlocked_n>=9 or harvested_n<unlocked_n then return null; end if;
  select min(slot_no) into next_slot from public.herb_garden_plots where member_id=p_member_id and not unlocked;
  if next_slot is null then return null; end if;
  update public.herb_garden_plots set unlocked=true,unlocked_at=now(),updated_at=now() where member_id=p_member_id and slot_no=next_slot;
  insert into public.notifications(member_id,kind,title,body) values(p_member_id,'herb_garden_plot_unlocked','Đã mở khóa ô vườn '||next_slot,'Bạn đã hoàn thành thu hoạch trên toàn bộ ô đang mở. Ô '||next_slot||' hiện đã sẵn sàng để gieo trồng.');
  perform private.audit_event('herb_garden.plot_unlock','member',p_member_id::text,'info',jsonb_build_object('slot_no',next_slot,'unlocked_count',unlocked_n+1));
  return next_slot;
end $$;

create or replace function public.herb_garden_state_v3()
returns table(slot_no smallint,unlocked boolean,initial_selected boolean,harvest_count integer,initial_selection_complete boolean,id uuid,planted_at timestamptz,matures_at timestamptz,expires_at timestamptz,status text,water_count integer,fertilizer_count integer,required_water_count integer,required_fertilizer_count integer,last_watered_at timestamptz,last_fertilized_at timestamptz,next_water_at timestamptz,next_fertilizer_at timestamptz,can_water boolean,can_fertilize boolean,ready_for_harvest boolean,missed_water_slots integer,missed_fertilizer_days integer,died_at timestamptz,death_reason text,name text,other_names text,botanical_name text,family text,used_part text,traditional_actions text,dosage text,caution text,source_ref text,source_page integer,visual_variant smallint)
language plpgsql security definer set search_path to '' as $$
declare mid uuid:=private.current_member_id();selection_complete boolean;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.ensure_herb_garden_plots_v3(mid);perform private.herb_garden_sync_member_v3(mid);
  select count(*)=3 into selection_complete from public.herb_garden_plots where member_id=mid and initial_selected;
  return query select g.slot_no,g.unlocked,g.initial_selected,g.harvest_count,selection_complete,p.id,p.planted_at,p.matures_at,p.expires_at,p.status,coalesce(p.water_count,0),coalesce(p.fertilizer_count,0),12,3,p.last_watered_at,p.last_fertilized_at,
    case when p.id is not null and p.status='growing' and now()<p.matures_at then case when p.last_water_slot<p.current_water_slot then now() else p.planted_at+(p.current_water_slot+1)*interval '6 hours' end end,
    case when p.id is not null and p.status='growing' and now()<p.matures_at then case when p.last_fertilizer_day<p.current_fertilizer_day then now() else p.planted_at+(p.current_fertilizer_day+1)*interval '1 day' end end,
    coalesce(p.status='growing' and now()<p.matures_at and p.last_water_slot<p.current_water_slot,false),coalesce(p.status='growing' and now()<p.matures_at and p.last_fertilizer_day<p.current_fertilizer_day,false),coalesce(p.status='mature' and now()<p.expires_at and p.water_count>=12 and p.fertilizer_count>=3,false),
    case when p.id is null then 0 else greatest(0,(p.current_water_slot+1)-p.water_count) end,case when p.id is null then 0 else greatest(0,(p.current_fertilizer_day+1)-p.fertilizer_count) end,p.died_at,p.death_reason,
    case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.name end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.other_names end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.botanical_name end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.family end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.used_part end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.traditional_actions end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.dosage end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.caution end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.source_ref end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.source_page end,case when p.id is not null and (now()>=p.matures_at or p.status in('mature','dead','harvested')) then s.visual_variant end
  from public.herb_garden_plots g left join lateral(select x.*,greatest(0,least(11,floor(extract(epoch from(now()-x.planted_at))/21600)::integer)) current_water_slot,greatest(0,least(2,floor(extract(epoch from(now()-x.planted_at))/86400)::integer)) current_fertilizer_day from public.herb_garden_plants x where x.member_id=mid and x.slot_no=g.slot_no and x.status in('growing','mature') and x.harvested_at is null and x.died_at is null order by x.planted_at desc limit 1)p on true left join private.herb_garden_species s on s.seed_key=p.seed_key where g.member_id=mid order by g.slot_no;
end $$;

create or replace function public.herb_garden_plant_v3(p_slot_no smallint)
returns uuid language plpgsql security definer set search_path to '' as $$
declare mid uuid:=private.current_member_id();sk text;pid uuid;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;if p_slot_no not between 1 and 9 then raise exception 'Ô vườn không hợp lệ'; end if;
  perform private.ensure_herb_garden_plots_v3(mid);perform private.herb_garden_sync_member_v3(mid);
  if (select count(*) from public.herb_garden_plots where member_id=mid and initial_selected)<>3 then raise exception 'Hãy chọn 3 ô khởi đầu trước.'; end if;
  if not exists(select 1 from public.herb_garden_plots where member_id=mid and slot_no=p_slot_no and unlocked) then raise exception 'Ô này chưa được mở khóa.'; end if;
  if exists(select 1 from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status in('growing','mature') and harvested_at is null and died_at is null) then raise exception 'Ô này đang có cây.'; end if;
  select seed_key into sk from private.herb_garden_species where seedable and source_code='QD4664-2014' order by random() limit 1;if sk is null then raise exception 'Danh mục hạt giống chưa sẵn sàng.'; end if;
  insert into public.herb_garden_plants(member_id,seed_key,slot_no,matures_at,expires_at,status) values(mid,sk,p_slot_no,now()+interval '3 days',now()+interval '3 days 6 hours','growing') returning id into pid;
  insert into public.herb_garden_events(plant_id,member_id,event_type,metadata) values(pid,mid,'plant',jsonb_build_object('slot_no',p_slot_no)) on conflict do nothing;insert into public.notifications(member_id,kind,title,body) values(mid,'herb_garden_planted','Đã gieo hạt tại ô '||p_slot_no,'Hãy tưới theo chu kỳ 6 giờ và bón phân mỗi ngày.');return pid;
end $$;

create or replace function public.herb_garden_water_v3(p_slot_no smallint)
returns boolean language plpgsql security definer set search_path to '' as $$
declare mid uuid:=private.current_member_id();pid uuid;planted timestamptz;mature timestamptz;last_slot integer;slot_idx integer;
begin if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;perform private.herb_garden_sync_member_v3(mid);select id,planted_at,matures_at,last_water_slot into pid,planted,mature,last_slot from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status='growing' and harvested_at is null and died_at is null order by planted_at desc limit 1 for update;if pid is null then raise exception 'Ô này không có cây đang phát triển.'; end if;if now()>=mature then raise exception 'Đã hết giai đoạn tưới nước.'; end if;slot_idx:=floor(extract(epoch from(now()-planted))/21600)::integer;if slot_idx<0 or slot_idx>11 or last_slot>=slot_idx then raise exception 'Chưa đến lượt tưới tiếp theo.'; end if;update public.herb_garden_plants set last_watered_at=now(),last_water_slot=slot_idx,water_count=least(12,water_count+1),last_cared_at=now(),care_count=care_count+1 where id=pid;insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata) values(pid,mid,'water',slot_idx,jsonb_build_object('plot',p_slot_no)) on conflict do nothing;return true;end $$;

create or replace function public.herb_garden_fertilize_v3(p_slot_no smallint)
returns boolean language plpgsql security definer set search_path to '' as $$
declare mid uuid:=private.current_member_id();pid uuid;planted timestamptz;mature timestamptz;last_day integer;day_idx integer;
begin if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;perform private.herb_garden_sync_member_v3(mid);select id,planted_at,matures_at,last_fertilizer_day into pid,planted,mature,last_day from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status='growing' and harvested_at is null and died_at is null order by planted_at desc limit 1 for update;if pid is null then raise exception 'Ô này không có cây đang phát triển.'; end if;if now()>=mature then raise exception 'Đã hết giai đoạn bón phân.'; end if;day_idx:=floor(extract(epoch from(now()-planted))/86400)::integer;if day_idx<0 or day_idx>2 or last_day>=day_idx then raise exception 'Chưa đến lượt bón phân tiếp theo.'; end if;update public.herb_garden_plants set last_fertilized_at=now(),last_fertilizer_day=day_idx,fertilizer_count=least(3,fertilizer_count+1),last_cared_at=now(),care_count=care_count+1 where id=pid;insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata) values(pid,mid,'fertilize',day_idx,jsonb_build_object('plot',p_slot_no)) on conflict do nothing;return true;end $$;

create or replace function public.herb_garden_harvest_v3(p_slot_no smallint)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare mid uuid:=private.current_member_id();pid uuid;sk text;st text;exp timestamptz;wc integer;fc integer;next_slot smallint;herb_name text;qty integer;
begin if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;perform private.herb_garden_sync_member_v3(mid);select id,seed_key,status,expires_at,water_count,fertilizer_count into pid,sk,st,exp,wc,fc from public.herb_garden_plants where member_id=mid and slot_no=p_slot_no and status in('growing','mature') and harvested_at is null and died_at is null order by planted_at desc limit 1 for update;if pid is null then raise exception 'Ô này chưa có cây để thu hoạch.'; end if;if st<>'mature' or wc<12 or fc<3 or now()>=exp then raise exception 'Cây chưa đủ điều kiện thu hoạch.'; end if;update public.herb_garden_plants set harvested_at=now(),status='harvested' where id=pid;insert into public.herb_garden_inventory(member_id,seed_key,quantity,updated_at) values(mid,sk,1,now()) on conflict(member_id,seed_key) do update set quantity=public.herb_garden_inventory.quantity+1,updated_at=now();update public.herb_garden_plots set harvest_count=harvest_count+1,updated_at=now() where member_id=mid and slot_no=p_slot_no;insert into public.herb_garden_events(plant_id,member_id,event_type,metadata) values(pid,mid,'harvest',jsonb_build_object('slot_no',p_slot_no)) on conflict do nothing;next_slot:=private.herb_garden_unlock_progress_v3(mid);select s.name,i.quantity into herb_name,qty from private.herb_garden_species s join public.herb_garden_inventory i on i.seed_key=s.seed_key and i.member_id=mid where s.seed_key=sk;return jsonb_build_object('name',herb_name,'quantity',qty,'plot',p_slot_no,'unlocked_slot',next_slot);end $$;

create or replace function public.herb_garden_visit_v2(p_member_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare visitor uuid:=private.current_member_id();result jsonb;
begin if visitor is null or not private.is_approved() then raise exception 'Approved member required'; end if;if not exists(select 1 from public.club_members where id=p_member_id and status='approved' and login_enabled and not data_conflict) then raise exception 'Garden owner unavailable'; end if;perform private.ensure_herb_garden_plots_v3(p_member_id);perform private.herb_garden_sync_member_v3(p_member_id);select jsonb_build_object('owner',jsonb_build_object('id',m.id,'display_name',coalesce(m.herbal_alias,private.herbal_alias_for_name(m.full_name,m.id)),'full_name',m.full_name,'avatar_url',m.avatar_url),'theme',coalesce(pr.theme,'bamboo'),'decor',coalesce(pr.decor,'[]'::jsonb),'plots',coalesce((select jsonb_agg(jsonb_build_object('slot_no',g.slot_no,'unlocked',g.unlocked,'harvest_count',g.harvest_count,'plant',case when p.id is null then null else jsonb_build_object('id',p.id,'status',p.status,'planted_at',p.planted_at,'matures_at',p.matures_at,'water_count',p.water_count,'fertilizer_count',p.fertilizer_count,'can_water',p.status='growing' and now()<p.matures_at and p.last_water_slot<floor(extract(epoch from(now()-p.planted_at))/21600)::integer,'can_fertilize',p.status='growing' and now()<p.matures_at and p.last_fertilizer_day<floor(extract(epoch from(now()-p.planted_at))/86400)::integer,'name',case when now()>=p.matures_at or p.status in('mature','dead','harvested') then s.name end,'visual_variant',case when now()>=p.matures_at or p.status in('mature','dead','harvested') then s.visual_variant end) end) order by g.slot_no) from public.herb_garden_plots g left join lateral(select x.* from public.herb_garden_plants x where x.member_id=p_member_id and x.slot_no=g.slot_no and x.status in('growing','mature') and x.harvested_at is null and x.died_at is null order by x.planted_at desc limit 1)p on true left join private.herb_garden_species s on s.seed_key=p.seed_key where g.member_id=p_member_id),'[]'::jsonb)) into result from public.club_members m left join public.herb_garden_profiles pr on pr.member_id=m.id where m.id=p_member_id;return result;end $$;

create or replace function public.herb_garden_help_v2(p_owner_id uuid,p_slot_no smallint,p_kind text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare helper uuid:=private.current_member_id();pid uuid;planted timestamptz;mature timestamptz;last_slot int;last_day int;idx int;helper_name text;
begin if helper is null or not private.is_approved() then raise exception 'Approved member required'; end if;if p_owner_id is null or p_owner_id=helper then raise exception 'Hãy chăm sóc ở vườn của bạn'; end if;if p_slot_no not between 1 and 9 or p_kind not in('water','fertilize') then raise exception 'Invalid care action'; end if;if (select count(*) from public.herb_garden_events where member_id=helper and event_type like 'assist_%' and created_at>now()-interval '1 day')>=8 then raise exception 'Bạn đã đạt giới hạn 8 lượt hỗ trợ trong 24 giờ.'; end if;perform private.herb_garden_sync_member_v3(p_owner_id);select id,planted_at,matures_at,last_water_slot,last_fertilizer_day into pid,planted,mature,last_slot,last_day from public.herb_garden_plants where member_id=p_owner_id and slot_no=p_slot_no and status='growing' and harvested_at is null and died_at is null order by planted_at desc limit 1 for update;if pid is null or now()>=mature then raise exception 'Ô này hiện không có cây cần chăm sóc.'; end if;if p_kind='water' then idx:=floor(extract(epoch from(now()-planted))/21600)::integer;if idx<0 or idx>11 or last_slot>=idx then raise exception 'Cây chưa đến lượt tưới.'; end if;update public.herb_garden_plants set last_watered_at=now(),last_water_slot=idx,water_count=least(12,water_count+1),last_cared_at=now(),care_count=care_count+1 where id=pid;insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata) values(pid,helper,'assist_water',idx,jsonb_build_object('owner_id',p_owner_id,'plot',p_slot_no));else idx:=floor(extract(epoch from(now()-planted))/86400)::integer;if idx<0 or idx>2 or last_day>=idx then raise exception 'Cây chưa đến lượt bón phân.'; end if;update public.herb_garden_plants set last_fertilized_at=now(),last_fertilizer_day=idx,fertilizer_count=least(3,fertilizer_count+1),last_cared_at=now(),care_count=care_count+1 where id=pid;insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata) values(pid,helper,'assist_fertilize',idx,jsonb_build_object('owner_id',p_owner_id,'plot',p_slot_no));end if;select full_name into helper_name from public.club_members where id=helper;insert into public.notifications(member_id,actor_member_id,kind,title,body) values(p_owner_id,helper,'garden_help','Có bạn ghé Gia Viên',coalesce(helper_name,'Một thành viên')||case when p_kind='water' then ' đã giúp tưới ô ' else ' đã giúp bón phân ô ' end||p_slot_no||'.');return public.herb_garden_visit_v2(p_owner_id);end $$;

create or replace function public.herb_garden_directory_v2(p_query text default '',p_limit integer default 30)
returns table(member_id uuid,display_name text,full_name text,avatar_url text,theme text,decor jsonb,active_plots integer,unlocked_plots integer)
language sql security definer set search_path to '' as $$with me as(select private.current_member_id() mid),c as(select m.id,m.full_name,coalesce(m.herbal_alias,private.herbal_alias_for_name(m.full_name,m.id)) alias,m.avatar_url,coalesce(g.theme,'bamboo') theme,coalesce(g.decor,'[]'::jsonb) decor from public.club_members m left join public.herb_garden_profiles g on g.member_id=m.id cross join me where me.mid is not null and private.is_approved() and m.status='approved' and m.login_enabled and not m.data_conflict and m.id<>me.mid and (btrim(coalesce(p_query,''))='' or m.full_name ilike '%'||btrim(p_query)||'%' or coalesce(m.herbal_alias,'') ilike '%'||btrim(p_query)||'%') order by m.full_name limit least(greatest(coalesce(p_limit,30),1),50)) select c.id,c.alias,c.full_name,c.avatar_url,c.theme,c.decor,coalesce((select count(*)::integer from public.herb_garden_plants p where p.member_id=c.id and p.status in('growing','mature') and p.harvested_at is null and p.died_at is null),0),coalesce((select count(*)::integer from public.herb_garden_plots gp where gp.member_id=c.id and gp.unlocked),0) from c$$;

create or replace function private.herb_garden_maintenance_v3()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r record;v_slot integer;v_day integer;v_event uuid;n_water integer:=0;n_fertilizer integer:=0;n_processed integer:=0;
begin for r in select id from public.herb_garden_plants where status in('growing','mature') and harvested_at is null and died_at is null loop perform private.herb_garden_sync_plant_v3(r.id);end loop;for r in select id,member_id,slot_no,planted_at,matures_at,last_water_slot,last_fertilizer_day from public.herb_garden_plants where status='growing' and harvested_at is null and died_at is null and now()<matures_at loop n_processed:=n_processed+1;v_slot:=floor(extract(epoch from(now()-r.planted_at))/21600)::integer;if v_slot between 0 and 11 and r.last_water_slot<v_slot then v_event:=null;insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata) values(r.id,r.member_id,'reminder_water',v_slot,jsonb_build_object('plot',r.slot_no)) on conflict do nothing returning id into v_event;if v_event is not null then insert into public.notifications(member_id,kind,title,body) values(r.member_id,'herb_garden_water_due','Đến giờ tưới ô '||r.slot_no,'Ô '||r.slot_no||' đang ở chu kỳ tưới '||(v_slot+1)||'/12.');n_water:=n_water+1;end if;end if;v_day:=floor(extract(epoch from(now()-r.planted_at))/86400)::integer;if v_day between 0 and 2 and r.last_fertilizer_day<v_day then v_event:=null;insert into public.herb_garden_events(plant_id,member_id,event_type,slot_no,metadata) values(r.id,r.member_id,'reminder_fertilizer',v_day,jsonb_build_object('plot',r.slot_no)) on conflict do nothing returning id into v_event;if v_event is not null then insert into public.notifications(member_id,kind,title,body) values(r.member_id,'herb_garden_fertilizer_due','Nhắc bón phân ô '||r.slot_no,'Ô '||r.slot_no||' cần 1 lần bón phân trong ngày sinh trưởng '||(v_day+1)||'/3.');n_fertilizer:=n_fertilizer+1;end if;end if;end loop;return jsonb_build_object('processed_plants',n_processed,'water_reminders',n_water,'fertilizer_reminders',n_fertilizer,'ran_at',now());end $$;

do $$ declare jid bigint;begin select jobid into jid from cron.job where jobname='yhct-herb-garden-maintenance-v2';if jid is not null then perform cron.unschedule(jid);end if;select jobid into jid from cron.job where jobname='yhct-herb-garden-maintenance-v3';if jid is not null then perform cron.unschedule(jid);end if;perform cron.schedule('yhct-herb-garden-maintenance-v3','7 * * * *','select private.herb_garden_maintenance_v3();');end $$;

create or replace function private.tcm_news_retention_v2()
returns jsonb language plpgsql security definer set search_path to '' as $$declare deleted_n integer;begin delete from public.tcm_news_items where coalesce(published_at,created_at)<now()-interval '2 days';get diagnostics deleted_n=row_count;if deleted_n>0 then perform private.audit_event('news.retention_v2','tcm_news_items',null,'info',jsonb_build_object('deleted',deleted_n,'cutoff',now()-interval '2 days'));end if;return jsonb_build_object('deleted',deleted_n,'retention_hours',48,'ran_at',now());end $$;
create or replace function public.tcm_news_feed_v1(p_limit integer default 30)
returns table(id uuid,title text,canonical_url text,publisher text,publisher_domain text,published_at timestamptz,summary text,tags text[],trust_score numeric,ai_provider text)
language sql stable security definer set search_path to 'public','pg_catalog' as $$select n.id,n.title,n.canonical_url,n.publisher,n.publisher_domain,n.published_at,n.summary,n.tags,n.trust_score,n.ai_provider from public.tcm_news_items n where n.status='published' and coalesce(n.published_at,n.created_at)>=now()-interval '2 days' order by n.is_pinned desc,coalesce(n.published_at,n.created_at) desc limit greatest(1,least(coalesce(p_limit,30),100))$$;
create or replace function public.tcm_news_admin_list_v1(p_limit integer default 5)
returns jsonb language plpgsql stable security definer set search_path to 'public','private','pg_catalog' as $$declare v_result jsonb;begin if not private.has_min_role('super_mod') then raise exception 'Super Mod role required';end if;select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'summary',x.summary,'publisher',x.publisher,'published_at',x.published_at,'status',x.status,'trust_score',x.trust_score,'is_pinned',x.is_pinned,'canonical_url',x.canonical_url) order by case x.status when 'pending' then 0 when 'published' then 1 else 2 end,x.is_pinned desc,coalesce(x.published_at,x.created_at) desc),'[]'::jsonb) into v_result from (select * from public.tcm_news_items where coalesce(published_at,created_at)>=now()-interval '2 days' order by case status when 'pending' then 0 when 'published' then 1 else 2 end,is_pinned desc,coalesce(published_at,created_at) desc limit greatest(1,least(coalesce(p_limit,5),20))) x;return v_result;end $$;
do $$ declare jid bigint;begin select jobid into jid from cron.job where jobname='tcm-news-retention-hourly';if jid is not null then perform cron.unschedule(jid);end if;perform cron.schedule('tcm-news-retention-hourly','47 * * * *','select private.tcm_news_retention_v2();');end $$;
select private.tcm_news_retention_v2();

create or replace function private.augment_snapshot_modules_v6(p_snapshot_id uuid)
returns void language plpgsql security definer set search_path to 'public','private','extensions','pg_catalog' as $$declare p jsonb;counts jsonb;begin perform private.augment_snapshot_modules_v5(p_snapshot_id);select payload,row_counts into p,counts from private.app_snapshots where id=p_snapshot_id for update;if p is null then raise exception 'Snapshot not found';end if;p:=p||jsonb_build_object('schema_version',6,'herb_garden_plots',coalesce((select jsonb_agg(to_jsonb(x)) from public.herb_garden_plots x),'[]'::jsonb));counts:=counts||jsonb_build_object('herb_garden_plots',(select count(*) from public.herb_garden_plots));update private.app_snapshots set payload=p,row_counts=counts,checksum_sha256=encode(extensions.digest(p::text,'sha256'),'hex') where id=p_snapshot_id;end $$;
create or replace function private.create_managed_snapshot(p_created_by uuid default null) returns uuid language plpgsql security definer set search_path to 'private','pg_catalog' as $$declare rid uuid;begin rid:=private.create_operational_snapshot(case when p_created_by is null then 'daily_full_v2' else 'manual_full_v2' end,p_created_by);perform private.augment_snapshot_modules_v6(rid);return rid;end$$;
create or replace function private.daily_managed_snapshot() returns void language plpgsql security definer set search_path to 'private','pg_catalog' as $$declare rid uuid;begin rid:=private.create_operational_snapshot('daily_full_v2',null);perform private.augment_snapshot_modules_v6(rid);delete from private.app_snapshots where scope='daily_full_v2' and created_at<now()-interval '30 days';end$$;
create or replace function private.monthly_managed_snapshot() returns void language plpgsql security definer set search_path to 'private','pg_catalog' as $$declare rid uuid;begin rid:=private.create_operational_snapshot('monthly_full_v2',null);perform private.augment_snapshot_modules_v6(rid);delete from private.app_snapshots where scope='monthly_full_v2' and created_at<now()-interval '12 months';end$$;

revoke all on function public.herb_garden_select_initial_plots_v3(smallint[]) from public,anon;
revoke all on function public.herb_garden_state_v3() from public,anon;
revoke all on function public.herb_garden_plant_v3(smallint) from public,anon;
revoke all on function public.herb_garden_water_v3(smallint) from public,anon;
revoke all on function public.herb_garden_fertilize_v3(smallint) from public,anon;
revoke all on function public.herb_garden_harvest_v3(smallint) from public,anon;
revoke all on function public.herb_garden_visit_v2(uuid) from public,anon;
revoke all on function public.herb_garden_help_v2(uuid,smallint,text) from public,anon;
revoke all on function public.herb_garden_directory_v2(text,integer) from public,anon;
grant execute on function public.herb_garden_select_initial_plots_v3(smallint[]) to authenticated;
grant execute on function public.herb_garden_state_v3() to authenticated;
grant execute on function public.herb_garden_plant_v3(smallint) to authenticated;
grant execute on function public.herb_garden_water_v3(smallint) to authenticated;
grant execute on function public.herb_garden_fertilize_v3(smallint) to authenticated;
grant execute on function public.herb_garden_harvest_v3(smallint) to authenticated;
grant execute on function public.herb_garden_visit_v2(uuid) to authenticated;
grant execute on function public.herb_garden_help_v2(uuid,smallint,text) to authenticated;
grant execute on function public.herb_garden_directory_v2(text,integer) to authenticated;
