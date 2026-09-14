import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(path,'utf8');
const ingest=read('api/_lib/trusted-quiz-ingest.js');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const memberBank=read('supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql');
const syncRevision=read('supabase/migrations/202609132145_phase19_quiz_source_sync_revision.sql');
const legacyRegistry=read('supabase/migrations/202609131920_phase18c_quiz_folder_registry.sql');

assert.match(ingest,/MANUAL_INTAKE_FOLDER='Thêm thủ công'/);
assert.match(ingest,/MEMBER_SUBJECT='Ngân hàng HIU'/);
assert.match(ingest,/PARSER_REVISION='red-layout-v2'/);
assert.match(ingest,/root\.find\(x=>x\.mimeType===FOLDER_MIME&&normalizedName\(x\.name\)===normalizedName\(MANUAL_INTAKE_FOLDER\)\)/,'Update must locate exactly Thêm thủ công');
assert.match(ingest,/rows\.filter\(isDocx\)/,'direct DOCX children must remain supported');
assert.match(ingest,/subjectFolders/,'one-level subject folders must be discovered');
assert.match(ingest,/nestedGroups/,'DOCX files inside one-level subject folders must be scanned');
assert.match(ingest,/sourceSubject/,'folder-derived subject must be preserved as taxonomy');
assert.match(ingest,/needsProcessing\(file,state\)/,'parser revision/mtime/subject changes must be reprocessed');
assert.match(ingest,/syncMessage/,'parser revision state must participate in retry logic');
assert.doesNotMatch(ingest,/root\.filter\(isDocx\)|parseMcqDocument|explicit-answer-key-v1|subjectFromName/,'root intake, alternate answer parser and filename taxonomy must stay removed');
assert.match(ingest,/parseTrustedMarkedDocx/,'red Word marker parser is mandatory');
assert.match(ingest,/practice_trusted_quiz_ingest_v1/,'qualified questions must enter trusted bank immediately');
assert.match(ingest,/for\(const file of selected\).*catch\(error\)/s,'one bad file must not block remaining files');

assert.match(manager,/Thêm thủ công → Cập nhật → dùng ngay/);
assert.match(manager,/Tên thư mục môn là nội dung người học nhìn thấy/);
assert.match(manager,/tên tệp DOCX chỉ là dấu vết quản trị/);
assert.match(manager,/syncQuizBank/);
assert.doesNotMatch(manager,/sourceFileBase64|tryTrustedQuizUpload|startQuizPipeline|publishQuizDraft|Duyệt Drive thủ công|Xử lý nâng cao/);

assert.match(memberBank,/where q\.review_status in\('source_verified','expert_approved'\)/,'all approved questions remain eligible');
assert.match(memberBank,/then 'Ngân hàng HIU'/,'technical historical subjects map to safe label');
assert.doesNotMatch(memberBank,/sourceFileName/,'member quiz page must not return source filenames');
assert.match(memberBank,/practice_quiz_config_v1/);
assert.match(memberBank,/practice_quiz_page_v1/);
assert.match(memberBank,/practice_subject_folders_sync_admin_v1/);
assert.match(memberBank,/where active is true/,'folder registry sync must satisfy safe-update guard');
assert.match(syncRevision,/'syncMessage'/,'production sync-state RPC must expose parser revision message');
assert.match(legacyRegistry,/practice_subject_folders_v1/,'legacy registry remains migration-compatible but non-canonical');

console.log('Phase 19.1 data-first quiz bank contract PASS: direct + one-level subject DOCX, deterministic red answers, parser-revision retry, folder taxonomy, immediate member availability.');
