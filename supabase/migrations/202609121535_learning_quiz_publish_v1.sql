-- HIU YHCT 4.0 — AI Study OS V2 / Phase 13C
-- One explicit human action promotes an already-previewed quiz draft to the approved bank.
-- Supports both server-scoped Drive sources and bounded direct uploads registered by Knowledge Gateway.
-- Publication is bound to the current content hash so stale questions from an older Drive revision are never promoted.

create or replace function public.learning_quiz_publish_v1(
  p_resource_key text,
  p_source_file_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  key_value text:=btrim(coalesce(p_resource_key,''));
  source_value text:=left(btrim(coalesce(p_source_file_id,'')),2048);
  resource_row private.learning_resources_v1%rowtype;
  source_row private.learning_resource_sources_v1%rowtype;
  source_doc public.practice_source_documents%rowtype;
  approved_now integer:=0;
  eligible_total integer:=0;
begin
  if mid is null or not private.is_learning_content_manager() then
    raise exception 'Learning content manager required';
  end if;
  if key_value !~ '^hiu_res_[0-9a-f]{20}$' or source_value='' then
    raise exception 'Invalid publish request';
  end if;

  select * into resource_row
  from private.learning_resources_v1
  where resource_key=key_value
  for update;
  if resource_row.id is null or resource_row.resource_type<>'quiz_source' then
    raise exception 'Quiz resource not found';
  end if;

  select * into source_row
  from private.learning_resource_sources_v1
  where resource_id=resource_row.id and is_current
  limit 1
  for update;
  if source_row.id is null
     or source_row.provider not in('drive','upload')
     or source_row.source_locator is distinct from source_value
     or btrim(source_row.content_hash)='' then
    raise exception 'Quiz source provenance mismatch';
  end if;

  select * into source_doc
  from public.practice_source_documents d
  where d.drive_file_id=source_value
  for update;
  if source_doc.drive_file_id is null then
    raise exception 'Quiz source has not been imported';
  end if;
  if source_doc.source_hash is distinct from source_row.content_hash then
    raise exception 'Quiz source revision changed. Rebuild preview before publication';
  end if;

  select count(*) into eligible_total
  from public.practice_questions q
  where q.source_file_id=source_value
    and q.source_hash=source_row.content_hash
    and q.review_status<>'rejected';
  if eligible_total=0 then raise exception 'No reviewed quiz questions to publish'; end if;

  update public.practice_questions
  set review_status='expert_approved',
      expert_verified_by=mid,
      expert_verified_at=now(),
      provenance=provenance||jsonb_build_object(
        'documentApproval',true,
        'documentApprovalAt',now(),
        'documentApprovalResourceKey',key_value,
        'documentApprovalSourceHash',source_row.content_hash
      ),
      updated_at=now()
  where source_file_id=source_value
    and source_hash=source_row.content_hash
    and review_status='needs_review';
  get diagnostics approved_now=row_count;

  if exists(
    select 1 from public.practice_questions q
    where q.source_file_id=source_value
      and q.source_hash=source_row.content_hash
      and q.review_status not in('source_verified','expert_approved','rejected')
  ) then raise exception 'Quiz review state is incomplete'; end if;

  update public.practice_source_documents
  set sync_status='ready',
      sync_message='Đã được Ban Quản lý Học tập duyệt và phát hành.',
      last_synced_at=now(),
      updated_at=now()
  where drive_file_id=source_value and source_hash=source_row.content_hash;

  update private.learning_resources_v1
  set status='published',
      audience='members',
      published_at=coalesce(published_at,now()),
      updated_at=now()
  where id=resource_row.id
  returning * into resource_row;

  perform private.audit_event(
    'learning.quiz.publish',
    'learning_resource',
    resource_row.resource_key,
    'info',
    jsonb_build_object('approved_now',approved_now,'eligible_total',eligible_total,'provider',source_row.provider,'source_hash',source_row.content_hash)
  );

  return jsonb_build_object(
    'ok',true,
    'resourceKey',resource_row.resource_key,
    'status',resource_row.status,
    'audience',resource_row.audience,
    'approvedNow',approved_now,
    'questionCount',eligible_total,
    'publishedAt',resource_row.published_at
  );
end
$$;

-- Replace the Phase 13B generic publish guard so direct-upload quiz sources are not
-- artificially blocked; quiz publication itself is performed by learning_quiz_publish_v1.
create or replace function public.learning_resource_publish_v1(
  p_resource_key text,
  p_status text default 'published'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  key_value text:=btrim(coalesce(p_resource_key,''));
  status_value text:=lower(btrim(coalesce(p_status,'')));
  resource_row private.learning_resources_v1%rowtype;
  source_row private.learning_resource_sources_v1%rowtype;
begin
  if mid is null or not private.is_learning_content_manager() then raise exception 'Learning content manager required'; end if;
  if key_value !~ '^hiu_res_[0-9a-f]{20}$' then raise exception 'Invalid resource key'; end if;
  if status_value not in('draft','published','archived') then raise exception 'Invalid resource status'; end if;
  select * into resource_row from private.learning_resources_v1 where resource_key=key_value for update;
  if resource_row.id is null then raise exception 'Resource not found'; end if;
  select * into source_row from private.learning_resource_sources_v1 where resource_id=resource_row.id and is_current limit 1;
  if status_value='published' and source_row.id is null then raise exception 'Resource source required'; end if;
  if status_value='published' and resource_row.resource_type='quiz_source' then
    raise exception 'Use reviewed quiz publication flow';
  end if;
  update private.learning_resources_v1
  set status=status_value,
      published_at=case when status_value='published' then coalesce(published_at,now()) else published_at end,
      updated_at=now()
  where id=resource_row.id
  returning * into resource_row;
  perform private.audit_event('learning.resource.status','learning_resource',resource_row.resource_key,'info',jsonb_build_object('status',resource_row.status,'audience',resource_row.audience));
  return jsonb_build_object('ok',true,'resourceKey',resource_row.resource_key,'title',resource_row.title,'resourceType',resource_row.resource_type,'status',resource_row.status,'audience',resource_row.audience,'publishedAt',resource_row.published_at,'updatedAt',resource_row.updated_at);
end
$$;

revoke all on function public.learning_quiz_publish_v1(text,text) from public,anon;
grant execute on function public.learning_quiz_publish_v1(text,text) to authenticated;
revoke all on function public.learning_resource_publish_v1(text,text) from public,anon;
grant execute on function public.learning_resource_publish_v1(text,text) to authenticated;
