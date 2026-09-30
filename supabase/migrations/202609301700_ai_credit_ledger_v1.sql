-- AI credit ledger v1 (additive only).
-- Nothing changes for learners until BOTH switches are turned on:
--   1) private.ai_credit_settings_v1.enforce = true   (database)
--   2) ENABLE_AI_CREDITS=true                           (server env)
-- Credits are non-cash, non-transferable usage points. Gift credits expire (lots).

create schema if not exists private;

create table if not exists private.ai_credit_settings_v1 (
  id boolean primary key default true check (id),
  enforce boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.ai_credit_settings_v1(id) values (true) on conflict (id) do nothing;

-- Per-capability price. A capability that is not listed costs nothing.
create table if not exists private.ai_credit_policy_v1 (
  capability text primary key check (capability ~ '^[a-z0-9_:.-]{2,64}$'),
  cost integer not null default 0 check (cost between 0 and 1000),
  free_daily integer not null default 0 check (free_daily between 0 and 10000),
  updated_at timestamptz not null default now()
);

-- One row per block of credits. Spending consumes the soonest-expiring lot first.
create table if not exists private.ai_credit_lot_v1 (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('grant','campaign','purchase')),
  ref text not null check (length(ref) between 1 and 120),
  initial integer not null check (initial > 0),
  remaining integer not null check (remaining >= 0 and remaining <= initial),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source, ref)
);
create index if not exists ai_credit_lot_v1_user_open_idx
  on private.ai_credit_lot_v1 (user_id, expires_at nulls last, id) where remaining > 0;

-- Append-only history. Rows are never updated or deleted by these functions.
create table if not exists private.ai_credit_ledger_v1 (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('grant','spend','free','refund')),
  capability text,
  delta integer not null,
  ref text not null check (length(ref) between 1 and 120),
  lots jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index if not exists ai_credit_ledger_v1_user_time_idx
  on private.ai_credit_ledger_v1 (user_id, created_at desc);

-- Time-boxed gift campaigns (e.g. the launch gift). Disabled until the owner enables one.
create table if not exists private.ai_credit_campaign_v1 (
  campaign text primary key check (campaign ~ '^[a-z0-9_-]{3,64}$'),
  amount integer not null check (amount between 1 and 100000),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  credit_valid_days integer not null default 180 check (credit_valid_days between 1 and 3650),
  enabled boolean not null default false
);

revoke all on table private.ai_credit_settings_v1, private.ai_credit_policy_v1,
  private.ai_credit_lot_v1, private.ai_credit_ledger_v1, private.ai_credit_campaign_v1
  from public, anon, authenticated;

-- Placeholder policy so the owner only has to review numbers. Values are proposals, not decisions.
insert into private.ai_credit_policy_v1(capability, cost, free_daily) values
  ('assistant_fast', 1, 20),
  ('assistant_research', 5, 3),
  ('study_quiz', 2, 10),
  ('study_chat', 1, 20),
  ('xiaozhi_mini', 1, 20)
on conflict (capability) do nothing;

insert into private.ai_credit_campaign_v1(campaign, amount, starts_at, ends_at, credit_valid_days, enabled) values
  ('launch-2026-10-01', 50, '2026-10-01T00:00:00+07:00', '2026-11-01T00:00:00+07:00', 180, false)
on conflict (campaign) do nothing;

-- Shared guard: approved member with a real role.
create or replace function private.ai_credit_member_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_catalog
as $$
declare
  v_access jsonb;
  v_role text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;
  v_access := public.current_member_access_v1();
  v_role := coalesce(v_access->>'role','guest');
  if coalesce((v_access->>'approved')::boolean,false) is not true or v_role='guest' then
    raise exception using errcode='42501', message='Approved member required';
  end if;
  return jsonb_build_object('uid',auth.uid(),'role',v_role);
end;
$$;
revoke all on function private.ai_credit_member_v1() from public, anon, authenticated;

