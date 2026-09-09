-- Separate the two feed contracts:
-- * TCM news keeps its established rotating feed (UI shows 2 cards per desktop viewport).
-- * System-generated academic posts expose only the newest 3; older ones are archived before deletion.

create table if not exists private.ai_academic_post_archive(
  id uuid primary key,
  archived_at timestamptz not null default now(),
  archived_reason text not null default 'superseded_top3',
  author_id uuid,
  payload jsonb not null
);
revoke all on private.ai_academic_post_archive from public,anon,authenticated;
create index if not exists ai_academic_post_archive_archived_at_idx on private.ai_academic_post_archive(archived_at desc);

create or replace function public.academic_feed_v1(p_limit integer default 50)
returns jsonb language plpgsql set search_path to '' as $function$
declare v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);v_result jsonb;
begin
  select coalesce(jsonb_agg(x.payload order by x.approved_at desc nulls last,x.created_at desc),'[]'::jsonb) into v_result
  from (
    select p.approved_at,p.created_at,jsonb_build_object(
      'id',p.id,
      'author',jsonb_build_object('id',m.id,'studentCode',m.student_code,'fullName',m.full_name,'title',coalesce(nullif(m.position_title,''),'Hội viên'),'role',m.role,'reputation',least(100,greatest(0,round(coalesce(m.academic_reputation_multiplier,1)::numeric*20)))),
      'title',p.title,'chiefComplaint',p.chief_complaint,'fourExams',coalesce(p.four_exams,'{}'::jsonb),'eightPrinciples',coalesce(to_jsonb(p.eight_principles),'[]'::jsonb),'syndrome',p.syndrome,'treatmentPrinciple',p.treatment_principle,'formula',p.formula,'acupoints',coalesce(to_jsonb(p.acupoints),'[]'::jsonb),'citations',coalesce(p.citations,'[]'::jsonb),'tags',coalesce(to_jsonb(p.tags),'[]'::jsonb),'createdAt',p.created_at,'approvedAt',p.approved_at,'modVerified',p.citation_verified,'moderationStatus',p.moderation_status,'postType',p.post_type,'specialty',p.specialty,'visibility',p.visibility,'media',p.media,'academicScore',coalesce(p.academic_score_cached,0),'likes',coalesce((select count(*) from public.post_reactions r where r.post_id=p.id),0),'comments',coalesce((select count(*) from public.comments c where c.post_id=p.id),0)
    ) payload
    from public.clinical_posts p join public.club_members m on m.id=p.author_id
    where p.privacy_scrubbed is true and m.data_conflict is false and p.moderation_status='approved'
      and (m.student_code<>'AI-YHCT-SYSTEM' or p.id in (
        select p2.id from public.clinical_posts p2
        where p2.author_id=p.author_id and p2.privacy_scrubbed is true and p2.moderation_status='approved'
        order by p2.approved_at desc nulls last,p2.created_at desc,p2.id desc limit 3
      ))
    order by p.approved_at desc nulls last,p.created_at desc limit v_limit
  ) x;
  return coalesce(v_result,'[]'::jsonb);
end $function$;

create or replace function private.academic_ai_post_retention_v1()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_bot uuid;v_keep_ids uuid[]:='{}'::uuid[];v_archived integer:=0;v_deleted integer:=0;
begin
  select id into v_bot from public.club_members where student_code='AI-YHCT-SYSTEM' order by created_at asc limit 1;
  if v_bot is null then return jsonb_build_object('ok',true,'kept',0,'archived',0,'deleted',0,'reason','system_author_missing');end if;
  select coalesce(array_agg(k.id),'{}'::uuid[]) into v_keep_ids from (
    select p.id from public.clinical_posts p where p.author_id=v_bot and p.moderation_status='approved' and p.privacy_scrubbed is true
    order by p.approved_at desc nulls last,p.created_at desc,p.id desc limit 3
  ) k;
  insert into private.ai_academic_post_archive(id,archived_at,archived_reason,author_id,payload)
  select p.id,now(),'superseded_top3',p.author_id,to_jsonb(p)||jsonb_build_object('authorStudentCode','AI-YHCT-SYSTEM','authorName','YHCT HIU A.I Học thuật')
  from public.clinical_posts p
  where p.author_id=v_bot and p.moderation_status='approved' and 'system_generated'=any(coalesce(p.synthetic_flags,'{}'::text[])) and not(p.id=any(v_keep_ids))
  on conflict(id) do update set archived_at=excluded.archived_at,archived_reason=excluded.archived_reason,author_id=excluded.author_id,payload=excluded.payload;
  get diagnostics v_archived=row_count;
  delete from public.clinical_posts p
  where p.author_id=v_bot and p.moderation_status='approved' and 'system_generated'=any(coalesce(p.synthetic_flags,'{}'::text[])) and not(p.id=any(v_keep_ids));
  get diagnostics v_deleted=row_count;
  if v_archived>0 or v_deleted>0 then perform private.audit_event('academic.ai_post_retention_v1','clinical_posts',null,'info',jsonb_build_object('kept_public',cardinality(v_keep_ids),'archived',v_archived,'deleted_public',v_deleted));end if;
  return jsonb_build_object('ok',true,'kept',cardinality(v_keep_ids),'archived',v_archived,'deleted',v_deleted,'ran_at',now());
