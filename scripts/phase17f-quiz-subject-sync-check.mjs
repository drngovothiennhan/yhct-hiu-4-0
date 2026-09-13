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
assert.match(ingest,/rows\.filter\(isDocx\)/,'only direct DOCX children are candidates');
assert.doesNotMatch(ingest,/for\(const child of|subjectFolders|root\.filter\(isDocx\)/,'root/nested alternate intake paths must stay removed');
assert.match(ingest,/parseTrustedMarkedDocx/,'red Word marker parser is mandatory');
assert.doesNotMatch(ingest,/parseMcqDocument|explicit-answer-key-v1/,'explicit text answer keys must not qualify the canonical fast path');
assert.match(ingest,/!knownIds\.has\(String\(file\.id\)\)/,'only new Drive file IDs are scanned');
assert.match(ingest,/practice_trusted_quiz_ingest_v1/,'qualified questions must enter the trusted bank immediately');
assert.match(ingest,/for\(const file of selected\).*catch\(error\)/s,'one bad file must not block the remaining new files');

assert.match(manager,/Thêm thủ công → Cập nhật → dùng ngay/);
assert.match(manager,/Tên tệp không dùng để đặt môn, không hiển thị cho thành viên/);
assert.match(manager,/syncQuizBank/);
assert.doesNotMatch(manager,/sourceFileBase64|tryTrustedQuizUpload|startQuizPipeline|publishQuizDraft|Duyệt Drive thủ công|Xử lý nâng cao/);

assert.match(memberBank,/where q\.review_status in\('source_verified','expert_approved'\)/,'all approved questions must remain eligible');
assert.match(memberBank,/then 'Ngân hàng HIU'/,'historical technical/file-derived subjects must map to a member-safe label');
assert.doesNotMatch(memberBank,/sourceFileName/,'member quiz page must not return source filenames');
assert.match(memberBank,/practice_quiz_config_v1/);
assert.match(memberBank,/practice_quiz_page_v1/);
assert.match(legacyRegistry,/practice_subject_folders_v1/,'legacy registry remains migration-compatible but is no longer canonical for member eligibility');

console.log('Phase 19 data-first quiz bank contract PASS: new direct DOCX only, red-answer evidence only, no filename taxonomy, immediate member availability.');