create or replace function private.ai_credit_balance_of_v1(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path=public,private,auth,pg_catalog
as $$
  select coalesce(sum(remaining),0)::integer
  from private.ai_credit_lot_v1
  where user_id=p_uid and remaining>0 and (expires_at is null or expires_at>now());
$$;
revoke all on function private.ai_credit_balance_of_v1(uuid) from public, anon, authenticated;

create or replace function public.ai_credit_balance_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_catalog
as $$
declare
  v_who jsonb := private.ai_credit_member_v1();
  v_uid uuid := (v_who->>'uid')::uuid;
  v_day timestamptz := date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
  v_enforce boolean;
  v_free jsonb;
  v_soon integer;
begin
  select enforce into v_enforce from private.ai_credit_settings_v1 where id;
  select coalesce(sum(remaining),0)::integer into v_soon
    from private.ai_credit_lot_v1
    where user_id=v_uid and remaining>0 and expires_at is not null
      and expires_at>now() and expires_at<=now()+interval '30 days';
  select coalesce(jsonb_agg(jsonb_build_object(
      'capability',p.capability,'cost',p.cost,'freeDaily',p.free_daily,
      'freeUsedToday',greatest(0,coalesce(u.used,0))) order by p.capability),'[]'::jsonb)
    into v_free
    from private.ai_credit_policy_v1 p
    left join lateral (
      select count(*) filter (where l.kind='free') - count(*) filter (where l.kind='refund' and l.delta=0) as used
      from private.ai_credit_ledger_v1 l
      where l.user_id=v_uid and l.capability=p.capability and l.created_at>=v_day
    ) u on true;
  return jsonb_build_object(
    'enforced',coalesce(v_enforce,false),
    'unlimited',v_who->>'role'='admin',
    'balance',private.ai_credit_balance_of_v1(v_uid),
    'expiringWithin30Days',v_soon,
    'policy',v_free
  );
end;
$$;

create or replace function public.ai_credit_spend_v1(p_capability text, p_ref text)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_catalog
as $$
declare
  v_who jsonb := private.ai_credit_member_v1();
  v_uid uuid := (v_who->>'uid')::uuid;
  v_day timestamptz := date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh';
  v_enforce boolean;
  v_cost integer;
  v_free integer;
  v_used integer;
  v_balance integer;
  v_need integer;
  v_take integer;
  v_lots jsonb := '[]'::jsonb;
  v_lot record;
begin
  if p_capability is null or p_capability !~ '^[a-z0-9_:.-]{2,64}$' then
    raise exception using errcode='22023', message='Invalid capability';
  end if;
  if p_ref is null or length(p_ref) not between 8 and 120 then
    raise exception using errcode='22023', message='Invalid ref';
  end if;

  select enforce into v_enforce from private.ai_credit_settings_v1 where id;
  if coalesce(v_enforce,false) is not true or v_who->>'role'='admin' then
    return jsonb_build_object('allowed',true,'enforced',false,'charged',0,'free',false);
  end if;

  select cost, free_daily into v_cost, v_free from private.ai_credit_policy_v1 where capability=p_capability;
  if not found or v_cost=0 then
    return jsonb_build_object('allowed',true,'enforced',true,'charged',0,'free',false);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':ai-credit-v1',0));

  if exists (select 1 from private.ai_credit_ledger_v1 where user_id=v_uid and kind in ('spend','free') and ref=p_ref) then
    return jsonb_build_object('allowed',true,'enforced',true,'duplicate',true,'balance',private.ai_credit_balance_of_v1(v_uid));
  end if;

  select count(*) filter (where kind='free') - count(*) filter (where kind='refund' and delta=0)
    into v_used
    from private.ai_credit_ledger_v1
    where user_id=v_uid and capability=p_capability and created_at>=v_day;

  if coalesce(v_used,0) < v_free then
    insert into private.ai_credit_ledger_v1(user_id,kind,capability,delta,ref)
      values (v_uid,'free',p_capability,0,p_ref);
    return jsonb_build_object('allowed',true,'enforced',true,'charged',0,'free',true,
      'freeRemaining',greatest(0,v_free-coalesce(v_used,0)-1),'balance',private.ai_credit_balance_of_v1(v_uid));
  end if;

  v_balance := private.ai_credit_balance_of_v1(v_uid);
  if v_balance < v_cost then
    return jsonb_build_object('allowed',false,'enforced',true,'reason','insufficient_credits',
      'cost',v_cost,'balance',v_balance);
  end if;

  v_need := v_cost;
  for v_lot in
    select id, remaining from private.ai_credit_lot_v1
    where user_id=v_uid and remaining>0 and (expires_at is null or expires_at>now())
    order by expires_at nulls last, id
    for update
  loop
    exit when v_need<=0;
    v_take := least(v_lot.remaining, v_need);
    update private.ai_credit_lot_v1 set remaining=remaining-v_take where id=v_lot.id;
    v_lots := v_lots || jsonb_build_array(jsonb_build_object('lot',v_lot.id,'take',v_take));
    v_need := v_need - v_take;
  end loop;

  insert into private.ai_credit_ledger_v1(user_id,kind,capability,delta,ref,lots)
    values (v_uid,'spend',p_capability,-v_cost,p_ref,v_lots);

  return jsonb_build_object('allowed',true,'enforced',true,'charged',v_cost,'free',false,
    'balance',private.ai_credit_balance_of_v1(v_uid));
end;
$$;

create or replace function public.ai_credit_refund_v1(p_ref text)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_catalog
as $$
declare
  v_who jsonb := private.ai_credit_member_v1();
  v_uid uuid := (v_who->>'uid')::uuid;
  v_row private.ai_credit_ledger_v1%rowtype;
  v_item jsonb;
