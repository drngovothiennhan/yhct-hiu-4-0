-- HIU YHCT 4.0 — Phase 13B hardening
-- A quiz_source resource cannot become published before the existing quiz
-- integrity pipeline has at least one reviewed/eligible question for its source.

create index if not exists learning_resource_sources_v1_created_by_idx
  on private.learning_resource_sources_v1(created_by,created_at desc);

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
    if source_row.provider<>'drive' then raise exception 'Quiz source publication requires verified Drive provenance'; end if;
    if not exists(
      select 1 from public.practice_questions q
      where q.source_file_id=source_row.source_locator
        and q.review_status in('source_verified','expert_approved')
    ) then raise exception 'Reviewed quiz content required before publication'; end if;
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

revoke all on function public.learning_resource_publish_v1(text,text) from public,anon;
grant execute on function public.learning_resource_publish_v1(text,text) to authenticated;
