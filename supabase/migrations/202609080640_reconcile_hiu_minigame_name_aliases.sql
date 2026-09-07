do $migration$
declare
  v_batch public.drl_import_batches%rowtype;
  v_sem public.drl_semesters%rowtype;
  v_activity constant text:='MINIGAME ONLINE:HIỂU ĐÚNG VỀ VIÊM GAN';
  v_codes constant text[]:=array['2513120049','2213120005','2313120028'];
  v_warnings jsonb;
  v_inserted int:=0;
  v_accepted int:=0;
  v_rejected int:=0;
begin
  select * into v_batch
  from public.drl_import_batches
  where file_name ilike 'DANH SÁCH ĐỀ NGHỊ CÔNG NHẬN ĐIỂM RÈN LUYỆN MINIGAME ONLINE_HIỂU ĐÚNG VỀ VIÊM GAN%'
  order by created_at desc
  limit 1
  for update;

  if not found then raise exception 'Target DRL import batch not found'; end if;

  select * into v_sem
  from public.drl_semesters
  where code='HK3-2025-2026'
  for update;

  if not found then raise exception 'Target semester HK3-2025-2026 not found'; end if;

  if not exists (
    select 1
    from public.club_members m
    where m.status='approved'
      and m.student_code='2513120049'
      and private.drl_name_compatible('NGUYỄN HOÀNG NHÂN',m.full_name)
  ) then raise exception 'Member 2513120049 compatibility check failed'; end if;

  if not exists (
    select 1
    from public.club_members m
    where m.status='approved'
      and m.student_code='2213120005'
      and private.drl_name_compatible('Trần Xuân Hoàn',m.full_name)
  ) then raise exception 'Member 2213120005 compatibility check failed'; end if;

  if not exists (
    select 1
    from public.club_members m
    where m.status='approved'
      and m.student_code='2313120028'
      and private.drl_name_compatible('Trương Sỹ Hiếu',m.full_name)
  ) then raise exception 'Member 2313120028 compatibility check failed'; end if;

  if v_sem.is_published then
    update public.drl_semesters
    set is_published=false,published_at=null,published_by=null,updated_at=now()
    where id=v_sem.id;
  end if;

  with source_rows(student_code,note) as (
    values
      ('2513120049'::text,'Khoa: Y · Vai trò: Ban quản lý'::text),
      ('2213120005'::text,'Khoa: Khoa Y · Vai trò: người tham gia'::text),
      ('2313120028'::text,'Khoa: Khoa Y · Vai trò: người tham gia'::text)
  ), inserted as (
    insert into public.drl_activities(
      semester_id,member_id,student_code,full_name,activity_name,points,note,occurred_at,source_batch_id,row_fingerprint,created_by
    )
    select
      v_sem.id,
      m.id,
      s.student_code,
      left(regexp_replace(trim(m.full_name),'\s+',' ','g'),160),
      v_activity,
      1,
      s.note,
      '2026-06-21T00:00:00+07:00'::timestamptz,
      v_batch.id,
      encode(extensions.digest(lower(s.student_code||'|'||v_sem.id::text||'|'||regexp_replace(extensions.unaccent(lower(v_activity)),'\s+',' ','g')),'sha256'),'hex'),
      v_batch.created_by
    from source_rows s
    join public.club_members m on m.student_code=s.student_code and m.status='approved'
    on conflict(row_fingerprint) do nothing
    returning 1
  )
  select count(*)::int into v_inserted from inserted;

  if v_sem.is_published then
    update public.drl_semesters
    set is_published=true,published_at=v_sem.published_at,published_by=v_sem.published_by,updated_at=now()
    where id=v_sem.id;
  end if;

  select coalesce(jsonb_agg(w),'[]'::jsonb) into v_warnings
  from jsonb_array_elements(coalesce(v_batch.warnings,'[]'::jsonb)) w
  where not (
    w->>'type'='name_mismatch'
    and w->>'mssv'=any(v_codes)
  );

  v_warnings:=v_warnings||jsonb_build_array(
    jsonb_build_object('type','name_alias_reconciled','mssv','2513120049','source_name','NGUYỄN HOÀNG NHÂN'),
    jsonb_build_object('type','name_alias_reconciled','mssv','2213120005','source_name','Trần Xuân Hoàn'),
    jsonb_build_object('type','name_alias_reconciled','mssv','2313120028','source_name','Trương Sỹ Hiếu')
  );

  select count(*)::int into v_accepted
  from public.drl_activities
  where source_batch_id=v_batch.id;

  v_rejected:=greatest(coalesce(v_batch.row_count,0)-v_accepted-coalesce(v_batch.duplicate_count,0),0);

  update public.drl_import_batches
  set accepted_count=v_accepted,
      rejected_count=v_rejected,
      warnings=v_warnings
  where id=v_batch.id;

  perform private.audit_event(
    'drl.import.name_alias.reconcile',
    'drl_import_batch',
    v_batch.id::text,
    'info',
    jsonb_build_object('inserted',v_inserted,'accepted_total',v_accepted,'rejected_total',v_rejected,'student_codes',v_codes)
  );
end
$migration$;
