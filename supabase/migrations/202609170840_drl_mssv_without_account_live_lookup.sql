-- DRL: activity points are keyed by MSSV, not by account existence.
-- Exact MSSV lookup is live immediately after an admin import; semester publication
-- remains the finalization/confirmation step, not a visibility gate.

create or replace function public.drl_admin_import_v1(
  p_file_name text,
  p_checksum_sha256 text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','extensions'
as $function$
declare
  mid uuid:=private.current_member_id();
  batch_id uuid;
  item jsonb;
  sem public.drl_semesters%rowtype;
  member_row public.club_members%rowtype;
  code text;
  source_name text;
  canonical_name text;
  act text;
  semcode text;
  notev text;
  pts numeric;
  fp text;
  total int:=0;
  accepted int:=0;
  rejected int:=0;
  dupes int:=0;
  warns jsonb:='[]'::jsonb;
  existing public.drl_import_batches%rowtype;
  occurred timestamptz;
  source_name_key text;
  member_name_key text;
  existing_source_batch uuid;
  member_found boolean:=false;
  needs_retry boolean:=false;
begin
  if not private.has_min_role('mod') then raise exception 'Insufficient role'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Rows must be a JSON array'; end if;
  if jsonb_array_length(p_rows)>5000 then raise exception 'Maximum 5000 rows per import'; end if;
  if pg_column_size(p_rows)>6000000 then raise exception 'Import payload too large'; end if;
  if coalesce(p_checksum_sha256,'') !~ '^[0-9a-fA-F]{64}$' then raise exception 'Valid SHA-256 checksum required'; end if;

  select * into existing
  from public.drl_import_batches
  where checksum_sha256=lower(p_checksum_sha256)
  for update;

  if found then
    select exists(
      select 1
      from jsonb_array_elements(coalesce(existing.warnings,'[]'::jsonb)) w
      where w->>'type'='member_not_found'
    ) into needs_retry;

    if coalesce(existing.accepted_count,0)>0 and not needs_retry then
      return jsonb_build_object(
        'batchId',existing.id,
        'rowCount',existing.row_count,
        'accepted',existing.accepted_count,
        'rejected',existing.rejected_count,
        'duplicates',existing.duplicate_count,
        'warnings',existing.warnings,
        'idempotent',true,
        'retryable',false
      );
    end if;

    batch_id:=existing.id;
    update public.drl_import_batches
       set file_name=left(coalesce(p_file_name,'upload'),255),
           created_by=mid,
           row_count=0,
           accepted_count=0,
           rejected_count=0,
           duplicate_count=0,
           warnings='[]'::jsonb
     where id=batch_id;
  else
    insert into public.drl_import_batches(file_name,checksum_sha256,created_by)
    values(left(coalesce(p_file_name,'upload'),255),lower(p_checksum_sha256),mid)
    returning id into batch_id;
  end if;

  for item in select value from jsonb_array_elements(p_rows) loop
    total:=total+1;
    code:=upper(regexp_replace(left(trim(coalesce(item->>'mssv',item->>'MSSV',item->>'student_code','')),20),'\s','','g'));
    source_name:=left(regexp_replace(trim(coalesce(item->>'ho_ten',item->>'Họ tên',item->>'Họ và tên',item->>'full_name','')),'\s+',' ','g'),160);
    act:=left(regexp_replace(trim(coalesce(item->>'ten_hoat_dong',item->>'Tên hoạt động',item->>'activity_name','')),'\s+',' ','g'),240);
    semcode:=upper(left(regexp_replace(trim(coalesce(item->>'hoc_ky',item->>'Học kỳ',item->>'semester',item->>'semester_code','')),'\s+',' ','g'),80));
    notev:=left(regexp_replace(trim(coalesce(item->>'ghi_chu',item->>'Ghi chú',item->>'note','')),'\s+',' ','g'),500);

    begin
      pts:=replace(left(trim(coalesce(item->>'diem_cong',item->>'Điểm cộng',item->>'Điểm đề xuất ĐRL',item->>'Điểm đề xuất DRL',item->>'diem_de_xuat_drl',item->>'points','')),40),',','.')::numeric;
    exception when others then
      pts:=null;
    end;

    begin
      occurred:=nullif(left(coalesce(item->>'occurred_at',item->>'Thời gian tổ chức',''),64),'')::timestamptz;
    exception when others then
      occurred:=null;
    end;

    if code !~ '^[0-9]{8,14}$'
       or source_name=''
       or act=''
       or semcode=''
       or pts is null
       or pts<0
       or pts>1000
       or pts<>trunc(pts) then
      rejected:=rejected+1;
      warns:=warns||jsonb_build_array(jsonb_build_object(
        'row',total,'type','invalid','mssv',code,
        'name_present',source_name<>'',
        'activity_present',act<>'',
        'semester_present',semcode<>'',
        'points',pts
      ));
      continue;
    end if;

    select * into sem
      from public.drl_semesters
     where upper(drl_semesters.code)=semcode
     limit 1;
    if not found then
      rejected:=rejected+1;
      warns:=warns||jsonb_build_array(jsonb_build_object('row',total,'type','semester_not_found','semester',semcode));
      continue;
    end if;
    if sem.is_published then
      rejected:=rejected+1;
      warns:=warns||jsonb_build_array(jsonb_build_object('row',total,'type','semester_published','semester',semcode));
      continue;
    end if;
    if private.drl_semester_locked(sem.id) then
      rejected:=rejected+1;
      warns:=warns||jsonb_build_array(jsonb_build_object('row',total,'type','semester_locked','semester',semcode));
      continue;
    end if;

    select * into member_row
      from public.club_members
     where upper(student_code)=code
       and status='approved'
     limit 1;
    member_found:=found;

    if member_found then
      source_name_key:=regexp_replace(extensions.unaccent(lower(replace(source_name,'đ','d'))),'[^a-z0-9]+','','g');
      member_name_key:=regexp_replace(extensions.unaccent(lower(replace(coalesce(member_row.full_name,''),'đ','d'))),'[^a-z0-9]+','','g');

      if not private.drl_name_compatible(source_name,member_row.full_name) then
        rejected:=rejected+1;
        warns:=warns||jsonb_build_array(jsonb_build_object(
          'row',total,'type','name_mismatch','mssv',code,
          'source_name',source_name,'member_name',member_row.full_name
        ));
        continue;
      end if;

      if source_name_key<>member_name_key then
        warns:=warns||jsonb_build_array(jsonb_build_object(
          'row',total,'type','name_alias_accepted','mssv',code,
          'source_name',source_name,'member_name',member_row.full_name
        ));
      end if;

      canonical_name:=left(regexp_replace(trim(member_row.full_name),'\s+',' ','g'),160);
    else
      canonical_name:=source_name;
      warns:=warns||jsonb_build_array(jsonb_build_object(
        'row',total,
        'type','member_not_registered_accepted',
        'mssv',code
      ));
    end if;

    fp:=encode(
      extensions.digest(
        lower(code||'|'||sem.id::text||'|'||regexp_replace(extensions.unaccent(lower(act)),'\s+',' ','g')),
        'sha256'
      ),
      'hex'
    );

    begin
      insert into public.drl_activities(
        semester_id,member_id,student_code,full_name,activity_name,points,note,
        occurred_at,source_batch_id,row_fingerprint,created_by
      )
      values(
        sem.id,
        case when member_found then member_row.id else null end,
        code,canonical_name,act,pts,notev,occurred,batch_id,fp,mid
      );
      accepted:=accepted+1;
    exception when unique_violation then
      select a.source_batch_id into existing_source_batch
        from public.drl_activities a
       where a.row_fingerprint=fp
       limit 1;

      if existing_source_batch=batch_id then
        accepted:=accepted+1;
      else
        dupes:=dupes+1;
        warns:=warns||jsonb_build_array(jsonb_build_object(
          'row',total,'type','duplicate','mssv',code,'activity',act,'semester',semcode
        ));
      end if;
    end;
  end loop;

  update public.drl_import_batches
     set row_count=total,
         accepted_count=accepted,
         rejected_count=rejected,
         duplicate_count=dupes,
         warnings=warns
   where id=batch_id;

  perform private.audit_event(
    'drl.import.commit',
    'drl_import_batch',
    batch_id::text,
    'info',
    jsonb_build_object('rows',total,'accepted',accepted,'rejected',rejected,'duplicates',dupes)
  );

  return jsonb_build_object(
    'batchId',batch_id,
    'rowCount',total,
    'accepted',accepted,
    'rejected',rejected,
    'duplicates',dupes,
    'warnings',warns,
    'idempotent',false,
    'retryable',accepted=0 and rejected>0
  );
end
$function$;

revoke all on function public.drl_admin_import_v1(text,text,jsonb) from public,anon;
grant execute on function public.drl_admin_import_v1(text,text,jsonb) to authenticated,service_role;

comment on function public.drl_admin_import_v1(text,text,jsonb) is
'Imports DRL by MSSV. A matching approved account is optional: when present, name compatibility is verified and member_id is linked; when absent, the row is still accepted with member_id NULL and remains immediately retrievable by exact MSSV. Partially rejected legacy batches with member_not_found warnings may be retried idempotently.';

create or replace function public.drl_public_lookup_v2(p_student_code text)
returns table(
  student_code_masked text,
  semester_code text,
  semester_title text,
  is_published boolean,
  publication_status text,
  total_points numeric,
  activities jsonb
)
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare
  q text:=upper(regexp_replace(trim(coalesce(p_student_code,'')),'\s','','g'));
  mid uuid:=private.current_member_id();
  own_code text;
  own_lookup boolean:=false;
begin
  if q !~ '^[0-9]{8,14}$' then return; end if;

  if mid is not null then
    select upper(regexp_replace(trim(coalesce(m.student_code,'')),'\s','','g'))
      into own_code
      from public.club_members m
     where m.id=mid;
    own_lookup:=nullif(own_code,'') is not null and own_code=q;
  end if;

  return query
  with relevant as (
    select s.*
      from public.drl_semesters s
     where s.archived_at is null
       and (
         exists (
           select 1
             from public.drl_activities a
            where a.semester_id=s.id
              and upper(a.student_code)=q
         )
         or (
           own_lookup
           and s.is_published=false
           and s.id=(
             select x.id
               from public.drl_semesters x
              where x.archived_at is null
                and x.is_published=false
              order by x.created_at desc,x.id desc
              limit 1
           )
         )
       )
  ), aggregated as (
    select
      s.id,
      s.code,
      s.title,
      s.starts_on,
      s.created_at as semester_created_at,
      s.is_published,
      coalesce(sum(a.points),0)::numeric as live_total,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',a.id,
            'activity_name',a.activity_name,
            'points',a.points,
            'note',a.note,
            'occurred_at',a.occurred_at
          )
          order by coalesce(a.occurred_at,a.created_at) desc,a.created_at desc
        ) filter (where a.id is not null),
        '[]'::jsonb
      ) as live_activities
    from relevant s
    left join public.drl_activities a
      on a.semester_id=s.id
     and upper(a.student_code)=q
    group by s.id,s.code,s.title,s.starts_on,s.created_at,s.is_published
  )
  select
    case
      when length(q)<=4 then repeat('*',length(q))
      else left(q,2)||repeat('*',length(q)-4)||right(q,2)
    end,
    a.code,
    a.title,
    a.is_published,
    case when a.is_published then 'published' else 'recording' end::text,
    a.live_total,
    a.live_activities
  from aggregated a
  order by coalesce(a.starts_on,'1900-01-01'::date) desc,a.semester_created_at desc,a.code desc;
