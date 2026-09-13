import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const need=(body,tokens,label)=>tokens.forEach(t=>{if(!body.includes(t))fail.push(`${label} missing ${t}`)});
const forbid=(body,tokens,label)=>tokens.forEach(t=>{if(body.includes(t))fail.push(`${label} must not contain ${t}`)});

const acc=read('src/components/admin/QuizImportCenter.tsx');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const trustedIngest=read('api/_lib/trusted-quiz-ingest.js');
const daily=read('src/components/exam/DailyDrivePractice.tsx');
const practice=read('src/components/exam/PracticeBankQuiz.tsx');
const adaptive=read('src/components/exam/AdaptiveReview.tsx');
const reasoning=read('src/components/exam/QuestionReasoningGuide.tsx');
const service=read('src/services/practiceQuizService.ts');
const studyService=read('src/services/studyAiService.ts');
const studyQuiz=read('api/ai/study-quiz.js');
const studyHandler=read('api/_lib/study-assistant-handler.js');
const aiCenter=read('src/components/ai/AiCenter.tsx');
const exam=read('src/components/exam/ExamCenter.tsx');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const mascot=read('src/components/ai/AssistantMascot.tsx');
const bankSql=read('supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql');

need(manager,['syncQuizBank','Thêm thủ công → Cập nhật → dùng ngay','thư mục môn','đáp án tô đỏ','tên tệp DOCX chỉ là dấu vết quản trị'],'canonical one-step trusted quiz bank manager');
forbid(manager,['processUpload','publishAll','publishQuizDraft','startQuizPipeline','sourceFileBase64','tryTrustedQuizUpload','Duyệt Drive thủ công','File từ ACC'],'canonical manager must not expose legacy conversion/publish workflow');
need(acc,['LearningContentManagerPanel'],'ACC learning compatibility entry');
forbid(acc,['Tự chuyển đổi','Cập nhật vào ngân hàng','pendingUpload','quizWorkspace(','startQuizPipeline'],'ACC wrapper must not own a second quiz pipeline');
need(trustedIngest,['subjectFolders','nestedGroups','parseTrustedMarkedDocx','practice_source_sync_state_v1','practice_trusted_quiz_ingest_v1','!knownIds.has'],'server trusted intake scans direct + one-level subject folders and only new files');
forbid(trustedIngest,['parseMcqDocument','explicit-answer-key-v1','subjectFromName'],'canonical trusted intake must not infer answers/taxonomy from alternate parser or filename');

need(bankSql,["q.review_status in('source_verified','expert_approved')",'practice_quiz_config_v1','practice_quiz_page_v1','practice_subject_folders_sync_admin_v1','where active is true'],'data-first approved-bank SQL contract and safe-update compatibility');
const pageBody=bankSql.slice(bankSql.indexOf('practice_quiz_page_v1'),bankSql.indexOf('-- Preserve the Drive-folder registry'));
forbid(pageBody,["'correctIndex'","'explanation'",'sourceFileName'],'Practice Quiz page must not leak answers or file provenance');
need(bankSql,['least(coalesce(p_limit,25),50)'],'server quiz page request bound');

for(const count of ['5','10','20'])need(daily,[count],`Quick Review ${count}-question choice`);
need(daily,['selectedCount','Ôn tập nhanh','daily-drive__source-switch','onChooseGemini','Đề HIU','Đề Gemini','const openToday=async(count=selectedCount)','getTodayDailyPractice(count)','QuestionReasoningGuide'],'Quick Review has actionable HIU/Gemini sources, stable HIU session and contextual reasoning');
forbid(daily,['eligibleCount','<small>Sẵn sàng</small>'],'member Quick Review must not expose global approved-bank count');

need(practice,['QUIZ HỌC TẬP','Chọn nguồn → nội dung → số câu → bắt đầu','HIU_QUESTION_COUNTS=[10,20,30,50]','AI_QUESTION_COUNTS=[5,10,20]','preferredSource','onSourceChange','Đề HIU','Đề Gemini','getPracticeQuizPage(subject,0,seed.current,count)','submitPracticeQuiz(questions as PracticeQuizQuestion[]','Nộp bài','QuestionReasoningGuide','recordReview'],'source-first HIU/Gemini Practice Quiz with contextual reasoning and adaptive-card capture');
forbid(practice,['Tải thêm','hasMore','eligibleCount','câu đã duyệt'],'member Practice Quiz must hide global bank count and pagination controls');
need(service,['practice_quiz_page_v1','practice_quiz_submit_v1','for(let at=0;at<questions.length;at+=500)'],'HIU client submit remains chunked and server-authoritative');

need(studyService,['generateStudyGeminiQuiz',"fetch('/api/ai/study-quiz'",'A.I chưa tạo đủ số câu hợp lệ','Đề A.I chưa có nguồn web xác minh'],'generated quiz client uses dedicated resilient grounded gateway');
need(studyQuiz,['runGemini(topic,count,controller.signal)','runOpenAi(topic,count,controller.signal)',"provider:'openai-web-fallback'",'invalid_quiz_count','Gemini quiz has no grounded web source','OpenAI quiz has no grounded web source'],'Study quiz is Gemini-first, exact-count, source-grounded and provider-resilient');
if(studyQuiz.indexOf('runGemini(topic,count,controller.signal)')>=studyQuiz.indexOf('runOpenAi(topic,count,controller.signal)'))fail.push('Study quiz must attempt Gemini before fallback');
need(studyHandler,['createGeminiWebSearch','conversationContext','giảng viên kiêm cố vấn học tập Y học cổ truyền bậc đại học','THỨ TỰ ƯU TIÊN NGỮ CẢNH BẮT BUỘC','Tuyệt đối không tự bịa rằng người dùng sắp thi'],'Gemini Study chat remains grounded, context-first and university-YHCT-advisor scoped');
need(aiCenter,['slice(-6400)','Giảng viên & cố vấn YHCT hệ đại học','câu hỏi hiện tại luôn được ưu tiên cao nhất','Nếu chưa xác định được chủ đề'],'AI Center must preserve recent context and avoid guessing missing study context');
need(exam,["import PracticeBankQuiz from './PracticeBankQuiz'","openBankSource('ai')",'<DailyDrivePractice onChooseGemini',"<PracticeBankQuiz key={bankSource} preferredSource={bankSource} onSourceChange={setBankSource}/>",'Đề HIU hoặc Gemini A.I'],'Quick Review Gemini source must route to real generated quiz mode');

need(adaptive,['Ôn tập ngắt quãng','selectedSubject','selectedCount','5','10','20','QuestionReasoningGuide'],'adaptive review supports content/count selection and contextual reasoning');
need(reasoning,['A.I hướng dẫn suy luận','askStudyGemini','stem','options','subject','topic','selectedIndex'],'reasoning tutor must receive current question context and route to Study AI');

need(mini,['AssistantMascot','guideOpen','avatarStyle','Trợ lý tác vụ','Câu hỏi học tập sẽ tự chuyển sang Gemini Study.','app-assistant-guide-toggle'],'task-only A.I Mini compact/collapsible guide and avatar preference');
need(mascot,["'default'|'eagle'|'viet'|'minimal'",'assistant-mascot__beak'],'selectable eagle/Vietnam presentation layer');
forbid(mascot,['fetch(','askServerAi','askXiaoZhiMini'],'mascot must remain presentation-only');

if(fail.length){console.error('QUIZ LEARNING PIPELINE CONTRACT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('Quiz learning pipeline contract PASS: one-step trusted subject-folder bank + data-first HIU practice + resilient grounded Gemini-first quiz + contextual reasoning + subject-aware adaptive review + task-only assistant.');