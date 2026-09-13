-- Phase 19: member quiz bank is data-first. Drive/file names are provenance only,
-- never member-facing taxonomy. Approved questions remain usable regardless of the
-- historical folder registry used by earlier intake phases.

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

revoke all on function public.practice_quiz_config_v1() from public,anon;
revoke all on function public.practice_quiz_page_v1(text,integer,integer,text) from public,anon;
grant execute on function public.practice_quiz_config_v1() to authenticated;
grant execute on function public.practice_quiz_page_v1(text,integer,integer,text) to authenticated;
