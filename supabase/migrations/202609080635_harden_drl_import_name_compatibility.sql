create or replace function private.drl_name_compatible(p_source_name text, p_member_name text)
returns boolean
language plpgsql
stable
set search_path to 'pg_catalog','extensions'
as $function$
declare
  source_norm text;
  member_norm text;
  source_tokens text[];
  member_tokens text[];
  short_tokens text[];
  long_tokens text[];
  source_len int;
  member_len int;
  all_short_in_long boolean;
begin
  source_norm:=btrim(regexp_replace(extensions.unaccent(lower(replace(coalesce(p_source_name,''),'đ','d'))),'[^a-z0-9]+',' ','g'));
  member_norm:=btrim(regexp_replace(extensions.unaccent(lower(replace(coalesce(p_member_name,''),'đ','d'))),'[^a-z0-9]+',' ','g'));

  if source_norm='' or member_norm='' then return false; end if;
  if source_norm=member_norm then return true; end if;

  source_tokens:=regexp_split_to_array(source_norm,'\s+');
  member_tokens:=regexp_split_to_array(member_norm,'\s+');
  source_len:=coalesce(array_length(source_tokens,1),0);
  member_len:=coalesce(array_length(member_tokens,1),0);

  if source_len<2 or member_len<2 then return false; end if;
  if source_tokens[source_len]<>member_tokens[member_len] then return false; end if;

  if source_len<=member_len then
    short_tokens:=source_tokens;
    long_tokens:=member_tokens;
  else
    short_tokens:=member_tokens;
    long_tokens:=source_tokens;
  end if;

  select bool_and(token=any(long_tokens)) into all_short_in_long
  from unnest(short_tokens) token;

  return coalesce(all_short_in_long,false);
end
$function$;

comment on function private.drl_name_compatible(text,text) is
'Name compatibility guard for DRL imports. Exact normalized names pass; abbreviated/extended Vietnamese names pass only when the shorter token set is contained in the longer name and the final given-name token matches.';

create or replace function public.drl_admin_import_v1(p_file_name text, p_checksum_sha256 text, p_rows jsonb)
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
    if coalesce(existing.accepted_count,0)>0 then
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
    set file_name=left(coalesce(p_file_name,'upload'),255),created_by=mid,row_count=0,accepted_count=0,rejected_count=0,duplicate_count=0,warnings='[]'::jsonb
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

    if code !~ '^[0-9]{8,14}$' or source_name='' or act='' or semcode='' or pts is null or pts<0 or pts>1000 or pts<>trunc(pts) then
      rejected:=rejected+1;
      warns:=warns||jsonb_build_array(jsonb_build_object('row',total,'type','invalid','mssv',code,'name_present',source_name<>'','activity_present',act<>'','semester_present',semcode<>'','points',pts));
      continue;
    end if;

    select * into sem from public.drl_semesters where upper(drl_semesters.code)=semcode limit 1;
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

    select * into member_row from public.club_members where upper(student_code)=code and status='approved' limit 1;
    if not found then
      rejected:=rejected+1;
      warns:=warns||jsonb_build_array(jsonb_build_object('row',total,'type','member_not_found','mssv',code));
      continue;
    end if;

    source_name_key:=regexp_replace(extensions.unaccent(lower(replace(source_name,'đ','d'))),'[^a-z0-9]+','','g');
    member_name_key:=regexp_replace(extensions.unaccent(lower(replace(coalesce(member_row.full_name,''),'đ','d'))),'[^a-z0-9]+','','g');

    if not private.drl_name_compatible(source_name,member_row.full_name) then
      rejected:=rejected+1;
      warns:=warns||jsonb_build_array(jsonb_build_object('row',total,'type','name_mismatch','mssv',code,'source_name',source_name,'member_name',member_row.full_name));
      continue;
    end if;

    if source_name_key<>member_name_key then
      warns:=warns||jsonb_build_array(jsonb_build_object('row',total,'type','name_alias_accepted','mssv',code,'source_name',source_name,'member_name',member_row.full_name));
    end if;

    canonical_name:=left(regexp_replace(trim(member_row.full_name),'\s+',' ','g'),160);
    fp:=encode(extensions.digest(lower(code||'|'||sem.id::text||'|'||regexp_replace(extensions.unaccent(lower(act)),'\s+',' ','g')),'sha256'),'hex');

    begin
      insert into public.drl_activities(semester_id,member_id,student_code,full_name,activity_name,points,note,occurred_at,source_batch_id,row_fingerprint,created_by)
      values(sem.id,member_row.id,code,canonical_name,act,pts,notev,occurred,batch_id,fp,mid);
      accepted:=accepted+1;
    exception when unique_violation then
      dupes:=dupes+1;
      warns:=warns||jsonb_build_array(jsonb_build_object('row',total,'type','duplicate','mssv',code,'activity',act,'semester',semcode));
    end;
  end loop;

  update public.drl_import_batches
  set row_count=total,accepted_count=accepted,rejected_count=rejected,duplicate_count=dupes,warnings=warns
  where id=batch_id;

  perform private.audit_event('drl.import.commit','drl_import_batch',batch_id::text,'info',jsonb_build_object('rows',total,'accepted',accepted,'rejected',rejected,'duplicates',dupes));

  return jsonb_build_object('batchId',batch_id,'rowCount',total,'accepted',accepted,'rejected',rejected,'duplicates',dupes,'warnings',warns,'idempotent',false,'retryable',accepted=0 and rejected>0);
end
$function$;

revoke all on function public.drl_admin_import_v1(text,text,jsonb) from public,anon;
grant execute on function public.drl_admin_import_v1(text,text,jsonb) to authenticated,service_role;

comment on function public.drl_admin_import_v1(text,text,jsonb) is
'Imports valid DRL rows for approved members. MSSV is the primary member key; Vietnamese name variants that are token-compatible with the canonical member profile are accepted and audited, while incompatible names remain rejected.';