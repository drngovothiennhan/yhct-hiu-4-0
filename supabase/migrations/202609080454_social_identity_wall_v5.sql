-- Social identity + personal wall v5. Idempotent replay of production state.
alter table public.club_members add column if not exists herbal_alias text;
alter table public.club_members add column if not exists wall_theme text not null default 'herbal-paper';
alter table public.club_members add column if not exists wall_motto text;

create or replace function private.herbal_alias_for_name(p_name text,p_member_id uuid default null)
returns text language plpgsql immutable set search_path='pg_catalog' as $$
declare given_name text:=regexp_replace(btrim(coalesce(p_name,'')),'^.*\s+',''); ch text:=left(given_name,1); k text;
begin
 if ch~*'[aáàảãạăắằẳẵặâấầẩẫậ]' then k:='A'; elsif ch~*'[b]' then k:='B'; elsif ch~*'[c]' then k:='C'; elsif ch~*'[dđ]' then k:='D'; elsif ch~*'[eéèẻẽẹêếềểễệ]' then k:='E'; elsif ch~*'[g]' then k:='G'; elsif ch~*'[h]' then k:='H'; elsif ch~*'[iíìỉĩị]' then k:='I'; elsif ch~*'[k]' then k:='K'; elsif ch~*'[l]' then k:='L'; elsif ch~*'[m]' then k:='M'; elsif ch~*'[n]' then k:='N'; elsif ch~*'[oóòỏõọôốồổỗộơớờởỡợ]' then k:='O'; elsif ch~*'[p]' then k:='P'; elsif ch~*'[q]' then k:='Q'; elsif ch~*'[r]' then k:='R'; elsif ch~*'[s]' then k:='S'; elsif ch~*'[t]' then k:='T'; elsif ch~*'[uúùủũụưứừửữự]' then k:='U'; elsif ch~*'[v]' then k:='V'; elsif ch~*'[x]' then k:='X'; elsif ch~*'[yýỳỷỹỵ]' then k:='Y'; else k:='Z'; end if;
 return case k when'A'then'Actisô' when'B'then'Bạch truật' when'C'then'Cam thảo' when'D'then'Đan sâm' when'E'then'É tía' when'G'then'Gừng' when'H'then'Hà thủ ô' when'I'then'Ích mẫu' when'K'then'Kim ngân' when'L'then'Lá lốt' when'M'then'Mạch môn' when'N'then'Nghệ' when'O'then'Ô dược' when'P'then'Phục linh' when'Q'then'Quế' when'R'then'Rau má' when'S'then'Sa nhân' when'T'then'Tía tô' when'U'then'Uất kim' when'V'then'Vông nem' when'X'then'Xuyên khung' when'Y'then'Ý dĩ' else'Dược thảo' end;
end $$;
update public.club_members set herbal_alias=private.herbal_alias_for_name(full_name,id) where herbal_alias is null or btrim(herbal_alias)='';

