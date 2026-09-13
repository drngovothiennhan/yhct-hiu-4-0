-- Phase 19: member quiz bank is data-first. DOCX file names are provenance only and
-- never member-facing taxonomy. A one-level subject folder inside "Thêm thủ công"
-- may supply the subject label, while approved questions remain usable independently
-- of the historical folder registry used by earlier intake phases.

create or replace function public.practice_quiz_config_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  eligible integer:=0;
  subjects jsonb:='[]'::jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;

  select count(*) into eligible
  from public.practice_questions q
  where q.review_status in('source_verified','expert_approved');

  select coalesce(jsonb_agg(x.display_subject order by lower(x.display_subject),x.display_subject),'[]'::jsonb)
  into subjects
  from (
    select distinct case
      when btrim(coalesce(q.subject,''))='' then 'Ngân hàng HIU'
      when lower(btrim(q.subject)) in('chưa phân loại','them thu cong','thêm thủ công','ngân hàng trắc nghiệm') then 'Ngân hàng HIU'
      when btrim(q.subject) ~* '\.(docx|pdf|txt|xlsx?|pptx?)$' then 'Ngân hàng HIU'
      else left(btrim(q.subject),160)
    end as display_subject
    from public.practice_questions q
    where q.review_status in('source_verified','expert_approved')
  ) x;

  return jsonb_build_object('ready',eligible>0,'eligibleCount',eligible,'subjects',subjects,'pageSize',25,'continuous',true);
end
$$;

create or replace function public.practice_quiz_page_v1(
  p_subject text default '',
  p_offset integer default 0,
  p_limit integer default 25,
  p_seed text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  subject_filter text:=left(btrim(coalesce(p_subject,'')),160);
  row_offset integer:=greatest(0,least(coalesce(p_offset,0),1000000));
  row_limit integer:=greatest(1,least(coalesce(p_limit,25),50));
  seed text:=left(coalesce(nullif(btrim(p_seed),''),mid::text),120);
  total integer:=0;
  rows jsonb:='[]'::jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;

  with eligible as (
    select q.*,case
      when btrim(coalesce(q.subject,''))='' then 'Ngân hàng HIU'
      when lower(btrim(q.subject)) in('chưa phân loại','them thu cong','thêm thủ công','ngân hàng trắc nghiệm') then 'Ngân hàng HIU'
      when btrim(q.subject) ~* '\.(docx|pdf|txt|xlsx?|pptx?)$' then 'Ngân hàng HIU'
      else left(btrim(q.subject),160)
    end as display_subject
    from public.practice_questions q
    where q.review_status in('source_verified','expert_approved')
  )
  select count(*) into total from eligible e where subject_filter='' or e.display_subject=subject_filter;

  if subject_filter<>'' and total=0 then raise exception 'Nội dung ôn tập chưa có câu hỏi khả dụng'; end if;

  with eligible as (
    select q.*,case
      when btrim(coalesce(q.subject,''))='' then 'Ngân hàng HIU'
      when lower(btrim(q.subject)) in('chưa phân loại','them thu cong','thêm thủ công','ngân hàng trắc nghiệm') then 'Ngân hàng HIU'
      when btrim(q.subject) ~* '\.(docx|pdf|txt|xlsx?|pptx?)$' then 'Ngân hàng HIU'
      else left(btrim(q.subject),160)
    end as display_subject
    from public.practice_questions q
    where q.review_status in('source_verified','expert_approved')
  ), page_rows as (
    select e.*,row_number() over(order by md5(seed||'|'||e.id::text),e.id)::integer as ord
    from eligible e
    where subject_filter='' or e.display_subject=subject_filter
    order by md5(seed||'|'||e.id::text),e.id
    offset row_offset limit row_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'subject',p.display_subject,
    'topic',p.topic,
    'stem',p.stem,
    'options',to_jsonb(p.options),
    'generationMethod',p.generation_method,
    'reviewStatus',p.review_status
  ) order by p.ord),'[]'::jsonb) into rows
  from page_rows p;

  return jsonb_build_object('ready',total>0,'subject',subject_filter,'offset',row_offset,'pageSize',row_limit,'total',total,'hasMore',row_offset+jsonb_array_length(rows)<total,'questions',rows);
end
$$;

-- Preserve the Drive-folder registry as management metadata, but keep it out of the
-- member quiz eligibility path. The WHERE clause is intentional: production enables
-- the safe-update guard and rejects blanket UPDATE statements.
create or replace function public.practice_subject_folders_sync_admin_v1(p_subjects text[])
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  result jsonb:='[]'::jsonb;
  active_count integer:=0;
begin
  if mid is null or not private.is_learning_content_manager() then
    raise exception 'Learning content manager required';
  end if;

  update private.practice_subject_folders_v1
    set active=false
    where active is true;

  insert into private.practice_subject_folders_v1(folder_name,active,first_seen_at,last_seen_at)
  select s.folder_name,true,now(),now()
  from (
    select distinct left(btrim(u.value),160) as folder_name
    from unnest(coalesce(p_subjects,'{}'::text[])) as u(value)
    where btrim(u.value)<>''
  ) s
  on conflict(folder_name) do update set active=true,last_seen_at=now();

  select count(*),coalesce(jsonb_agg(x.folder_name order by lower(x.folder_name),x.folder_name),'[]'::jsonb)
  into active_count,result
  from (
    select folder_name
    from private.practice_subject_folders_v1
    where active
  ) x;

  perform private.audit_event(
    'practice.subject_folders.sync',
    'practice_subject_folders',
    mid::text,
    'info',
    jsonb_build_object('active_count',active_count,'subjects',result)
  );

  return jsonb_build_object('ok',true,'count',active_count,'subjects',result);
end
$$;

revoke all on function public.practice_quiz_config_v1() from public,anon;
revoke all on function public.practice_quiz_page_v1(text,integer,integer,text) from public,anon;
revoke all on function public.practice_subject_folders_sync_admin_v1(text[]) from public,anon;
grant execute on function public.practice_quiz_config_v1() to authenticated;
grant execute on function public.practice_quiz_page_v1(text,integer,integer,text) to authenticated;
grant execute on function public.practice_subject_folders_sync_admin_v1(text[]) to authenticated;
