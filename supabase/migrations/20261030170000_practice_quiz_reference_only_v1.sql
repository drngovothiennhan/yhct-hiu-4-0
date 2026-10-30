-- Đánh dấu câu luyện thi có tài liệu nguồn chưa được kiểm (practice_source_documents.sync_status='needs_review').
-- Chủ dự án duyệt 30/10/2026: các câu này vẫn hiển thị nhưng chỉ mang tính tham khảo.
-- Chỉ thêm trường referenceOnly vào kết quả; chữ ký, quyền và cách chọn câu giữ nguyên.
create or replace function public.practice_quiz_page_v1(p_subject text default ''::text, p_offset integer default 0, p_limit integer default 25, p_seed text default ''::text)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
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
    'reviewStatus',p.review_status,
    'referenceOnly',coalesce(d.sync_status='needs_review',false)
  ) order by p.ord),'[]'::jsonb) into rows
  from page_rows p
  left join public.practice_source_documents d on d.drive_file_id=p.source_file_id;

  return jsonb_build_object('ready',total>0,'subject',subject_filter,'offset',row_offset,'pageSize',row_limit,'total',total,'hasMore',row_offset+jsonb_array_length(rows)<total,'questions',rows);
end
$function$;
