-- Public, privacy-safe showcase for the hiutmc.com portal. Additive; read-only aggregates.
-- Exposes: bank size, active learners (30d), launch gift terms, top 5 learners as MASKED initials.
-- Never returns member ids, full names, avatars or emails.
create or replace function private.mask_initials_v1(p_name text)
returns text language sql immutable set search_path=pg_catalog as $$
  select coalesce(nullif(string_agg(upper(left(w,1))||'.', '' order by ord),''),'?')
  from regexp_split_to_table(btrim(coalesce(p_name,'')), '\s+') with ordinality as t(w,ord)
  where w<>''
$$;

create or replace function public.public_showcase_v1()
returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_bank jsonb; v_learners bigint; v_gift jsonb; v_top jsonb;
begin
  select jsonb_build_object('questions',count(*),'subjects',count(distinct subject))
    into v_bank from public.practice_questions where review_status is distinct from 'rejected';

  select count(distinct l.actor_member_id) into v_learners
    from public.system_audit_logs l
   where l.action='practice.quiz.submit' and l.actor_member_id is not null
     and l.created_at>=now()-interval '30 days';

  select jsonb_build_object('credits',c.amount,'validDays',c.credit_valid_days,'endsAt',c.ends_at)
    into v_gift from private.ai_credit_campaign_v1 c
   where c.enabled and now()<c.ends_at order by c.starts_at desc limit 1;

  with quiz as (
    select l.actor_member_id mid,
           sum(greatest(0,least(coalesce((l.metadata->>'total')::int,0),500))) q,
           sum(greatest(0,least(coalesce((l.metadata->>'correct')::int,0),500))) ok,
           count(*) subs,
           count(distinct (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date) days
      from public.system_audit_logs l
     where l.action='practice.quiz.submit' and l.actor_member_id is not null
       and l.created_at>=now()-interval '30 days'
     group by 1),
  scored as (
    select m.full_name, (q.ok*4+greatest(q.q-q.ok,0)+q.subs*2+q.days*5)::bigint pts, q.ok
      from quiz q join public.club_members m on m.id=q.mid
     where m.status='approved' and m.login_enabled and not m.data_conflict and q.q>0),
  ranked as (select dense_rank() over(order by pts desc, ok desc) rk, * from scored)
  -- k-anonymity: publish the top list only when at least 3 learners qualify, so a lone learner is never identifiable.
  select case when (select count(*) from ranked)>=3
           then coalesce((select jsonb_agg(jsonb_build_object('rank',rk,'name',private.mask_initials_v1(full_name),'points',pts) order by rk)
                            from (select * from ranked order by rk limit 5) t),'[]'::jsonb)
           else '[]'::jsonb end
    into v_top;

  return jsonb_build_object(
    'generatedAt',now(),
    'bank',coalesce(v_bank,'{}'::jsonb),
    'activeLearners30d',coalesce(v_learners,0),
    'gift',v_gift,
    'top',v_top
  );
end $$;
revoke all on function public.public_showcase_v1() from public;
grant execute on function public.public_showcase_v1() to anon,authenticated;
