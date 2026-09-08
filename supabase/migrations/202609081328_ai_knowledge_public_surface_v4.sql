begin;

-- Central RAG v3 is the only public read API. Older RPC versions remain available
-- to the function owner for internal composition, but are no longer callable through
-- PostgREST by anon/authenticated roles.
revoke all on function public.ai_knowledge_search_v1(text,text[],integer) from public,anon,authenticated;
revoke all on function public.ai_knowledge_search_v2(text,text[],integer) from public,anon,authenticated;
revoke all on function public.ai_knowledge_stats_v1() from public,anon,authenticated;
revoke all on function public.ai_knowledge_stats_v2() from public,anon,authenticated;

revoke all on function public.ai_knowledge_search_v3(text,text[],integer) from public;
revoke all on function public.ai_knowledge_stats_v3() from public;
grant execute on function public.ai_knowledge_search_v3(text,text[],integer) to anon,authenticated;
grant execute on function public.ai_knowledge_stats_v3() to anon,authenticated;

commit;
