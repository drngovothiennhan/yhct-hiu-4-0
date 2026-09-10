-- Public academic feed v2: expose only the member's public avatar URL so feed cards can distinguish authors.
-- The backing member table remains private; this bounded RPC is still the only public read surface.
create or replace function public.academic_feed_v1(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);
  v_result jsonb;
begin
  select coalesce(jsonb_agg(x.payload order by x.approved_at desc nulls last,x.created_at desc),'[]'::jsonb)
  into v_result
  from (
    select p.approved_at,p.created_at,
      jsonb_build_object(
        'id',p.id,
        'author',jsonb_build_object(
          'id',m.id,
          'studentCode',m.student_code,
          'fullName',m.full_name,
          'avatarUrl',m.avatar_url,
          'title',coalesce(nullif(m.position_title,''),'Hội viên'),
          'role',m.role,
          'reputation',least(100,greatest(0,round(coalesce(m.academic_reputation_multiplier,1)::numeric*20)))
        ),
        'title',p.title,
        'chiefComplaint',p.chief_complaint,
        'fourExams',coalesce(p.four_exams,'{}'::jsonb),
        'eightPrinciples',coalesce(to_jsonb(p.eight_principles),'[]'::jsonb),
        'syndrome',p.syndrome,
        'treatmentPrinciple',p.treatment_principle,
        'formula',p.formula,
        'acupoints',coalesce(to_jsonb(p.acupoints),'[]'::jsonb),
        'citations',coalesce(p.citations,'[]'::jsonb),
        'tags',coalesce(to_jsonb(p.tags),'[]'::jsonb),
        'createdAt',p.created_at,
        'approvedAt',p.approved_at,
        'modVerified',p.citation_verified,
        'moderationStatus',p.moderation_status,
        'postType',p.post_type,
        'specialty',p.specialty,
        'visibility',p.visibility,
        'media',p.media,
        'academicScore',coalesce(p.academic_score_cached,0),
        'likes',coalesce((select count(*) from public.post_reactions r where r.post_id=p.id),0),
        'comments',coalesce((select count(*) from public.comments c where c.post_id=p.id),0)
      ) payload
    from public.clinical_posts p
    join public.club_members m on m.id=p.author_id
    where p.privacy_scrubbed is true
      and m.data_conflict is false
      and p.moderation_status='approved'
      and (
        m.student_code<>'AI-YHCT-SYSTEM'
        or p.id in (
          select p2.id
          from public.clinical_posts p2
          where p2.author_id=p.author_id
            and p2.privacy_scrubbed is true
            and p2.moderation_status='approved'
          order by p2.approved_at desc nulls last,p2.created_at desc,p2.id desc
          limit 3
        )
      )
    order by p.approved_at desc nulls last,p.created_at desc
    limit v_limit
  ) x;
  return coalesce(v_result,'[]'::jsonb);
end
$function$;

revoke all on function public.academic_feed_v1(integer) from public;
grant execute on function public.academic_feed_v1(integer) to anon,authenticated,service_role;
