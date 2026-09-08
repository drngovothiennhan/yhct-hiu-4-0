-- Applied to production Supabase 2026-09-08. Keep this file as the source-of-truth migration.

create or replace function public.herb_garden_water_v4(p_slot_no integer)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_state jsonb; v_message text;
begin
  begin
    perform public.herb_garden_water_v3(p_slot_no);
    v_state:=public.herb_garden_state_v3();
    return jsonb_build_object('ok',true,'watered',true,'reason','watered','state',v_state);
  exception when others then
    get stacked diagnostics v_message=message_text;
    if position('Chu kỳ 6 giờ này đã được tưới' in coalesce(v_message,''))>0 then
      v_state:=public.herb_garden_state_v3();
      return jsonb_build_object('ok',true,'watered',false,'reason','already_watered','message','Chu kỳ 6 giờ hiện tại đã được tưới.','state',v_state);
    end if;
    raise;
  end;
end $function$;
revoke all on function public.herb_garden_water_v4(integer) from public,anon;
grant execute on function public.herb_garden_water_v4(integer) to authenticated;

create or replace function public.herb_garden_ai_status_v1()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_state jsonb;
begin
  if private.current_member_id() is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  v_state:=public.herb_garden_state_v3();
  return jsonb_build_object('serverTime',now(),'plants',coalesce(v_state->'plants','[]'::jsonb),'plots',coalesce(v_state->'plots','[]'::jsonb),'summary',jsonb_build_object('growing',coalesce(jsonb_array_length(coalesce(v_state->'plants','[]'::jsonb)),0)));
end $function$;
revoke all on function public.herb_garden_ai_status_v1() from public,anon;
grant execute on function public.herb_garden_ai_status_v1() to authenticated;

create table if not exists public.ai_assistant_reminders(
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.club_members(id) on delete cascade,
 kind text not null check(kind in('garden_water','general')),due_at timestamptz not null,payload jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check(status in('pending','delivered','cancelled')),created_at timestamptz not null default now(),delivered_at timestamptz);
create index if not exists ai_assistant_reminders_due_idx on public.ai_assistant_reminders(status,due_at) where status='pending';
alter table public.ai_assistant_reminders enable row level security;

