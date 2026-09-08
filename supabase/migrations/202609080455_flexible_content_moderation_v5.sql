-- Flexible academic posts + MOD/Admin five-item workbench v5.
create table if not exists public.moderation_seen(
 member_id uuid not null references public.club_members(id) on delete cascade,
 entity_type text not null check(entity_type in('academic','news','feedback')),
 entity_id uuid not null,seen_at timestamptz not null default now(),
 primary key(member_id,entity_type,entity_id)
);
alter table public.moderation_seen enable row level security;
revoke all on public.moderation_seen from anon,authenticated;

create or replace function public.create_academic_post(p_draft jsonb,p_academic_score numeric default 0)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_member uuid;v_id uuid;v_title text;v_citations jsonb;v_author_name text;v_post_type text;v_body text;
begin
 v_member:=private.current_member_id(); if v_member is null or not private.is_approved() then raise exception 'Approved member required'; end if;
 v_title:=btrim(coalesce(p_draft->>'title','')); if length(v_title)<5 or length(v_title)>300 then raise exception 'Title must contain 5 to 300 characters'; end if;
 v_body:=private.scrub_clinical_text(left(coalesce(p_draft->>'chief_complaint',''),8000)); if length(btrim(v_body))<1 then raise exception 'Nội dung bài viết là bắt buộc'; end if;
 v_post_type:=coalesce(nullif(p_draft->>'post_type',''),'reference'); if v_post_type not in('research','clinical_case','medicinal_diet','news','reference','status') then raise exception 'Invalid post type'; end if;
 v_citations:=private.safe_citations(p_draft->'citations'); if v_post_type in('research','news','reference') and not private.has_meaningful_citations(v_citations) then raise exception 'Loại bài này cần ít nhất một nguồn trích dẫn/tài liệu tham khảo hợp lệ'; end if;
 insert into public.clinical_posts(author_id,title,abstract,chief_complaint,four_exams,eight_principles,syndrome,treatment_principle,formula,acupoints,tags,citations,privacy_scrubbed,academic_score_cached,moderation_status,post_type,specialty,visibility,media,citation_verified)
 values(v_member,v_title,nullif(private.scrub_clinical_text(left(coalesce(p_draft->>'abstract',''),8000)),''),v_body,jsonb_build_object('vong',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,vong}',''),5000)),'van',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,van}',''),5000)),'van_hoi',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,van_hoi}',''),5000)),'thiet',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,thiet}',''),5000))),private.safe_jsonb_text_array(p_draft->'eight_principles',8),private.scrub_clinical_text(left(coalesce(p_draft->>'syndrome',''),3000)),private.scrub_clinical_text(left(coalesce(p_draft->>'treatment_principle',''),3000)),private.scrub_clinical_text(left(coalesce(p_draft->>'formula',''),8000)),private.safe_jsonb_text_array(p_draft->'acupoints',50),private.safe_jsonb_text_array(p_draft->'tags',20),v_citations,true,greatest(0,least(120,coalesce(p_academic_score,0))),'pending',v_post_type,coalesce(nullif(p_draft->>'specialty',''),'general'),coalesce(nullif(p_draft->>'visibility',''),'public'),coalesce(p_draft->'media','[]'::jsonb),false) returning id into v_id;
 select full_name into v_author_name from public.club_members where id=v_member;
 insert into public.notifications(member_id,actor_member_id,kind,post_id,title,body) values(v_member,v_member,'academic_post_submitted',v_id,'Đã gửi bài chờ kiểm duyệt','“'||v_title||'” đã được lưu và chuyển tới hàng đợi MOD/Admin.');
 insert into public.notifications(member_id,actor_member_id,kind,post_id,title,body) select m.id,v_member,'academic_post_review',v_id,'Bài mới chờ duyệt',coalesce(v_author_name,'Thành viên')||' · '||v_title from public.club_members m where m.status='approved' and m.login_enabled and not m.data_conflict and private.role_level(m.role)>=private.role_level('mod');
 perform private.audit_event('academic.post.submit','clinical_post',v_id::text,'info',jsonb_build_object('status','pending','post_type',v_post_type)); return v_id;
end $$;

