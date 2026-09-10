-- HIU Y Quan V15 — additive engagement loop.
-- All V15 rewards are XP/mastery only. Existing Gia Vien credits and V14 diagnosis/treatment RPCs are untouched.
-- Busy Shift is a voluntary educational workload mode, not clinical triage.

create table if not exists public.hiu_y_quan_engagement_profiles (
  member_id uuid primary key references public.club_members(id) on delete cascade,
  xp integer not null default 0 check (xp between 0 and 1000000),
  streak_days integer not null default 0 check (streak_days between 0 and 10000),
  last_claim_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hiu_y_quan_engagement_profiles enable row level security;
revoke all on table public.hiu_y_quan_engagement_profiles from anon, authenticated;

create table if not exists public.hiu_y_quan_mastery (
  member_id uuid not null references public.club_members(id) on delete cascade,
  item_type text not null check (item_type in ('herb','syndrome')),
  item_key text not null,
  points integer not null default 0 check (points between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key(member_id,item_type,item_key)
);
alter table public.hiu_y_quan_mastery enable row level security;
revoke all on table public.hiu_y_quan_mastery from anon, authenticated;

create table if not exists public.hiu_y_quan_herb_challenge_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.club_members(id) on delete cascade,
  challenge_date date not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  questions jsonb not null check (jsonb_typeof(questions)='array' and jsonb_array_length(questions)=8),
  current_index smallint not null default 0 check (current_index between 0 and 8),
  score smallint not null default 0 check (score between 0 and 8),
  combo smallint not null default 0 check (combo between 0 and 8),
  best_combo smallint not null default 0 check (best_combo between 0 and 8),
  finished_at timestamptz,
  unique(member_id,challenge_date),
  check (expires_at>started_at and expires_at<=started_at+interval '60 seconds')
);
alter table public.hiu_y_quan_herb_challenge_sessions enable row level security;
revoke all on table public.hiu_y_quan_herb_challenge_sessions from anon, authenticated;
create index if not exists hiu_y_quan_challenge_member_started_idx on public.hiu_y_quan_herb_challenge_sessions(member_id,started_at desc);

create table if not exists public.hiu_y_quan_daily_rewards (
  member_id uuid not null references public.club_members(id) on delete cascade,
  mission_date date not null,
  claimed_at timestamptz not null default now(),
  primary key(member_id,mission_date)
);
alter table public.hiu_y_quan_daily_rewards enable row level security;
revoke all on table public.hiu_y_quan_daily_rewards from anon, authenticated;

create table if not exists public.hiu_y_quan_consult_votes (
  consult_date date not null,
  member_id uuid not null references public.club_members(id) on delete cascade,
  syndrome_code text not null,
  selected_code text not null,
  correct boolean not null,
  voted_at timestamptz not null default now(),
  primary key(consult_date,member_id)
);
alter table public.hiu_y_quan_consult_votes enable row level security;
revoke all on table public.hiu_y_quan_consult_votes from anon, authenticated;
create index if not exists hiu_y_quan_consult_votes_member_idx on public.hiu_y_quan_consult_votes(member_id,voted_at desc);

-- V14 creates only ordinal 1-2. V15 may opt-in one compatible third case; all old rows remain valid.
alter table public.hiu_y_quan_cases drop constraint if exists hiu_y_quan_cases_ordinal_check;
alter table public.hiu_y_quan_cases add constraint hiu_y_quan_cases_ordinal_check check (ordinal between 1 and 3);

create or replace function private.hiu_y_quan_ensure_engagement_v15(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.hiu_y_quan_engagement_profiles(member_id) values(p_member_id)
  on conflict(member_id) do nothing;
end $$;

create or replace function private.hiu_y_quan_mastery_tier_v15(p_points integer)
returns smallint
language sql
immutable
set search_path=''
as $$
  select case when coalesce(p_points,0)>=15 then 4 when coalesce(p_points,0)>=7 then 3 when coalesce(p_points,0)>=3 then 2 when coalesce(p_points,0)>=1 then 1 else 0 end::smallint;
$$;

create or replace function private.hiu_y_quan_sync_syndrome_mastery_v15(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.hiu_y_quan_mastery(member_id,item_type,item_key,points,updated_at)
  select p_member_id,'syndrome',c.syndrome_code,count(*)::integer,now()
  from public.hiu_y_quan_attempts a
  join public.hiu_y_quan_cases c on c.id=a.case_id
  where a.member_id=p_member_id and a.correct
  group by c.syndrome_code
  on conflict(member_id,item_type,item_key) do update
  set points=greatest(public.hiu_y_quan_mastery.points,excluded.points),updated_at=now();
end $$;

create or replace function private.hiu_y_quan_challenge_question_v15(p_questions jsonb,p_index integer)
returns jsonb
language sql
immutable
set search_path=''
as $$
  select case
    when p_index<0 or p_index>=jsonb_array_length(p_questions) then null
    else (p_questions->p_index)-'correct_index'-'herb_key'
  end;
$$;

create or replace function private.hiu_y_quan_consult_payload_v15(p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  codes text[];
  labels text[];
  n integer;
  base_seed bigint;
  correct_pos integer;
  correct_code text;
  r record;
  raw_codes text[];
  ordered_codes text[];
  opts jsonb;
begin
  select array_agg(code order by code),array_agg(label order by code) into codes,labels from private.hiu_y_quan_syndrome_catalog;
  n:=coalesce(array_length(codes,1),0);
  if n<4 then raise exception 'Syndrome catalog is not ready'; end if;
  base_seed:=(hashtext(p_date::text||':hiu-consult-v15')::bigint & 2147483647);
  correct_pos:=(base_seed%n)::integer+1;
  correct_code:=codes[correct_pos];
  select * into r from private.hiu_y_quan_syndrome_catalog where code=correct_code;
  raw_codes:=array[
    correct_code,
    codes[((correct_pos+2-1)%n)+1],
    codes[((correct_pos+7-1)%n)+1],
    codes[((correct_pos+12-1)%n)+1]
  ];
  select array_agg(x order by (hashtext(p_date::text||':opt:'||x)::bigint & 2147483647),x) into ordered_codes from unnest(raw_codes) x;
  select jsonb_agg(jsonb_build_object('code',x,'label',s.label) order by u.ord)
  into opts
  from unnest(ordered_codes) with ordinality u(x,ord)
  join private.hiu_y_quan_syndrome_catalog s on s.code=x;
  return jsonb_build_object(
    'consult_date',p_date,'case_label','Ca hội chẩn mô phỏng trong ngày','vong',r.vong,'van_am',r.van_am,'van_hoi',r.van_hoi,'thiet',r.thiet,
    'options',opts,'correct_code',correct_code,'correct_label',r.label,'explanation',r.explanation
  );
end $$;

create or replace function public.hiu_y_quan_engagement_v15()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  p public.hiu_y_quan_engagement_profiles%rowtype;
  correct_today integer:=0;
  discharged_today integer:=0;
  challenge_score integer:=0;
  challenge_finished boolean:=false;
  claimed boolean:=false;
  mastery_count integer:=0;
  level_no integer:=1;
  title_text text;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  perform private.hiu_y_quan_sync_syndrome_mastery_v15(mid);
  update public.hiu_y_quan_herb_challenge_sessions
    set finished_at=coalesce(finished_at,expires_at),combo=case when finished_at is null then 0 else combo end
    where member_id=mid and challenge_date=d and finished_at is null and expires_at<=now();
  select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
  select count(*)::integer into correct_today from public.hiu_y_quan_attempts a where a.member_id=mid and a.correct and (a.answered_at at time zone 'Asia/Ho_Chi_Minh')::date=d;
  select count(*)::integer into discharged_today from public.hiu_y_quan_cases c where c.member_id=mid and c.archived_at is not null and (c.archived_at at time zone 'Asia/Ho_Chi_Minh')::date=d;
  select coalesce(s.score,0)::integer,(s.finished_at is not null) into challenge_score,challenge_finished from public.hiu_y_quan_herb_challenge_sessions s where s.member_id=mid and s.challenge_date=d;
  challenge_score:=coalesce(challenge_score,0); challenge_finished:=coalesce(challenge_finished,false);
  select exists(select 1 from public.hiu_y_quan_daily_rewards r where r.member_id=mid and r.mission_date=d) into claimed;
  select count(*)::integer into mastery_count from public.hiu_y_quan_mastery m where m.member_id=mid and m.points>0;
  level_no:=case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end;
  title_text:=case when p.xp>=300 then 'Danh y mô phỏng' when p.xp>=150 then 'Cao thủ Tứ chẩn' when p.xp>=50 then 'Tân thủ Biện chứng' else 'Học đồ HIU' end;
  return jsonb_build_object(
    'date',d,'xp',p.xp,'level',level_no,'title',title_text,'streak_days',p.streak_days,'last_claim_date',p.last_claim_date,
    'daily_claimed',claimed,
    'can_claim',(correct_today>=2 and discharged_today>=1 and challenge_finished and challenge_score>=3 and not claimed),
    'missions',jsonb_build_array(
      jsonb_build_object('key','diagnose','label','Chẩn đúng 2 ca','current',least(correct_today,2),'target',2,'done',correct_today>=2),
      jsonb_build_object('key','discharge','label','Hoàn tất 1 ca Dưỡng Trị','current',least(discharged_today,1),'target',1,'done',discharged_today>=1),
      jsonb_build_object('key','herb','label','Thử thách Tủ thuốc đạt 3 câu đúng','current',least(challenge_score,3),'target',3,'done',challenge_finished and challenge_score>=3)
    ),
    'mastery_unlocked',mastery_count,'busy_shift_available',true
  );
end $$;

create or replace function public.hiu_y_quan_herb_challenge_start_v15()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  s public.hiu_y_quan_herb_challenge_sessions%rowtype;
  herb_keys text[];
  n integer;
  base_seed bigint;
  i integer;
  target_pos integer;
  target_key text;
  target_name text;
  field_key text;
  field_label text;
  raw_opts text[];
  ordered_opts text[];
  options_json jsonb;
  correct_idx integer;
  questions_json jsonb:='[]'::jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  select * into s from public.hiu_y_quan_herb_challenge_sessions where member_id=mid and challenge_date=d;
  if found then
    if s.finished_at is null and s.expires_at<=now() then
      update public.hiu_y_quan_herb_challenge_sessions set finished_at=expires_at,combo=0 where id=s.id returning * into s;
    end if;
    return jsonb_build_object('session_id',s.id,'challenge_date',d,'expires_at',s.expires_at,'current_index',s.current_index,'score',s.score,'combo',s.combo,'best_combo',s.best_combo,'finished',s.finished_at is not null,'question',case when s.finished_at is null then private.hiu_y_quan_challenge_question_v15(s.questions,s.current_index) else null end);
  end if;
  select array_agg(herb_key order by herb_key) into herb_keys from public.hiu_y_quan_herbs_v14();
  n:=coalesce(array_length(herb_keys,1),0);
  if n<8 then raise exception 'Herb catalog is not ready'; end if;
  base_seed:=(hashtext(mid::text||':'||d::text||':herb60-v15')::bigint & 2147483647);
  for i in 0..7 loop
    target_pos:=((base_seed+i*5)%n)::integer+1;
    target_key:=herb_keys[target_pos];
    select name into target_name from public.hiu_y_quan_herbs_v14() where herb_key=target_key;
    field_key:=case ((base_seed/13+i)%3)::integer when 0 then 'nature_flavor' when 1 then 'meridians' else 'actions' end;
    field_label:=case field_key when 'nature_flavor' then 'Tính vị' when 'meridians' then 'Quy kinh' else 'Công năng' end;
    raw_opts:=array[
      target_key,
      herb_keys[((target_pos+1-1)%n)+1],
      herb_keys[((target_pos+4-1)%n)+1],
      herb_keys[((target_pos+7-1)%n)+1]
    ];
    select array_agg(x order by (hashtext(mid::text||':'||d::text||':'||i::text||':'||x)::bigint & 2147483647),x) into ordered_opts from unnest(raw_opts) x;
    select jsonb_agg(
      case field_key when 'nature_flavor' then to_jsonb(h.nature_flavor) when 'meridians' then to_jsonb(h.meridians) else to_jsonb(h.actions) end
      order by u.ord
    ) into options_json
    from unnest(ordered_opts) with ordinality u(x,ord)
    join public.hiu_y_quan_herbs_v14() h on h.herb_key=x;
    correct_idx:=array_position(ordered_opts,target_key)-1;
    questions_json:=questions_json||jsonb_build_array(jsonb_build_object(
      'herb_key',target_key,'name',target_name,'field',field_key,'field_label',field_label,
      'prompt','Chọn '||lower(field_label)||' phù hợp với '||target_name||'.','options',options_json,'correct_index',correct_idx
    ));
  end loop;
  insert into public.hiu_y_quan_herb_challenge_sessions(member_id,challenge_date,started_at,expires_at,questions)
  values(mid,d,now(),now()+interval '60 seconds',questions_json)
  returning * into s;
  return jsonb_build_object('session_id',s.id,'challenge_date',d,'expires_at',s.expires_at,'current_index',0,'score',0,'combo',0,'best_combo',0,'finished',false,'question',private.hiu_y_quan_challenge_question_v15(s.questions,0));
end $$;

create or replace function public.hiu_y_quan_herb_challenge_answer_v15(p_session_id uuid,p_selected_index integer)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  s public.hiu_y_quan_herb_challenge_sessions%rowtype;
  q jsonb;
  option_count integer;
  expected integer;
  was_correct boolean;
  next_index integer;
  next_score integer;
  next_combo integer;
  next_best integer;
  done boolean;
  xp_now integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  select * into s from public.hiu_y_quan_herb_challenge_sessions where id=p_session_id and member_id=mid for update;
  if not found then raise exception 'Challenge session not found'; end if;
  if s.finished_at is not null then
    select xp into xp_now from public.hiu_y_quan_engagement_profiles where member_id=mid;
    return jsonb_build_object('finished',true,'expired',s.expires_at<=now(),'score',s.score,'combo',s.combo,'best_combo',s.best_combo,'xp',xp_now,'question',null);
  end if;
  if s.expires_at<=now() then
    update public.hiu_y_quan_herb_challenge_sessions set finished_at=expires_at,combo=0 where id=s.id returning * into s;
    select xp into xp_now from public.hiu_y_quan_engagement_profiles where member_id=mid;
    return jsonb_build_object('finished',true,'expired',true,'score',s.score,'combo',0,'best_combo',s.best_combo,'xp',xp_now,'question',null);
  end if;
  q:=s.questions->s.current_index;
  option_count:=jsonb_array_length(q->'options');
  if p_selected_index<0 or p_selected_index>=option_count then raise exception 'Invalid answer option'; end if;
  expected:=(q->>'correct_index')::integer;
  was_correct:=p_selected_index=expected;
  next_score:=s.score+case when was_correct then 1 else 0 end;
  next_combo:=case when was_correct then s.combo+1 else 0 end;
  next_best:=greatest(s.best_combo,next_combo);
  next_index:=s.current_index+1;
  done:=next_index>=jsonb_array_length(s.questions);
  update public.hiu_y_quan_herb_challenge_sessions
  set current_index=next_index,score=next_score,combo=next_combo,best_combo=next_best,finished_at=case when done then now() else null end
  where id=s.id;
  if was_correct then
    insert into public.hiu_y_quan_mastery(member_id,item_type,item_key,points,updated_at)
    values(mid,'herb',q->>'herb_key',1,now())
    on conflict(member_id,item_type,item_key) do update set points=least(public.hiu_y_quan_mastery.points+1,100000),updated_at=now();
    update public.hiu_y_quan_engagement_profiles set xp=least(xp+2,1000000),updated_at=now() where member_id=mid;
  end if;
  select xp into xp_now from public.hiu_y_quan_engagement_profiles where member_id=mid;
  return jsonb_build_object(
    'correct',was_correct,'xp_awarded',case when was_correct then 2 else 0 end,'xp',xp_now,'current_index',next_index,
    'score',next_score,'combo',next_combo,'best_combo',next_best,'finished',done,'expired',false,
    'question',case when done then null else private.hiu_y_quan_challenge_question_v15(s.questions,next_index) end
  );
end $$;

create or replace function public.hiu_y_quan_daily_claim_v15()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  correct_today integer:=0;
  discharged_today integer:=0;
  challenge_score integer:=0;
  challenge_finished boolean:=false;
  inserted integer:=0;
  p public.hiu_y_quan_engagement_profiles%rowtype;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  select count(*)::integer into correct_today from public.hiu_y_quan_attempts a where a.member_id=mid and a.correct and (a.answered_at at time zone 'Asia/Ho_Chi_Minh')::date=d;
  select count(*)::integer into discharged_today from public.hiu_y_quan_cases c where c.member_id=mid and c.archived_at is not null and (c.archived_at at time zone 'Asia/Ho_Chi_Minh')::date=d;
  select coalesce(s.score,0)::integer,(s.finished_at is not null or s.expires_at<=now()) into challenge_score,challenge_finished from public.hiu_y_quan_herb_challenge_sessions s where s.member_id=mid and s.challenge_date=d;
  challenge_score:=coalesce(challenge_score,0); challenge_finished:=coalesce(challenge_finished,false);
  if correct_today<2 or discharged_today<1 or not challenge_finished or challenge_score<3 then
    return jsonb_build_object('ok',false,'reason','Chưa hoàn tất đủ 3 nhiệm vụ Ca trực hôm nay','engagement',public.hiu_y_quan_engagement_v15());
  end if;
  insert into public.hiu_y_quan_daily_rewards(member_id,mission_date) values(mid,d) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then
    select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid for update;
    update public.hiu_y_quan_engagement_profiles
    set xp=least(xp+25,1000000),
        streak_days=case when p.last_claim_date=d-1 then least(p.streak_days+1,10000) when p.last_claim_date=d then p.streak_days else 1 end,
        last_claim_date=d,updated_at=now()
    where member_id=mid;
  end if;
  return jsonb_build_object('ok',true,'already_claimed',inserted=0,'xp_awarded',case when inserted=1 then 25 else 0 end,'engagement',public.hiu_y_quan_engagement_v15());
end $$;

create or replace function public.hiu_y_quan_busy_shift_v15()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  slot timestamptz:=date_trunc('hour',now());
  seed bigint;
  picked_code text;
  key text;
  age_value smallint;
  variant_value smallint;
  inserted integer:=0;
  total_now integer:=0;
  p public.hiu_y_quan_engagement_profiles%rowtype;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles hp where hp.member_id=mid) then raise exception 'Hãy kích hoạt HIU - Y - Quán trước.'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  if exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.ordinal=3) then
    select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
    select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
    return jsonb_build_object('ok',true,'added',false,'reason','Ca đông khách trong giờ này đã được kích hoạt','active_cases',total_now,'level',case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end);
  end if;
  select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
  if total_now>=3 then return jsonb_build_object('ok',true,'added',false,'reason','Đã đủ 3 ca mô phỏng trong giờ hiện tại','active_cases',total_now); end if;
  seed:=(hashtext(mid::text||slot::text||':busy-v15')::bigint & 2147483647);
  select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed%20)::integer limit 1;
  age_value:=case (seed%4)::integer when 0 then (5+((seed/4)%8))::smallint when 1 then (13+((seed/32)%5))::smallint when 2 then (18+((seed/160)%42))::smallint else (60+((seed/6720)%31))::smallint end;
  variant_value:=(1+((seed/208320)%3))::smallint;
  key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-busy3';
  insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,patient_variant,appointment_offered,appointment_status,appointment_for_at,care_status)
  values(mid,key,slot,3,picked_code,age_value,case when ((seed/624960)%2)=0 then 'female' else 'male' end,variant_value,false,'none',null,'waiting_diagnosis')
  on conflict do nothing;
  get diagnostics inserted=row_count;
  select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
  select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
  return jsonb_build_object('ok',true,'added',inserted=1,'active_cases',total_now,'level',case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end,'message',case when inserted=1 then 'Đã mở Ca đông khách: thêm 1 bệnh nhân mô phỏng.' else 'Ca đông khách đã tồn tại; không tạo trùng.' end);
