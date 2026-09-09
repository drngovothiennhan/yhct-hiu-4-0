-- The academic feed is intentionally public, but its backing member/post tables remain private.
-- Run the bounded, privacy-scrubbed read RPC with its postgres owner privileges instead of
-- granting anon/authenticated direct SELECT on club_members, clinical_posts, reactions or comments.

alter function public.academic_feed_v1(integer) security definer;
alter function public.academic_feed_v1(integer) set search_path = '';
revoke all on function public.academic_feed_v1(integer) from public;
grant execute on function public.academic_feed_v1(integer) to anon, authenticated, service_role;
