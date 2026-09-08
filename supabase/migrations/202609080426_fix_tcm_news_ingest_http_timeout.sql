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
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cmd$
);
