create table if not exists public.member_registration_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  student_code text not null,
  full_name text not null,
  class_name text not null,
  faculty text not null,
  email text not null,
  status text not null default 'awaiting_email',
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint member_registration_student_code_check check (student_code ~ '^[0-9]{8,14}$'),
  constraint member_registration_status_check check (status in ('awaiting_email','activated','conflict','cancelled')),
  constraint member_registration_full_name_check check (length(btrim(full_name)) between 2 and 180),
  constraint member_registration_class_name_check check (length(btrim(class_name)) between 1 and 80),
  constraint member_registration_faculty_check check (length(btrim(faculty)) between 1 and 120),
  constraint member_registration_email_check check (length(btrim(email)) between 5 and 254)
);

create unique index if not exists ux_member_registration_auth_user on public.member_registration_requests(auth_user_id);
create unique index if not exists ux_member_registration_student_code_ci on public.member_registration_requests(upper(student_code)) where status in ('awaiting_email','activated');
create unique index if not exists ux_member_registration_email_ci on public.member_registration_requests(lower(email)) where status in ('awaiting_email','activated');
create index if not exists idx_member_registration_status_created on public.member_registration_requests(status,created_at desc);

alter table public.member_registration_requests enable row level security;
revoke all on table public.member_registration_requests from anon;
revoke insert,update,delete on table public.member_registration_requests from authenticated;
grant select on table public.member_registration_requests to authenticated;

drop policy if exists member_registration_admin_read on public.member_registration_requests;
create policy member_registration_admin_read
on public.member_registration_requests
for select
to authenticated
using ((select private.has_min_role('admin'::app_role)));

create or replace function private.activate_self_registration_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.member_registration_requests%rowtype;
  v_member_id uuid;
begin
  if new.email_confirmed_at is null or old.email_confirmed_at is not null then
    return new;
  end if;

  select * into r
  from public.member_registration_requests
  where auth_user_id=new.id and status='awaiting_email'
  for update;

  if not found then
    return new;
  end if;

  begin
    insert into public.club_members(
      auth_user_id,full_name,email,student_code,class_name,faculty,
      role,status,login_enabled,data_conflict,position_title,
      source_file,source_student_code
    ) values (
      new.id,r.full_name,r.email,r.student_code,r.class_name,r.faculty,
      'member'::public.app_role,'approved'::public.membership_status,true,false,'Hội viên',
      'self-registration',r.student_code
    )
    returning id into v_member_id;
  exception when unique_violation then
    update public.member_registration_requests
    set status='conflict',activated_at=new.email_confirmed_at,updated_at=now()
    where id=r.id;
    return new;
  end;

  update public.member_registration_requests
  set status='activated',activated_at=new.email_confirmed_at,updated_at=now()
  where id=r.id;

  return new;
end;
$$;

revoke all on function private.activate_self_registration_v1() from public,anon,authenticated;

drop trigger if exists trg_activate_self_registration_v1 on auth.users;
create trigger trg_activate_self_registration_v1
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function private.activate_self_registration_v1();