create table if not exists public.member_wall_posts(
 id uuid primary key default gen_random_uuid(), member_id uuid not null references public.club_members(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 500), image_url text,
 visibility text not null default 'public' check(visibility in('public','members')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists member_wall_posts_member_created_idx on public.member_wall_posts(member_id,created_at desc);
alter table public.member_wall_posts enable row level security;
revoke all on public.member_wall_posts from anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('member-media','member-media',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists member_media_select_own on storage.objects;
drop policy if exists member_media_insert_own on storage.objects;
drop policy if exists member_media_update_own on storage.objects;
drop policy if exists member_media_delete_own on storage.objects;
create policy member_media_select_own on storage.objects for select to authenticated using(bucket_id='member-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy member_media_insert_own on storage.objects for insert to authenticated with check(bucket_id='member-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy member_media_update_own on storage.objects for update to authenticated using(bucket_id='member-media' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='member-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy member_media_delete_own on storage.objects for delete to authenticated using(bucket_id='member-media' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.member_profile_update_v2(p_avatar_url text default null,p_wall_theme text default null,p_wall_motto text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); r public.club_members%rowtype;
begin
 if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
 if p_wall_theme is not null and p_wall_theme not in('herbal-paper','bamboo','lotus','stone','lantern') then raise exception 'Invalid wall theme'; end if;
 if p_wall_motto is not null and char_length(p_wall_motto)>160 then raise exception 'Motto exceeds 160 characters'; end if;
 if p_avatar_url is not null and char_length(p_avatar_url)>2048 then raise exception 'Avatar URL is too long'; end if;
 update public.club_members set avatar_url=case when p_avatar_url is null then avatar_url when btrim(p_avatar_url)='' then null else btrim(p_avatar_url) end,wall_theme=coalesce(p_wall_theme,wall_theme),wall_motto=case when p_wall_motto is null then wall_motto else nullif(btrim(p_wall_motto),'') end,herbal_alias=coalesce(nullif(herbal_alias,''),private.herbal_alias_for_name(full_name,id)),updated_at=now() where id=mid returning * into r;
 perform private.audit_event('profile.wall.update','club_member',mid::text,'info',jsonb_build_object('wall_theme',r.wall_theme));
 return jsonb_build_object('id',r.id,'full_name',r.full_name,'herbal_alias',r.herbal_alias,'avatar_url',r.avatar_url,'wall_theme',r.wall_theme,'wall_motto',r.wall_motto);
end $$;

create or replace function public.member_wall_post_create_v1(p_body text,p_image_url text default null,p_visibility text default 'public')
returns uuid language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); rid uuid; txt text:=btrim(coalesce(p_body,''));
begin
 if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
 if char_length(txt)<1 or char_length(txt)>500 then raise exception 'Status must contain 1 to 500 characters'; end if;
 if p_visibility not in('public','members') then raise exception 'Invalid visibility'; end if;
 if p_image_url is not null and(char_length(p_image_url)>2048 or p_image_url!~'^https://') then raise exception 'Invalid image URL'; end if;
 if(select count(*) from public.member_wall_posts where member_id=mid and created_at>now()-interval'1 day')>=12 then raise exception 'Bạn đã đạt giới hạn 12 bài tường trong 24 giờ.'; end if;
 insert into public.member_wall_posts(member_id,body,image_url,visibility) values(mid,txt,nullif(btrim(p_image_url),''),p_visibility) returning id into rid;
 perform private.audit_event('profile.wall.post','member_wall_post',rid::text,'info',jsonb_build_object('visibility',p_visibility)); return rid;
end $$;

create or replace function public.member_wall_post_delete_v1(p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id();
begin if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if; delete from public.member_wall_posts where id=p_id and member_id=mid; if found then perform private.audit_event('profile.wall.delete','member_wall_post',p_id::text,'info','{}'::jsonb); end if; return found; end $$;

create or replace function public.member_wall_feed_v1(p_member_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare viewer uuid:=private.current_member_id(); target uuid:=coalesce(p_member_id,viewer); result jsonb;
begin
 if target is null then raise exception 'Member is required'; end if;
 if not exists(select 1 from public.club_members m where m.id=target and m.status='approved' and m.login_enabled and not m.data_conflict) then raise exception 'Member is unavailable'; end if;
 select jsonb_build_object('member',jsonb_build_object('id',m.id,'full_name',m.full_name,'herbal_alias',coalesce(m.herbal_alias,private.herbal_alias_for_name(m.full_name,m.id)),'avatar_url',m.avatar_url,'position_title',m.position_title,'wall_theme',m.wall_theme,'wall_motto',m.wall_motto),'posts',coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from(select p.id,p.body,p.image_url,p.visibility,p.created_at from public.member_wall_posts p where p.member_id=target and(p.visibility='public' or private.is_approved()) order by p.created_at desc limit 3)w),'[]'::jsonb)) into result from public.club_members m where m.id=target;
 return result;
end $$;
revoke all on function public.member_profile_update_v2(text,text,text),public.member_wall_post_create_v1(text,text,text),public.member_wall_post_delete_v1(uuid) from public,anon;
revoke all on function public.member_wall_feed_v1(uuid) from public;
grant execute on function public.member_profile_update_v2(text,text,text),public.member_wall_post_create_v1(text,text,text),public.member_wall_post_delete_v1(uuid) to authenticated;
grant execute on function public.member_wall_feed_v1(uuid) to anon,authenticated;
