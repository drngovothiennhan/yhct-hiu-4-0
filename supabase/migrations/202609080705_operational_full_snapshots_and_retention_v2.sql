create or replace function private.create_operational_snapshot(p_scope text, p_created_by uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','storage','auth','extensions','pg_catalog'
as $function$
declare
  p jsonb;
  chk text;
  rid uuid;
  counts jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('yhct_operational_snapshot_v2',0));
  if coalesce(trim(p_scope),'')='' then raise exception 'Snapshot scope required'; end if;

  p:=jsonb_build_object(
    'schema_version',2,
    'generated_at',now(),
    'scope',p_scope,
    'security_note','Auth password hashes, refresh tokens, OTP/recovery secrets and service-role secrets are intentionally excluded.',
    'system_settings',coalesce((select jsonb_agg(to_jsonb(x)) from public.system_settings x),'[]'::jsonb),
    'departments',coalesce((select jsonb_agg(to_jsonb(x)) from public.departments x),'[]'::jsonb),
    'club_members',coalesce((select jsonb_agg(to_jsonb(x)) from public.club_members x),'[]'::jsonb),
    'clinical_posts',coalesce((select jsonb_agg(to_jsonb(x)) from public.clinical_posts x),'[]'::jsonb),
    'academic_reposts',coalesce((select jsonb_agg(to_jsonb(x)) from public.academic_reposts x),'[]'::jsonb),
    'comments',coalesce((select jsonb_agg(to_jsonb(x)) from public.comments x),'[]'::jsonb),
    'post_reactions',coalesce((select jsonb_agg(to_jsonb(x)) from public.post_reactions x),'[]'::jsonb),
    'member_follows',coalesce((select jsonb_agg(to_jsonb(x)) from public.member_follows x),'[]'::jsonb),
    'topic_follows',coalesce((select jsonb_agg(to_jsonb(x)) from public.topic_follows x),'[]'::jsonb),
    'bookmark_collections',coalesce((select jsonb_agg(to_jsonb(x)) from public.bookmark_collections x),'[]'::jsonb),
    'bookmark_items',coalesce((select jsonb_agg(to_jsonb(x)) from public.bookmark_items x),'[]'::jsonb),
    'community_credit_events',coalesce((select jsonb_agg(to_jsonb(x)) from public.community_credit_events x),'[]'::jsonb),
    'drl_semesters',coalesce((select jsonb_agg(to_jsonb(x)) from public.drl_semesters x),'[]'::jsonb),
    'drl_import_batches',coalesce((select jsonb_agg(to_jsonb(x)) from public.drl_import_batches x),'[]'::jsonb),
    'drl_activities',coalesce((select jsonb_agg(to_jsonb(x)) from public.drl_activities x),'[]'::jsonb),
    'herb_drug_interactions',coalesce((select jsonb_agg(to_jsonb(x)) from public.herb_drug_interactions x),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(to_jsonb(x)) from public.notifications x),'[]'::jsonb),
    'notification_outbox',coalesce((select jsonb_agg(to_jsonb(x)) from public.notification_outbox x),'[]'::jsonb),
    'research_opportunities',coalesce((select jsonb_agg(to_jsonb(x)) from public.research_opportunities x),'[]'::jsonb),
    'research_applications',coalesce((select jsonb_agg(to_jsonb(x)) from public.research_applications x),'[]'::jsonb),
    'schedules',coalesce((select jsonb_agg(to_jsonb(x)) from public.schedules x),'[]'::jsonb),
    'schedule_assignments',coalesce((select jsonb_agg(to_jsonb(x)) from public.schedule_assignments x),'[]'::jsonb),
    'schedule_checkins',coalesce((select jsonb_agg(to_jsonb(x)) from public.schedule_checkins x),'[]'::jsonb),
    'score_rules',coalesce((select jsonb_agg(to_jsonb(x)) from public.score_rules x),'[]'::jsonb),
    'score_transactions',coalesce((select jsonb_agg(to_jsonb(x)) from public.score_transactions x),'[]'::jsonb),
    'score_locks',coalesce((select jsonb_agg(to_jsonb(x)) from public.score_locks x),'[]'::jsonb),
    'system_audit_logs',coalesce((select jsonb_agg(to_jsonb(x)) from public.system_audit_logs x),'[]'::jsonb),
    'system_incidents',coalesce((select jsonb_agg(to_jsonb(x)) from public.system_incidents x),'[]'::jsonb),
    'tcm_news_sources',coalesce((select jsonb_agg(to_jsonb(x)) from public.tcm_news_sources x),'[]'::jsonb),
    'tcm_news_items',coalesce((select jsonb_agg(to_jsonb(x)) from public.tcm_news_items x),'[]'::jsonb),
    'auth_user_manifest',coalesce((select jsonb_agg(jsonb_build_object(
      'id',u.id,'email',u.email,'phone',u.phone,'raw_user_meta_data',u.raw_user_meta_data,
      'raw_app_meta_data',u.raw_app_meta_data,'created_at',u.created_at,'updated_at',u.updated_at,
      'last_sign_in_at',u.last_sign_in_at,'banned_until',u.banned_until,'deleted_at',u.deleted_at,
      'is_anonymous',u.is_anonymous)) from auth.users u),'[]'::jsonb),
    'storage_object_manifest',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'bucket_id',o.bucket_id,'name',o.name,'owner_id',o.owner_id,'metadata',o.metadata,
      'created_at',o.created_at,'updated_at',o.updated_at,'last_accessed_at',o.last_accessed_at)) from storage.objects o),'[]'::jsonb)
  );

  counts:=jsonb_build_object(
    'system_settings',(select count(*) from public.system_settings),
    'departments',(select count(*) from public.departments),
    'club_members',(select count(*) from public.club_members),
    'clinical_posts',(select count(*) from public.clinical_posts),
    'academic_reposts',(select count(*) from public.academic_reposts),
    'comments',(select count(*) from public.comments),
    'post_reactions',(select count(*) from public.post_reactions),
    'member_follows',(select count(*) from public.member_follows),
    'topic_follows',(select count(*) from public.topic_follows),
    'bookmark_collections',(select count(*) from public.bookmark_collections),
    'bookmark_items',(select count(*) from public.bookmark_items),
    'community_credit_events',(select count(*) from public.community_credit_events),
    'drl_semesters',(select count(*) from public.drl_semesters),
    'drl_import_batches',(select count(*) from public.drl_import_batches),
    'drl_activities',(select count(*) from public.drl_activities),
    'herb_drug_interactions',(select count(*) from public.herb_drug_interactions),
    'notifications',(select count(*) from public.notifications),
    'notification_outbox',(select count(*) from public.notification_outbox),
    'research_opportunities',(select count(*) from public.research_opportunities),
    'research_applications',(select count(*) from public.research_applications),
    'schedules',(select count(*) from public.schedules),
    'schedule_assignments',(select count(*) from public.schedule_assignments),
    'schedule_checkins',(select count(*) from public.schedule_checkins),
    'score_rules',(select count(*) from public.score_rules),
    'score_transactions',(select count(*) from public.score_transactions),
    'score_locks',(select count(*) from public.score_locks),
    'system_audit_logs',(select count(*) from public.system_audit_logs),
    'system_incidents',(select count(*) from public.system_incidents),
    'tcm_news_sources',(select count(*) from public.tcm_news_sources),
    'tcm_news_items',(select count(*) from public.tcm_news_items),
    'auth_user_manifest',(select count(*) from auth.users),
    'storage_object_manifest',(select count(*) from storage.objects)
  );

  chk:=encode(extensions.digest(p::text,'sha256'),'hex');
  insert into private.app_snapshots(scope,payload,checksum_sha256,row_counts,created_by)
  values(p_scope,p,chk,counts,p_created_by)
  returning id into rid;
  return rid;