end
$function$;

revoke all on function public.drl_public_lookup_v2(text) from public;
grant execute on function public.drl_public_lookup_v2(text) to anon,authenticated,service_role;

comment on function public.drl_public_lookup_v2(text) is
'Exact MSSV lookup available without an account. Activity points are visible live immediately after import, including in an unpublished semester; publication only marks the semester total as finalized.';

create or replace function public.drl_member_current_semester_v1()
returns table(
  semester_id uuid,
  semester_code text,
  semester_title text,
  is_published boolean,
  publication_status text,
  total_points numeric,
  activities jsonb
)
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare
  mid uuid:=private.current_member_id();
  own_code text;
begin
  if mid is null then raise exception 'Authentication required'; end if;

  select upper(regexp_replace(trim(coalesce(m.student_code,'')),'\s','','g'))
    into own_code
    from public.club_members m
   where m.id=mid;

  return query
  with current_semester as (
    select s.*
      from public.drl_semesters s
     where s.archived_at is null
     order by
       case when s.is_published=false then 0 else 1 end,
       s.created_at desc,
       s.id desc
     limit 1
  )
  select
    s.id,
    s.code,
    s.title,
    s.is_published,
    case when s.is_published then 'published' else 'recording' end::text,
    coalesce(sum(a.points),0)::numeric,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',a.id,
          'activity_name',a.activity_name,
          'points',a.points,
          'note',a.note,
          'occurred_at',a.occurred_at
        )
        order by coalesce(a.occurred_at,a.created_at) desc,a.created_at desc
      ) filter (where a.id is not null),
      '[]'::jsonb
    )
  from current_semester s
  left join public.drl_activities a
    on a.semester_id=s.id
   and (
     a.member_id=mid
     or (nullif(own_code,'') is not null and upper(a.student_code)=own_code)
   )
  group by s.id,s.code,s.title,s.is_published,s.created_at;
