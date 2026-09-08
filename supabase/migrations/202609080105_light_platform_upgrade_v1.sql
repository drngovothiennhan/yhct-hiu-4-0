-- YHCT HIU 4.0 light platform upgrade v1
-- Backwards-compatible: moderation notifications, messaging, feedback, herb garden,
-- explainable admin ops, and snapshot augmentation for the new mutable modules.

create table if not exists public.member_messages (
  id uuid primary key default gen_random_uuid(),
  sender_member_id uuid not null references public.club_members(id) on delete cascade,
  recipient_member_id uuid not null references public.club_members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  kind text not null default 'direct' check (kind in ('direct','system')),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.member_messages enable row level security;
create index if not exists member_messages_recipient_created_idx on public.member_messages(recipient_member_id,created_at desc);
create index if not exists member_messages_sender_created_idx on public.member_messages(sender_member_id,created_at desc);
revoke all on public.member_messages from anon, authenticated;
grant select on public.member_messages to authenticated;
drop policy if exists member_messages_read_own on public.member_messages;
create policy member_messages_read_own on public.member_messages
for select to authenticated
using (sender_member_id=private.current_member_id() or recipient_member_id=private.current_member_id());

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='member_messages'
     ) then
    alter publication supabase_realtime add table public.member_messages;
  end if;
end $$;

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_member_id uuid not null references public.club_members(id) on delete cascade,
  kind text not null check (kind in ('bug','suggestion','other')),
  body text not null check (char_length(body) between 4 and 3000),
  context jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.club_members(id)
);
alter table public.feedback_reports enable row level security;
create index if not exists feedback_reports_status_created_idx on public.feedback_reports(status,created_at desc);
revoke all on public.feedback_reports from public, anon, authenticated;

create table if not exists private.herb_garden_species (
  seed_key text primary key,
  name text not null,
  botanical_name text not null,
  category text not null,
  traditional_actions text not null,
  caution text not null
);
revoke all on private.herb_garden_species from public, anon, authenticated;
insert into private.herb_garden_species(seed_key,name,botanical_name,category,traditional_actions,caution) values
 ('hoang-ky','Hoàng kỳ','Astragalus membranaceus','Bổ khí','Bổ khí thăng dương, ích vệ cố biểu, lợi thủy, sinh cơ theo lý luận YHCT.','Nội dung học thuật; không thay thế chỉ định. Cần rà soát bệnh tự miễn, thuốc ức chế miễn dịch và bệnh nền trước sử dụng.'),
 ('cam-thao','Cam thảo','Glycyrrhiza uralensis','Bổ khí / điều hòa','Bổ Tỳ ích khí, nhuận Phế, thanh nhiệt giải độc, điều hòa phương theo lý luận YHCT.','Dùng kéo dài/liều cao có thể gây giữ natri, hạ kali hoặc tăng huyết áp; cần kiểm tra tương tác thuốc.'),
 ('sinh-khuong','Sinh khương','Zingiber officinale','Tân ôn giải biểu','Phát hãn giải biểu, ôn trung chỉ ẩu, ôn Phế chỉ khái theo lý luận YHCT.','Nội dung học tập; thận trọng khi có nguy cơ chảy máu hoặc đang dùng thuốc chống đông.'),
 ('bach-thuat','Bạch truật','Atractylodes macrocephala','Bổ khí / kiện Tỳ','Kiện Tỳ ích khí, táo thấp lợi thủy, chỉ hãn theo lý luận YHCT.','Không áp dụng máy móc khi âm hư táo nhiệt; cần đánh giá thể trạng và thuốc dùng kèm.'),
 ('phuc-linh','Phục linh','Poria cocos','Lợi thủy thẩm thấp','Lợi thủy thẩm thấp, kiện Tỳ, an thần theo lý luận YHCT.','Thông tin giáo dục; người có bệnh nền liên quan dịch/điện giải cần được đánh giá chuyên môn.'),
 ('tran-bi','Trần bì','Citrus reticulata pericarpium','Lý khí','Lý khí kiện Tỳ, táo thấp hóa đàm theo lý luận YHCT.','Thông tin học tập; cần phân biệt dược liệu đúng chuẩn và rà soát thuốc dùng kèm.')
on conflict(seed_key) do update set
 name=excluded.name,botanical_name=excluded.botanical_name,category=excluded.category,
 traditional_actions=excluded.traditional_actions,caution=excluded.caution;

