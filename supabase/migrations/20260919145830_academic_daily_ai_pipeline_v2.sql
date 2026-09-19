-- Academic Daily AI Pipeline V2
-- New academic source -> PubMed verification -> Gemini summary -> citation persistence -> max one public post per HCM day.

create table if not exists private.academic_ai_daily_runs_v2(
  run_id uuid primary key default gen_random_uuid(),
  local_day date not null,
  status text not null check(status in ('issued','claimed','posted','failed')),
  issued_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  dispatch_request_id bigint,
  post_id uuid references public.clinical_posts(id) on delete set null,
  source_id text,
  failure_reason text,
  attempt_count integer not null default 0
);
revoke all on private.academic_ai_daily_runs_v2 from public,anon,authenticated;
create index if not exists academic_ai_daily_runs_v2_day_idx on private.academic_ai_daily_runs_v2(local_day,issued_at desc);
create unique index if not exists academic_ai_daily_runs_v2_one_post_per_day_uidx on private.academic_ai_daily_runs_v2(local_day) where status='posted';

create or replace function public.academic_ai_claim_daily_run_v2(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_day date:=timezone('Asia/Ho_Chi_Minh',now())::date;v_count integer:=0;
begin
  if exists(select 1 from private.academic_ai_daily_runs_v2 where local_day=v_day and status='posted') then
    return jsonb_build_object('ok',false,'reason','already_posted_today');
  end if;
  update private.academic_ai_daily_runs_v2
  set status='claimed',claimed_at=now(),attempt_count=attempt_count+1,failure_reason=null
  where run_id=p_run_id and local_day=v_day and status='issued' and issued_at>now()-interval '20 minutes';
  get diagnostics v_count=row_count;
  if v_count<>1 then return jsonb_build_object('ok',false,'reason','not_claimable');end if;
  return jsonb_build_object('ok',true,'localDay',v_day);
end $function$;
revoke all on function public.academic_ai_claim_daily_run_v2(uuid) from public;
grant execute on function public.academic_ai_claim_daily_run_v2(uuid) to anon,authenticated;

create or replace function public.academic_ai_seen_sources_v2(p_sources jsonb)
returns jsonb language sql stable security definer set search_path='' as $function$
  select coalesce(jsonb_agg(s->>'sourceId'),'[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(coalesce(p_sources,'[]'::jsonb))='array' then coalesce(p_sources,'[]'::jsonb) else '[]'::jsonb end) s
  where nullif(s->>'sourceId','') is not null
    and exists(
      select 1 from public.ai_auto_post_runs r
      where r.status='posted' and (
        r.source_id=s->>'sourceId'
        or (nullif(s->>'pmid','') is not null and r.details->>'pmid'=s->>'pmid')
        or (nullif(s->>'doi','') is not null and lower(coalesce(r.details->>'doi',''))=lower(s->>'doi'))
      )
    )
$function$;
revoke all on function public.academic_ai_seen_sources_v2(jsonb) from public;
grant execute on function public.academic_ai_seen_sources_v2(jsonb) to anon,authenticated;

create or replace function public.academic_ai_publish_daily_v2(
  p_run_id uuid,p_topic text,p_summary text,p_tags text[],p_source jsonb,p_model text
) returns jsonb language plpgsql security definer set search_path='' as $function$
declare
  v_day date:=timezone('Asia/Ho_Chi_Minh',now())::date;v_bot uuid;v_post uuid;v_source_id text;v_pmid text;v_doi text;v_url text;v_source_title text;v_topic text;v_summary text;v_tags text[];v_citation jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('yhct-academic-daily-publish-v2'));
  if not exists(select 1 from private.academic_ai_daily_runs_v2 where run_id=p_run_id and local_day=v_day and status='claimed' and claimed_at>now()-interval '25 minutes' for update) then
    return jsonb_build_object('ok',false,'reason','run_not_claimed');
  end if;
  if exists(select 1 from private.academic_ai_daily_runs_v2 where local_day=v_day and status='posted') then
    return jsonb_build_object('ok',false,'reason','already_posted_today');
  end if;

  v_source_id:=left(coalesce(p_source->>'id',''),180);v_pmid:=coalesce(p_source->>'pmid','');v_doi:=left(coalesce(p_source->>'doi',''),220);
  v_url:=left(coalesce(p_source->>'url',''),1200);v_source_title:=left(trim(coalesce(p_source->>'title','')),700);
  v_topic:=left(trim(coalesce(p_topic,'')),80);v_summary:=left(trim(coalesce(p_summary,'')),2200);
  if v_source_id<>'pubmed:'||v_pmid or v_pmid!~ '^\d{5,10}$' or v_url<>'https://pubmed.ncbi.nlm.nih.gov/'||v_pmid||'/' or length(v_source_title)<20 or length(v_summary)<120 or length(v_topic)<2 then
    return jsonb_build_object('ok',false,'reason','invalid_verified_source_payload');
  end if;
  if exists(select 1 from public.ai_auto_post_runs r where r.status='posted' and (r.source_id=v_source_id or r.details->>'pmid'=v_pmid or (v_doi<>'' and lower(coalesce(r.details->>'doi',''))=lower(v_doi)))) then
    return jsonb_build_object('ok',false,'reason','duplicate_source');
  end if;

  select id into v_bot from public.club_members where student_code='AI-YHCT-SYSTEM' and status='approved' order by created_at asc limit 1;
  if v_bot is null then return jsonb_build_object('ok',false,'reason','system_author_missing');end if;
  select coalesce(array_agg(x),'{}'::text[]) into v_tags from (
    select distinct left(trim(t),40) x from unnest(coalesce(p_tags,'{}'::text[])) t where length(trim(t)) between 2 and 40 limit 6
  ) q;
  v_citation:=jsonb_build_array(jsonb_build_object(
    'id',v_source_id,'title',v_source_title,'type','pubmed','url',v_url,'pmid',v_pmid,'doi',v_doi,
    'citation',left(coalesce(p_source->>'citation',''),1600),'journal',left(coalesce(p_source->>'journal',''),260),
    'publicationYear',left(coalesce(p_source->>'publicationYear',''),30),'verifiedBy','NCBI ESummary'
  ));

  insert into public.clinical_posts(
    author_id,title,chief_complaint,citations,tags,privacy_scrubbed,academic_score_cached,moderation_status,approved_at,
    post_type,specialty,visibility,citation_verified,synthetic_flags
  ) values(
    v_bot,left('A.I học thuật · '||v_topic||': '||v_source_title,300),
    v_summary||E'\n\nLưu ý: Nội dung phục vụ học tập và nghiên cứu; không thay thế đánh giá lâm sàng.',
    v_citation,v_tags,true,80,'approved',now(),'reference','research','public',true,
    array['system_generated','verified_source_only','gemini_generated','daily_pipeline_v2']
  ) returning id into v_post;

  insert into public.ai_auto_post_runs(source_id,post_id,content_hash,status,details)
  values(v_source_id,v_post,md5(v_source_id||'|'||v_summary),'posted',jsonb_build_object(
    'pipeline','academic_daily_ai_v2','run_id',p_run_id,'pmid',v_pmid,'doi',v_doi,'model',left(coalesce(p_model,''),120),'verified_by','NCBI ESummary'
  ));
  update private.academic_ai_daily_runs_v2 set status='posted',completed_at=now(),post_id=v_post,source_id=v_source_id,failure_reason=null where run_id=p_run_id;
  perform private.academic_ai_post_retention_v1();
  return jsonb_build_object('ok',true,'postId',v_post,'sourceId',v_source_id,'localDay',v_day);
exception when unique_violation then
  return jsonb_build_object('ok',false,'reason','daily_or_source_conflict');
end $function$;
revoke all on function public.academic_ai_publish_daily_v2(uuid,text,text,text[],jsonb,text) from public;
grant execute on function public.academic_ai_publish_daily_v2(uuid,text,text,text[],jsonb,text) to anon,authenticated;

create or replace function public.academic_ai_fail_daily_run_v2(p_run_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_count integer:=0;
begin
  update private.academic_ai_daily_runs_v2 set status='failed',completed_at=now(),failure_reason=left(coalesce(p_reason,'failed'),240)
  where run_id=p_run_id and status in ('issued','claimed') and issued_at>now()-interval '45 minutes';
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',v_count=1);
end $function$;
revoke all on function public.academic_ai_fail_daily_run_v2(uuid,text) from public;
grant execute on function public.academic_ai_fail_daily_run_v2(uuid,text) to anon,authenticated;

create or replace function private.academic_ai_dispatch_v2()
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_day date:=timezone('Asia/Ho_Chi_Minh',now())::date;v_run uuid:=gen_random_uuid();v_request bigint;
begin
  if not pg_try_advisory_xact_lock(hashtext('yhct-academic-daily-dispatch-v2')) then return jsonb_build_object('ok',true,'dispatched',false,'reason','locked');end if;
  if exists(select 1 from private.academic_ai_daily_runs_v2 where local_day=v_day and status='posted') then
    return jsonb_build_object('ok',true,'dispatched',false,'reason','already_posted_today');
  end if;
  if exists(select 1 from private.academic_ai_daily_runs_v2 where local_day=v_day and status in ('issued','claimed') and issued_at>now()-interval '45 minutes') then
    return jsonb_build_object('ok',true,'dispatched',false,'reason','attempt_in_flight');
  end if;
  insert into private.academic_ai_daily_runs_v2(run_id,local_day,status) values(v_run,v_day,'issued');
  select net.http_post(
    url:='https://yhct-hiu-final4-stage.vercel.app/api/ai/assistant',
    headers:=jsonb_build_object('Content-Type','application/json'),
    body:=jsonb_build_object('mode','academic-daily-post','runId',v_run),
    timeout_milliseconds:=60000
  ) into v_request;
  update private.academic_ai_daily_runs_v2 set dispatch_request_id=v_request where run_id=v_run;
  return jsonb_build_object('ok',true,'dispatched',true,'runId',v_run,'requestId',v_request,'localDay',v_day);
exception when others then
  update private.academic_ai_daily_runs_v2 set status='failed',completed_at=now(),failure_reason=left(sqlerrm,240) where run_id=v_run and status='issued';
  return jsonb_build_object('ok',false,'dispatched',false,'reason',left(sqlerrm,180));
end $function$;
revoke all on function private.academic_ai_dispatch_v2() from public,anon,authenticated;

do $do$ declare jid bigint;begin
  select jobid into jid from cron.job where jobname='yhct-academic-auto-post-180m';if jid is not null then perform cron.unschedule(jid);end if;
  select jobid into jid from cron.job where jobname='yhct-academic-daily-ai-v2';if jid is not null then perform cron.unschedule(jid);end if;
  perform cron.schedule('yhct-academic-daily-ai-v2','17 0,6,12 * * *','select private.academic_ai_dispatch_v2();');
end $do$;
