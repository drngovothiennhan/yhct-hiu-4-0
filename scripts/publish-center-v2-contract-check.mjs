import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Publish Center V2 contract] ${message}`)};
const requireText=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbidText=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

// The reviewed-publish backend remains available for compatibility and must remain secure,
// but Phase 19 deliberately removes that multi-step workflow from the canonical ACC surface.
const migration=read('supabase/migrations/202609121535_learning_quiz_publish_v1.sql');
const handler=read('api/_lib/quiz-publish.js');
const route=read('api/ai/drive-rag.js');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const trustedIngest=read('api/_lib/trusted-quiz-ingest.js');
const bankMigration=read('supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql');
const admin=read('src/components/admin/AdminControlCenter.tsx');
const student=read('src/components/exam/PracticeBankQuiz.tsx');
const studyService=read('src/services/studyAiService.ts');

requireText(migration,/learning_quiz_publish_v1/,'legacy reviewed quiz publication RPC must remain intact');
requireText(migration,/private\.is_learning_content_manager\(\)/,'legacy publication must preserve scoped capability');
requireText(migration,/source_doc\.source_hash is distinct from source_row\.content_hash/,'legacy publication must reject changed source revision');
requireText(migration,/review_status='expert_approved'/,'legacy reviewed publication must preserve expert-approved state');
requireText(migration,/revoke all on function public\.learning_quiz_publish_v1\(text,text\) from public,anon/,'anonymous legacy publication must remain denied');
requireText(handler,/learningContentAccess\(req\)/,'legacy publish API must remain capability-gated');
requireText(handler,/learning_quiz_publish_v1/,'legacy publish API must remain server-authoritative');
requireText(route,/action==='quiz-publish'/,'legacy quiz-publish action must remain explicit and isolated');

requireText(manager,/QUẢN LÝ HỌC TẬP/,'ACC must expose scoped learning management');
requireText(manager,/Ngân hàng đề thi/,'ACC must expose the canonical quiz-bank manager');
requireText(manager,/Thêm thủ công → Cập nhật → dùng ngay/,'ACC must expose exactly the one-step bank workflow');
requireText(manager,/syncQuizBank/,'ACC primary action must scan the canonical intake');
requireText(manager,/thư mục môn/,'ACC must explain one-level subject folders');
requireText(manager,/Tên thư mục môn là nội dung người học nhìn thấy/,'subject folder must be member-facing taxonomy');
requireText(manager,/tên tệp DOCX chỉ là dấu vết quản trị/,'DOCX filename must remain provenance only');
requireText(manager,/đúng một phương án được tô đỏ/,'trusted DOCX must require one red Word answer');
forbidText(manager,/sourceFileBase64|tryTrustedQuizUpload|startQuizPipeline|publishQuizDraft|Duyệt Drive thủ công|DOCX, TXT hoặc PDF|File từ ACC|Duyệt & phát hành/,'canonical ACC must not expose retired multi-step/direct-upload workflows');

requireText(trustedIngest,/MANUAL_INTAKE_FOLDER='Thêm thủ công'/,'server intake must remain pinned to Thêm thủ công');
requireText(trustedIngest,/subjectFolders/,'server intake must recognize subject folders');
requireText(trustedIngest,/nestedGroups/,'server intake must scan one subject-folder level');
requireText(trustedIngest,/parseTrustedMarkedDocx/,'server intake must use deterministic red-answer parser');
requireText(trustedIngest,/practice_trusted_quiz_ingest_v1/,'server intake must write through trusted quiz RPC');
forbidText(trustedIngest,/parseMcqDocument|explicit-answer-key-v1|subjectFromName/,'canonical intake must not infer taxonomy/answers from filenames or alternate parser paths');
requireText(bankMigration,/practice_quiz_config_v1/,'member bank config must be data-first');
requireText(bankMigration,/practice_quiz_page_v1/,'member bank page must be data-first');
requireText(bankMigration,/q\.review_status in\('source_verified','expert_approved'\)/,'only approved/verified questions may enter member quiz');
requireText(bankMigration,/where active is true/,'folder-registry compatibility sync must be safe-update compatible');
forbidText(bankMigration,/sourceFileName/,'member quiz RPC must not leak source filenames');

requireText(admin,/LearningContentManagerPanel/,'system admins must receive the same canonical learning-management surface');
requireText(admin,/canBulk&&<LearningContentManagerPanel\/>/,'canonical learning-management surface must remain admin-scoped inside AdminControlCenter');

requireText(student,/HIU_QUESTION_COUNTS=\[10,20,30,50\]/,'HIU bank must keep bounded member-selected counts');
requireText(student,/AI_QUESTION_COUNTS=\[5,10,20\]/,'A.I generated quiz must keep tighter bounded counts');
requireText(student,/Chọn nguồn → nội dung → số câu → bắt đầu/,'student workflow must remain source → content → count → start');
requireText(student,/>Đề HIU</,'approved HIU bank must remain an explicit source');
requireText(student,/>Đề Gemini <em className="practice-bank__ai-label">A\.I<\/em></,'Gemini-first generated quiz must remain an explicit A.I-labelled source');
requireText(student,/getPracticeQuizPage\(subject,0,seed\.current,count\)/,'selected HIU count must control server-backed quiz page');
requireText(student,/QuestionReasoningGuide/,'contextual reasoning guide must remain present in free practice');
requireText(student,/submitPracticeQuiz/,'server-side grading must remain authoritative for HIU questions');
forbidText(student,/Tải thêm/,'primary student quiz flow must not require pagination controls');
requireText(studyService,/fetch\('\/api\/ai\/study-quiz'/,'generated quiz client must use the resilient dedicated Study quiz gateway');

console.log('Publish Center Phase 19 contracts: PASS — one-step subject-folder intake, deterministic red-answer ingestion, data-first member bank and resilient Study quiz are enforced.');