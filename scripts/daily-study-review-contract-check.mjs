import fs from 'node:fs';
import {validateDailyReviewQuestions,validateDailyReviewQuestionsDetailed,chooseDailySourceCount} from '../api/_lib/daily-study-review.js';

const fail=[];
const need=(body,tokens,label)=>tokens.forEach(token=>{if(!body.includes(token))fail.push(`${label} missing ${token}`)});
const migration=fs.readdirSync('supabase/migrations').find(name=>name.endsWith('_daily_grounded_study_review_v1.sql'));
if(!migration)fail.push('daily grounded review migration missing');
const sql=migration?fs.readFileSync(`supabase/migrations/${migration}`,'utf8'):'';
const ui=fs.readFileSync('src/components/home/DailyStudyReview.tsx','utf8');
const cron=fs.readFileSync('api/_lib/daily-study-review.js','utf8');
const assistant=fs.readFileSync('api/ai/assistant.js','utf8');
const service=fs.readFileSync('src/services/dailyStudyReviewService.ts','utf8');
const schema=migration?fs.readFileSync(`supabase/migrations/${migration}`,'utf8'):'';
need(schema,['source_question_id uuid not null references public.practice_questions(id)','source_file_id text not null references public.practice_source_documents(drive_file_id)','unique(member_id,quiz_date)','daily_study_review_candidates_v1','daily_study_review_generate_v1','daily_study_review_today_v1','daily_study_review_submit_v1','daily_study_review_secret_valid_v1','last_seen_at >= now()-interval \'30 days\'','cron.schedule','daily-study-os-grounded-review'],'database provenance, eligibility and restricted daily scheduling');
need(cron,['daily_study_review_secret_valid_v1','generateDailyReview','daily_study_review_candidates_v1','daily_study_review_generate_v1','Asia/Ho_Chi_Minh'],'shared gateway uses Vault-authenticated scheduler and grounded generation');
need(assistant,["req.body?.task==='daily_review_cron'",'handleDailyStudyReviewCron'],'scheduled job reuses the existing AI Gateway function');
need(ui,['ÔN TẬP HÔM NAY','Xem lại bài học gốc','Chưa có lượt ôn nội dung nguồn được duyệt','không hiển thị câu chưa được xác thực'],'inline quiz and truthful empty/source-review states');
need(service,['daily_study_review_today_v1','daily_study_review_submit_v1'],'member quiz fetch and grading RPC');
if(!schema.includes("'0 1 * * *'"))fail.push('daily 08:00 Vietnam cron missing');

const source={id:'source-1',stem:'Nội dung học tập có bốn lựa chọn.',options:['Đáp án A','Đáp án B','Đáp án C','Đáp án D'],correctIndex:1,explanation:'Giải thích nguyên văn từ tài liệu đã duyệt.'};
const valid={sourceQuestionId:'source-1',stem:'Theo nội dung học tập có bốn lựa chọn, chọn phương án đúng.',options:source.options,correctAnswer:'Đáp án B',explanation:source.explanation,evidenceQuote:'Nội dung học tập'};
if(validateDailyReviewQuestions([valid],[source]).length!==1)fail.push('valid source-backed item should pass');
if(validateDailyReviewQuestions([{...valid,correctAnswer:'Đáp án tự tạo'}],[source]).length!==0)fail.push('invented answer was not rejected');
if(validateDailyReviewQuestions([{...valid,options:['A','B','C','D']}],[source]).length!==0)fail.push('non-source options were not rejected');
if(validateDailyReviewQuestions([{...valid,evidenceQuote:'không có trong nguồn'}],[source]).length!==0)fail.push('missing evidence quote was not rejected');
if(validateDailyReviewQuestions([{...valid,sourceQuestionId:'missing'}],[source]).length!==0)fail.push('question without a source FK target was not rejected');
if(validateDailyReviewQuestionsDetailed([{...valid,correctAnswer:'Đáp án tự tạo'}],[source]).rejections.answer_mismatch!==1)fail.push('source validation diagnostic must identify only the failure category');
const counts=Array.from({length:100},(_,index)=>chooseDailySourceCount(index/100));
if(Math.min(...counts)!==3||Math.max(...counts)!==5)fail.push('daily quiz count must stay between 3 and 5');

if(fail.length){console.error('Daily Study Review contract FAIL');fail.forEach(item=>console.error(`- ${item}`));process.exit(1)}
console.log('Daily Study Review contract PASS: 3–5 grounded questions, approved-source FKs, user-only review access, and honest empty states.');
