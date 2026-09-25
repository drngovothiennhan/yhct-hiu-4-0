-- Protected PDF reader locator for the StudyOS server API.
-- The source locator remains private and this RPC is executable by the server role only.
create or replace function public.learning_resource_reader_source_v1(p_resource_key text)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'resourceKey', r.resource_key,
    'title', r.title,
    'provider', s.provider,
    'sourceLocator', s.source_locator,
    'mimeType', s.mime_type
  )
  from private.learning_resources_v1 r
  join private.learning_resource_sources_v1 s
    on s.resource_id = r.id and s.is_current
  where r.resource_key = btrim(coalesce(p_resource_key, ''))
    and r.resource_key ~ '^hiu_res_[0-9a-f]{20}$'
    and r.status = 'published'
    and r.audience = 'members'
    and s.provider = 'drive'
  limit 1
$$;

revoke all on function public.learning_resource_reader_source_v1(text) from public, anon, authenticated;
grant execute on function public.learning_resource_reader_source_v1(text) to service_role;
