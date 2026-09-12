-- HIU YHCT 4.0 — AI Study OS V2 / Phase 13B
-- Stable application resource identity over Drive/upload sources.
-- Raw source locators stay in private schema. Student/member RPCs return safe metadata only.

create table if not exists private.learning_resources_v1(
  id uuid primary key default gen_random_uuid(),
  resource_key text not null unique default ('hiu_res_' || substr(replace(gen_random_uuid()::text,'-',''),1,20)),
  title text not null check(char_length(btrim(title)) between 1 and 300),
  resource_type text not null default 'document' check(resource_type in('document','quiz_source','reference')),
  status text not null default 'draft' check(status in('draft','published','archived')),
  audience text not null default 'private' check(audience in('private','members')),
  created_by uuid not null references public.club_members(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_resources_v1_key_format check(resource_key ~ '^hiu_res_[0-9a-f]{20}$')
);

create index if not exists learning_resources_v1_status_idx on private.learning_resources_v1(status,audience,updated_at desc);
create index if not exists learning_resources_v1_created_by_idx on private.learning_resources_v1(created_by,updated_at desc);

create table if not exists private.learning_resource_sources_v1(
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references private.learning_resources_v1(id) on delete cascade,
  provider text not null check(provider in('drive','upload')),
  source_locator text not null check(char_length(btrim(source_locator)) between 1 and 2048),
  source_version text not null default '',
  mime_type text not null default '',
  content_hash text not null default '',
  source_metadata jsonb not null default '{}'::jsonb,
  is_current boolean not null default true,
  created_by uuid not null references public.club_members(id),
  created_at timestamptz not null default now()
);

create unique index if not exists learning_resource_sources_v1_one_current_idx
  on private.learning_resource_sources_v1(resource_id) where is_current;
create index if not exists learning_resource_sources_v1_locator_idx
  on private.learning_resource_sources_v1(provider,source_locator,is_current);

revoke all on table private.learning_resources_v1 from public,anon,authenticated;
revoke all on table private.learning_resource_sources_v1 from public,anon,authenticated;

create or replace function public.learning_resource_upsert_v1(
  p_resource_key text default '',
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  requested_key text:=btrim(coalesce(p_resource_key,''));
  title_value text:=left(btrim(coalesce(p_payload->>'title','')),300);
  type_value text:=lower(btrim(coalesce(p_payload->>'resourceType','document')));
  audience_value text:=lower(btrim(coalesce(p_payload->>'audience','private')));
  provider_value text:=lower(btrim(coalesce(p_payload->'source'->>'provider','')));
  locator_value text:=left(btrim(coalesce(p_payload->'source'->>'id','')),2048);
  version_value text:=left(btrim(coalesce(p_payload->'source'->>'version','')),300);
  mime_value text:=left(btrim(coalesce(p_payload->'source'->>'mimeType','')),240);
  hash_value text:=left(btrim(coalesce(p_payload->'source'->>'contentHash','')),160);
  metadata_value jsonb:=case when jsonb_typeof(p_payload->'source'->'metadata')='object' then p_payload->'source'->'metadata' else '{}'::jsonb end;
  resource_row private.learning_resources_v1%rowtype;
  current_source private.learning_resource_sources_v1%rowtype;
begin
  if mid is null or not private.is_learning_content_manager() then raise exception 'Learning content manager required'; end if;
  if title_value='' then raise exception 'Resource title required'; end if;
  if type_value not in('document','quiz_source','reference') then raise exception 'Invalid resource type'; end if;
  if audience_value not in('private','members') then raise exception 'Invalid resource audience'; end if;
  if provider_value not in('drive','upload') or locator_value='' then raise exception 'Invalid resource source'; end if;

  if requested_key<>'' then
    if requested_key !~ '^hiu_res_[0-9a-f]{20}$' then raise exception 'Invalid resource key'; end if;
    select * into resource_row from private.learning_resources_v1 where resource_key=requested_key for update;
    if resource_row.id is null then raise exception 'Resource not found'; end if;
  else
    select r.* into resource_row
    from private.learning_resources_v1 r
    join private.learning_resource_sources_v1 s on s.resource_id=r.id and s.is_current
    where s.provider=provider_value and s.source_locator=locator_value
    order by r.updated_at desc
    limit 1
    for update of r;
  end if;

  if resource_row.id is null then
    insert into private.learning_resources_v1(title,resource_type,audience,created_by)
    values(title_value,type_value,audience_value,mid)
    returning * into resource_row;
  else
    update private.learning_resources_v1
    set title=title_value,
        resource_type=type_value,
        audience=audience_value,
        updated_at=now()
    where id=resource_row.id
    returning * into resource_row;
  end if;

  select * into current_source
  from private.learning_resource_sources_v1
  where resource_id=resource_row.id and is_current
  limit 1
  for update;

  if current_source.id is null
     or current_source.provider is distinct from provider_value
     or current_source.source_locator is distinct from locator_value
     or current_source.source_version is distinct from version_value
     or current_source.content_hash is distinct from hash_value then
    update private.learning_resource_sources_v1 set is_current=false where resource_id=resource_row.id and is_current;
    insert into private.learning_resource_sources_v1(resource_id,provider,source_locator,source_version,mime_type,content_hash,source_metadata,is_current,created_by)
    values(resource_row.id,provider_value,locator_value,version_value,mime_value,hash_value,metadata_value,true,mid);
  elsif current_source.mime_type is distinct from mime_value or current_source.source_metadata is distinct from metadata_value then
    update private.learning_resource_sources_v1
    set mime_type=mime_value,source_metadata=metadata_value
    where id=current_source.id;
  end if;

  perform private.audit_event('learning.resource.upsert','learning_resource',resource_row.resource_key,'info',jsonb_build_object('resource_type',resource_row.resource_type,'audience',resource_row.audience));
  return jsonb_build_object(
    'ok',true,
    'resourceKey',resource_row.resource_key,
    'title',resource_row.title,
    'resourceType',resource_row.resource_type,
    'status',resource_row.status,
    'audience',resource_row.audience,
    'publishedAt',resource_row.published_at,
    'updatedAt',resource_row.updated_at
  );
end
$$;

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
begin
  if mid is null or not private.is_learning_content_manager() then raise exception 'Learning content manager required'; end if;
  if key_value !~ '^hiu_res_[0-9a-f]{20}$' then raise exception 'Invalid resource key'; end if;
  if status_value not in('draft','published','archived') then raise exception 'Invalid resource status'; end if;
  select * into resource_row from private.learning_resources_v1 where resource_key=key_value for update;
  if resource_row.id is null then raise exception 'Resource not found'; end if;
  if status_value='published' and not exists(select 1 from private.learning_resource_sources_v1 s where s.resource_id=resource_row.id and s.is_current) then raise exception 'Resource source required'; end if;

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

create or replace function public.learning_resource_get_v1(p_resource_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  key_value text:=btrim(coalesce(p_resource_key,''));
  manager boolean:=false;
  resource_row private.learning_resources_v1%rowtype;
  mime_value text:='';
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  manager:=private.is_learning_content_manager();
  if key_value !~ '^hiu_res_[0-9a-f]{20}$' then raise exception 'Resource not found'; end if;
  select * into resource_row from private.learning_resources_v1 where resource_key=key_value;
  if resource_row.id is null then raise exception 'Resource not found'; end if;
  if not manager and not(resource_row.status='published' and resource_row.audience='members') then raise exception 'Resource not found'; end if;
  select s.mime_type into mime_value from private.learning_resource_sources_v1 s where s.resource_id=resource_row.id and s.is_current limit 1;
  return jsonb_build_object('resourceKey',resource_row.resource_key,'title',resource_row.title,'resourceType',resource_row.resource_type,'status',resource_row.status,'audience',resource_row.audience,'mimeType',coalesce(mime_value,''),'publishedAt',resource_row.published_at,'updatedAt',resource_row.updated_at);
end
$$;

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
    'publishedAt',x.published_at,
    'updatedAt',x.updated_at
  ) order by x.updated_at desc),'[]'::jsonb)
  into result
  from (
    select r.resource_key,r.title,r.resource_type,r.status,r.audience,r.published_at,r.updated_at,s.mime_type
    from private.learning_resources_v1 r
    left join private.learning_resource_sources_v1 s on s.resource_id=r.id and s.is_current
    where (r.status='published' and r.audience='members') or (manager and p_include_drafts)
    order by r.updated_at desc
    limit least(greatest(coalesce(p_limit,50),1),100)
  ) x;
  return result;
end
$$;

revoke all on function public.learning_resource_upsert_v1(text,jsonb) from public,anon;
revoke all on function public.learning_resource_publish_v1(text,text) from public,anon;
revoke all on function public.learning_resource_get_v1(text) from public,anon;
revoke all on function public.learning_resource_list_v1(integer,boolean) from public,anon;
grant execute on function public.learning_resource_upsert_v1(text,jsonb) to authenticated;
grant execute on function public.learning_resource_publish_v1(text,text) to authenticated;
grant execute on function public.learning_resource_get_v1(text) to authenticated;
grant execute on function public.learning_resource_list_v1(integer,boolean) to authenticated;
