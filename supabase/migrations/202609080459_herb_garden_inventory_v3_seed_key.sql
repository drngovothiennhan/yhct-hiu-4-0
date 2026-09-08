create or replace function public.herb_garden_inventory_v3()
returns table(seed_key text,name text,other_names text,botanical_name text,family text,used_part text,traditional_actions text,dosage text,caution text,source_ref text,source_page integer,quantity integer,updated_at timestamptz,visual_variant smallint)
language sql security definer set search_path=''
as $$
 select i.seed_key,s.name,s.other_names,s.botanical_name,s.family,s.used_part,s.traditional_actions,s.dosage,s.caution,s.source_ref,s.source_page,i.quantity,i.updated_at,s.visual_variant
 from public.herb_garden_inventory i join private.herb_garden_species s on s.seed_key=i.seed_key
 where private.is_approved() and i.member_id=private.current_member_id() and i.quantity>0
 order by i.updated_at desc
$$;
revoke all on function public.herb_garden_inventory_v3() from public,anon;
grant execute on function public.herb_garden_inventory_v3() to authenticated;
