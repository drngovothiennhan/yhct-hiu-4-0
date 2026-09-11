create table if not exists public.practice_import_drafts_v2(
 id text primary key,
 payload jsonb not null,
 revision integer not null default 1,
 created_by uuid not null references public.club_members(id),
 updated_at timestamptz not null default now()
);
alter table public.practice_import_drafts_v2 enable row level security;
revoke all on public.practice_import_drafts_v2 from anon,authenticated;
create index if not exists practice_import_drafts_v2_creator_idx on public.practice_import_drafts_v2(created_by);

create or replace function public.practice_import_workspace_v2(p_action text,p_key text default '',p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); d public.practice_import_drafts_v2%rowtype; result jsonb; ids jsonb; remaining integer;
begin
 if mid is null or not exists(select 1 from public.club_members where id=mid and role='admin' and status='approved') then raise exception 'Admin required'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'fileName',x.payload->'document'->>'fileName','subject',x.payload->'document'->>'subjectHint','total',jsonb_array_length(x.payload->'questions'),'pending',(select count(*) from jsonb_array_elements(x.payload->'questions') q where coalesce((q->>'imported')::boolean,false)=false),'updatedAt',x.updated_at) order by x.updated_at desc),'[]'::jsonb) into result from (select * from public.practice_import_drafts_v2 order by updated_at desc limit 100) x;
  return result;
 end if;
 if char_length(p_key) not between 1 and 240 then raise exception 'Invalid draft key'; end if;
 if p_action='save' then
  if jsonb_typeof(p_payload->'questions') is distinct from 'array' or jsonb_array_length(p_payload->'questions')>1000 or octet_length(p_payload::text)>3000000 then raise exception 'Invalid or oversized draft'; end if;
  insert into public.practice_import_drafts_v2(id,payload,created_by) values(p_key,p_payload,mid) on conflict(id) do nothing;
 end if;
 select * into d from public.practice_import_drafts_v2 where id=p_key for update;
 if d.id is null then raise exception 'Draft not found'; end if;
 if p_action in('get','save') then return d.payload||jsonb_build_object('id',d.id,'revision',d.revision); end if;
 if p_action='commit' then
  if coalesce((p_payload->>'revision')::integer,-1)<>d.revision then raise exception 'Draft changed. Reload before importing.'; end if;
  ids:=p_payload->'ids';
  if jsonb_typeof(ids) is distinct from 'array' or jsonb_typeof(p_payload->'questions') is distinct from 'array' then raise exception 'Invalid questions'; end if;
  if jsonb_array_length(ids)=0 or jsonb_array_length(ids)<>jsonb_array_length(p_payload->'questions') then raise exception 'Invalid selection'; end if;
  if exists(select 1 from jsonb_array_elements_text(ids) i where not exists(select 1 from jsonb_array_elements(d.payload->'questions') q where q->>'id'=i and coalesce((q->>'imported')::boolean,false)=false)) then raise exception 'Question already imported or missing'; end if;
  result:=public.practice_drive_ingest_admin_v1(d.payload->'document',p_payload->'questions');
  update public.practice_import_drafts_v2 set payload=jsonb_set(payload,'{questions}',(select jsonb_agg(case when ids ? (q->>'id') then q||jsonb_build_object('imported',true) else q end order by ord) from jsonb_array_elements(payload->'questions') with ordinality a(q,ord))),revision=revision+1,updated_at=now() where id=p_key;
  select count(*) into remaining from public.practice_import_drafts_v2 x cross join lateral jsonb_array_elements(x.payload->'questions') q where x.id=p_key and coalesce((q->>'imported')::boolean,false)=false;
  return result||jsonb_build_object('remaining',remaining);
 end if;
 raise exception 'Invalid action';
end $$;
revoke all on function public.practice_import_workspace_v2(text,text,jsonb) from public,anon;
grant execute on function public.practice_import_workspace_v2(text,text,jsonb) to authenticated;
