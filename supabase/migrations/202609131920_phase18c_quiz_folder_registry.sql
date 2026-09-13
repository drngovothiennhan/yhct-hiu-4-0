-- Phase 18C: authoritative member-facing quiz content comes from immediate child folders
-- under the canonical `Thêm thủ công` Drive intake. File names are never member subjects.

create table if not exists private.practice_subject_folders_v1 (
  folder_name text primary key,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint practice_subject_folders_v1_name_check check (char_length(btrim(folder_name)) between 1 and 160)
);

revoke all on table private.practice_subject_folders_v1 from public,anon,authenticated;

-- Safe bootstrap for the current production bank. Obvious historical file-derived
-- labels are deliberately excluded; the next Admin `Cập nhật` fully replaces this
-- bootstrap set with the live Drive child-folder list.
insert into private.practice_subject_folders_v1(folder_name,active,first_seen_at,last_seen_at)
select distinct btrim(q.subject),true,now(),now()
from public.practice_questions q
where q.review_status in('source_verified','expert_approved')
  and btrim(q.subject)<>''
  and lower(btrim(q.subject)) not in('chưa phân loại','them thu cong','thêm thủ công')
  and btrim(q.subject) !~* '\.(docx|pdf|txt|xlsx?|pptx?)$'
on conflict(folder_name) do nothing;

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

  update private.practice_subject_folders_v1 set active=false;

  insert into private.practice_subject_folders_v1(folder_name,active,first_seen_at,last_seen_at)
  select s.folder_name,true,now(),now()
  from (
    select distinct left(btrim(value),160) as folder_name
    from unnest(coalesce(p_subjects,'{}'::text[])) value
    where btrim(value)<>''
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

revoke all on function public.practice_subject_folders_sync_admin_v1(text[]) from public,anon;
grant execute on function public.practice_subject_folders_sync_admin_v1(text[]) to authenticated;

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
  join private.practice_subject_folders_v1 f on f.active and f.folder_name=q.subject
  where q.review_status in('source_verified','expert_approved');

  select coalesce(jsonb_agg(x.folder_name order by lower(x.folder_name),x.folder_name),'[]'::jsonb) into subjects
  from (
    select folder_name
    from private.practice_subject_folders_v1
    where active
  ) x;

  return jsonb_build_object(
    'ready',eligible>0,
    'eligibleCount',eligible,
    'subjects',subjects,
    'pageSize',25,
    'continuous',true
  );
end
$$;

revoke all on function public.practice_quiz_config_v1() from public,anon;
grant execute on function public.practice_quiz_config_v1() to authenticated;

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

  if subject_filter<>'' and not exists(
    select 1 from private.practice_subject_folders_v1 f
    where f.active and f.folder_name=subject_filter
  ) then
    raise exception 'Nội dung HIU không còn trong lần cập nhật mới nhất';
  end if;

  select count(*) into total
  from public.practice_questions q
  join private.practice_subject_folders_v1 f on f.active and f.folder_name=q.subject
  where q.review_status in('source_verified','expert_approved')
    and (subject_filter='' or q.subject=subject_filter);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'subject',p.subject,
    'topic',p.topic,
    'stem',p.stem,
    'options',to_jsonb(p.options),
    'sourceFileName',p.source_file_name,
    'generationMethod',p.generation_method,
    'reviewStatus',p.review_status
  ) order by p.ord),'[]'::jsonb) into rows
  from (
    select q.*,row_number() over(order by md5(seed||'|'||q.id::text),q.id)::integer as ord
    from public.practice_questions q
    join private.practice_subject_folders_v1 f on f.active and f.folder_name=q.subject
    where q.review_status in('source_verified','expert_approved')
      and (subject_filter='' or q.subject=subject_filter)
    order by md5(seed||'|'||q.id::text),q.id
    offset row_offset limit row_limit
  ) p;

  return jsonb_build_object(
    'ready',total>0,
    'subject',subject_filter,
    'offset',row_offset,
    'pageSize',row_limit,
    'total',total,
    'hasMore',row_offset+jsonb_array_length(rows)<total,
    'questions',rows
  );
end
$$;

revoke all on function public.practice_quiz_page_v1(text,integer,integer,text) from public,anon;
grant execute on function public.practice_quiz_page_v1(text,integer,integer,text) to authenticated;
