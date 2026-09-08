-- Managed snapshot v5: include all mutable social, moderation and garden economy tables.
create or replace function private.augment_snapshot_modules_v5(p_snapshot_id uuid)
returns void language plpgsql security definer set search_path='public','private','extensions','pg_catalog' as $$
declare p jsonb;counts jsonb;
begin
 perform private.augment_snapshot_modules_v4(p_snapshot_id);
 select payload,row_counts into p,counts from private.app_snapshots where id=p_snapshot_id for update;
 if p is null then raise exception 'Snapshot not found'; end if;
 p:=p||jsonb_build_object(
  'schema_version',5,
  'member_wall_posts',coalesce((select jsonb_agg(to_jsonb(x)) from public.member_wall_posts x),'[]'::jsonb),
  'moderation_seen',coalesce((select jsonb_agg(to_jsonb(x)) from public.moderation_seen x),'[]'::jsonb),
  'herb_garden_profiles',coalesce((select jsonb_agg(to_jsonb(x)) from public.herb_garden_profiles x),'[]'::jsonb),
  'herb_garden_wallets',coalesce((select jsonb_agg(to_jsonb(x)) from public.herb_garden_wallets x),'[]'::jsonb),
  'herb_garden_trade_listings',coalesce((select jsonb_agg(to_jsonb(x)) from public.herb_garden_trade_listings x),'[]'::jsonb)
 );
 counts:=counts||jsonb_build_object(
  'member_wall_posts',(select count(*) from public.member_wall_posts),
  'moderation_seen',(select count(*) from public.moderation_seen),
  'herb_garden_profiles',(select count(*) from public.herb_garden_profiles),
  'herb_garden_wallets',(select count(*) from public.herb_garden_wallets),
  'herb_garden_trade_listings',(select count(*) from public.herb_garden_trade_listings)
 );
 update private.app_snapshots set payload=p,row_counts=counts,checksum_sha256=encode(extensions.digest(p::text,'sha256'),'hex') where id=p_snapshot_id;
end $$;

create or replace function private.create_managed_snapshot(p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path='private','pg_catalog' as $$
declare rid uuid;begin rid:=private.create_operational_snapshot(case when p_created_by is null then'daily_full_v2' else'manual_full_v2' end,p_created_by);perform private.augment_snapshot_modules_v5(rid);return rid;end $$;
create or replace function private.daily_managed_snapshot()
returns void language plpgsql security definer set search_path='private','pg_catalog' as $$
declare rid uuid;begin rid:=private.create_operational_snapshot('daily_full_v2',null);perform private.augment_snapshot_modules_v5(rid);delete from private.app_snapshots where scope='daily_full_v2' and created_at<now()-interval'30 days';end $$;
create or replace function private.monthly_managed_snapshot()
returns void language plpgsql security definer set search_path='private','pg_catalog' as $$
declare rid uuid;begin rid:=private.create_operational_snapshot('monthly_full_v2',null);perform private.augment_snapshot_modules_v5(rid);delete from private.app_snapshots where scope='monthly_full_v2' and created_at<now()-interval'12 months';end $$;
