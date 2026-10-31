import fs from 'node:fs';

// Điểm xác minh Quiz (chủ dự án duyệt 2026-10-31): câu bỏ trống 0 điểm, mỗi câu một lần/ngày
// (đúng 4, sai 1), không cộng theo lượt nộp, +5 mỗi ngày hoạt động, trần 300 điểm/ngày.
const file='supabase/migrations/20261031090000_practice_quiz_points_anti_farm_v1.sql';
const sql=fs.readFileSync(file,'utf8');
const errors=[];

for(const marker of [
  'create table if not exists private.practice_quiz_daily_credit',
  'primary key (member_id, day, question_id)',
  'check (points in (1, 4))',
  'revoke all on table private.practice_quiz_daily_credit from public, anon, authenticated',
  'if selected is not null then',
  'on conflict (member_id, day, question_id) do update',
  'where c.points < excluded.points',
  "jsonb_build_object('total',total,'answered',answered,'correct',correct_count)",
  'least(300, pts + 5)',
  'revoke all on function private.practice_quiz_points_v2(timestamptz) from public, anon, authenticated',
  'public.learning_competition_leaderboard_v1(p_days integer default 30, p_limit integer default 100)',
  "private.practice_quiz_points_v2(now()-interval '30 days')",
  'private.mask_initials_v1(full_name)',
]) if(!sql.includes(marker)) errors.push(`missing: ${marker}`);

if(/submissions,0\)\*2|q\.subs\*2/.test(sql)) errors.push('per-submission bonus must stay removed');
if(/\b(drop|truncate)\b|\bdelete\s+from\b/i.test(sql.replace(/--.*$/gm,''))) errors.push('migration must stay additive (no DROP/DELETE/TRUNCATE)');

if(errors.length){
  console.error('Quiz points anti-farm contract failed:');
  for(const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Quiz points anti-farm contract passed: blank answers score 0, one credit per question per day, no per-submission bonus, 300/day cap.');