end $$;

create or replace function public.hiu_y_quan_consult_today_v15()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  payload jsonb;
  v public.hiu_y_quan_consult_votes%rowtype;
  total_votes integer:=0;
  distribution jsonb:='[]'::jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  payload:=private.hiu_y_quan_consult_payload_v15(d);
  select * into v from public.hiu_y_quan_consult_votes where consult_date=d and member_id=mid;
  if not found then
    return (payload-'correct_code'-'correct_label'-'explanation')||jsonb_build_object('voted',false,'selected_code',null,'correct',null,'distribution',null,'total_votes',null);
  end if;
  select count(*)::integer into total_votes from public.hiu_y_quan_consult_votes where consult_date=d;
  select coalesce(jsonb_agg(jsonb_build_object(
    'code',o.value->>'code','label',o.value->>'label','votes',coalesce(vc.c,0),
    'percent',case when total_votes>0 then round(coalesce(vc.c,0)*100.0/total_votes,1) else 0 end
  ) order by o.ord),'[]'::jsonb)
  into distribution
  from jsonb_array_elements(payload->'options') with ordinality o(value,ord)
  left join lateral (select count(*)::integer c from public.hiu_y_quan_consult_votes x where x.consult_date=d and x.selected_code=o.value->>'code') vc on true;
  return payload||jsonb_build_object('voted',true,'selected_code',v.selected_code,'correct',v.correct,'distribution',distribution,'total_votes',total_votes);
