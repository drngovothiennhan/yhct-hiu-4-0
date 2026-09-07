-- Explicit API grants for desktop widget RPCs.
revoke execute on function public.research_opportunities_feed_v1(integer) from public;
grant execute on function public.research_opportunities_feed_v1(integer) to anon, authenticated;

revoke execute on function public.research_apply_v1(uuid) from public, anon;
grant execute on function public.research_apply_v1(uuid) to authenticated;

revoke execute on function public.drl_deadline_public_v1() from public, anon;
grant execute on function public.drl_deadline_public_v1() to authenticated;

revoke execute on function public.member_upcoming_schedule_v2(integer) from public, anon;
grant execute on function public.member_upcoming_schedule_v2(integer) to authenticated;

revoke execute on function public.schedule_checkin_v1(uuid) from public, anon;
grant execute on function public.schedule_checkin_v1(uuid) to authenticated;

-- Fast bounded substring lookup for verified herb-drug evidence.
create index if not exists herb_drug_interactions_herb_trgm_idx
  on public.herb_drug_interactions using gin (herb_name extensions.gin_trgm_ops);
create index if not exists herb_drug_interactions_drug_trgm_idx
  on public.herb_drug_interactions using gin (drug_name extensions.gin_trgm_ops);

-- Feed/query indexes aligned with the desktop widgets.
create index if not exists research_opportunities_open_deadline_idx
  on public.research_opportunities (deadline_at asc nulls last, created_at desc)
  where status = 'open';
create index if not exists research_applications_active_opportunity_idx
  on public.research_applications (opportunity_id, status)
  where status in ('requested','accepted');
create index if not exists schedules_active_window_idx
  on public.schedules (ends_at, starts_at)
  where status = 'scheduled';