create table if not exists public.herb_garden_plants (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  seed_key text not null references private.herb_garden_species(seed_key),
  planted_at timestamptz not null default now(),
  matures_at timestamptz not null,
  last_cared_at timestamptz,
  care_count integer not null default 0 check (care_count>=0),
  harvested_at timestamptz
);
alter table public.herb_garden_plants enable row level security;
create unique index if not exists herb_garden_one_active_idx on public.herb_garden_plants(member_id) where harvested_at is null;
create index if not exists herb_garden_plants_member_created_idx on public.herb_garden_plants(member_id,planted_at desc);
revoke all on public.herb_garden_plants from public, anon, authenticated;

create table if not exists public.herb_garden_inventory (
  member_id uuid not null references public.club_members(id) on delete cascade,
  seed_key text not null references private.herb_garden_species(seed_key),
  quantity integer not null default 0 check (quantity>=0),
  updated_at timestamptz not null default now(),
  primary key(member_id,seed_key)
);
alter table public.herb_garden_inventory enable row level security;
revoke all on public.herb_garden_inventory from public, anon, authenticated;

create or replace function public.message_recipients_v1(p_query text default '',p_limit integer default 30)
returns table(id uuid,full_name text,position_title text,role public.app_role)
language sql
security definer
set search_path=''
as $$
  select m.id,m.full_name,coalesce(m.position_title,'Hội viên'),m.role
  from public.club_members m
  where private.current_member_id() is not null
    and private.is_approved()
    and m.status='approved' and m.login_enabled and not m.data_conflict
    and m.id<>private.current_member_id()
    and (btrim(coalesce(p_query,''))='' or m.full_name ilike '%'||btrim(p_query)||'%' or coalesce(m.student_code,'') ilike '%'||btrim(p_query)||'%')
  order by private.role_level(m.role) desc,m.full_name
  limit least(greatest(coalesce(p_limit,30),1),50)
$$;
revoke all on function public.message_recipients_v1(text,integer) from public,anon;
grant execute on function public.message_recipients_v1(text,integer) to authenticated;

create or replace function public.messages_inbox_v1(p_limit integer default 80)
returns table(id uuid,direction text,counterpart_id uuid,counterpart_name text,counterpart_title text,body text,kind text,metadata jsonb,read_at timestamptz,created_at timestamptz)
language sql
security definer
set search_path=''
as $$
  with me as (select private.current_member_id() id)
  select x.id,
    case when x.sender_member_id=me.id then 'sent' else 'received' end,
    case when x.sender_member_id=me.id then x.recipient_member_id else x.sender_member_id end,
    c.full_name,coalesce(c.position_title,'Hội viên'),x.body,x.kind,x.metadata,x.read_at,x.created_at
  from public.member_messages x
  cross join me
  join public.club_members c on c.id=case when x.sender_member_id=me.id then x.recipient_member_id else x.sender_member_id end
  where me.id is not null and private.is_approved()
    and (x.sender_member_id=me.id or x.recipient_member_id=me.id)
  order by x.created_at desc
  limit least(greatest(coalesce(p_limit,80),1),150)
$$;
revoke all on function public.messages_inbox_v1(integer) from public,anon;
grant execute on function public.messages_inbox_v1(integer) to authenticated;

