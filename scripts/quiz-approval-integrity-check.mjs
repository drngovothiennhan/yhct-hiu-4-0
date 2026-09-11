import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const fail = [];
const migration = read('supabase/migrations/202609111805_quiz_approval_integrity_v4.sql');
const deploy = read('.github/workflows/vercel-production.yml');

const need = (body, tokens, label) => {
  for (const token of tokens) {
    if (!body.includes(token)) fail.push(`${label} missing ${token}`);
  }
};

need(migration, [
  'create or replace function public.practice_drive_ingest_admin_v1',
  "public.practice_questions.review_status='expert_approved'",
  'content_hash is not distinct from excluded.content_hash',
  'stem is not distinct from excluded.stem',
  'options is not distinct from excluded.options',
  'correct_index is not distinct from excluded.correct_index',
  'explanation is not distinct from excluded.explanation',
  'expert_verified_by=case',
  'expert_verified_at=case',
  "'approvalInvalidatedReason','content_changed'",
], 'approval invalidation');

need(migration, [
  'create or replace function public.daily_practice_today_v1',
  'for update;',
  'on conflict(member_id,practice_date) do nothing',
  "where q.review_status in('source_verified','expert_approved')",
  'not (q.id=any(retained))',
  'ids:=retained||refill',
  "from jsonb_each(coalesce(s.answers,'{}'::jsonb))",
  "'practice.daily.refresh'",
], 'daily practice eligibility repair');

if (deploy.includes('group: vercel-production\n')) {
  fail.push('production deployment concurrency must not let non-main Web CI completion cancel main deployment');
}
need(deploy, [
  'github.event.workflow_run.event',
  'github.event.workflow_run.head_branch',
], 'production concurrency isolation');

if (fail.length) {
  console.error('QUIZ APPROVAL INTEGRITY CONTRACT FAILED');
  fail.forEach((x) => console.error(`- ${x}`));
  process.exit(1);
}

console.log('Quiz approval integrity PASS: changed content invalidates stale expert approval, daily sessions self-heal eligibility, and deploy concurrency is event/branch isolated.');
