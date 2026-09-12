import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Publish Center V2 contract] ${message}`)};
const requireText=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbidText=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const migration=read('supabase/migrations/202609121535_learning_quiz_publish_v1.sql');
const handler=read('api/_lib/quiz-publish.js');
const route=read('api/ai/drive-rag.js');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const admin=read('src/components/admin/AdminControlCenter.tsx');
const student=read('src/components/exam/PracticeBankQuiz.tsx');

requireText(migration,/learning_quiz_publish_v1/,'atomic reviewed quiz publication RPC is required');
requireText(migration,/private\.is_learning_content_manager\(\)/,'publication must preserve scoped learning-content capability');
requireText(migration,/source_row\.provider not in\('drive','upload'\)/,'publication must bind to approved source providers');
requireText(migration,/source_row\.source_locator is distinct from source_value/,'publication must verify exact source provenance');
requireText(migration,/source_doc\.source_hash is distinct from source_row\.content_hash/,'publication must reject a changed source revision');
requireText(migration,/q\.source_hash=source_row\.content_hash/,'question promotion must be bound to the exact current source hash');
requireText(migration,/documentApprovalSourceHash/,'approval provenance must retain the exact source hash');
requireText(migration,/public\.practice_questions/,'publication must operate on canonical practice question bank');
requireText(migration,/review_status='expert_approved'/,'document approval must create expert-approved questions');
requireText(migration,/expert_verified_by=mid/,'document approval must record the approving member');
requireText(migration,/status='published'[\s\S]*audience='members'/,'resource publication must atomically make the resource member-visible');
requireText(migration,/Use reviewed quiz publication flow/,'generic resource publisher must not bypass quiz review');
requireText(migration,/revoke all on function public\.learning_quiz_publish_v1\(text,text\) from public,anon/,'anonymous quiz publication must be denied');

requireText(handler,/learningContentAccess\(req\)/,'publish API must enforce Learning Content Manager access');
requireText(handler,/practice_import_workspace_v2/,'publish API must verify the persisted canonical draft');
requireText(handler,/pending\.length/,'publish API must reject drafts with valid unimported questions');
requireText(handler,/upsertLearningResource/,'publish API must register a stable Knowledge Gateway resource');
requireText(handler,/learning_quiz_publish_v1/,'publish API must call the atomic reviewed publication RPC');
requireText(route,/action==='quiz-publish'/,'quiz publish must be an explicit server action');

requireText(manager,/TRUNG TÂM PHÁT HÀNH HỌC TẬP/,'admin UI must expose Publish Center V2');
requireText(manager,/Tài liệu → Quiz → Phát hành/,'admin UI must present the simplified workflow');
requireText(manager,/conversionMode:'auto'/,'Gemini conversion settings must stay automatic on the main path');
requireText(manager,/Duyệt & phát hành/,'admin must explicitly approve before publication');
requireText(manager,/publishQuizDraft/,'admin final action must use server publication flow');
requireText(manager,/getQuizDriveRoots|browseQuizDrive/,'Publish Center must support system Drive selection');
requireText(manager,/DOCX, TXT hoặc PDF/,'Publish Center must preserve bounded direct document upload');
forbidText(manager,/driveFileId.*<|webViewLink.*</,'raw Drive identity must not be rendered in the Publish Center UI');

requireText(admin,/LearningContentManagerPanel/,'system admins must receive the same Publish Center surface');
requireText(admin,/canBulk&&<LearningContentManagerPanel\/>/,'Publish Center must remain admin-only inside AdminControlCenter');

requireText(student,/QUESTION_COUNTS=\[10,20,30,50\]/,'student must choose a bounded quiz question count');
requireText(student,/Chọn nội dung → số câu → bắt đầu/,'student workflow must be content → count → start');
requireText(student,/getPracticeQuizPage\(subject,0,seed\.current,count\)/,'selected count must control the server-backed quiz page');
forbidText(student,/Tải thêm/,'primary student quiz flow must not require pagination controls');
requireText(student,/submitPracticeQuiz/,'server-side grading must remain authoritative');

console.log('Publish Center V2 contracts: PASS');
