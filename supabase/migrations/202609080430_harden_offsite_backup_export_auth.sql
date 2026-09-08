-- Requires the operational secret named offsite_backup_export_secret to be provisioned in Supabase Vault.
-- No credential value is stored or generated in source control.

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