create or replace function public.ai_assistant_reminder_create_v1(p_kind text,p_due_at timestamptz,p_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_member uuid;v_id uuid;v_kind text:=lower(btrim(coalesce(p_kind,'')));
begin
 v_member:=private.current_member_id(); if v_member is null or not private.is_approved() then raise exception 'Approved member required'; end if;
 if v_kind not in('garden_water','general') then raise exception 'Unsupported reminder kind'; end if;
 if p_due_at is null or p_due_at<now()+interval '1 minute' or p_due_at>now()+interval '30 days' then raise exception 'Reminder time must be between 1 minute and 30 days from now'; end if;
 insert into public.ai_assistant_reminders(member_id,kind,due_at,payload) values(v_member,v_kind,p_due_at,coalesce(p_payload,'{}'::jsonb)) returning id into v_id;return v_id;
end $function$;
revoke all on function public.ai_assistant_reminder_create_v1(text,timestamptz,jsonb) from public,anon;
grant execute on function public.ai_assistant_reminder_create_v1(text,timestamptz,jsonb) to authenticated;

create or replace function public.ai_assistant_reminders_v1(p_limit integer default 10)
returns table(id uuid,kind text,due_at timestamptz,payload jsonb,status text,created_at timestamptz)
language plpgsql security definer set search_path=''
as $function$
declare v_member uuid;
begin
 v_member:=private.current_member_id();if v_member is null or not private.is_approved() then raise exception 'Approved member required';end if;
 return query select r.id,r.kind,r.due_at,r.payload,r.status,r.created_at from public.ai_assistant_reminders r where r.member_id=v_member order by r.due_at asc limit least(greatest(coalesce(p_limit,10),1),30);
end $function$;
revoke all on function public.ai_assistant_reminders_v1(integer) from public,anon;
grant execute on function public.ai_assistant_reminders_v1(integer) to authenticated;

create or replace function private.ai_assistant_deliver_reminders_v1()
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_count integer:=0;
begin
 with due as(select r.id,r.member_id,r.kind,r.payload from public.ai_assistant_reminders r where r.status='pending' and r.due_at<=now() order by r.due_at for update skip locked limit 100),
 ins as(insert into public.notifications(member_id,actor_member_id,kind,title,body)
 select d.member_id,null,'ai_assistant_reminder',case when d.kind='garden_water' then 'A.I Mini · Nhắc tưới Gia Viên' else 'A.I Mini · Nhắc việc' end,
 left(coalesce(nullif(d.payload->>'body',''),case when d.kind='garden_water' then 'Đã đến thời điểm kiểm tra và tưới cây trong Gia Viên Dược Thảo.' else 'Đã đến thời điểm bạn đã nhờ A.I Mini nhắc.' end),8000) from due d returning 1)
 update public.ai_assistant_reminders r set status='delivered',delivered_at=now() where r.id in(select id from due);
 get diagnostics v_count=row_count;return v_count;
end $function$;

alter table public.clinical_posts drop constraint if exists clinical_posts_post_type_check;
alter table public.clinical_posts add constraint clinical_posts_post_type_check check(post_type in('research','clinical_case','medicinal_diet','news','reference','status'));

insert into public.club_members(full_name,student_code,role,status,login_enabled,data_conflict,source_file,academic_bio,herbal_alias)
select 'YHCT HIU A.I Học thuật','AI-YHCT-SYSTEM','member'::public.app_role,'approved'::public.membership_status,false,false,'system:auto-academic','Tài khoản hệ thống chỉ dùng đăng bản tin học thuật tự động từ nguồn đã xác minh.','A.I Học thuật'
where not exists(select 1 from public.club_members where student_code='AI-YHCT-SYSTEM');

create table if not exists public.ai_auto_post_runs(id bigserial primary key,ran_at timestamptz not null default now(),source_id text not null,post_id uuid references public.clinical_posts(id) on delete set null,content_hash text not null,status text not null check(status in('posted','skipped','failed')),details jsonb not null default '{}'::jsonb);
create index if not exists ai_auto_post_runs_recent_idx on public.ai_auto_post_runs(ran_at desc);
create unique index if not exists ai_auto_post_runs_source_posted_idx on public.ai_auto_post_runs(source_id) where status='posted';
alter table public.ai_auto_post_runs enable row level security;

create or replace function private.academic_auto_post_v1()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_bot uuid;v_e record;v_post uuid;v_hash text;v_body text;v_title text;v_citation jsonb;
begin
 if not pg_try_advisory_xact_lock(hashtext('yhct-academic-auto-post-v1')) then return jsonb_build_object('ok',true,'posted',false,'reason','locked');end if;
 if exists(select 1 from public.ai_auto_post_runs where status='posted' and ran_at>now()-interval '180 minutes') then return jsonb_build_object('ok',true,'posted',false,'reason','interval_guard');end if;
 select id into v_bot from public.club_members where student_code='AI-YHCT-SYSTEM' and status='approved' limit 1;if v_bot is null then raise exception 'AI academic system member is missing';end if;
 select e.id evidence_id,e.knowledge_id,e.title evidence_title,e.citation_text,e.journal,e.publication_year,e.pmid,e.doi,e.pubmed_url,e.evidence_note,k.name knowledge_name,k.kind,k.content_text into v_e
 from public.ai_knowledge_evidence e join public.ai_knowledge_items k on k.id=e.knowledge_id
 where e.verified is true and k.published is true and coalesce(e.pubmed_url,'') like 'https://%' and not exists(select 1 from public.ai_auto_post_runs r where r.source_id=e.id and r.status='posted')
 order by e.checked_at desc,e.publication_year desc,e.id limit 1;
 if v_e.evidence_id is null then insert into public.ai_auto_post_runs(source_id,content_hash,status,details) values('none',md5(now()::date::text),'skipped',jsonb_build_object('reason','no_unused_verified_source'));return jsonb_build_object('ok',true,'posted',false,'reason','no_unused_verified_source');end if;
 v_title:=left('A.I học thuật · '||v_e.knowledge_name||': '||v_e.evidence_title,300);
 v_body:=left('Bản tin tự động từ kho bằng chứng đã xác minh của YHCT HIU 4.0. '||coalesce(nullif(v_e.evidence_note,''),nullif(v_e.content_text,''),'Vui lòng mở nguồn gốc để đọc và đánh giá mức độ bằng chứng.')||E'\n\nLưu ý: nội dung dùng cho học tập và nghiên cứu; không thay thế đánh giá lâm sàng.',8000);
 v_hash:=md5(v_title||'|'||v_body||'|'||v_e.evidence_id);
 v_citation:=jsonb_build_array(jsonb_build_object('id',v_e.evidence_id,'title',v_e.evidence_title,'type','pubmed','url',v_e.pubmed_url,'pmid',v_e.pmid,'doi',v_e.doi,'citation',v_e.citation_text));
 insert into public.clinical_posts(author_id,title,chief_complaint,citations,privacy_scrubbed,academic_score_cached,moderation_status,approved_at,post_type,specialty,visibility,citation_verified,synthetic_flags)
 values(v_bot,v_title,v_body,v_citation,true,80,'approved',now(),'reference','research','public',true,array['system_generated','verified_source_only']) returning id into v_post;
 insert into public.ai_auto_post_runs(source_id,post_id,content_hash,status,details) values(v_e.evidence_id,v_post,v_hash,'posted',jsonb_build_object('knowledge_id',v_e.knowledge_id,'pmid',v_e.pmid,'doi',v_e.doi));
 return jsonb_build_object('ok',true,'posted',true,'postId',v_post,'sourceId',v_e.evidence_id);
exception when unique_violation then return jsonb_build_object('ok',true,'posted',false,'reason','duplicate_source');
end $function$;

do $do$ declare j record; begin
 for j in select jobid from cron.job where jobname in('yhct-ai-assistant-reminders','yhct-academic-auto-post-180m') loop perform cron.unschedule(j.jobid);end loop;
 perform cron.schedule('yhct-ai-assistant-reminders','*/5 * * * *','select private.ai_assistant_deliver_reminders_v1();');
 perform cron.schedule('yhct-academic-auto-post-180m','0 */3 * * *','select private.academic_auto_post_v1();');
end $do$;