end
$function$;

revoke all on function public.drl_member_current_semester_v1() from public,anon;
grant execute on function public.drl_member_current_semester_v1() to authenticated,service_role;

comment on function public.drl_member_current_semester_v1() is
'Returns the logged-in member current-semester DRL, matching both linked member_id and MSSV so activities imported before account registration remain visible after registration.';

create or replace function public.drl_member_history_v1()
returns table(
  id uuid,
  semester_code text,
  semester_title text,
  activity_name text,
  points numeric,
  note text,
  occurred_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public','private','pg_catalog'
as $function$
declare
  mid uuid:=private.current_member_id();
  own_code text;
begin
  if mid is null then raise exception 'Authentication required'; end if;

  select upper(regexp_replace(trim(coalesce(m.student_code,'')),'\s','','g'))
    into own_code
    from public.club_members m
   where m.id=mid;

  return query
  select a.id,s.code,s.title,a.activity_name,a.points,a.note,a.occurred_at,a.created_at
    from public.drl_activities a
    join public.drl_semesters s on s.id=a.semester_id
   where s.archived_at is null
     and (
       a.member_id=mid
       or (nullif(own_code,'') is not null and upper(a.student_code)=own_code)
     )
   order by coalesce(a.occurred_at,a.created_at) desc,a.created_at desc;
end
$function$;

revoke all on function public.drl_member_history_v1() from public,anon;
grant execute on function public.drl_member_history_v1() to authenticated,service_role;

comment on function public.drl_member_history_v1() is
'Member DRL history matched by member_id or canonical MSSV, preserving scores imported before the member had an account.';