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



-- Expose only the whitelisted bibliographic fields needed by the Hub catalog.
-- The underlying source metadata remains private and is never returned wholesale.
create or replace function public.learning_resource_list_v1(p_limit integer default 50,p_include_drafts boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  manager boolean:=false;
  result jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  manager:=private.is_learning_content_manager();
  if p_include_drafts and not manager then raise exception 'Learning content manager required'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'resourceKey',x.resource_key,
    'title',x.title,
    'resourceType',x.resource_type,
    'status',x.status,
    'audience',x.audience,
    'mimeType',coalesce(x.mime_type,''),
    'author',coalesce(x.author,''),
    'subject',coalesce(x.subject,''),
    'keywords',coalesce(x.keywords,''),
    'publishedAt',x.published_at,
    'updatedAt',x.updated_at
  ) order by x.updated_at desc),'[]'::jsonb)
  into result
  from (
    select
      r.resource_key,r.title,r.resource_type,r.status,r.audience,r.published_at,r.updated_at,s.mime_type,
      case when jsonb_typeof(s.source_metadata->'author')='string'
        then left(btrim(s.source_metadata->>'author'),200) else '' end as author,
      case
        when jsonb_typeof(s.source_metadata->'subject')='string' then left(btrim(s.source_metadata->>'subject'),240)
        when jsonb_typeof(s.source_metadata->'topic')='string' then left(btrim(s.source_metadata->>'topic'),240)
        else '' end as subject,
      case
        when jsonb_typeof(s.source_metadata->'keywords')='array' then (
          select coalesce(string_agg(left(btrim(k.value #>> '{}'),80),' ' order by k.ordinality),'')
          from (
            select value,ordinality
            from jsonb_array_elements(
              case when jsonb_typeof(s.source_metadata->'keywords')='array'
                then s.source_metadata->'keywords' else '[]'::jsonb end
            ) with ordinality as keyword_item(value,ordinality)
            where jsonb_typeof(value)='string' and btrim(value #>> '{}')<>''
            order by ordinality
            limit 20
          ) k
        )
        when jsonb_typeof(s.source_metadata->'keywords')='string'
          then left(btrim(s.source_metadata->>'keywords'),500)
        when jsonb_typeof(s.source_metadata->'tags')='array' then (
          select coalesce(string_agg(left(btrim(k.value #>> '{}'),80),' ' order by k.ordinality),'')
          from (
            select value,ordinality
            from jsonb_array_elements(
              case when jsonb_typeof(s.source_metadata->'tags')='array'
                then s.source_metadata->'tags' else '[]'::jsonb end
            ) with ordinality as tag_item(value,ordinality)
            where jsonb_typeof(value)='string' and btrim(value #>> '{}')<>''
            order by ordinality
            limit 20
          ) k
        )
        when jsonb_typeof(s.source_metadata->'tags')='string'
          then left(btrim(s.source_metadata->>'tags'),500)
        else '' end as keywords
    from private.learning_resources_v1 r
    left join private.learning_resource_sources_v1 s on s.resource_id=r.id and s.is_current
    where (r.status='published' and r.audience='members') or (manager and p_include_drafts)
    order by r.updated_at desc
    limit least(greatest(coalesce(p_limit,50),1),100)
  ) x;
  return result;
end
$$;

revoke all on function public.learning_resource_list_v1(integer,boolean) from public,anon;
grant execute on function public.learning_resource_list_v1(integer,boolean) to authenticated;
