update private.practice_subject_folders_v1
set active=false
where active is distinct from false;

insert into private.practice_subject_folders_v1(folder_name,active,first_seen_at,last_seen_at)
values
  ('Sinh lý',true,now(),now()),
  ('Tâm lý đạo đức',true,now(),now()),
  ('Sinh lý bệnh',true,now(),now()),
  ('Sức khỏe môi trường',true,now(),now()),
  ('Phương pháp NCKH',true,now(),now()),
  ('YHCT co sở',true,now(),now()),
  ('Thuốc yhct',true,now(),now()),
  ('Châm cứu',true,now(),now()),
  ('Điều dưỡng cơ bản',true,now(),now()),
  ('Ký sinh trùng',true,now(),now())
on conflict (folder_name) do update
set active=true,last_seen_at=excluded.last_seen_at;

create or replace function public.practice_quiz_config_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  mid uuid:=private.current_member_id();
  eligible integer:=0;
  subjects jsonb:='[]'::jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;

  select count(*) into eligible
  from public.practice_questions q
  join private.practice_subject_folders_v1 f
    on f.active=true
   and lower(btrim(f.folder_name))=lower(btrim(coalesce(q.subject,'')))
  where q.review_status in('source_verified','expert_approved');

  select coalesce(jsonb_agg(x.folder_name order by lower(x.folder_name),x.folder_name),'[]'::jsonb)
  into subjects
  from (
    select distinct f.folder_name
    from private.practice_subject_folders_v1 f
    join public.practice_questions q
      on lower(btrim(q.subject))=lower(btrim(f.folder_name))
     and q.review_status in('source_verified','expert_approved')
    where f.active=true
  ) x;

  return jsonb_build_object('ready',eligible>0,'eligibleCount',eligible,'subjects',subjects,'pageSize',25,'continuous',true);
end
$function$;

create or replace function public.practice_quiz_page_v1(p_subject text default ''::text,p_offset integer default 0,p_limit integer default 25,p_seed text default ''::text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
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
    select q.*,f.folder_name as display_subject
    from public.practice_questions q
    join private.practice_subject_folders_v1 f
      on f.active=true
     and lower(btrim(f.folder_name))=lower(btrim(coalesce(q.subject,'')))
    where q.review_status in('source_verified','expert_approved')
  )
  select count(*) into total
  from eligible e
  where subject_filter='' or lower(e.display_subject)=lower(subject_filter);

  if subject_filter<>'' and total=0 then raise exception 'Nội dung ôn tập chưa có câu hỏi khả dụng'; end if;

  with eligible as (
    select q.*,f.folder_name as display_subject
    from public.practice_questions q
    join private.practice_subject_folders_v1 f
      on f.active=true
     and lower(btrim(f.folder_name))=lower(btrim(coalesce(q.subject,'')))
    where q.review_status in('source_verified','expert_approved')
  ), page_rows as (
    select e.*,row_number() over(order by md5(seed||'|'||e.id::text),e.id)::integer as ord
    from eligible e
    where subject_filter='' or lower(e.display_subject)=lower(subject_filter)
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
$function$;

revoke all on function public.practice_quiz_config_v1() from public;
revoke all on function public.practice_quiz_page_v1(text,integer,integer,text) from public;
grant execute on function public.practice_quiz_config_v1() to authenticated,service_role;
grant execute on function public.practice_quiz_page_v1(text,integer,integer,text) to authenticated,service_role;
