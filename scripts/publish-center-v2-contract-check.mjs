import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Publish Center V2 contract] ${message}`)};
const requireText=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbidText=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const migration=read('supabase/migrations/202609121535_learning_quiz_publish_v1.sql');
const handler=read('api/_lib/quiz-publish.js');
const route=read('api/ai/drive-rag.js');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const trustedIngest=read('api/_lib/trusted-quiz-ingest.js');
const bankMigration=read('supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql');
const admin=read('src/components/admin/AdminControlCenter.tsx');
const student=read('src/components/exam/PracticeBankQuiz.tsx');
const studyService=read('src/services/studyAiService.ts');
const studyHandler=read('api/_lib/study-assistant-handler.js');
const publicEvidence=read('api/_lib/public-medical-evidence.js');
const assistant=read('api/ai/assistant.js');

requireText(migration,/learning_quiz_publish_v1/,'legacy reviewed quiz publication RPC remains intact');
requireText(migration,/private\.is_learning_content_manager\(\)/,'legacy publication preserves scoped capability');
requireText(migration,/review_status='expert_approved'/,'legacy reviewed publication preserves expert-approved state');
requireText(handler,/learningContentAccess\(req\)/,'legacy publish API remains capability-gated');
requireText(route,/action==='quiz-publish'/,'legacy quiz-publish action remains isolated');

requireText(manager,/Ngân hàng đề thi/,'ACC exposes canonical quiz-bank manager');
requireText(manager,/Thêm thủ công → Cập nhật → dùng ngay/,'ACC exposes one-step bank workflow');
requireText(manager,/syncQuizBank/,'ACC primary action scans canonical intake');
requireText(manager,/thư mục môn/,'ACC explains one-level subject folders');
requireText(manager,/Tên thư mục môn là nội dung người học nhìn thấy/,'subject folder is member-facing taxonomy');
requireText(manager,/DOCX và Google Docs được chuẩn hóa về DOCX nội bộ/,'document provenance stays behind the member-facing folder taxonomy');
requireText(manager,/đúng một phương án được tô đỏ/,'trusted DOCX requires one red answer');
forbidText(manager,/sourceFileBase64|tryTrustedQuizUpload|startQuizPipeline|publishQuizDraft|Duyệt Drive thủ công|DOCX, TXT hoặc PDF|File từ ACC|Duyệt & phát hành/,'ACC must not expose retired workflows');

requireText(trustedIngest,/MANUAL_INTAKE_FOLDER='Thêm thủ công'/,'server intake pinned to Thêm thủ công');
requireText(trustedIngest,/subjectFolders/,'server intake recognizes subject folders');
requireText(trustedIngest,/nestedGroups/,'server intake scans one subject-folder level');
requireText(trustedIngest,/parseTrustedMarkedDocx/,'server intake uses deterministic red-answer parser');
requireText(trustedIngest,/needsProcessing/,'server intake retries parser-revision failures');
requireText(trustedIngest,/practice_trusted_quiz_ingest_v1/,'server intake writes through trusted quiz RPC');
forbidText(trustedIngest,/parseMcqDocument|explicit-answer-key-v1|subjectFromName/,'canonical intake must not infer taxonomy/answers');
requireText(bankMigration,/practice_quiz_config_v1/,'member bank config is data-first');
requireText(bankMigration,/practice_quiz_page_v1/,'member bank page is data-first');
requireText(bankMigration,/q\.review_status in\('source_verified','expert_approved'\)/,'only verified/approved questions enter member quiz');
requireText(bankMigration,/where active is true/,'folder registry compatibility sync is safe-update compatible');
forbidText(bankMigration,/sourceFileName/,'member quiz RPC must not leak source filenames');

requireText(admin,/LearningContentManagerPanel/,'system admins receive canonical learning-management surface');
requireText(student,/HIU_QUESTION_COUNTS=\[5,10,20,30,50,0\]/,'HIU bank offers bounded counts and paged all mode');
requireText(student,/AI_QUESTION_COUNTS=\[5,10,20\]/,'A.I generated quiz keeps tighter counts');
requireText(student,/Nguồn → thư mục\/chủ đề → số câu → học/,'student workflow remains source → folder/topic → count → study');
requireText(student,/Thư mục HIU/,'HIU bank uses folder-based member taxonomy');
requireText(student,/>Đề HIU</,'approved HIU bank remains explicit source');
requireText(student,/>Đề Gemini <em className="practice-bank__ai-label">A\.I<\/em></,'Gemini generated quiz remains A.I-labelled source');
requireText(student,/QuestionReasoningGuide/,'contextual reasoning remains present');
requireText(student,/submitPracticeQuiz/,'HIU grading remains server-authoritative');
forbidText(student,/Tải thêm/,'primary quiz flow must not require pagination controls');

requireText(studyService,/fetch\('\/api\/ai\/assistant'/,'generated quiz client reuses shared assistant gateway');
requireText(studyService,/task:'quiz'/,'generated quiz selects shared Study quiz task');
forbidText(studyService,/\/api\/ai\/study-quiz/,'dedicated Study quiz endpoint must stay removed');
requireText(assistant,/req\.body\?\.mode==='study'\)return handleStudyAssistant/,'assistant gateway owns Study mode');
requireText(studyHandler,/task==='quiz'/,'Study handler owns generated quiz task');
requireText(studyHandler,/retrievePublicMedicalEvidence/,'shared Study handler retrieves public evidence independently of model quota');
requireText(studyHandler,/createGeminiJson/,'Gemini remains primary structured quiz generator');
requireText(studyHandler,/runOpenAiEvidenceQuiz/,'shared Study handler retains same-evidence generator failover');
requireText(studyHandler,/sourceIndexes/,'generated questions bind to retrieved public sources');
requireText(studyHandler,/QUIZ_MODEL_BUSY/,'source retrieval failure is distinct from model quota exhaustion');
forbidText(studyHandler,/web_search_preview|runOpenAiQuiz|provider:'openai-web-fallback'/,'retired duplicate quota-sensitive web-search fallback must stay removed');
requireText(publicEvidence,/api\.openalex\.org\/works/,'OpenAlex public evidence retrieval present');
requireText(publicEvidence,/ebi\.ac\.uk\/europepmc/,'Europe PMC public evidence retrieval present');

console.log('Publish Center Phase 19.2 contracts: PASS — one-step subject-folder intake, deterministic red-answer ingestion, data-first bank and quota-independent public-evidence Study quiz.');