create or replace function public.messages_send_v1(p_recipient_id uuid,p_body text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id(); rid uuid; txt text:=btrim(coalesce(p_body,'')); sender_name text;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_recipient_id is null or p_recipient_id=mid then raise exception 'Recipient is invalid'; end if;
  if char_length(txt)<1 or char_length(txt)>2000 then raise exception 'Message must contain 1 to 2000 characters'; end if;
  if not exists(select 1 from public.club_members where id=p_recipient_id and status='approved' and login_enabled and not data_conflict) then raise exception 'Recipient is unavailable'; end if;
  if (select count(*) from public.member_messages where sender_member_id=mid and created_at>now()-interval '1 minute')>=20 then raise exception 'Bạn gửi tin quá nhanh. Vui lòng thử lại sau.'; end if;
  select full_name into sender_name from public.club_members where id=mid;
  insert into public.member_messages(sender_member_id,recipient_member_id,body) values(mid,p_recipient_id,txt) returning id into rid;
  insert into public.notifications(member_id,actor_member_id,kind,title,body)
    values(p_recipient_id,mid,'message_received','Tin nhắn mới từ '||coalesce(sender_name,'Thành viên'),left(txt,220));
  perform private.audit_event('message.send','member_message',rid::text,'info',jsonb_build_object('recipient_id',p_recipient_id));
  return rid;
end $$;
revoke all on function public.messages_send_v1(uuid,text) from public,anon;
grant execute on function public.messages_send_v1(uuid,text) to authenticated;

create or replace function public.messages_mark_read_v1(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id();
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  update public.member_messages set read_at=coalesce(read_at,now()) where id=p_message_id and recipient_member_id=mid;
  return found;
end $$;
revoke all on function public.messages_mark_read_v1(uuid) from public,anon;
grant execute on function public.messages_mark_read_v1(uuid) to authenticated;

create or replace function public.feedback_submit_v1(p_kind text,p_body text,p_context jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); rid uuid; txt text:=btrim(coalesce(p_body,'')); ctx jsonb:=coalesce(p_context,'{}'::jsonb); reporter text;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if p_kind not in ('bug','suggestion','other') then raise exception 'Feedback type is invalid'; end if;
  if char_length(txt)<4 or char_length(txt)>3000 then raise exception 'Nội dung phải từ 4 đến 3000 ký tự'; end if;
  if octet_length(ctx::text)>8000 then ctx:='{}'::jsonb; end if;
  if (select count(*) from public.feedback_reports where reporter_member_id=mid and created_at>now()-interval '10 minutes')>=5 then raise exception 'Bạn gửi góp ý quá nhanh. Vui lòng thử lại sau.'; end if;
  insert into public.feedback_reports(reporter_member_id,kind,body,context) values(mid,p_kind,txt,ctx) returning id into rid;
  select full_name into reporter from public.club_members where id=mid;
  insert into public.notifications(member_id,actor_member_id,kind,title,body)
  select m.id,mid,'feedback_received','A.I Mini nhận '||case p_kind when 'bug' then 'báo lỗi' when 'suggestion' then 'góp ý' else 'phản hồi' end,
         coalesce(reporter,'Thành viên')||': '||left(txt,180)
  from public.club_members m where m.role='admin' and m.status='approved' and m.login_enabled and not m.data_conflict;
  perform private.audit_event('feedback.submit','feedback_report',rid::text,'info',jsonb_build_object('kind',p_kind));
  return rid;
end $$;
revoke all on function public.feedback_submit_v1(text,text,jsonb) from public,anon;
grant execute on function public.feedback_submit_v1(text,text,jsonb) to authenticated;

create or replace function public.feedback_admin_list_v1(p_limit integer default 60)
returns table(id uuid,reporter_name text,reporter_student_code text,kind text,body text,context jsonb,status text,created_at timestamptz)
language sql
security definer
set search_path=''
as $$
  select f.id,m.full_name,coalesce(m.student_code,''),f.kind,f.body,f.context,f.status,f.created_at
  from public.feedback_reports f join public.club_members m on m.id=f.reporter_member_id
  where private.has_min_role('admin')
  order by case f.status when 'open' then 0 when 'reviewing' then 1 else 2 end,f.created_at desc
  limit least(greatest(coalesce(p_limit,60),1),150)
$$;
revoke all on function public.feedback_admin_list_v1(integer) from public,anon;
grant execute on function public.feedback_admin_list_v1(integer) to authenticated;

create or replace function public.feedback_admin_resolve_v1(p_id uuid,p_status text default 'resolved')
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); reporter_id uuid; txt text;
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  if p_status not in ('reviewing','resolved') then raise exception 'Invalid feedback status'; end if;
  update public.feedback_reports set status=p_status,resolved_at=case when p_status='resolved' then now() else null end,resolved_by=case when p_status='resolved' then mid else null end
   where id=p_id returning reporter_member_id,body into reporter_id,txt;
  if not found then return false; end if;
  if p_status='resolved' then
    insert into public.notifications(member_id,actor_member_id,kind,title,body)
      values(reporter_id,mid,'feedback_resolved','Góp ý của bạn đã được xử lý',left(txt,180));
  end if;
  perform private.audit_event('feedback.admin.'||p_status,'feedback_report',p_id::text,'info','{}'::jsonb);
  return true;
end $$;
revoke all on function public.feedback_admin_resolve_v1(uuid,text) from public,anon;
grant execute on function public.feedback_admin_resolve_v1(uuid,text) to authenticated;

create or replace function public.herb_garden_state_v1()
returns table(id uuid,planted_at timestamptz,matures_at timestamptz,last_cared_at timestamptz,care_count integer,ready boolean,name text,botanical_name text,category text,traditional_actions text,caution text)
language sql
security definer
set search_path=''
as $$
  select p.id,p.planted_at,p.matures_at,p.last_cared_at,p.care_count,now()>=p.matures_at,
    case when now()>=p.matures_at then s.name end,
    case when now()>=p.matures_at then s.botanical_name end,
    case when now()>=p.matures_at then s.category end,
    case when now()>=p.matures_at then s.traditional_actions end,
    case when now()>=p.matures_at then s.caution end
  from public.herb_garden_plants p join private.herb_garden_species s on s.seed_key=p.seed_key
  where private.is_approved() and p.member_id=private.current_member_id() and p.harvested_at is null
  order by p.planted_at desc limit 1
$$;
revoke all on function public.herb_garden_state_v1() from public,anon;
grant execute on function public.herb_garden_state_v1() to authenticated;

create or replace function public.herb_garden_plant_v1()
returns table(id uuid,planted_at timestamptz,matures_at timestamptz,last_cared_at timestamptz,care_count integer,ready boolean,name text,botanical_name text,category text,traditional_actions text,caution text)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); sk text;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if exists(select 1 from public.herb_garden_plants where member_id=mid and harvested_at is null) then raise exception 'Bạn đang có một cây trong vườn. Hãy chăm sóc hoặc thu hoạch trước khi gieo hạt mới.'; end if;
  select seed_key into sk from private.herb_garden_species order by random() limit 1;
  if sk is null then raise exception 'Seed catalog unavailable'; end if;
  insert into public.herb_garden_plants(member_id,seed_key,matures_at) values(mid,sk,now()+interval '3 days');
  perform private.audit_event('herb_garden.plant','member',mid::text,'info','{}'::jsonb);
  return query select * from public.herb_garden_state_v1();
