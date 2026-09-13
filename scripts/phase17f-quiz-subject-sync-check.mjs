import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(path,'utf8');
const ingest=read('api/_lib/trusted-quiz-ingest.js');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const memberBank=read('supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql');
const legacyRegistry=read('supabase/migrations/202609131920_phase18c_quiz_folder_registry.sql');

assert.match(ingest,/MANUAL_INTAKE_FOLDER='Thêm thủ công'/);
assert.match(ingest,/MEMBER_SUBJECT='Ngân hàng HIU'/);
assert.match(ingest,/root\.find\(x=>x\.mimeType===FOLDER_MIME&&normalizedName\(x\.name\)===normalizedName\(MANUAL_INTAKE_FOLDER\)\)/,'Update must locate exactly Thêm thủ công');
assert.match(ingest,/rows\.filter\(isDocx\)/,'direct DOCX children must remain supported');
assert.match(ingest,/subjectFolders/,'one-level subject folders must be discovered');
assert.match(ingest,/nestedGroups/,'DOCX files inside one-level subject folders must be scanned');
assert.match(ingest,/sourceSubject/,'folder-derived subject must be preserved as taxonomy');
assert.doesNotMatch(ingest,/root\.filter\(isDocx\)|parseMcqDocument|explicit-answer-key-v1|subjectFromName/,'root intake, alternate answer parser and filename taxonomy must stay removed');
assert.match(ingest,/parseTrustedMarkedDocx/,'red Word marker parser is mandatory');
assert.match(ingest,/!knownIds\.has\(String\(file\.id\)\)/,'only new Drive file IDs are scanned');
assert.match(ingest,/practice_trusted_quiz_ingest_v1/,'qualified questions must enter the trusted bank immediately');
assert.match(ingest,/for\(const file of selected\).*catch\(error\)/s,'one bad file must not block remaining new files');

assert.match(manager,/Thêm thủ công → Cập nhật → dùng ngay/);
assert.match(manager,/Tên thư mục môn là nội dung người học nhìn thấy/);
assert.match(manager,/tên tệp DOCX chỉ là dấu vết quản trị/);
assert.match(manager,/syncQuizBank/);
assert.doesNotMatch(manager,/sourceFileBase64|tryTrustedQuizUpload|startQuizPipeline|publishQuizDraft|Duyệt Drive thủ công|Xử lý nâng cao/);

assert.match(memberBank,/where q\.review_status in\('source_verified','expert_approved'\)/,'all approved questions must remain eligible');
assert.match(memberBank,/then 'Ngân hàng HIU'/,'technical/file-derived historical subjects must map to a safe label');
assert.doesNotMatch(memberBank,/sourceFileName/,'member quiz page must not return source filenames');
assert.match(memberBank,/practice_quiz_config_v1/);
assert.match(memberBank,/practice_quiz_page_v1/);
assert.match(memberBank,/practice_subject_folders_sync_admin_v1/,'folder registry compatibility sync must remain callable');
assert.match(memberBank,/where active is true/,'folder registry sync must satisfy production safe-update guard');
assert.match(legacyRegistry,/practice_subject_folders_v1/,'legacy registry remains migration-compatible but is no longer canonical for member eligibility');

console.log('Phase 19.1 data-first quiz bank contract PASS: direct + one-level subject-folder DOCX, red-answer evidence only, folder taxonomy, no filename taxonomy, safe-update registry compatibility and immediate member availability.');
