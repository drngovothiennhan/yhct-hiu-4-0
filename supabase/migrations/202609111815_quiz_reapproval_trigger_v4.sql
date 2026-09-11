-- ON CONFLICT runs BEFORE INSERT triggers on the candidate before conflict UPDATE.
-- A changed, explicitly re-approved AI candidate can therefore reach the UPDATE
-- trigger already marked expert_approved while the conflict SET intentionally
-- cleared stale verifier fields. Re-hydrate only that authenticated admin-confirmed
-- tuple; never promote an unconfirmed tuple.

create or replace function private.practice_promote_admin_confirmed_ai_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  confirmed boolean:=coalesce((new.provenance->>'adminConfirmed')::boolean,false);
  admin_ok boolean:=false;
begin
  if mid is not null then
    select exists(
      select 1
      from public.club_members m
      where m.id=mid and m.role='admin' and m.status='approved'
    ) into admin_ok;
  end if;

  if new.generation_method='ai_generated'
     and confirmed
     and admin_ok
     and (
       new.review_status='needs_review'
       or (new.review_status='expert_approved' and new.expert_verified_by is null)
     ) then
    new.review_status:='expert_approved';
    new.expert_verified_by:=coalesce(new.expert_verified_by,mid);
    new.expert_verified_at:=coalesce(new.expert_verified_at,now());
    new.provenance:=new.provenance||jsonb_build_object(
      'approvedBy',new.expert_verified_by,
      'approvedAt',new.expert_verified_at,
      'approvalGate','acc-explicit-confirm-v2'
    );
  end if;

  return new;
end
$$;

revoke all on function private.practice_promote_admin_confirmed_ai_v1() from public;
revoke all on function private.practice_promote_admin_confirmed_ai_v1() from anon;
revoke all on function private.practice_promote_admin_confirmed_ai_v1() from authenticated;

comment on function private.practice_promote_admin_confirmed_ai_v1() is
'ACC explicit approval v2: promotes confirmed AI drafts and repairs verifier fields after ON CONFLICT invalidates a prior content version.';
