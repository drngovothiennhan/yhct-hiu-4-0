-- Fix Gia Viên watering transaction: v4 previously called the smallint v3 RPC with
-- an integer argument and attempted to assign a set-returning state function to jsonb.
-- Both could make a successful v3 water update roll back before the client received success.

create or replace function public.herb_garden_water_v4(p_slot_no integer)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_state jsonb;
  v_message text;
begin
  if p_slot_no not between 1 and 9 then
    raise exception 'Ô vườn không hợp lệ';
  end if;

  begin
    perform public.herb_garden_water_v3(p_slot_no::smallint);

    select coalesce(jsonb_agg(to_jsonb(s) order by s.slot_no),'[]'::jsonb)
      into v_state
    from public.herb_garden_state_v3() s;

    return jsonb_build_object(
      'ok',true,
      'watered',true,
      'reason','watered',
      'state',v_state
    );
  exception when others then
    get stacked diagnostics v_message = message_text;

    if position('Chưa đến lượt tưới tiếp theo' in coalesce(v_message,'')) > 0
       or position('Chu kỳ 6 giờ này đã được tưới' in coalesce(v_message,'')) > 0 then
      select coalesce(jsonb_agg(to_jsonb(s) order by s.slot_no),'[]'::jsonb)
        into v_state
      from public.herb_garden_state_v3() s;

      return jsonb_build_object(
        'ok',true,
        'watered',false,
        'reason','already_watered',
        'message','Ô này đã được tưới trong chu kỳ 6 giờ hiện tại. Hãy chờ lượt tưới kế tiếp.',
        'state',v_state
      );
    end if;

    raise;
  end;
end
$function$;

revoke all on function public.herb_garden_water_v4(integer) from public,anon;
grant execute on function public.herb_garden_water_v4(integer) to authenticated;