end $$;
revoke all on function public.herb_garden_plant_v1() from public,anon;
grant execute on function public.herb_garden_plant_v1() to authenticated;

create or replace function public.herb_garden_care_v1()
returns table(id uuid,planted_at timestamptz,matures_at timestamptz,last_cared_at timestamptz,care_count integer,ready boolean,name text,botanical_name text,category text,traditional_actions text,caution text)
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); pid uuid; last_at timestamptz;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  select id,last_cared_at into pid,last_at from public.herb_garden_plants where member_id=mid and harvested_at is null order by planted_at desc limit 1 for update;
  if pid is null then raise exception 'Bạn chưa gieo hạt.'; end if;
  if last_at is not null and last_at>now()-interval '6 hours' then raise exception 'Cây vừa được chăm sóc. Hãy quay lại sau.'; end if;
  update public.herb_garden_plants set last_cared_at=now(),care_count=care_count+1 where id=pid;
  return query select * from public.herb_garden_state_v1();
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
  select id,seed_key,matures_at into pid,sk,mature from public.herb_garden_plants where member_id=mid and harvested_at is null order by planted_at desc limit 1 for update;
  if pid is null then raise exception 'Bạn chưa có cây để thu hoạch.'; end if;
  if now()<mature then raise exception 'Cây chưa trưởng thành.'; end if;
  update public.herb_garden_plants set harvested_at=now() where id=pid;
  insert into public.herb_garden_inventory(member_id,seed_key,quantity,updated_at) values(mid,sk,1,now())
    on conflict(member_id,seed_key) do update set quantity=public.herb_garden_inventory.quantity+1,updated_at=now();
  perform private.audit_event('herb_garden.harvest','member',mid::text,'info',jsonb_build_object('seed_key',sk));
  return query select s.name,s.botanical_name,s.category,s.traditional_actions,s.caution,i.quantity
    from private.herb_garden_species s join public.herb_garden_inventory i on i.seed_key=s.seed_key and i.member_id=mid where s.seed_key=sk;
end $$;
revoke all on function public.herb_garden_harvest_v1() from public,anon;
grant execute on function public.herb_garden_harvest_v1() to authenticated;

create or replace function public.herb_garden_inventory_v1()
returns table(name text,botanical_name text,category text,traditional_actions text,caution text,quantity integer,updated_at timestamptz)
language sql
security definer
set search_path=''
as $$
  select s.name,s.botanical_name,s.category,s.traditional_actions,s.caution,i.quantity,i.updated_at
  from public.herb_garden_inventory i join private.herb_garden_species s on s.seed_key=i.seed_key
  where private.is_approved() and i.member_id=private.current_member_id() and i.quantity>0
  order by i.updated_at desc
