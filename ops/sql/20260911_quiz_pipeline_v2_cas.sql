-- HIU YHCT 4.0 — PHASE 2 quiz pipeline v2
-- Backwards-compatible extension: keeps the existing draft table and public function signature.
-- Adds optimistic-CAS draft replacement so chunked processing can persist real progress/retry state safely.

create or replace function public.practice_import_workspace_v2(p_action text, p_key text default ''::text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  mid uuid:=private.current_member_id();
  d public.practice_import_drafts_v2%rowtype;
  result jsonb;
  ids jsonb;
  remaining integer;
  next_payload jsonb;
begin
  if mid is null or not private.is_learning_content_manager() then raise exception 'Learning content manager required'; end if;

  if p_action='list' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,
      'fileName',x.payload->'document'->>'fileName',
      'subject',x.payload->'document'->>'subjectHint',
      'total',jsonb_array_length(x.payload->'questions'),
      'pending',(select count(*) from jsonb_array_elements(x.payload->'questions') q where coalesce((q->>'imported')::boolean,false)=false),
      'pipelineState',coalesce(x.payload->'pipeline'->>'state','legacy'),
      'pipelineProgress',coalesce((x.payload->'pipeline'->>'percent')::integer,100),
      'updatedAt',x.updated_at
    ) order by x.updated_at desc),'[]'::jsonb)
    into result
    from (select * from public.practice_import_drafts_v2 order by updated_at desc limit 100) x;
    return result;
  end if;

  if char_length(p_key) not between 1 and 240 then raise exception 'Invalid draft key'; end if;

  if p_action='save' then
    if jsonb_typeof(p_payload->'questions') is distinct from 'array'
       or jsonb_array_length(p_payload->'questions')>1000
       or octet_length(p_payload::text)>3000000 then
      raise exception 'Invalid or oversized draft';
    end if;
    insert into public.practice_import_drafts_v2(id,payload,created_by)
    values(p_key,p_payload,mid)
    on conflict(id) do nothing;
  end if;

  select * into d from public.practice_import_drafts_v2 where id=p_key for update;
  if d.id is null then raise exception 'Draft not found'; end if;

  if p_action='replace' then
    if coalesce((p_payload->>'revision')::integer,-1)<>d.revision then raise exception 'Draft changed. Reload before updating.'; end if;
    next_payload:=p_payload->'draft';
    if jsonb_typeof(next_payload) is distinct from 'object'
       or jsonb_typeof(next_payload->'questions') is distinct from 'array'
       or jsonb_array_length(next_payload->'questions')>1000
       or octet_length(next_payload::text)>3000000 then
      raise exception 'Invalid or oversized draft';
    end if;
    update public.practice_import_drafts_v2
      set payload=next_payload,revision=revision+1,updated_at=now()
      where id=p_key;
    select * into d from public.practice_import_drafts_v2 where id=p_key;
    return d.payload||jsonb_build_object('id',d.id,'revision',d.revision);
  end if;

  if p_action in('get','save') then return d.payload||jsonb_build_object('id',d.id,'revision',d.revision); end if;

  if p_action='commit' then
    if coalesce((p_payload->>'revision')::integer,-1)<>d.revision then raise exception 'Draft changed. Reload before importing.'; end if;
    ids:=p_payload->'ids';
    if jsonb_typeof(ids) is distinct from 'array' or jsonb_typeof(p_payload->'questions') is distinct from 'array' then raise exception 'Invalid questions'; end if;
    if jsonb_array_length(ids)=0
       or jsonb_array_length(ids)>200
       or (select count(distinct value) from jsonb_array_elements_text(ids))<>jsonb_array_length(ids)
       or jsonb_array_length(ids)<>jsonb_array_length(p_payload->'questions') then
      raise exception 'Invalid selection';
    end if;
    if exists(
      select 1 from jsonb_array_elements_text(ids) i
      where not exists(
        select 1 from jsonb_array_elements(d.payload->'questions') q
        where q->>'id'=i and coalesce((q->>'imported')::boolean,false)=false
      )
    ) then raise exception 'Question already imported or missing'; end if;

    result:=public.practice_drive_ingest_admin_v1(d.payload->'document',p_payload->'questions');
    update public.practice_import_drafts_v2
      set payload=jsonb_set(payload,'{questions}',(
        select jsonb_agg(
          case when ids ? (q->>'id') then
            q||jsonb_build_object('imported',true,'importedSnapshot',(
              select v from jsonb_array_elements(p_payload->'questions') with ordinality z(v,n)
              where n=(select k from jsonb_array_elements_text(ids) with ordinality i(t,k) where t=q->>'id')
            ))
          else q end order by ord
        )
        from jsonb_array_elements(payload->'questions') with ordinality a(q,ord)
      )),revision=revision+1,updated_at=now()
      where id=p_key;

    select count(*) into remaining
      from public.practice_import_drafts_v2 x
      cross join lateral jsonb_array_elements(x.payload->'questions') q
      where x.id=p_key and coalesce((q->>'imported')::boolean,false)=false;

    update public.practice_source_documents
      set question_count=(select count(*) from public.practice_questions where source_file_id=d.payload->'document'->>'driveFileId'),
          sync_status=case when remaining>0 then 'needs_review' else 'ready' end
      where drive_file_id=d.payload->'document'->>'driveFileId';

    return result||jsonb_build_object('remaining',remaining);
  end if;

  raise exception 'Invalid action';
end
$function$;

revoke all on function public.practice_import_workspace_v2(text,text,jsonb) from public;
grant execute on function public.practice_import_workspace_v2(text,text,jsonb) to authenticated, service_role;
