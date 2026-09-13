import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const ingest=read('api/_lib/trusted-quiz-ingest.js');
const service=read('src/services/quizWorkspaceService.ts');
const bank=read('src/components/exam/PracticeBankQuiz.tsx');
const hubCss=read('src/learning-hub.css');
const migration=read('supabase/migrations/202609131735_phase17f_quiz_subject_sync.sql');
const folderRegistry=read('supabase/migrations/202609131920_phase18c_quiz_folder_registry.sql');

assert.match(ingest,/MANUAL_INTAKE_FOLDER='Thêm thủ công'/);
assert.match(ingest,/parentName:clean\(child\.name,160\)/,'subject-folder name must flow into the source identity');
assert.match(ingest,/const rows=.*ungroupedFiles=rows\.filter\(isDocx\)\.length,files=\[\]/s,'root DOCX files must be counted but not promoted to member subjects');
assert.doesNotMatch(ingest,/rows\.filter\(isDocx\)\.map\(file=>\(\{\.\.\.file,parentName:MANUAL_INTAKE_FOLDER\}\)\)/,'DOCX directly under Thêm thủ công must not become a canonical subject');
assert.match(ingest,/subjects=subjectFolders\.map/,'member subject candidates must come from immediate child folders');
assert.match(ingest,/practice_subject_folders_sync_admin_v1/,'every successful Admin update must synchronize the canonical folder registry');
assert.match(ingest,/subjectChanged=.*subjectHint/,'moving a file between subject folders must trigger resync');
assert.match(ingest,/modifiedChanged=!sameTime/,'a modified waiting file must be scanned again');
assert.match(ingest,/practice_source_pending_admin_v1/,'unmarked documents must be registered as waiting instead of blocking the scan');
assert.match(ingest,/status:'waiting_for_red_answer'/,'unmarked documents need a stable waiting state');
assert.match(ingest,/status:parsed\.invalid\.length\?'imported_partial':'imported'/,'red-marked questions must publish even when other questions are still waiting');
assert.match(ingest,/for\(const file of selected\).*catch\(error\)/s,'one bad document must not abort the remaining scan batch');
assert.doesNotMatch(ingest,/practice_drive_ingest_admin_v1/,'trusted red-answer path must not fall back to generic ingest');

assert.match(service,/while\(rounds\+\+<40\)/,'one Update action should continue bounded serverless batches');
assert.match(service,/hasTransportError/,'automatic batching must stop on transport errors rather than loop forever');
assert.match(migration,/subjectHint/,'sync registry must expose canonical subject');
assert.match(migration,/practice_source_pending_admin_v1/,'waiting-source RPC missing');
assert.match(migration,/sync_status='needs_review'/,'waiting sources must remain non-published until red evidence appears');
assert.match(migration,/private\.is_learning_content_manager\(\)/,'pending-source registration must stay manager-scoped');

assert.match(folderRegistry,/create table if not exists private\.practice_subject_folders_v1/,'canonical folder registry must be private');
assert.match(folderRegistry,/practice_subject_folders_sync_admin_v1/,'folder registry sync RPC missing');
assert.match(folderRegistry,/update private\.practice_subject_folders_v1 set active=false/,'Admin Update must replace stale folder visibility');
assert.match(folderRegistry,/join private\.practice_subject_folders_v1 f on f\.active and f\.folder_name=q\.subject/g,'member config/page must read questions only through active folder names');
assert.ok(folderRegistry.includes("and btrim(q.subject) !~* '\\.(docx|pdf|txt|xlsx?|pptx?)$'"),'bootstrap must reject historical file-name subjects');
assert.match(folderRegistry,/Nội dung HIU không còn trong lần cập nhật mới nhất/,'stale folder selections must fail closed');
assert.match(folderRegistry,/private\.is_learning_content_manager\(\)/,'folder sync must remain learning-manager scoped');
assert.match(folderRegistry,/revoke all on table private\.practice_subject_folders_v1 from public,anon,authenticated/,'raw folder registry must not be directly readable by members');

assert.match(bank,/Nội dung ôn tập/,'member UI must retain content-level review choice for the HIU bank');
assert.match(bank,/config\?\.subjects\.map/,'canonical subject folders must populate the member selector');
assert.match(bank,/AI_PENDING_KEY='yhct-ai-center-pending-query-v1'/,'subject review must hand off to Gemini Study, not XiaoZhi');
assert.match(bank,/Học cùng Gemini/,'contextual Gemini study action missing');
assert.match(hubCss,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,'mobile Learning Hub modes must use compact 2x2 layout');
assert.match(hubCss,/max-height:76px!important/,'mobile Learning Hub mode cards must stay compact');

console.log('Phase 17F/18C folder-authoritative quiz source + mobile Learning Hub contract: PASS');