end $$;

create or replace function public.hiu_y_quan_consult_vote_v15(p_selected_code text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  payload jsonb;
  expected text;
  chosen text:=btrim(coalesce(p_selected_code,''));
  valid boolean:=false;
  was_correct boolean;
  inserted integer:=0;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  if exists(select 1 from public.hiu_y_quan_consult_votes where consult_date=d and member_id=mid) then return public.hiu_y_quan_consult_today_v15(); end if;
  payload:=private.hiu_y_quan_consult_payload_v15(d);
  expected:=payload->>'correct_code';
  select exists(select 1 from jsonb_array_elements(payload->'options') o where o->>'code'=chosen) into valid;
  if not valid then raise exception 'Lựa chọn hội chẩn không hợp lệ'; end if;
  was_correct:=chosen=expected;
  insert into public.hiu_y_quan_consult_votes(consult_date,member_id,syndrome_code,selected_code,correct)
  values(d,mid,expected,chosen,was_correct) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=1 then
    update public.hiu_y_quan_engagement_profiles set xp=least(xp+case when was_correct then 10 else 5 end,1000000),updated_at=now() where member_id=mid;
    if was_correct then
      insert into public.hiu_y_quan_mastery(member_id,item_type,item_key,points,updated_at)
      values(mid,'syndrome',expected,1,now())
      on conflict(member_id,item_type,item_key) do update set points=least(public.hiu_y_quan_mastery.points+1,100000),updated_at=now();
    end if;
  end if;
  return public.hiu_y_quan_consult_today_v15()||jsonb_build_object('xp_awarded',case when inserted=1 then case when was_correct then 10 else 5 end else 0 end);
end $$;

create or replace function public.hiu_y_quan_collection_v15()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  mid uuid:=private.current_member_id();
  herb_cards jsonb;
  syndrome_cards jsonb;
  p public.hiu_y_quan_engagement_profiles%rowtype;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  perform private.hiu_y_quan_sync_syndrome_mastery_v15(mid);
  select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',h.herb_key,'name',h.name,'kind','herb','points',coalesce(m.points,0),'tier',private.hiu_y_quan_mastery_tier_v15(coalesce(m.points,0)),
    'unlocked',coalesce(m.points,0)>0,'badge',case private.hiu_y_quan_mastery_tier_v15(coalesce(m.points,0)) when 4 then 'Ngọc dược' when 3 then 'Tinh thông' when 2 then 'Thuần thục' when 1 then 'Đã nhận diện' else 'Chưa mở' end
  ) order by h.name),'[]'::jsonb) into herb_cards
  from public.hiu_y_quan_herbs_v14() h
  left join public.hiu_y_quan_mastery m on m.member_id=mid and m.item_type='herb' and m.item_key=h.herb_key;
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',s.code,'name',s.label,'kind','syndrome','points',coalesce(m.points,0),'tier',private.hiu_y_quan_mastery_tier_v15(coalesce(m.points,0)),
    'unlocked',coalesce(m.points,0)>0,'badge',case private.hiu_y_quan_mastery_tier_v15(coalesce(m.points,0)) when 4 then 'Biện chứng tinh thông' when 3 then 'Vững thể bệnh' when 2 then 'Thuần thục' when 1 then 'Đã nhận diện' else 'Chưa mở' end
  ) order by coalesce(m.points,0) desc,s.label),'[]'::jsonb) into syndrome_cards
  from private.hiu_y_quan_syndrome_catalog s
  left join public.hiu_y_quan_mastery m on m.member_id=mid and m.item_type='syndrome' and m.item_key=s.code;
  return jsonb_build_object('xp',p.xp,'title',case when p.xp>=300 then 'Danh y mô phỏng' when p.xp>=150 then 'Cao thủ Tứ chẩn' when p.xp>=50 then 'Tân thủ Biện chứng' else 'Học đồ HIU' end,'herbs',herb_cards,'syndromes',syndrome_cards);
