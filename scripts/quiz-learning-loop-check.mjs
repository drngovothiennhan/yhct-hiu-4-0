import fs from 'node:fs';

// Vòng học khép kín của Quiz (2026-11-13): mỗi lượt nộp ghi kết quả từng câu trên máy chủ,
// máy chủ trả danh sách câu còn sai (không kèm đáp án) và mức nắm bài theo thư mục.
const file='supabase/migrations/20261113022758_practice_quiz_learning_loop_v1.sql';
const sql=fs.readFileSync(file,'utf8');
const code=sql.replace(/--.*$/gm,'');
const errors=[];

for(const marker of [
  'create or replace function public.practice_quiz_submit_v1(p_answers jsonb)',
  'insert into public.daily_practice_question_stats as s(member_id, question_id, attempts, correct_count, wrong_count, last_seen_at, last_correct_at)',
  'on conflict (member_id, question_id) do update',
  'last_correct_at = coalesce(excluded.last_correct_at, s.last_correct_at)',
  'insert into private.practice_quiz_daily_credit as c(member_id, day, question_id, points)',
  'where c.points < excluded.points',
  "create or replace function public.practice_quiz_mistakes_v1(p_subject text default '', p_limit integer default 20)",
  'and (s.last_correct_at is null or s.last_correct_at<s.last_seen_at)',
  'create or replace function public.practice_quiz_mastery_v1()',
  'revoke all on function public.practice_quiz_submit_v1(jsonb) from public, anon',
  'revoke all on function public.practice_quiz_mistakes_v1(text, integer) from public, anon',
  'revoke all on function public.practice_quiz_mastery_v1() from public, anon',
  'grant execute on function public.practice_quiz_mistakes_v1(text, integer) to authenticated',
  'grant execute on function public.practice_quiz_mastery_v1() to authenticated',
]) if(!sql.includes(marker)) errors.push(`missing: ${marker}`);

if((code.match(/if mid is null or not private\.is_approved\(\) then raise exception 'Approved member required'; end if;/g)||[]).length!==3) errors.push('all three functions must require an approved member');
if((code.match(/set search_path = ''/g)||[]).length!==3) errors.push("all three functions must pin search_path = ''");
if(/\b(drop|truncate)\b|\bdelete\s+from\b/i.test(code)) errors.push('migration must stay additive (no DROP/DELETE/TRUNCATE)');

// Hai hàm đọc không được trả đáp án hay giải thích.
const readers=code.slice(code.indexOf('create or replace function public.practice_quiz_mistakes_v1'));
for(const leak of ['correct_index','correctIndex','explanation','provenance','evidenceText']) if(readers.includes(leak)) errors.push(`read functions must not expose ${leak}`);
// Câu bỏ trống không được tính là một lần làm.
const submit=code.slice(0,code.indexOf('create or replace function public.practice_quiz_mistakes_v1'));
const guard=submit.indexOf('if selected is not null then'),stats=submit.indexOf('insert into public.daily_practice_question_stats'),endIf=submit.indexOf('end if;',stats);
if(!(guard>0&&stats>guard&&endIf>stats)) errors.push('per-question stats must be written only for answered questions');

const service=fs.readFileSync('src/services/practiceQuizService.ts','utf8');
const ui=fs.readFileSync('src/components/exam/PracticeBankQuiz.tsx','utf8');
for(const marker of ["supabase.rpc('practice_quiz_mastery_v1')","supabase.rpc('practice_quiz_mistakes_v1'"]) if(!service.includes(marker)) errors.push(`service missing: ${marker}`);
for(const marker of ['data-practice-mastery="true"','startMistakes','refreshMastery()']) if(!ui.includes(marker)) errors.push(`quiz UI missing: ${marker}`);

if(errors.length){
  console.error('Quiz learning loop contract failed:');
  for(const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Quiz learning loop contract passed: answered questions are recorded per member, open mistakes and mastery are read without answers.');