end $function$;
revoke all on function private.academic_ai_post_retention_v1() from public,anon,authenticated;

create or replace function private.academic_auto_post_v1()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_bot uuid;v_e record;v_post uuid;v_hash text;v_body text;v_title text;v_citation jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('yhct-academic-auto-post-v1')) then return jsonb_build_object('ok',true,'posted',false,'reason','locked');end if;
  if exists(select 1 from public.ai_auto_post_runs where status='posted' and ran_at>now()-interval '180 minutes') then return jsonb_build_object('ok',true,'posted',false,'reason','interval_guard');end if;
  select id into v_bot from public.club_members where student_code='AI-YHCT-SYSTEM' and status='approved' limit 1;
  if v_bot is null then raise exception 'AI academic system member is missing';end if;
  select e.id evidence_id,e.knowledge_id,e.title evidence_title,e.citation_text,e.journal,e.publication_year,e.pmid,e.doi,e.pubmed_url,e.evidence_note,k.name knowledge_name,k.kind,k.content_text into v_e
  from public.ai_knowledge_evidence e join public.ai_knowledge_items k on k.id=e.knowledge_id
  where e.verified is true and k.published is true and coalesce(e.pubmed_url,'') like 'https://%' and not exists(select 1 from public.ai_auto_post_runs r where r.source_id=e.id and r.status='posted')
  order by e.checked_at desc,e.publication_year desc,e.id limit 1;
  if v_e.evidence_id is null then insert into public.ai_auto_post_runs(source_id,content_hash,status,details) values('none',md5(now()::date::text),'skipped',jsonb_build_object('reason','no_unused_verified_source'));return jsonb_build_object('ok',true,'posted',false,'reason','no_unused_verified_source');end if;
  v_title:=left('A.I học thuật · '||v_e.knowledge_name||': '||v_e.evidence_title,300);
  v_body:=left('Bản tin tự động từ kho bằng chứng đã xác minh của YHCT HIU 4.0. '||coalesce(nullif(v_e.evidence_note,''),nullif(v_e.content_text,''),'Vui lòng mở nguồn gốc để đọc toàn văn/tóm tắt và đánh giá mức độ bằng chứng.')||E'\n\nLưu ý: nội dung dùng cho học tập và nghiên cứu; không thay thế đánh giá lâm sàng.',8000);
  v_hash:=md5(v_title||'|'||v_body||'|'||v_e.evidence_id);
  v_citation:=jsonb_build_array(jsonb_build_object('id',v_e.evidence_id,'title',v_e.evidence_title,'type','pubmed','url',v_e.pubmed_url,'pmid',v_e.pmid,'doi',v_e.doi,'citation',v_e.citation_text));
  insert into public.clinical_posts(author_id,title,chief_complaint,citations,privacy_scrubbed,academic_score_cached,moderation_status,approved_at,post_type,specialty,visibility,citation_verified,synthetic_flags)
  values(v_bot,v_title,v_body,v_citation,true,80,'approved',now(),'reference','research','public',true,array['system_generated','verified_source_only']) returning id into v_post;
  insert into public.ai_auto_post_runs(source_id,post_id,content_hash,status,details) values(v_e.evidence_id,v_post,v_hash,'posted',jsonb_build_object('knowledge_id',v_e.knowledge_id,'pmid',v_e.pmid,'doi',v_e.doi));
  return jsonb_build_object('ok',true,'posted',true,'postId',v_post,'sourceId',v_e.evidence_id);
exception when unique_violation then return jsonb_build_object('ok',true,'posted',false,'reason','duplicate_source');
end $function$;

update public.clinical_posts p set chief_complaint=replace(p.chief_complaint,'\n',chr(10))
from public.club_members m
where m.id=p.author_id and m.student_code='AI-YHCT-SYSTEM' and position('\n' in p.chief_complaint)>0;

create or replace function public.tcm_news_feed_v1(p_limit integer default 30)
returns table(id uuid,title text,canonical_url text,publisher text,publisher_domain text,published_at timestamptz,summary text,tags text[],trust_score numeric,ai_provider text)
language sql stable security definer set search_path='public','pg_catalog' as $$
  select n.id,n.title,n.canonical_url,n.publisher,n.publisher_domain,n.published_at,n.summary,n.tags,n.trust_score,n.ai_provider
  from public.tcm_news_items n where n.status='published'
  order by n.is_pinned desc,coalesce(n.published_at,n.created_at) desc,n.created_at desc,n.id desc
  limit greatest(1,least(coalesce(p_limit,30),100))
$$;

do $do$ declare jid bigint;begin
  select jobid into jid from cron.job where jobname='tcm-news-retention-hourly';if jid is not null then perform cron.unschedule(jid);end if;
  perform cron.schedule('tcm-news-retention-hourly','47 * * * *','select private.tcm_news_retention_v2();');
  select jobid into jid from cron.job where jobname='academic-ai-post-retention-hourly';if jid is not null then perform cron.unschedule(jid);end if;
  perform cron.schedule('academic-ai-post-retention-hourly','17 * * * *','select private.academic_ai_post_retention_v1();');
end $do$;

select private.academic_ai_post_retention_v1();
