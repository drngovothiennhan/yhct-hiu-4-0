-- Production migration already applied as: viewport_news_role_audit_hardening
alter table public.tcm_news_items add column if not exists is_pinned boolean not null default false;
create index if not exists idx_tcm_news_items_feed_pinned on public.tcm_news_items(status,is_pinned desc,published_at desc,created_at desc);

create or replace function public.tcm_news_feed_v1(p_limit integer default 30)
returns table(id uuid,title text,canonical_url text,publisher text,publisher_domain text,published_at timestamptz,summary text,tags text[],trust_score numeric,ai_provider text)
language sql stable security definer set search_path='public','pg_catalog' as $$
select n.id,n.title,n.canonical_url,n.publisher,n.publisher_domain,n.published_at,n.summary,n.tags,n.trust_score,n.ai_provider
from public.tcm_news_items n where n.status='published'
order by n.is_pinned desc,coalesce(n.published_at,n.created_at) desc
limit greatest(1,least(coalesce(p_limit,30),100))
$$;

create or replace function public.tcm_news_admin_list_v1(p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path='public','private','pg_catalog' as $$
declare v_result jsonb;
begin
  if not private.has_min_role('super_mod') then raise exception 'Super Mod role required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'summary',x.summary,'publisher',x.publisher,'published_at',x.published_at,'status',x.status,'trust_score',x.trust_score,'is_pinned',x.is_pinned,'canonical_url',x.canonical_url) order by case x.status when 'pending' then 0 when 'published' then 1 else 2 end,x.is_pinned desc,coalesce(x.published_at,x.created_at) desc),'[]'::jsonb)
  into v_result from (select * from public.tcm_news_items order by case status when 'pending' then 0 when 'published' then 1 else 2 end,is_pinned desc,coalesce(published_at,created_at) desc limit greatest(1,least(coalesce(p_limit,30),100))) x;
  return v_result;
end $$;

create or replace function public.tcm_news_admin_update_v1(p_id uuid,p_title text,p_summary text)
returns boolean language plpgsql security definer set search_path='public','private','pg_catalog' as $$
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  if length(btrim(coalesce(p_title,'')))<5 or length(btrim(coalesce(p_title,'')))>300 then raise exception 'Title must contain 5 to 300 characters'; end if;
  if length(coalesce(p_summary,''))>2000 then raise exception 'Summary too long'; end if;
  update public.tcm_news_items set title=btrim(p_title),summary=btrim(coalesce(p_summary,'')),updated_at=now() where id=p_id;
  if not found then raise exception 'News item not found'; end if;
  perform private.audit_event('news.admin_update','tcm_news_item',p_id::text,'info',jsonb_build_object('title_length',length(btrim(p_title)),'summary_length',length(coalesce(p_summary,''))));
  return true;
end $$;

create or replace function public.tcm_news_admin_set_pinned_v1(p_id uuid,p_pinned boolean)
returns boolean language plpgsql security definer set search_path='public','private','pg_catalog' as $$
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  update public.tcm_news_items set is_pinned=coalesce(p_pinned,false),updated_at=now() where id=p_id;
  if not found then raise exception 'News item not found'; end if;
  perform private.audit_event('news.admin_pin','tcm_news_item',p_id::text,'info',jsonb_build_object('pinned',coalesce(p_pinned,false)));
  return true;
end $$;

create or replace function public.tcm_news_admin_delete_v1(p_id uuid)
returns boolean language plpgsql security definer set search_path='public','private','pg_catalog' as $$
declare v_title text;
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  select title into v_title from public.tcm_news_items where id=p_id;
  if v_title is null then return false; end if;
  delete from public.tcm_news_items where id=p_id;
  perform private.audit_event('news.admin_delete','tcm_news_item',p_id::text,'warning',jsonb_build_object('title',left(v_title,180)));
  return true;
end $$;

create or replace function public.moderation_recent_logs_v1(p_limit integer default 60)
returns table(id uuid,action text,entity_type text,entity_id text,severity text,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path='public','private','pg_catalog' as $$
begin
  if not private.has_min_role('super_mod') then raise exception 'Super Mod role required'; end if;
  return query select l.id,l.action,l.entity_type,l.entity_id,l.severity,l.metadata,l.created_at from public.system_audit_logs l
  where l.action like 'news.%' or l.action like 'post.%' or l.action like 'drl.%' or l.action like 'score.%' or l.action like 'member.%'
  order by l.created_at desc limit greatest(1,least(coalesce(p_limit,60),200));
end $$;

revoke all on function public.tcm_news_admin_list_v1(integer) from public,anon;
revoke all on function public.tcm_news_admin_update_v1(uuid,text,text) from public,anon;
revoke all on function public.tcm_news_admin_set_pinned_v1(uuid,boolean) from public,anon;
revoke all on function public.tcm_news_admin_delete_v1(uuid) from public,anon;
revoke all on function public.moderation_recent_logs_v1(integer) from public,anon;
grant execute on function public.tcm_news_admin_list_v1(integer) to authenticated,service_role;
grant execute on function public.tcm_news_admin_update_v1(uuid,text,text) to authenticated,service_role;
grant execute on function public.tcm_news_admin_set_pinned_v1(uuid,boolean) to authenticated,service_role;
grant execute on function public.tcm_news_admin_delete_v1(uuid) to authenticated,service_role;
grant execute on function public.moderation_recent_logs_v1(integer) to authenticated,service_role;
