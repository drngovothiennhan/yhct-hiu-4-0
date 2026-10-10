-- Additive: quản trị viên đã duyệt xác nhận hàng loạt bản nháp AI (external_key tiền tố 'claude-draft:')
-- đang ở trạng thái needs_review. Kiểm tra quyền ngay trong database qua auth.uid().

create or replace function public.practice_approve_ai_drafts_v1(p_prefix text default 'claude-draft:')
returns integer
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_member uuid;
  v_count integer;
begin
  select cm.id into v_member
  from public.club_members cm
  where cm.auth_user_id = auth.uid()
    and cm.status = 'approved'
    and cm.role::text = 'admin'
  limit 1;

  if v_member is null then
    raise exception 'Chỉ quản trị viên đã duyệt mới được xác nhận bản nháp AI' using errcode = '42501';
  end if;

  if p_prefix is null or p_prefix not like 'claude-draft:%' then
    raise exception 'Tiền tố bản nháp không hợp lệ';
  end if;

  update public.practice_questions
  set review_status = 'expert_approved',
      expert_verified_by = v_member,
      expert_verified_at = now(),
      provenance = provenance || jsonb_build_object(
        'adminConfirmed', true,
        'reviewer', v_member::text,
        'note', 'AI soạn; quản trị viên xác nhận qua ACC'
      ),
      updated_at = now()
  where external_key like p_prefix || '%'
    and review_status = 'needs_review'
    and generation_method = 'ai_generated';

  get diagnostics v_count = row_count;
  return v_count;
end
$function$;

revoke all on function public.practice_approve_ai_drafts_v1(text) from public, anon;
grant execute on function public.practice_approve_ai_drafts_v1(text) to authenticated;
