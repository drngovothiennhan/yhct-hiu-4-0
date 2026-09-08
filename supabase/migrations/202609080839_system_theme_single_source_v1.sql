update public.system_settings
set setting_value = jsonb_build_object(
  'default', coalesce(nullif(setting_value->>'default',''),'duoc-ngoc'),
  'available', jsonb_build_array('duoc-ngoc','muc-tuyen','ngu-y','tcm-cartoon-2d','tcm-isometric-3d','tcm-spring-2d','tcm-cloud-2d','tcm-mint-modern')
), updated_at=now()
where setting_key='ui.theme';

insert into public.system_settings(setting_key,setting_value,updated_at)
select 'ui.theme',jsonb_build_object('default','duoc-ngoc','available',jsonb_build_array('duoc-ngoc','muc-tuyen','ngu-y','tcm-cartoon-2d','tcm-isometric-3d','tcm-spring-2d','tcm-cloud-2d','tcm-mint-modern')),now()
where not exists(select 1 from public.system_settings where setting_key='ui.theme');

create or replace function public.system_theme_get_v1()
returns jsonb
language sql
stable
security definer
set search_path to 'public','pg_catalog'
as $$
  select jsonb_build_object(
    'theme', coalesce(nullif(setting_value->>'default',''),'duoc-ngoc'),
    'available', coalesce(setting_value->'available','[]'::jsonb),
    'updatedAt', updated_at
  )
  from public.system_settings
  where setting_key='ui.theme'
  limit 1
$$;

create or replace function public.system_theme_set_v1(p_theme text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $$
declare
  v_allowed constant text[] := array['duoc-ngoc','muc-tuyen','ngu-y','tcm-cartoon-2d','tcm-isometric-3d','tcm-spring-2d','tcm-cloud-2d','tcm-mint-modern'];
  v_mid uuid := private.current_member_id();
  v_result jsonb;
begin
  if not private.has_min_role('admin') then raise exception 'Admin role required'; end if;
  if not (p_theme = any(v_allowed)) then raise exception 'Unsupported theme'; end if;
  update public.system_settings
     set setting_value=jsonb_build_object('default',p_theme,'available',to_jsonb(v_allowed)),
         updated_by=v_mid,
         updated_at=now()
   where setting_key='ui.theme';
  select public.system_theme_get_v1() into v_result;
  perform private.audit_event('system.theme.set','system_setting','ui.theme','info',jsonb_build_object('theme',p_theme));
  return v_result;
end
$$;

revoke all on function public.system_theme_get_v1() from public;
grant execute on function public.system_theme_get_v1() to anon, authenticated;
revoke all on function public.system_theme_set_v1(text) from public;
grant execute on function public.system_theme_set_v1(text) to authenticated;
