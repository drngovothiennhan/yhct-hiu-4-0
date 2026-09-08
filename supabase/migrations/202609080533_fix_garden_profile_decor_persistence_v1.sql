create or replace function public.herb_garden_profile_update_v1(p_theme text, p_decor jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  clean jsonb;
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required';
  end if;
  if p_theme not in ('bamboo','lotus','stone','lantern','herbal-paper') then
    raise exception 'Invalid garden theme';
  end if;

  select coalesce(jsonb_agg(q.value order by q.first_ord),'[]'::jsonb)
    into clean
  from (
    select x.value, min(x.ord) as first_ord
    from jsonb_array_elements_text(coalesce(p_decor,'[]'::jsonb)) with ordinality as x(value,ord)
    where x.value in ('pond','lantern','stone-path','bamboo-gate','lotus-pot','herb-sign')
    group by x.value
    order by min(x.ord)
    limit 6
  ) q;

  insert into public.herb_garden_profiles(member_id,theme,decor,updated_at)
  values(mid,p_theme,clean,now())
  on conflict(member_id) do update
    set theme=excluded.theme,
        decor=excluded.decor,
        updated_at=excluded.updated_at;

  return jsonb_build_object('theme',p_theme,'decor',clean,'persisted',true);
end
$$;
