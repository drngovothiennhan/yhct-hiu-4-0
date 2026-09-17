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
  if mid is null or not private.is_approved() then
    raise exception 'Approved member required';
  end if;

  select count(*) into eligible
  from public.practice_questions q
  join private.practice_subject_folders_v1 f
    on f.active=true
   and lower(btrim(f.folder_name))=lower(btrim(coalesce(q.subject,'')))
  where q.review_status in('source_verified','expert_approved');

  select coalesce(
    jsonb_agg(f.folder_name order by lower(f.folder_name),f.folder_name),
    '[]'::jsonb
  )
  into subjects
  from private.practice_subject_folders_v1 f
  where f.active=true;

  return jsonb_build_object(
    'ready',eligible>0,
    'eligibleCount',eligible,
    'subjects',subjects,
    'pageSize',25,
    'continuous',true
  );
end
$function$;

revoke all on function public.practice_quiz_config_v1() from public;
grant execute on function public.practice_quiz_config_v1() to authenticated,service_role;
