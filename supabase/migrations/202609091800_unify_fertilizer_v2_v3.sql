-- Single source of truth for Gia Vien fertilizing.
-- The legacy no-argument v2 RPC remains for backward compatibility, but it no
-- longer owns a second fertilizer calculation. It resolves the legacy target
-- plant and delegates the actual care rule, counters, missed-day handling and
-- rewards to herb_garden_fertilize_v3(p_slot_no).

create or replace function public.herb_garden_fertilize_v2()
returns table(
  id uuid,
  planted_at timestamptz,
  matures_at timestamptz,
  expires_at timestamptz,
  status text,
  water_count integer,
  fertilizer_count integer,
  required_water_count integer,
  required_fertilizer_count integer,
  last_watered_at timestamptz,
  last_fertilized_at timestamptz,
  next_water_at timestamptz,
  next_fertilizer_at timestamptz,
  can_water boolean,
  can_fertilize boolean,
  ready_for_harvest boolean,
  missed_water_slots integer,
  missed_fertilizer_days integer,
  died_at timestamptz,
  death_reason text,
  name text,
  other_names text,
  botanical_name text,
  family text,
  used_part text,
  traditional_actions text,
  dosage text,
  caution text,
  source_ref text,
  source_page integer,
  visual_variant smallint
)
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  target_slot smallint;
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required';
  end if;

  perform private.herb_garden_sync_member_v3(mid);

  select p.slot_no
    into target_slot
  from public.herb_garden_plants p
  where p.member_id=mid
    and p.status='growing'
    and p.harvested_at is null
    and p.died_at is null
  order by p.planted_at desc
  limit 1;

  if target_slot is null then
    raise exception 'Không có cây đang phát triển để bón phân.';
  end if;

  -- v3 is authoritative: one valid fertilizer care per 24-hour growth day,
  -- three valid applications during the 72-hour growth cycle.
  perform public.herb_garden_fertilize_v3(target_slot);

  -- Preserve the historical v2 response contract for old clients only.
  return query select * from public.herb_garden_state_v2();
end
$$;

revoke all on function public.herb_garden_fertilize_v2() from public,anon;
grant execute on function public.herb_garden_fertilize_v2() to authenticated;
