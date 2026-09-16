import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const need=(body,tokens,label)=>tokens.forEach(t=>{if(!body.includes(t))fail.push(`${label} missing ${t}`)});
const forbid=(body,tokens,label)=>tokens.forEach(t=>{if(body.includes(t))fail.push(`${label} must not contain ${t}`)});

const acc=read('src/components/admin/QuizImportCenter.tsx');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const trustedIngest=read('api/_lib/trusted-quiz-ingest.js');
const daily=read('src/components/exam/DailyDrivePractice.tsx');
const dailyService=read('src/services/dailyPracticeService.ts');
const dailyV2Sql=read('supabase/migrations/202609140820_quick_review_folder_reconfigure_v2.sql');
const practice=read('src/components/exam/PracticeBankQuiz.tsx');
const adaptive=read('src/components/exam/AdaptiveReview.tsx');
const reasoning=read('src/components/exam/QuestionReasoningGuide.tsx');
const service=read('src/services/practiceQuizService.ts');
const studyService=read('src/services/studyAiService.ts');
const studyHandler=read('api/_lib/study-assistant-handler.js');
const publicEvidence=read('api/_lib/public-medical-evidence.js');
const assistant=read('api/ai/assistant.js');
const aiCenter=read('src/components/ai/AiCenter.tsx');
const exam=read('src/components/exam/ExamCenter.tsx');
const legacyExam=read('src/components/exam/NationalExamPrepLegacy.tsx');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const mascot=read('src/components/ai/AssistantMascot.tsx');
const bankSql=read('supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql');

need(manager,['syncQuizBank','Thêm thủ công → Cập nhật → dùng ngay','thư mục môn','đáp án tô đỏ','tên tệp DOCX chỉ là dấu vết quản trị'],'canonical one-step trusted quiz bank manager');
forbid(manager,['processUpload','publishAll','publishQuizDraft','startQuizPipeline','sourceFileBase64','tryTrustedQuizUpload','Duyệt Drive thủ công','File từ ACC'],'canonical manager must not expose legacy conversion workflow');
need(acc,['LearningContentManagerPanel'],'ACC learning compatibility entry');
forbid(acc,['Tự chuyển đổi','Cập nhật vào ngân hàng','pendingUpload','quizWorkspace(','startQuizPipeline'],'ACC wrapper must not own a second quiz pipeline');
need(trustedIngest,['subjectFolders','nestedGroups','parseTrustedMarkedDocx','practice_source_sync_state_v1','practice_trusted_quiz_ingest_v1','needsProcessing'],'trusted intake scans direct + one-level subject folders and retries parser-revision failures');
forbid(trustedIngest,['parseMcqDocument','explicit-answer-key-v1','subjectFromName'],'canonical intake must not infer answers or taxonomy from filenames');

need(bankSql,["q.review_status in('source_verified','expert_approved')",'practice_quiz_config_v1','practice_quiz_page_v1','practice_subject_folders_sync_admin_v1','where active is true'],'data-first approved bank SQL contract');
const pageBody=bankSql.slice(bankSql.indexOf('practice_quiz_page_v1'),bankSql.indexOf('-- Preserve the Drive-folder registry'));
forbid(pageBody,["'correctIndex'","'explanation'",'sourceFileName'],'quiz page must not leak answers or source filename');
need(bankSql,['least(coalesce(p_limit,25),50)'],'server quiz page request bound');

for(const count of ['5','10','20'])need(daily,[count],`Quick Review ${count}-question choice`);
need(daily,['selectedCount','selectedSubject','getPracticeQuizConfig','Ôn tập nhanh','daily-drive__source-switch','daily-drive__setup','onChooseGemini','Đề HIU','Đề Gemini','Thư mục HIU','Tất cả thư mục HIU','const openToday=async(count=selectedCount,subject=selectedSubject,reset=Boolean(session))','getTodayDailyPractice(count,subject,reset)','Đổi bộ','QuestionReasoningGuide'],'Quick Review has repeatable folder/count choice, HIU/Gemini sources and contextual reasoning');
need(dailyService,['daily_practice_today_v2','p_subject:String(subject||\'\')','p_reset:Boolean(reset)'],'Quick Review client uses reconfigurable daily practice RPC');
need(dailyV2Sql,['daily_practice_today_v2','p_subject text default','p_reset boolean default false','private.practice_subject_folders_v1',"answers='{}'::jsonb",'subject=target_subject'],'Quick Review server preserves folder-only taxonomy and supports safe same-day reset');
forbid(daily,['eligibleCount','<small>Sẵn sàng</small>'],'member Quick Review must not expose global bank count');
need(practice,['QUIZ HỌC TẬP','Nguồn → thư mục/chủ đề → số câu → học','HIU_QUESTION_COUNTS=[5,10,20,30,50,0]','AI_QUESTION_COUNTS=[5,10,20]','preferredSource','Đề HIU','Đề Gemini','Thư mục HIU','Tất cả thư mục HIU','getPracticeQuizPage(subject,offset,seed.current,count===0?25:count)','submitPracticeQuiz(questions as PracticeQuizQuestion[]','Nộp bài','QuestionReasoningGuide','recordReview'],'source-first HIU/Gemini Practice Quiz');
forbid(practice,['Tải thêm','eligibleCount','câu đã duyệt'],'member Practice Quiz hides global counts; all mode pages only after grading');
need(service,['practice_quiz_page_v1','practice_quiz_submit_v1','for(let at=0;at<questions.length;at+=500)'],'HIU client submit remains chunked and server-authoritative');