end $$;

revoke all on function private.hiu_y_quan_ensure_engagement_v15(uuid) from public;
revoke all on function private.hiu_y_quan_mastery_tier_v15(integer) from public;
revoke all on function private.hiu_y_quan_sync_syndrome_mastery_v15(uuid) from public;
revoke all on function private.hiu_y_quan_challenge_question_v15(jsonb,integer) from public;
revoke all on function private.hiu_y_quan_consult_payload_v15(date) from public;

revoke all on function public.hiu_y_quan_engagement_v15() from public,anon;
revoke all on function public.hiu_y_quan_herb_challenge_start_v15() from public,anon;
revoke all on function public.hiu_y_quan_herb_challenge_answer_v15(uuid,integer) from public,anon;
revoke all on function public.hiu_y_quan_daily_claim_v15() from public,anon;
revoke all on function public.hiu_y_quan_busy_shift_v15() from public,anon;
revoke all on function public.hiu_y_quan_consult_today_v15() from public,anon;
revoke all on function public.hiu_y_quan_consult_vote_v15(text) from public,anon;
revoke all on function public.hiu_y_quan_collection_v15() from public,anon;

grant execute on function public.hiu_y_quan_engagement_v15() to authenticated;
grant execute on function public.hiu_y_quan_herb_challenge_start_v15() to authenticated;
grant execute on function public.hiu_y_quan_herb_challenge_answer_v15(uuid,integer) to authenticated;
grant execute on function public.hiu_y_quan_daily_claim_v15() to authenticated;
grant execute on function public.hiu_y_quan_busy_shift_v15() to authenticated;
grant execute on function public.hiu_y_quan_consult_today_v15() to authenticated;
grant execute on function public.hiu_y_quan_consult_vote_v15(text) to authenticated;
grant execute on function public.hiu_y_quan_collection_v15() to authenticated;
