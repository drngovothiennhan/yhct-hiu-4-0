do $$
begin
  if not exists (select 1 from vault.secrets where name = 'offsite_backup_export_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''),
      'offsite_backup_export_secret',
      'Internal credential for controlled off-site backup export retrieval'
    );
  end if;
end
$$;

create or replace function public.offsite_backup_validate_secret_v1(p_secret text)
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
      where name = 'offsite_backup_export_secret'
        and decrypted_secret = p_secret
    );
$$;

revoke all on function public.offsite_backup_validate_secret_v1(text) from public, anon, authenticated;
grant execute on function public.offsite_backup_validate_secret_v1(text) to service_role;
