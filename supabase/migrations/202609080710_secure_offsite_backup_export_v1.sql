create table if not exists public.system_backup_exports (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  payload_text text not null,
  checksum_sha256 text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '20 minutes')
);

alter table public.system_backup_exports enable row level security;
revoke all on table public.system_backup_exports from public,anon,authenticated;
grant select,delete on table public.system_backup_exports to service_role;

create index if not exists system_backup_exports_expires_idx on public.system_backup_exports(expires_at);

create or replace function private.prepare_offsite_export(p_snapshot_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare rid uuid;
begin
  delete from public.system_backup_exports where expires_at < now();
  insert into public.system_backup_exports(snapshot_id,payload_text,checksum_sha256,expires_at)
  select id,payload::text,checksum_sha256,now()+interval '20 minutes'
  from private.app_snapshots where id=p_snapshot_id
  returning id into rid;
  if rid is null then raise exception 'Snapshot not found'; end if;
  return rid;
end
$function$;

revoke all on function private.prepare_offsite_export(uuid) from public,anon,authenticated;

comment on table public.system_backup_exports is 'Short-lived RLS-locked staging area used only by service-role Edge Function for off-site backup transfer.';
comment on function private.prepare_offsite_export(uuid) is 'Creates a 20-minute service-role-only export of an exact snapshot payload string.';