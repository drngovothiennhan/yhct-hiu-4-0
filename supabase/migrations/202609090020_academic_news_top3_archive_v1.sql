-- Academic feed AI news V1: expose exactly the three newest distinct AI-generated news items.
-- Older published AI news is archived privately before deletion by the hourly retention job.

create table if not exists private.tcm_news_archive(
  id uuid primary key,
  archived_at timestamptz not null default now(),
  archived_reason text not null default 'superseded_top3',
  payload jsonb not null
);
revoke all on private.tcm_news_archive from public,anon,authenticated;
create index if not exists tcm_news_archive_archived_at_idx on private.tcm_news_archive(archived_at desc);

create or replace function public.tcm_news_feed_v1(p_limit integer default 3)
returns table(
  id uuid,
  title text,
  canonical_url text,
  publisher text,
  publisher_domain text,
  published_at timestamptz,
  summary text,
  tags text[],
  trust_score numeric,
  ai_provider text
)
language sql stable security definer set search_path to 'public','pg_catalog' as $$
  with ranked as (
    select
      n.*,
      row_number() over(
        partition by coalesce(nullif(lower(btrim(n.canonical_url)),''),n.id::text)
        order by coalesce(n.published_at,n.created_at) desc,n.created_at desc,n.id desc
      ) as source_rank
    from public.tcm_news_items n
    where n.status='published'
      and coalesce(nullif(btrim(n.ai_provider),''),'')<>''
  )
  select n.id,n.title,n.canonical_url,n.publisher,n.publisher_domain,n.published_at,n.summary,n.tags,n.trust_score,n.ai_provider
  from ranked n
  where n.source_rank=1
  order by coalesce(n.published_at,n.created_at) desc,n.created_at desc,n.id desc
  limit least(3,greatest(1,coalesce(p_limit,3)))
$$;

create or replace function private.tcm_news_retention_v3()
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_keep_ids uuid[]:='{}'::uuid[];
  archived_n integer:=0;
  deleted_n integer:=0;
  expired_archive_n integer:=0;
begin
  select coalesce(array_agg(k.id),'{}'::uuid[])
  into v_keep_ids
  from (
    select d.id
    from (
      select distinct on (coalesce(nullif(lower(btrim(n.canonical_url)),''),n.id::text))
        n.id,
        coalesce(n.published_at,n.created_at) as effective_at,
        n.created_at
      from public.tcm_news_items n
      where n.status='published'
        and coalesce(nullif(btrim(n.ai_provider),''),'')<>''
      order by
        coalesce(nullif(lower(btrim(n.canonical_url)),''),n.id::text),
        coalesce(n.published_at,n.created_at) desc,
        n.created_at desc,
        n.id desc
    ) d
    order by d.effective_at desc,d.created_at desc,d.id desc
    limit 3
  ) k;

  insert into private.tcm_news_archive(id,archived_at,archived_reason,payload)
  select n.id,now(),'superseded_top3',to_jsonb(n)
  from public.tcm_news_items n
  where n.status='published'
    and coalesce(nullif(btrim(n.ai_provider),''),'')<>''
    and not (n.id=any(v_keep_ids))
  on conflict(id) do update
    set archived_at=excluded.archived_at,
        archived_reason=excluded.archived_reason,
        payload=excluded.payload;
  get diagnostics archived_n=row_count;

  delete from public.tcm_news_items n
  where n.status='published'
    and coalesce(nullif(btrim(n.ai_provider),''),'')<>''
    and not (n.id=any(v_keep_ids));
  get diagnostics deleted_n=row_count;

  delete from private.tcm_news_archive
  where archived_at<now()-interval '30 days';
  get diagnostics expired_archive_n=row_count;

  if archived_n>0 or deleted_n>0 or expired_archive_n>0 then
    perform private.audit_event(
      'news.retention_v3',
      'tcm_news_items',
      null,
      'info',
      jsonb_build_object(
        'kept_public_ai_news',cardinality(v_keep_ids),
        'archived',archived_n,
        'deleted_public',deleted_n,
        'expired_archive_deleted',expired_archive_n,
        'archive_retention_days',30
      )
    );
  end if;

  return jsonb_build_object(
    'kept_public_ai_news',cardinality(v_keep_ids),
    'archived',archived_n,
    'deleted_public',deleted_n,
    'expired_archive_deleted',expired_archive_n,
    'archive_retention_days',30,
    'ran_at',now()
  );
end $$;

revoke all on function private.tcm_news_retention_v3() from public,anon,authenticated;

do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname='tcm-news-retention-hourly';
  if jid is not null then perform cron.unschedule(jid); end if;
  perform cron.schedule('tcm-news-retention-hourly','47 * * * *','select private.tcm_news_retention_v3();');
end $$;

select private.tcm_news_retention_v3();
