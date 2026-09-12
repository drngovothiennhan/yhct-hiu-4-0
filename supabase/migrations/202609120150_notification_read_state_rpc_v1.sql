-- PHASE 5: authoritative notification read-state mutations.
-- Keep public.notifications client-readable only; read_at changes go through narrow RPCs.

create or replace function public.notifications_mark_read_v1(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required';
  end if;
  if p_notification_id is null then return false; end if;

  update public.notifications
     set read_at=coalesce(read_at,now())
   where id=p_notification_id
     and member_id=mid;
  return found;
end $$;

revoke all on function public.notifications_mark_read_v1(uuid) from public,anon,authenticated;
grant execute on function public.notifications_mark_read_v1(uuid) to authenticated;

create or replace function public.notifications_mark_all_read_v1()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  touched integer:=0;
begin
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required';
  end if;

  update public.notifications
     set read_at=now()
   where member_id=mid
     and read_at is null;
  get diagnostics touched=row_count;
  return touched;
end $$;

revoke all on function public.notifications_mark_all_read_v1() from public,anon,authenticated;
grant execute on function public.notifications_mark_all_read_v1() to authenticated;
