-- The credit leaderboard returns full member names; it must not be callable by signed-out visitors.
-- The public homepage uses public.public_showcase_v1 (masked initials, aggregates) instead.
revoke execute on function public.community_credit_leaderboard_v1(integer) from anon;
revoke execute on function public.community_credit_leaderboard_v1(integer) from public;
grant execute on function public.community_credit_leaderboard_v1(integer) to authenticated;
