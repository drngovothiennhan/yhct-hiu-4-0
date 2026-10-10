-- Study OS data repair v1 (2026-10-10). Destructive-free status changes; every affected row is backed up first.
-- Run only after the daily-review function migration (20261010130000) is applied. Safe to re-run (idempotent).
-- Expected counts when run on 2026-10-10: reject_duplicate 44, needs_review_awaiting_expert 300, reject_unsupported_ai 94.
--  - reject_duplicate: exact duplicates (same content_hash). Keeps the expert copy, else the earliest copy.
--  - needs_review_awaiting_expert: AI drafts whose source says "chờ chuyên gia duyệt" or "không hiển thị cho học viên".
--    Moved back to the expert review queue and hidden from students.
--  - reject_unsupported_ai: AI drafts from a source that produced 0 canonical questions.
-- Backup: private.study_os_repair_backup_20261010 (full rows before change). Targets: private.study_os_repair_targets_20261010.
-- Rollback: for each target id, restore review_status, provenance and updated_at from the backup table.

create table if not exists private.study_os_repair_backup_20261010 as select * from public.practice_questions where false;
revoke all on private.study_os_repair_backup_20261010 from public, anon, authenticated;

create table if not exists private.study_os_repair_targets_20261010(
  id uuid primary key,
  action text not null check(action in('reject_duplicate','needs_review_awaiting_expert','reject_unsupported_ai')),
  keep_id uuid,
  created_at timestamptz not null default now()
);
revoke all on private.study_os_repair_targets_20261010 from public, anon, authenticated;

insert into private.study_os_repair_targets_20261010(id,action,keep_id)
select ranked.id,'reject_duplicate',ranked.keep_id
from(
  select id,
    row_number() over(partition by content_hash order by (review_status='expert_approved') desc,created_at,id) as rn,
    first_value(id) over(partition by content_hash order by (review_status='expert_approved') desc,created_at,id) as keep_id,
    count(*) over(partition by content_hash) as n
  from public.practice_questions
) ranked
where ranked.n>1 and ranked.rn>1
on conflict(id) do nothing;

insert into private.study_os_repair_targets_20261010(id,action)
select q.id,'needs_review_awaiting_expert'
from public.practice_questions q
join public.practice_source_documents d on d.drive_file_id=q.source_file_id
where q.review_status='source_verified' and q.generation_method='ai_generated'
  and (d.sync_message ilike '%chờ chuyên gia duyệt%' or d.sync_message ilike '%không hiển thị cho học viên%')
on conflict(id) do nothing;

insert into private.study_os_repair_targets_20261010(id,action)
select q.id,'reject_unsupported_ai'
from public.practice_questions q
join public.practice_source_documents d on d.drive_file_id=q.source_file_id
where q.review_status='source_verified' and q.generation_method='ai_generated'
  and d.question_count=0 and d.sync_message ilike '%không có câu đạt chuẩn%'
on conflict(id) do nothing;

insert into private.study_os_repair_backup_20261010
select q.* from public.practice_questions q
join private.study_os_repair_targets_20261010 t on t.id=q.id
where not exists(select 1 from private.study_os_repair_backup_20261010 b where b.id=q.id);

update public.practice_questions q
set review_status=case when t.action='needs_review_awaiting_expert' then 'needs_review' else 'rejected' end,
    provenance=coalesce(q.provenance,'{}'::jsonb)||jsonb_build_object('studyOsRepair','v1','repairAction',t.action)
      ||case when t.keep_id is null then '{}'::jsonb else jsonb_build_object('duplicateOfId',t.keep_id::text) end,
    updated_at=now()
from private.study_os_repair_targets_20261010 t
where t.id=q.id and q.review_status='source_verified';
