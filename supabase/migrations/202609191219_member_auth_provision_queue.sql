create table if not exists public.member_auth_provision_queue (
  member_id uuid primary key references public.club_members(id) on delete cascade,
  student_code text not null unique,
  queued_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','provisioned','failed')),
  last_error text
);

alter table public.member_auth_provision_queue enable row level security;

insert into public.member_auth_provision_queue(member_id,student_code)
select m.id,m.student_code
from public.club_members m
left join auth.users u on u.id=m.auth_user_id
where m.student_code ~ '^\d{8,14}$'
  and m.status='approved'
  and m.login_enabled
  and (m.auth_user_id is null or u.id is null)
on conflict (member_id) do nothing;
