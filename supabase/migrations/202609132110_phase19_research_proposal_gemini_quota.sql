create table if not exists private.research_proposal_quota_v1 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  used smallint not null default 0 check (used between 0 and 5),
  updated_at timestamptz not null default now()
);

revoke all on table private.research_proposal_quota_v1 from public, anon, authenticated;

create or replace function public.research_proposal_quota_v1(p_consume boolean default false)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_access jsonb;
  v_role text;
  v_limit integer;
  v_started timestamptz;
  v_used integer;
  v_now timestamptz := now();
  v_retry timestamptz;
begin
  if v_uid is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;

  v_access := public.current_member_access_v1();
  v_role := coalesce(v_access->>'role','guest');
  if coalesce((v_access->>'approved')::boolean,false) is not true or v_role='guest' then
    raise exception using errcode='42501', message='Approved member required';
  end if;

  if v_role='admin' then
    return jsonb_build_object('allowed',true,'unlimited',true,'limit',null,'remaining',null,'used',0,'windowHours',6,'retryAt',null,'role',v_role);
  end if;

  v_limit := case when v_role in('mod','super_mod','leader') then 5 else 3 end;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':research-proposal-v1',0));

  select window_started_at, used into v_started, v_used
  from private.research_proposal_quota_v1
  where user_id=v_uid;

  if not found then
    if not p_consume then
      return jsonb_build_object('allowed',true,'unlimited',false,'limit',v_limit,'remaining',v_limit,'used',0,'windowHours',6,'retryAt',null,'role',v_role);
    end if;
    v_started := v_now;
    v_used := 0;
    insert into private.research_proposal_quota_v1(user_id,window_started_at,used,updated_at)
    values(v_uid,v_started,0,v_now);
  elsif v_started <= v_now - interval '6 hours' then
    v_started := v_now;
    v_used := 0;
    update private.research_proposal_quota_v1
      set window_started_at=v_started, used=0, updated_at=v_now
      where user_id=v_uid;
  end if;

  v_retry := v_started + interval '6 hours';
  if p_consume and v_used >= v_limit then
    return jsonb_build_object('allowed',false,'unlimited',false,'limit',v_limit,'remaining',0,'used',v_used,'windowHours',6,'retryAt',v_retry,'role',v_role);
  end if;

  if p_consume then
    v_used := v_used + 1;
    update private.research_proposal_quota_v1
      set used=v_used, updated_at=v_now
      where user_id=v_uid;
  end if;

  return jsonb_build_object(
    'allowed',true,
    'unlimited',false,
    'limit',v_limit,
    'remaining',greatest(0,v_limit-v_used),
    'used',v_used,
    'windowHours',6,
    'retryAt',case when v_used>=v_limit then v_retry else null end,
    'role',v_role
  );
end;
$$;

revoke all on function public.research_proposal_quota_v1(boolean) from public, anon;
grant execute on function public.research_proposal_quota_v1(boolean) to authenticated;
