// Study OS repair v1 contract: trusted-only daily review, duplicate-safe selection,
// backup-first data repair plan, single daily-review placement, and source-shape normalization.
import fs from 'node:fs';

const failures = [];
const need = (ok, message) => { if (!ok) failures.push(message); };
const read = (file) => fs.readFileSync(file, 'utf8');

const fnSql = read('supabase/migrations/20261010130000_study_os_daily_review_eligibility_v1.sql');
const dataSql = read('supabase/migrations/20261010131000_study_os_data_repair_v1.sql');
const hub = read('src/components/home/StudyHubV2.tsx');
const hubCss = read('src/components/home/study-hub-v2.css');
const aiService = read('src/services/studyAiService.ts');
const pkg = JSON.parse(read('package.json'));

need(/create or replace function public\.daily_study_review_candidates_v1/.test(fnSql), 'function migration must replace daily_study_review_candidates_v1');
need(/create or replace function public\.daily_study_review_generate_v1/.test(fnSql), 'function migration must replace daily_study_review_generate_v1');
need(/create or replace function public\.daily_study_review_today_v1/.test(fnSql), 'function migration must replace daily_study_review_today_v1');
need(fnSql.includes("q.review_status='source_verified' and q.generation_method='parsed'"), 'candidates and today must accept only parsed source_verified questions');
need(fnSql.includes("review_status='source_verified' and generation_method='parsed'"), 'generate must accept only parsed source_verified questions');
need(!/join public\.practice_questions q on q\.id=s\.question_id and q\.review_status in\('source_verified','expert_approved'\)\s*\n\s*join public\.practice_source_documents/.test(fnSql), 'legacy source_verified-only join must not remain in candidates');
need(/distinct on\(q\.content_hash\)/.test(fnSql), 'candidates must keep one question per content_hash');
need(fnSql.includes('join public.practice_questions sq on sq.id=s.question_id'), 'learner progress must be matched through content_hash');
need(fnSql.includes('seen_hashes') && fnSql.includes('continue;'), 'generate must refuse duplicate content inside one payload');

for (const action of ['reject_duplicate', 'needs_review_awaiting_expert', 'reject_unsupported_ai']) {
  need(dataSql.includes(`'${action}'`), `data repair must classify ${action}`);
}
need(dataSql.includes('private.study_os_repair_backup_20261010'), 'data repair must back up affected rows before changing them');
need(!/\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i.test(dataSql), 'data repair must not delete rows or drop tables');
need(dataSql.includes("q.review_status='source_verified'"), 'data repair must only change rows still in source_verified');

need(!hub.includes('TRỌNG TÂM'), 'hub must not repeat the focus CTA as a second tile');
need(hub.includes('DAILY MISSION') && hub.includes('TIẾP TỤC HỌC'), 'hub must keep the Daily Mission and Continue Learning surfaces');
need(hub.split('<DailyStudyReview').length === 2, 'daily review must render exactly once');
need(hub.indexOf('<DailyStudyReview') > 0 && hub.indexOf('<DailyStudyReview') < hub.indexOf('<PersonalizedStudyGuide'), 'daily review must render before the personalized guide');
need(/\.study-os-v2__continue-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(hubCss), 'continue grid must lay out the two remaining tiles');

need(aiService.includes('normalizeStudySources(payload?.sources)') && aiService.includes('raw.label'), 'study AI sources must accept title or label from every provider');
need(pkg.scripts?.['audit:study-os-repair'] === 'node scripts/study-os-repair-check.mjs', 'package.json must expose audit:study-os-repair');
need(String(pkg.scripts?.prebuild || '').includes('npm run audit:study-os-repair'), 'prebuild must run audit:study-os-repair');

if (failures.length) {
  console.error('study-os-repair-check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('study-os-repair-check passed: trusted-only daily review, duplicate-safe selection, backup-first repair plan, single daily-review placement, source normalization.');
