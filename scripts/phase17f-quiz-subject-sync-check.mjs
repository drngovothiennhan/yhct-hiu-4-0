import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(path,'utf8');
const ingest=read('api/_lib/trusted-quiz-ingest.js');
const service=read('src/services/quizWorkspaceService.ts');
const bank=read('src/components/exam/PracticeBankQuiz.tsx');
const hubCss=read('src/learning-hub.css');
const migration=read('supabase/migrations/202609131735_phase17f_quiz_subject_sync.sql');

assert.match(ingest,/MANUAL_INTAKE_FOLDER='Thêm thủ công'/);
assert.match(ingest,/parentName:clean\(child\.name,160\)/,'subject-folder name must flow into the source identity');
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

assert.match(bank,/practice-bank__subject-strip/,'member UI must expose subject-level review choices');
assert.match(bank,/AI_PENDING_KEY='yhct-ai-center-pending-query-v1'/,'subject review must hand off to Gemini Study, not XiaoZhi');
assert.match(bank,/Học cùng Gemini/,'contextual Gemini study action missing');
assert.match(hubCss,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/,'mobile Learning Hub modes must use compact 2x2 layout');
assert.match(hubCss,/max-height:76px!important/,'mobile Learning Hub mode cards must stay compact');

console.log('Phase 17F quiz subject sync + mobile Learning Hub contract: PASS');
