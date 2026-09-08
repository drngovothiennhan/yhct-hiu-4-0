create or replace function private.community_credit_sync()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_catalog
as $$
declare
  v_member uuid;
  v_source uuid;
  v_type text;
  v_spam boolean;
  v_created timestamptz;
  v_count integer:=0;
  v_limit integer:=20;
begin
  if tg_table_name='clinical_posts' then v_type:='post'; else v_type:='comment'; end if;

  if tg_op='DELETE' then
    v_source:=old.id;
    update public.community_credit_events
      set revoked_at=coalesce(revoked_at,now()),eligibility_status='revoked_deleted'
      where event_type=v_type and source_id=v_source and revoked_at is null;
    return old;
  end if;

  v_source:=new.id;
  if tg_table_name='clinical_posts' then
    v_member:=new.author_id;
  else
    v_member:=new.member_id;
  end if;
  v_spam:=coalesce(new.is_spam,false);
  v_created:=coalesce(new.created_at,now());

  if tg_op='UPDATE' then
    if v_spam and not coalesce(old.is_spam,false) then
      update public.community_credit_events
        set revoked_at=coalesce(revoked_at,now()),eligibility_status='revoked_spam'
        where event_type=v_type and source_id=v_source and revoked_at is null;
    end if;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_member::text,0));

  if v_spam then
    insert into public.community_credit_events(member_id,event_type,source_id,credits,eligibility_status,created_at,revoked_at)
    values(v_member,v_type,v_source,0,'revoked_spam',v_created,now())
    on conflict (event_type,source_id) do nothing;
    return new;
  end if;

  if v_type='comment' then
    v_limit:=private.community_credit_comment_hourly_limit();
    select count(*)::integer into v_count
    from public.community_credit_events e
    where e.member_id=v_member and e.event_type='comment' and e.credits=1 and e.revoked_at is null
      and e.created_at>v_created-interval '1 hour' and e.created_at<=v_created;
    if v_count>=v_limit then
      insert into public.community_credit_events(member_id,event_type,source_id,credits,eligibility_status,created_at)
      values(v_member,v_type,v_source,0,'rate_limited',v_created)
      on conflict (event_type,source_id) do nothing;
      return new;
    end if;
  end if;

  insert into public.community_credit_events(member_id,event_type,source_id,credits,eligibility_status,created_at)
  values(v_member,v_type,v_source,1,'credited',v_created)
  on conflict (event_type,source_id) do nothing;
  return new;
end
$$;