create or replace function public.update_academic_post(p_post_id uuid,p_draft jsonb,p_academic_score numeric default 0)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_member uuid;v_author uuid;v_title text;v_citations jsonb;v_post_type text;v_body text;
begin
 v_member:=private.current_member_id();if v_member is null or not private.is_approved() then raise exception 'Approved member required'; end if;
 select author_id into v_author from public.clinical_posts where id=p_post_id;if v_author is null then return false;end if;if v_author<>v_member and not private.has_min_role('mod') then raise exception 'Post author or Mod role required';end if;
 v_title:=btrim(coalesce(p_draft->>'title',''));if length(v_title)<5 or length(v_title)>300 then raise exception 'Title must contain 5 to 300 characters';end if;
 v_body:=private.scrub_clinical_text(left(coalesce(p_draft->>'chief_complaint',''),8000));if length(btrim(v_body))<1 then raise exception 'Nội dung bài viết là bắt buộc';end if;
 v_post_type:=coalesce(nullif(p_draft->>'post_type',''),'reference');if v_post_type not in('research','clinical_case','medicinal_diet','news','reference','status') then raise exception 'Invalid post type';end if;
 v_citations:=private.safe_citations(p_draft->'citations');if v_post_type in('research','news','reference') and not private.has_meaningful_citations(v_citations) then raise exception 'Loại bài này cần ít nhất một nguồn trích dẫn/tài liệu tham khảo hợp lệ';end if;
 update public.clinical_posts set title=v_title,abstract=nullif(private.scrub_clinical_text(left(coalesce(p_draft->>'abstract',''),8000)),''),chief_complaint=v_body,four_exams=jsonb_build_object('vong',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,vong}',''),5000)),'van',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,van}',''),5000)),'van_hoi',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,van_hoi}',''),5000)),'thiet',private.scrub_clinical_text(left(coalesce(p_draft#>>'{four_exams,thiet}',''),5000))),eight_principles=private.safe_jsonb_text_array(p_draft->'eight_principles',8),syndrome=private.scrub_clinical_text(left(coalesce(p_draft->>'syndrome',''),3000)),treatment_principle=private.scrub_clinical_text(left(coalesce(p_draft->>'treatment_principle',''),3000)),formula=private.scrub_clinical_text(left(coalesce(p_draft->>'formula',''),8000)),acupoints=private.safe_jsonb_text_array(p_draft->'acupoints',50),tags=private.safe_jsonb_text_array(p_draft->'tags',20),citations=v_citations,post_type=v_post_type,specialty=coalesce(nullif(p_draft->>'specialty',''),'general'),visibility=coalesce(nullif(p_draft->>'visibility',''),'public'),media=coalesce(p_draft->'media','[]'::jsonb),privacy_scrubbed=true,academic_score_cached=greatest(0,least(120,coalesce(p_academic_score,0))),moderation_status='pending',approved_at=null,approved_by=null,citation_verified=false,mod_verified_at=null,mod_verified_by=null,updated_at=now() where id=p_post_id;
 perform private.audit_event('academic.post.resubmit','clinical_post',p_post_id::text,'info',jsonb_build_object('status','pending','post_type',v_post_type));return found;
end $$;

create or replace function public.moderation_mark_seen_v1(p_entity_type text,p_entity_id uuid,p_seen boolean default true)
returns boolean language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id();
begin if mid is null or not private.has_min_role('mod') then raise exception 'Mod role required';end if;if p_entity_type not in('academic','news','feedback') then raise exception 'Invalid entity type';end if;if p_seen then insert into public.moderation_seen(member_id,entity_type,entity_id,seen_at) values(mid,p_entity_type,p_entity_id,now()) on conflict(member_id,entity_type,entity_id) do update set seen_at=excluded.seen_at;else delete from public.moderation_seen where member_id=mid and entity_type=p_entity_type and entity_id=p_entity_id;end if;return true;end $$;

create or replace function public.moderation_workbench_v2(p_query text default '',p_on_date date default null)
returns table(entity_type text,entity_id uuid,title text,subtitle text,status text,created_at timestamptz,payload jsonb,is_seen boolean)
language sql stable security definer set search_path='' as $$
with me as(select private.current_member_id() mid,private.has_min_role('mod') can_mod,private.has_min_role('admin') can_admin),
raw(entity_type,entity_id,title,subtitle,status,created_at,payload) as(
 select'academic'::text,p.id,p.title,coalesce(m.full_name,'Thành viên'),p.moderation_status,p.created_at,jsonb_build_object('citations',p.citations,'post_type',p.post_type,'specialty',p.specialty,'visibility',p.visibility,'synthetic_flags',p.synthetic_flags) from public.clinical_posts p join public.club_members m on m.id=p.author_id cross join me where me.can_mod
 union all select'news'::text,n.id,n.title,coalesce(n.publisher,'Nguồn tổng hợp'),n.status,n.created_at,jsonb_build_object('trust_score',n.trust_score,'published_at',n.published_at,'is_pinned',n.is_pinned) from public.tcm_news_items n cross join me where me.can_mod
 union all select'feedback'::text,f.id,left(f.body,180),coalesce(m.full_name,'Thành viên')||' · '||f.kind,f.status,f.created_at,jsonb_build_object('kind',f.kind,'body',f.body,'context',f.context) from public.feedback_reports f join public.club_members m on m.id=f.reporter_member_id cross join me where me.can_admin),
marked as(select r.*,exists(select 1 from public.moderation_seen s,me where s.member_id=me.mid and s.entity_type=r.entity_type and s.entity_id=r.entity_id) seen,row_number()over(partition by r.entity_type order by r.created_at asc) rn from raw r where(btrim(coalesce(p_query,''))='' or r.title ilike'%'||btrim(p_query)||'%' or r.subtitle ilike'%'||btrim(p_query)||'%') and(p_on_date is null or r.created_at::date=p_on_date)),
filtered as(select * from marked where case when btrim(coalesce(p_query,''))='' and p_on_date is null then((entity_type='academic' and status='pending')or(entity_type='news' and status='pending')or(entity_type='feedback' and status in('open','reviewing')))and not seen and rn<=5 else true end)
select entity_type,entity_id,title,subtitle,status,created_at,payload,seen from filtered order by case entity_type when'academic'then 1 when'news'then 2 else 3 end,created_at desc limit case when btrim(coalesce(p_query,''))='' and p_on_date is null then 15 else 50 end;
$$;
revoke all on function public.moderation_mark_seen_v1(text,uuid,boolean),public.moderation_workbench_v2(text,date) from public,anon;
grant execute on function public.moderation_mark_seen_v1(text,uuid,boolean),public.moderation_workbench_v2(text,date) to authenticated;