begin
  if p_ref is null or length(p_ref) not between 8 and 120 then
    raise exception using errcode='22023', message='Invalid ref';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':ai-credit-v1',0));

  if exists (select 1 from private.ai_credit_ledger_v1 where user_id=v_uid and kind='refund' and ref=p_ref) then
    return jsonb_build_object('refunded',false,'duplicate',true);
  end if;

  select * into v_row from private.ai_credit_ledger_v1
    where user_id=v_uid and kind in ('spend','free') and ref=p_ref;
  if not found then
    return jsonb_build_object('refunded',false,'reason','not_found');
  end if;

  if v_row.kind='spend' then
    for v_item in select * from jsonb_array_elements(coalesce(v_row.lots,'[]'::jsonb)) loop
      update private.ai_credit_lot_v1
        set remaining=least(initial, remaining+(v_item->>'take')::integer)
        where id=(v_item->>'lot')::bigint and user_id=v_uid;
    end loop;
    insert into private.ai_credit_ledger_v1(user_id,kind,capability,delta,ref)
      values (v_uid,'refund',v_row.capability,-v_row.delta,p_ref);
  else
    insert into private.ai_credit_ledger_v1(user_id,kind,capability,delta,ref)
      values (v_uid,'refund',v_row.capability,0,p_ref);
  end if;

  return jsonb_build_object('refunded',true,'balance',private.ai_credit_balance_of_v1(v_uid));
end;
$$;

create or replace function public.ai_credit_claim_v1(p_campaign text)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_catalog
as $$
declare
  v_who jsonb := private.ai_credit_member_v1();
  v_uid uuid := (v_who->>'uid')::uuid;
  v_c private.ai_credit_campaign_v1%rowtype;
  v_expires timestamptz;
  v_id bigint;
begin
  select * into v_c from private.ai_credit_campaign_v1
    where campaign=p_campaign and enabled and now()>=starts_at and now()<ends_at;
  if not found then
    return jsonb_build_object('claimed',false,'reason','campaign_unavailable');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text||':ai-credit-v1',0));
  v_expires := now() + make_interval(days => v_c.credit_valid_days);

  insert into private.ai_credit_lot_v1(user_id,source,ref,initial,remaining,expires_at)
    values (v_uid,'campaign',v_c.campaign,v_c.amount,v_c.amount,v_expires)
    on conflict (user_id,source,ref) do nothing
    returning id into v_id;

  if v_id is null then
    return jsonb_build_object('claimed',false,'reason','already_claimed','balance',private.ai_credit_balance_of_v1(v_uid));
  end if;

  insert into private.ai_credit_ledger_v1(user_id,kind,delta,ref)
    values (v_uid,'grant',v_c.amount,'campaign:'||v_c.campaign);

  return jsonb_build_object('claimed',true,'amount',v_c.amount,'expiresAt',v_expires,
    'balance',private.ai_credit_balance_of_v1(v_uid));
end;
$$;

-- Admin-only manual grant (support, competitions, compensation). Idempotent per ref.
create or replace function public.ai_credit_admin_grant_v1(p_user uuid, p_amount integer, p_ref text, p_valid_days integer default 180)
returns jsonb
language plpgsql
security definer
set search_path=public,private,auth,pg_catalog
as $$
declare
  v_who jsonb := private.ai_credit_member_v1();
  v_id bigint;
begin
  if v_who->>'role'<>'admin' then
    raise exception using errcode='42501', message='Admin required';
  end if;
  if p_user is null or p_amount is null or p_amount not between 1 and 100000
     or p_ref is null or length(p_ref) not between 3 and 100
     or p_valid_days is null or p_valid_days not between 1 and 3650 then
    raise exception using errcode='22023', message='Invalid grant';
  end if;
  if not exists (select 1 from auth.users where id=p_user) then
    raise exception using errcode='22023', message='Unknown user';
  end if;

  insert into private.ai_credit_lot_v1(user_id,source,ref,initial,remaining,expires_at)
    values (p_user,'grant',p_ref,p_amount,p_amount,now()+make_interval(days=>p_valid_days))
    on conflict (user_id,source,ref) do nothing
    returning id into v_id;

  if v_id is null then
    return jsonb_build_object('granted',false,'reason','duplicate');
  end if;
  insert into private.ai_credit_ledger_v1(user_id,kind,delta,ref)
    values (p_user,'grant',p_amount,'grant:'||p_ref);
  return jsonb_build_object('granted',true,'amount',p_amount);
end;
$$;

revoke all on function public.ai_credit_balance_v1() from public, anon;
revoke all on function public.ai_credit_spend_v1(text,text) from public, anon;
revoke all on function public.ai_credit_refund_v1(text) from public, anon;
revoke all on function public.ai_credit_claim_v1(text) from public, anon;
revoke all on function public.ai_credit_admin_grant_v1(uuid,integer,text,integer) from public, anon;
grant execute on function public.ai_credit_balance_v1() to authenticated;
grant execute on function public.ai_credit_spend_v1(text,text) to authenticated;
grant execute on function public.ai_credit_refund_v1(text) to authenticated;
grant execute on function public.ai_credit_claim_v1(text) to authenticated;
grant execute on function public.ai_credit_admin_grant_v1(uuid,integer,text,integer) to authenticated;