need(studyService,['generateStudyGeminiQuiz',"fetch('/api/ai/assistant'","task:'quiz'",'A.I chưa tạo đủ số câu hợp lệ','Đề A.I chưa có nguồn web xác minh'],'generated quiz uses shared resilient grounded gateway');
forbid(studyService,['/api/ai/study-quiz'],'duplicate Study quiz endpoint must stay removed');
need(assistant,["req.body?.mode==='study'",'handleStudyAssistant'],'shared assistant must own Study routing');
need(studyHandler,["task==='quiz'",'createGroundedQuiz','retrievePublicMedicalEvidence','createGeminiJson','runOpenAiEvidenceQuiz',"provider:'openai-public-evidence'",'sourceIndexes','QUIZ_MODEL_BUSY','X-AI-Evidence-Count'],'Study quiz is Gemini-first, exact-count, public-evidence-grounded and resilient inside shared gateway');
forbid(studyHandler,['web_search_preview','runOpenAiQuiz',"provider:'openai-web-fallback'",'Gemini quiz has no grounded web source','OpenAI quiz has no grounded web source'],'quota-sensitive parallel search path must stay retired');
need(publicEvidence,['api.openalex.org/works','ebi.ac.uk/europepmc','wikipedia.org/w/api.php','physiology','publicEvidencePacket','publicEvidenceSources'],'public evidence must be retrieved independently of model quota');
need(studyHandler,['conversationContext','giảng viên kiêm cố vấn học tập Y học cổ truyền bậc đại học','THỨ TỰ ƯU TIÊN NGỮ CẢNH BẮT BUỘC','Tuyệt đối không tự bịa rằng người dùng sắp thi'],'Gemini Study chat remains context-first and university-YHCT-advisor scoped');
need(aiCenter,['messages.slice(-12)','slice(-6500)','Giảng viên & cố vấn YHCT hệ đại học','câu hỏi hiện tại luôn được ưu tiên cao nhất','Nếu chưa xác định được chủ đề'],'AI Center preserves deeper but bounded recent context and avoids guessing');
need(exam,["import PracticeBankQuiz from './PracticeBankQuiz'","openBankSource('ai')",'<DailyDrivePractice onChooseGemini',"preferredSource={bankSource} initialSubject={bankSetup.subject}",'Nguồn → thư mục/chủ đề → số câu'],'Quick Review Gemini source routes to generated quiz mode inside the unified hierarchy');
forbid(legacyExam,['DailyDrivePractice','PracticeBankQuiz','AdaptiveReview'],'Standard Exam must not remount sibling Learning Hub workflows');

need(adaptive,['Ôn tập ngắt quãng','subject','count','REVIEW_COUNTS=[5,10,20,0]','getPracticeQuizConfig','const subjects=bankSubjects','validCards','<small>{card.subject}</small>','QuestionReasoningGuide'],'adaptive review uses current folder registry only, supports count selection and contextual reasoning');
need(reasoning,['A.I hướng dẫn suy luận','askServerAi','stem','options','subject','topic','selectedIndex',"askServerAi(prompt,'exam'",'KHÔNG tiết lộ đáp án đúng','Dữ kiện quyết định','Loại trừ','Điểm cần nhớ'],'reasoning tutor receives current question context and stays non-answer-leaking before selection');
need(mini,['AssistantMascot','guideOpen','avatarStyle','Trợ lý XiaoZhi','Ngoài các tác vụ cài sẵn, tôi có thể tìm nguồn Internet công khai để trả lời.','app-assistant-guide-toggle','askXiaoZhiPublic',"mode:'xiaozhi-mini'"],'XiaoZhi compact guide keeps tasks plus public web answers');
need(mascot,["'default'|'eagle'|'viet'|'minimal'",'assistant-mascot__beak'],'selectable assistant presentation layer');
forbid(mascot,['fetch(','askServerAi','askXiaoZhiMini'],'mascot remains presentation-only');

if(fs.existsSync('api/ai/study-quiz.js'))fail.push('duplicate api/ai/study-quiz.js must remain removed');
if(fail.length){console.error('QUIZ LEARNING PIPELINE CONTRACT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('Quiz learning pipeline contract PASS: one-step bank + source-folder-count learning hierarchy + repeatable Quick Review + grounded Gemini generation + XiaoZhi public web + folder-only adaptive review.');