end
$function$;

create or replace function private.create_managed_snapshot(p_created_by uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'private','pg_catalog'
as $function$
begin
  return private.create_operational_snapshot(case when p_created_by is null then 'daily_full_v2' else 'manual_full_v2' end,p_created_by);
end
$function$;

create or replace function private.daily_managed_snapshot()
returns void
language plpgsql
security definer
set search_path to 'private','pg_catalog'
as $function$
begin
  perform private.create_operational_snapshot('daily_full_v2',null);
  delete from private.app_snapshots where scope='daily_full_v2' and created_at < now()-interval '30 days';
end
$function$;

create or replace function private.monthly_managed_snapshot()
returns void
language plpgsql
security definer
set search_path to 'private','pg_catalog'
as $function$
begin
  perform private.create_operational_snapshot('monthly_full_v2',null);
  delete from private.app_snapshots where scope='monthly_full_v2' and created_at < now()-interval '12 months';
end
$function$;

create or replace function private.daily_retention_maintenance()
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare
  n_outbox integer:=0;
  n_notifications integer:=0;
  n_news integer:=0;
  n_throttle integer:=0;
  n_audit integer:=0;
begin
  delete from public.notification_outbox
   where status in ('sent','failed','dead','cancelled') and coalesce(sent_at,created_at) < now()-interval '30 days';
  get diagnostics n_outbox=row_count;

  delete from public.notifications
   where read_at is not null and created_at < now()-interval '365 days';
  get diagnostics n_notifications=row_count;

  delete from public.tcm_news_items
   where coalesce(is_pinned,false)=false and coalesce(published_at,created_at) < now()-interval '365 days';
  get diagnostics n_news=row_count;

  delete from public.login_throttle
   where updated_at < now()-interval '7 days' and (blocked_until is null or blocked_until < now());
  get diagnostics n_throttle=row_count;

  delete from public.system_audit_logs where created_at < now()-interval '730 days';
  get diagnostics n_audit=row_count;

  return jsonb_build_object(
    'notification_outbox_deleted',n_outbox,
    'notifications_deleted',n_notifications,
    'news_deleted',n_news,
    'login_throttle_deleted',n_throttle,
    'audit_logs_deleted',n_audit,
    'ran_at',now()
  );
end
$function$;

revoke all on function private.create_operational_snapshot(text,uuid) from public,anon,authenticated;
revoke all on function private.create_managed_snapshot(uuid) from public,anon,authenticated;
revoke all on function private.daily_managed_snapshot() from public,anon,authenticated;
revoke all on function private.monthly_managed_snapshot() from public,anon,authenticated;
revoke all on function private.daily_retention_maintenance() from public,anon,authenticated;

do $do$
begin
  begin perform cron.unschedule('yhct-managed-snapshot-monthly'); exception when others then null; end;
  begin perform cron.unschedule('yhct-retention-daily'); exception when others then null; end;
end
$do$;

select cron.schedule('yhct-managed-snapshot-monthly','23 18 1 * *','select private.monthly_managed_snapshot();');
select cron.schedule('yhct-retention-daily','43 18 * * *','select private.daily_retention_maintenance();');

comment on function private.create_operational_snapshot(text,uuid) is 'Operational full-data snapshot v2. Includes mutable application data plus non-secret Auth and Storage manifests; intentionally excludes credentials and file bytes.';
comment on function private.daily_managed_snapshot() is 'Creates daily_full_v2 operational snapshot and keeps 30 days.';
comment on function private.monthly_managed_snapshot() is 'Creates monthly_full_v2 operational snapshot and keeps 12 months.';
comment on function private.daily_retention_maintenance() is 'Retention: terminal outbox 30d, read notifications 365d, unpinned news 365d, throttle 7d, audit logs 730d.';