$$;
revoke all on function public.herb_garden_inventory_v1() from public,anon;
grant execute on function public.herb_garden_inventory_v1() to authenticated;

create or replace function public.admin_run_retention_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  result:=private.daily_retention_maintenance();
  perform private.audit_event('acc.retention.run','system',null,'warning',result);
  return result;
end $$;
revoke all on function public.admin_run_retention_v1() from public,anon;
grant execute on function public.admin_run_retention_v1() to authenticated;

create or replace function public.admin_ops_status_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare d timestamptz; m timestamptz;
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  select max(created_at) into d from private.app_snapshots where scope='daily_full_v2';
  select max(created_at) into m from private.app_snapshots where scope='monthly_full_v2';
  return jsonb_build_object(
    'pendingModeration',(select count(*) from public.clinical_posts where moderation_status='pending'),
    'openFeedback',(select count(*) from public.feedback_reports where status<>'resolved'),
    'recentErrors',(select count(*) from public.system_audit_logs where severity in ('error','critical') and created_at>now()-interval '24 hours'),
    'recentWarnings',(select count(*) from public.system_audit_logs where severity='warning' and created_at>now()-interval '24 hours'),
    'lastDailySnapshotAt',d,
    'lastMonthlySnapshotAt',m,
    'serverTime',now()
  );
end $$;
revoke all on function public.admin_ops_status_v1() from public,anon;
grant execute on function public.admin_ops_status_v1() to authenticated;

-- Fix submit -> pending -> notification -> moderator queue contract.
create or replace function public.create_academic_post(p_draft jsonb,p_academic_score numeric default 0)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_member uuid; v_id uuid; v_title text; v_citations jsonb; v_author_name text;
begin
  v_member:=private.current_member_id();
  if v_member is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  v_title:=btrim(coalesce(p_draft->>'title',''));
  if length(v_title)<5 or length(v_title)>300 then raise exception 'Title must contain 5 to 300 characters'; end if;
  v_citations:=private.safe_citations(p_draft->'citations');
  if not private.has_meaningful_citations(v_citations) then raise exception 'Nguồn trích dẫn/Tài liệu tham khảo hợp lệ là bắt buộc'; end if;
  insert into public.clinical_posts(author_id,title,abstract,chief_complaint,four_exams,eight_principles,syndrome,treatment_principle,formula,acupoints,tags,citations,privacy_scrubbed,academic_score_cached,moderation_status,post_type,specialty,visibility,media,citation_verified)
  values(v_member,v_title,nullif(private.scrub_clinical_text(left(coalesce(p_draft->>'abstract',''),8000)),''),private.scrub_clinical_text(left(coalesce(p_draft->>'chief_complaint',''),8000)),jsonb_build_object('vong',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,vong}',''),5000)),'van',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,van}',''),5000)),'van_hoi',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,van_hoi}',''),5000)),'thiet',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,thiet}',''),5000))),private.safe_jsonb_text_array(p_draft->'eight_principles',8),private.scrub_clinical_text(left(coalesce(p_draft->>'syndrome',''),3000)),private.scrub_clinical_text(left(coalesce(p_draft->>'treatment_principle',''),3000)),private.scrub_clinical_text(left(coalesce(p_draft->>'formula',''),8000)),private.safe_jsonb_text_array(p_draft->'acupoints',50),private.safe_jsonb_text_array(p_draft->'tags',20),v_citations,true,greatest(0,least(120,coalesce(p_academic_score,0))),'pending',coalesce(nullif(p_draft->>'post_type',''),'research'),coalesce(nullif(p_draft->>'specialty',''),'general'),coalesce(nullif(p_draft->>'visibility',''),'public'),coalesce(p_draft->'media','[]'::jsonb),false)
  returning id into v_id;
  select full_name into v_author_name from public.club_members where id=v_member;
  insert into public.notifications(member_id,actor_member_id,kind,post_id,title,body)
    values(v_member,v_member,'academic_post_submitted',v_id,'Đã gửi bài chờ kiểm duyệt','“'||v_title||'” đã được lưu và chuyển tới hàng đợi MOD/Admin.');
  insert into public.notifications(member_id,actor_member_id,kind,post_id,title,body)
  select m.id,v_member,'academic_post_review',v_id,'Bài học thuật mới chờ duyệt',coalesce(v_author_name,'Thành viên')||' · '||v_title
  from public.club_members m
  where m.status='approved' and m.login_enabled and not m.data_conflict
    and private.role_level(m.role)>=private.role_level('mod');
  perform private.audit_event('academic.post.submit','clinical_post',v_id::text,'info',jsonb_build_object('status','pending','moderator_notified',true));
  return v_id;
