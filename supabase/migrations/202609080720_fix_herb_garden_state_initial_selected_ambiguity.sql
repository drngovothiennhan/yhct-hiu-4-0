create or replace function public.herb_garden_state_v3()
returns table(
  slot_no smallint,
  unlocked boolean,
  initial_selected boolean,
  harvest_count integer,
  initial_selection_complete boolean,
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
set search_path to ''
as $function$
declare
  mid uuid := private.current_member_id();
  selection_complete boolean;
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required';
  end if;

  perform private.ensure_herb_garden_plots_v3(mid);
  perform private.herb_garden_sync_member_v3(mid);

  select count(*) = 3
    into selection_complete
  from public.herb_garden_plots g
  where g.member_id = mid
    and g.initial_selected;

  return query
  select
    g.slot_no,
    g.unlocked,
    g.initial_selected,
    g.harvest_count,
    selection_complete,
    p.id,
    p.planted_at,
    p.matures_at,
    p.expires_at,
    p.status,
    coalesce(p.water_count, 0),
    coalesce(p.fertilizer_count, 0),
    12,
    3,
    p.last_watered_at,
    p.last_fertilized_at,
    case
      when p.id is not null and p.status = 'growing' and now() < p.matures_at then
        case
          when p.last_water_slot < p.current_water_slot then now()
          else p.planted_at + (p.current_water_slot + 1) * interval '6 hours'
        end
    end,
    case
      when p.id is not null and p.status = 'growing' and now() < p.matures_at then
        case
          when p.last_fertilizer_day < p.current_fertilizer_day then now()
          else p.planted_at + (p.current_fertilizer_day + 1) * interval '1 day'
        end
    end,
    coalesce(p.status = 'growing' and now() < p.matures_at and p.last_water_slot < p.current_water_slot, false),
    coalesce(p.status = 'growing' and now() < p.matures_at and p.last_fertilizer_day < p.current_fertilizer_day, false),
    coalesce(p.status = 'mature' and now() < p.expires_at and p.water_count >= 12 and p.fertilizer_count >= 3, false),
    case when p.id is null then 0 else greatest(0, (p.current_water_slot + 1) - p.water_count) end,
    case when p.id is null then 0 else greatest(0, (p.current_fertilizer_day + 1) - p.fertilizer_count) end,
    p.died_at,
    p.death_reason,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.name end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.other_names end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.botanical_name end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.family end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.used_part end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.traditional_actions end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.dosage end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.caution end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.source_ref end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.source_page end,
    case when p.id is not null and (now() >= p.matures_at or p.status in ('mature','dead','harvested')) then s.visual_variant end
  from public.herb_garden_plots g
  left join lateral (
    select
      x.*,
      greatest(0, least(11, floor(extract(epoch from (now() - x.planted_at)) / 21600)::integer)) as current_water_slot,
      greatest(0, least(2, floor(extract(epoch from (now() - x.planted_at)) / 86400)::integer)) as current_fertilizer_day
    from public.herb_garden_plants x
    where x.member_id = mid
      and x.slot_no = g.slot_no
      and x.status in ('growing','mature')
      and x.harvested_at is null
      and x.died_at is null
    order by x.planted_at desc
    limit 1
  ) p on true
  left join private.herb_garden_species s on s.seed_key = p.seed_key
  where g.member_id = mid
  order by g.slot_no;
end
$function$;
