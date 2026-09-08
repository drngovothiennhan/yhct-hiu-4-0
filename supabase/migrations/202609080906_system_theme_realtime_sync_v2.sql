create or replace function public.system_theme_set_v1(p_theme text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','realtime','pg_catalog'
as $$
declare
  v_allowed constant text[] := array['duoc-ngoc','muc-tuyen','ngu-y','tcm-cartoon-2d','tcm-isometric-3d','tcm-spring-2d','tcm-cloud-2d','tcm-mint-modern'];
  v_mid uuid := private.current_member_id();
  v_result jsonb;
  v_updated_at timestamptz := clock_timestamp();
begin
  if not private.has_min_role('admin') then
    raise exception 'Admin role required';
  end if;
  if not (p_theme = any(v_allowed)) then
    raise exception 'Unsupported theme';
  end if;

  update public.system_settings
     set setting_value=jsonb_build_object('default',p_theme,'available',to_jsonb(v_allowed)),
         updated_by=v_mid,
         updated_at=v_updated_at
   where setting_key='ui.theme';

  if not found then
    raise exception 'Theme setting is missing';
  end if;

  select public.system_theme_get_v1() into v_result;
  perform realtime.send(
    jsonb_build_object('theme',p_theme,'updatedAt',v_updated_at),
    'theme.changed',
    'system:theme',
    false
  );
  perform private.audit_event('system.theme.set','system_setting','ui.theme','info',jsonb_build_object('theme',p_theme));
  return v_result;
end
$$;

revoke all on function public.system_theme_set_v1(text) from public;
grant execute on function public.system_theme_set_v1(text) to authenticated;
