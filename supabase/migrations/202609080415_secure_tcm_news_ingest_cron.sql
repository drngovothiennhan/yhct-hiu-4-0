do $$
begin
  if not exists (select 1 from vault.secrets where name = 'tcm_news_ingest_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
      'tcm_news_ingest_secret',
      'Internal credential for the YHCT news ingestion cron only'
    );
  end if;
end
$$;

create or replace function public.tcm_news_validate_ingest_secret_v1(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, vault
as $$
  select coalesce(length(p_secret) >= 32, false)
    and exists (
      select 1
      from vault.decrypted_secrets
      where name = 'tcm_news_ingest_secret'
        and decrypted_secret = p_secret
    );
$$;

revoke all on function public.tcm_news_validate_ingest_secret_v1(text) from public, anon, authenticated;
grant execute on function public.tcm_news_validate_ingest_secret_v1(text) to service_role;

select cron.unschedule('tcm-news-ingest-hourly');

select cron.schedule(
  'tcm-news-ingest-hourly',
  '17 * * * *',
  $cmd$
  select net.http_post(
    url := 'https://gzmpnsrwqjpsbklyflqr.supabase.co/functions/v1/tcm-news-ingest',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-YHCT-Ingest-Key',(select decrypted_secret from vault.decrypted_secrets where name='tcm_news_ingest_secret')
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
