import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const ingest=read('api/_lib/trusted-quiz-ingest.js');
const service=read('src/services/quizWorkspaceService.ts');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const bank=read('src/components/exam/PracticeBankQuiz.tsx');
const hubCss=read('src/learning-hub.css');
const migration=read('supabase/migrations/202609131735_phase17f_quiz_subject_sync.sql');
const folderRegistry=read('supabase/migrations/202609131920_phase18c_quiz_folder_registry.sql');

assert.match(ingest,/MANUAL_INTAKE_FOLDER='Thêm thủ công'/);
assert.match(ingest,/BANK_FOLDER_NAME='NGÂN HÀNG TRẮC NGHIỆM'/,'canonical Drive bank name missing');
assert.match(ingest,/for\(const file of root\.filter\(isDocx\)\)addDirect\(file\)/,'DOCX directly in the quiz-bank root must be scanned by Update');
assert.match(ingest,/parentName:MANUAL_INTAKE_FOLDER/,'direct DOCX in the legacy manual intake must remain compatible');
assert.match(ingest,/parentName:clean\(child\.name,160\)/,'subject-folder name must flow into the source identity');
assert.match(ingest,/subjects\.add\(subjectFromName\(file\.name\)\)/,'direct files must derive a member subject without requiring folder setup');
assert.match(ingest,/Math\.min\(1000,pageSize\)/,'bank scan should not be artificially capped at 100 Drive children');
assert.match(ingest,/dedup\.slice\(0,1000\)/,'one bank scan must expose a materially larger candidate pool');
assert.match(ingest,/parseTrustedDeterministicDocx/,'trusted ingest must use deterministic answer recognition');
assert.match(ingest,/explicit-answer-key-v1/,'explicit Đáp án/Bảng đáp án evidence must be accepted without AI guessing');
assert.match(ingest,/parseTrustedMarkedDocx/,'red-answer Word evidence must remain supported');
assert.match(ingest,/practice_subject_folders_sync_admin_v1/,'every successful Admin update must synchronize the canonical subject registry');
assert.match(ingest,/subjectChanged=.*subjectHint/,'moving a file between subjects must trigger resync');
assert.match(ingest,/modifiedChanged=!sameTime/,'a modified waiting file must be scanned again');
assert.match(ingest,/practice_source_pending_admin_v1/,'unqualified documents must be registered as waiting instead of blocking the scan');
assert.match(ingest,/status:'waiting_for_red_answer'/,'backward-compatible waiting status must remain stable');
assert.match(ingest,/status:parsed\.invalid\.length\?'imported_partial':'imported'/,'qualified questions must publish even when other questions are still waiting');
assert.match(ingest,/for\(const file of selected\).*catch\(error\)/s,'one bad document must not abort the remaining scan batch');
assert.doesNotMatch(ingest,/practice_drive_ingest_admin_v1/,'trusted deterministic path must not fall back to generic ingest');

assert.match(service,/while\(rounds\+\+<40\)/,'one Update action should continue bounded serverless batches');
assert.match(service,/hasTransportError/,'automatic batching must stop on transport errors rather than loop forever');
assert.match(manager,/File từ ACC/,'ACC must expose the direct file intake beside the single Update action');
assert.match(manager,/tryTrustedQuizUpload\(file\.name,base64,subject\.trim\(\)\|\|subjectFromFileName\(file\.name\)\)/,'ACC Update must immediately evaluate a selected DOCX');
assert.match(manager,/driveReady\?await syncQuizBank\(10\)/,'the same Update action must synchronize Drive after checking the ACC file');
assert.match(manager,/Xử lý nâng cao \/ tài liệu ngoại lệ/,'legacy conversion may remain only as an explicit exception path');

assert.match(migration,/subjectHint/,'sync registry must expose canonical subject');
assert.match(migration,/practice_source_pending_admin_v1/,'waiting-source RPC missing');
assert.match(migration,/sync_status='needs_review'/,'waiting sources must remain non-published until deterministic answer evidence exists');
assert.match(migration,/private\.is_learning_content_manager\(\)/,'pending-source registration must stay manager-scoped');

assert.match(folderRegistry,/create table if not exists private\.practice_subject_folders_v1/,'canonical subject registry must be private');
assert.match(folderRegistry,/practice_subject_folders_sync_admin_v1/,'subject registry sync RPC missing');
assert.match(folderRegistry,/update private\.practice_subject_folders_v1 set active=false/,'Admin Update must replace stale subject visibility');
assert.match(folderRegistry,/join private\.practice_subject_folders_v1 f on f\.active and f\.folder_name=q\.subject/g,'member config/page must read questions only through active subject names');
assert.ok(folderRegistry.includes("and btrim(q.subject) !~* '\\.(docx|pdf|txt|xlsx?|pptx?)$'"),'bootstrap must reject historical raw file-name subjects');
assert.match(folderRegistry,/Nội dung HIU không còn trong lần cập nhật mới nhất/,'stale subject selections must fail closed');
assert.match(folderRegistry,/private\.is_learning_content_manager\(\)/,'subject sync must remain learning-manager scoped');
assert.match(folderRegistry,/revoke all on table private\.practice_subject_folders_v1 from public,anon,authenticated/,'raw subject registry must not be directly readable by members');

assert.match(bank,/Nội dung ôn tập/,'member UI must retain content-level review choice for the HIU bank');
assert.match(bank,/config\?\.subjects\.map/,'canonical subjects must populate the member selector');
assert.match(bank,/AI_PENDING_KEY='yhct-ai-center-pending-query-v1'/,'subject review must hand off to Gemini Study, not XiaoZhi');
assert.match(bank,/Học cùng Gemini/,'contextual Gemini study action missing');
assert.match(hubCss,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,'mobile Learning Hub modes must use compact 2x2 layout');
assert.match(hubCss,/max-height:76px!important/,'mobile Learning Hub mode cards must stay compact');

console.log('Phase 18E one-step quiz-bank Update + deterministic source answers + mobile Learning Hub contract: PASS');