end $$;

create or replace function public.moderate_academic_post_v1(p_post_id uuid,p_action text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare mid uuid:=private.current_member_id(); v_author uuid; v_title text; notify_title text; notify_body text;
begin
  if not private.has_min_role('mod') then raise exception 'Mod role required'; end if;
  if p_action not in ('approved','rejected','quarantined','pending') then raise exception 'Invalid moderation action'; end if;
  select author_id,title into v_author,v_title from public.clinical_posts where id=p_post_id;
  if not found then return false; end if;
  update public.clinical_posts set moderation_status=p_action,
    approved_at=case when p_action='approved' then now() else null end,
    approved_by=case when p_action='approved' then mid else null end,
    citation_verified=case when p_action='approved' then private.has_meaningful_citations(citations) else false end,
    mod_verified_at=case when p_action='approved' then now() else null end,
    mod_verified_by=case when p_action='approved' then mid else null end,
    updated_at=now()
  where id=p_post_id;
  notify_title:=case p_action when 'approved' then 'Bài học thuật đã được duyệt' when 'rejected' then 'Bài học thuật chưa được duyệt' when 'quarantined' then 'Bài học thuật đang được kiểm tra' else 'Bài học thuật trở lại hàng đợi' end;
  notify_body:='“'||v_title||'” · trạng thái: '||p_action;
  insert into public.notifications(member_id,actor_member_id,kind,post_id,title,body)
    values(v_author,mid,'academic_post_moderated',p_post_id,notify_title,notify_body);
  perform private.audit_event('academic.post.moderate','clinical_post',p_post_id::text,'info',jsonb_build_object('status',p_action,'author_notified',true));
  return true;
end $$;

-- Add the new mutable modules to every new managed snapshot without rewriting the stable v2 base builder.
create or replace function private.augment_snapshot_modules_v3(p_snapshot_id uuid)
returns void
language plpgsql
security definer
set search_path='public','private','extensions','pg_catalog'
as $$
declare p jsonb; counts jsonb;
begin
  select payload,row_counts into p,counts from private.app_snapshots where id=p_snapshot_id for update;
  if p is null then raise exception 'Snapshot not found'; end if;
  p:=p||jsonb_build_object(
    'schema_version',3,
    'member_messages',coalesce((select jsonb_agg(to_jsonb(x)) from public.member_messages x),'[]'::jsonb),
    'feedback_reports',coalesce((select jsonb_agg(to_jsonb(x)) from public.feedback_reports x),'[]'::jsonb),
    'herb_garden_plants',coalesce((select jsonb_agg(to_jsonb(x)) from public.herb_garden_plants x),'[]'::jsonb),
    'herb_garden_inventory',coalesce((select jsonb_agg(to_jsonb(x)) from public.herb_garden_inventory x),'[]'::jsonb)
  );
  counts:=counts||jsonb_build_object(
    'member_messages',(select count(*) from public.member_messages),
    'feedback_reports',(select count(*) from public.feedback_reports),
    'herb_garden_plants',(select count(*) from public.herb_garden_plants),
    'herb_garden_inventory',(select count(*) from public.herb_garden_inventory)
  );
  update private.app_snapshots set payload=p,row_counts=counts,checksum_sha256=encode(extensions.digest(p::text,'sha256'),'hex') where id=p_snapshot_id;
end $$;
revoke all on function private.augment_snapshot_modules_v3(uuid) from public,anon,authenticated;

create or replace function private.create_managed_snapshot(p_created_by uuid default null)
returns uuid
language plpgsql
security definer
set search_path='private','pg_catalog'
as $$
declare rid uuid;
begin
  rid:=private.create_operational_snapshot(case when p_created_by is null then 'daily_full_v2' else 'manual_full_v2' end,p_created_by);
  perform private.augment_snapshot_modules_v3(rid);
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
  perform private.augment_snapshot_modules_v3(rid);
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
  perform private.augment_snapshot_modules_v3(rid);
  delete from private.app_snapshots where scope='monthly_full_v2' and created_at<now()-interval '12 months';
end $$;
