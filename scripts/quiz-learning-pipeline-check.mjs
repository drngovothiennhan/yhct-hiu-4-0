import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const need=(body,tokens,label)=>tokens.forEach(t=>{if(!body.includes(t))fail.push(`${label} missing ${t}`)});
const forbid=(body,tokens,label)=>tokens.forEach(t=>{if(body.includes(t))fail.push(`${label} must not contain ${t}`)});

const workspace=read('api/_lib/quiz-workspace.js');
const acc=read('src/components/admin/QuizImportCenter.tsx');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const daily=read('src/components/exam/DailyDrivePractice.tsx');
const practice=read('src/components/exam/PracticeBankQuiz.tsx');
const service=read('src/services/practiceQuizService.ts');
const studyService=read('src/services/studyAiService.ts');
const studyHandler=read('api/_lib/study-assistant-handler.js');
const aiCenter=read('src/components/ai/AiCenter.tsx');
const exam=read('src/components/exam/ExamCenter.tsx');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const mascot=read('src/components/ai/AssistantMascot.tsx');
const sql=read('supabase/migrations/202609111025_quiz_learning_pipeline_v3.sql');

need(workspace,['repairQuizWithGemini','parsed.ready===0','gemini-answer-repair-v1','sourceEvidence.includes(evidence.toLowerCase())'],'ACC automatic SOURCE-backed answer repair/fallback');
need(manager,['syncQuizBank','Cập nhật','processUpload','publishAll','confirmed:true'],'canonical quiz manager explicit update/convert/publish actions');
forbid(manager,['selection:ready','setChecked(new Set(d.questions'],'canonical quiz manager must not auto-confirm draft questions');
need(acc,['LearningContentManagerPanel'],'ACC learning compatibility entry');
forbid(acc,['Tự chuyển đổi','Cập nhật vào ngân hàng','pendingUpload','quizWorkspace(','startQuizPipeline'],'ACC wrapper must not own a second quiz pipeline');

need(sql,["review_status in('source_verified','expert_approved')",'adminConfirmed','practice_promote_admin_confirmed_ai_v1','practice_quiz_config_v1','practice_quiz_page_v1','practice_quiz_submit_v1'],'approved-bank SQL contract');
const pageBody=sql.slice(sql.indexOf('practice_quiz_page_v1'),sql.indexOf('practice_quiz_submit_v1'));
forbid(pageBody,["'correctIndex'","'explanation'"],'Practice Quiz page must not leak answers');
need(sql,['least(coalesce(p_limit,25),50)','jsonb_array_length(p_answers)>500'],'server request abuse bounds');

for(const count of ['5','10','20'])need(daily,[count],`Quick Review ${count}-question choice`);
need(daily,['selectedCount','Ôn tập nhanh','daily-drive__source-switch','onChooseGemini','Đề HIU','Đề Gemini','A.I','const openToday=async(count=selectedCount)','getTodayDailyPractice(count)','openToday(selectedCount)'],'Quick Review has actionable HIU/Gemini source buttons and stable HIU daily session');
forbid(daily,['eligibleCount','<small>Sẵn sàng</small>'],'member Quick Review must never expose the global approved-bank question total');

need(practice,['QUIZ HỌC TẬP','Chọn nguồn → nội dung → số câu → bắt đầu','HIU_QUESTION_COUNTS=[10,20,30,50]','AI_QUESTION_COUNTS=[5,10,20]','preferredSource','onSourceChange','Đề HIU','Đề Gemini','A.I','getPracticeQuizPage(subject,0,seed.current,count)','submitPracticeQuiz(questions as PracticeQuizQuestion[]','Nộp bài','practice-bank__options'],'source-first HIU/Gemini Practice Quiz with explicit buttons');
forbid(practice,['Tải thêm','hasMore','eligibleCount','câu đã duyệt'],'member Practice Quiz must hide global bank count and pagination controls');
need(service,['practice_quiz_page_v1','practice_quiz_submit_v1','for(let at=0;at<questions.length;at+=500)'],'HIU client submit remains chunked and server-authoritative');
need(studyService,["task:'quiz'",'/api/ai/assistant','generateStudyGeminiQuiz'],'Gemini quiz must reuse the existing Study gateway');
need(studyHandler,["task==='quiz'",'createGeminiWebSearch','Gemini quiz has no grounded web source','aiGenerated:true','contextText','slice(-max)','giảng viên kiêm cố vấn học tập Y học cổ truyền bậc đại học','THỨ TỰ ƯU TIÊN NGỮ CẢNH BẮT BUỘC','Tuyệt đối không tự bịa rằng người dùng sắp thi'],'Gemini Study must be grounded, context-first and university-YHCT-advisor scoped');
need(aiCenter,['slice(-6400)','Giảng viên & cố vấn YHCT hệ đại học','câu hỏi hiện tại luôn được ưu tiên cao nhất','Nếu chưa xác định được chủ đề'],'AI Center must preserve recent context and avoid guessing missing study context');
need(exam,["import PracticeBankQuiz from './PracticeBankQuiz'","openBankSource('ai')",'<DailyDrivePractice onChooseGemini',"<PracticeBankQuiz key={bankSource} preferredSource={bankSource} onSourceChange={setBankSource}/>",'Đề HIU hoặc Gemini A.I'],'Quick Review Gemini source must route to the real Gemini quiz mode');

need(mini,['AssistantMascot','guideOpen','avatarStyle','Trợ lý tác vụ','Câu hỏi học tập sẽ tự chuyển sang Gemini Study.','app-assistant-guide-toggle'],'task-only A.I Mini compact/collapsible guide and avatar preference');
need(mascot,["'default'|'eagle'|'viet'|'minimal'",'assistant-mascot__beak'],'selectable eagle/Vietnam presentation layer');
forbid(mascot,['fetch(','askServerAi','askXiaoZhiMini'],'mascot must remain presentation-only');

if(fail.length){console.error('QUIZ LEARNING PIPELINE CONTRACT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('Quiz learning pipeline contract PASS: canonical ACC -> trusted HIU bank + actionable Gemini A.I source -> context-first university YHCT Study advisor -> no member-facing global bank total -> compact task-only A.I Mini.');
