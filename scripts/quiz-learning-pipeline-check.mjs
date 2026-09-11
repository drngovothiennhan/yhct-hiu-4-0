import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const need=(body,tokens,label)=>tokens.forEach(t=>{if(!body.includes(t))fail.push(`${label} missing ${t}`)});
const forbid=(body,tokens,label)=>tokens.forEach(t=>{if(body.includes(t))fail.push(`${label} must not contain ${t}`)});

const workspace=read('api/_lib/quiz-workspace.js');
const acc=read('src/components/admin/QuizImportCenter.tsx');
const daily=read('src/components/exam/DailyDrivePractice.tsx');
const practice=read('src/components/exam/PracticeBankQuiz.tsx');
const service=read('src/services/practiceQuizService.ts');
const exam=read('src/components/exam/ExamCenter.tsx');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const mascot=read('src/components/ai/AssistantMascot.tsx');
const sql=read('supabase/migrations/202609111025_quiz_learning_pipeline_v3.sql');

need(workspace,['repairQuizWithGemini','parsed.ready===0','gemini-answer-repair-v1','sourceEvidence.includes(evidence.toLowerCase())'],'ACC automatic SOURCE-backed answer repair/fallback');
need(acc,['Tự chuyển đổi','Cập nhật vào ngân hàng','pendingUpload','confirmed:true'],'ACC explicit convert and publish actions');
forbid(acc,['selection:ready','setChecked(new Set(d.questions'],'ACC must not auto-confirm draft questions');

need(sql,["review_status in('source_verified','expert_approved')",'adminConfirmed','practice_promote_admin_confirmed_ai_v1','practice_quiz_config_v1','practice_quiz_page_v1','practice_quiz_submit_v1'],'approved-bank SQL contract');
const pageBody=sql.slice(sql.indexOf('practice_quiz_page_v1'),sql.indexOf('practice_quiz_submit_v1'));
forbid(pageBody,["'correctIndex'","'explanation'"],'Practice Quiz page must not leak answers');
need(sql,['least(coalesce(p_limit,25),50)','jsonb_array_length(p_answers)>500'],'server request abuse bounds');

for(const count of ['5','10','20'])need(daily,[count],`Quick Review ${count}-question choice`);
need(daily,['selectedCount','Ôn tập nhanh','const openToday=async(count=selectedCount)','getTodayDailyPractice(count)','openToday(selectedCount)'],'Quick Review user-selectable daily set and stable server session');
need(practice,['Google Quiz','Tải thêm','Nộp bài','hasMore','practice-bank__options'],'continuous Google-style Practice Quiz');
need(service,['practice_quiz_page_v1','practice_quiz_submit_v1','for(let at=0;at<questions.length;at+=500)'],'continuous client submit is chunked without a 50-question product cap');
need(exam,["import PracticeBankQuiz from './PracticeBankQuiz'",'<PracticeBankQuiz/>'],'approved bank Practice Quiz is integrated in Exam Center');

need(mini,['AssistantMascot','guideOpen','avatarStyle','Hỏi nhanh, tìm tin hoặc mở tính năng.','app-assistant-guide-toggle'],'A.I Mini compact/collapsible guide and avatar preference');
need(mascot,["'default'|'eagle'|'viet'|'minimal'",'assistant-mascot__beak'],'selectable eagle/Vietnam presentation layer');
forbid(mascot,['fetch(','askServerAi','askXiaoZhiMini'],'mascot must remain presentation-only');

if(fail.length){console.error('QUIZ LEARNING PIPELINE CONTRACT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('Quiz learning pipeline contract PASS: SOURCE-backed ACC review -> approved bank -> 5/10/20 quick review -> continuous Practice Quiz -> compact selectable A.I Mini presentation.');
