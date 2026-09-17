import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(path,'utf8');
const ingest=read('api/_lib/trusted-quiz-ingest.js');
const markedParser=read('api/_lib/docx-marked-quiz.js');
const manager=read('src/components/admin/LearningContentManagerPanel.tsx');
const memberBank=read('supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql');
const syncRevision=read('supabase/migrations/202609132145_phase19_quiz_source_sync_revision.sql');
const legacyRegistry=read('supabase/migrations/202609131920_phase18c_quiz_folder_registry.sql');

assert.match(ingest,/MANUAL_INTAKE_FOLDER='Thêm thủ công'/);
assert.match(ingest,/MEMBER_SUBJECT='Ngân hàng HIU'/);
assert.match(ingest,/PARSER_REVISION='red-layout-v4'/);
assert.match(ingest,/GOOGLE_DOC_MIME='application\/vnd\.google-apps\.document'/,'Google Docs must be a canonical convertible source');
assert.match(ingest,/root\.find\(x=>x\.mimeType===FOLDER_MIME&&normalizedName\(x\.name\)===normalizedName\(MANUAL_INTAKE_FOLDER\)\)/,'Update must locate exactly Thêm thủ công');
assert.match(ingest,/listChildren[\s\S]*nextPageToken/,'Drive listing must paginate rather than silently stop at one page');
assert.match(ingest,/collectSubjectDocuments/,'nested folders must be traversed recursively');
assert.match(ingest,/rows\.filter\(isConvertibleDocument\)/,'DOCX and Google Docs must share the conversion path');
assert.match(ingest,/\/export/,'native Google Docs must be exported before deterministic parsing');
assert.match(ingest,/sourceSubject/,'top-level folder-derived subject must be preserved as taxonomy');
assert.match(ingest,/practice_subject_folders_sync_admin_v1/,'Drive subjects must be synchronized to the member-facing registry');
assert.match(ingest,/needsProcessing\(file,state\)/,'parser revision/mtime/subject changes must be reprocessed');
assert.match(ingest,/!String\(state\.syncMessage\|\|'\'\)\.includes\(PARSER_REVISION\)/,'old ready files must be retried after parser revision upgrades');
assert.doesNotMatch(ingest,/files\.slice\(0,1000\)/,'canonical scan must not truncate the discovered file list');
assert.doesNotMatch(ingest,/root\.filter\(isDocx\)|parseMcqDocument|explicit-answer-key-v1|subjectFromName/,'root intake, alternate answer parser and filename taxonomy must stay removed');
assert.match(ingest,/parseTrustedMarkedDocx/,'red Word marker parser is mandatory');
assert.match(ingest,/practice_trusted_quiz_ingest_v1/,'qualified questions must enter trusted bank immediately');
assert.match(ingest,/for\(const file of selected\).*catch\(error\)/s,'one bad file must not block remaining files');

assert.match(markedParser,/sourceFormatNormalized:'common-red-v2'/,'accepted red variants must normalize to one trusted provenance contract');
assert.match(markedParser,/isRedColor/);
assert.match(markedParser,/isRedHighlight/);
assert.match(markedParser,/redChars\/totalChars>=0\.45/,'mixed black label + red option text must still be detectable');
assert.match(markedParser,/sourceMark:'word-font-color-red-v1'/,'database trusted provenance contract must remain compatible');
assert.match(markedParser,/sourceMarkColor:'FF0000'/,'normalized provenance must keep canonical FF0000');

assert.match(manager,/Thêm thủ công → tự chuyển đổi → dùng ngay/);
assert.match(manager,/quét toàn bộ cây thư mục/);
assert.match(manager,/DOCX và Google Docs/);
assert.match(manager,/Chủ đề đã đồng bộ cho Learning Hub/);
assert.match(manager,/useEffect\(\(\)=>\{if\(autoStarted\.current\)return;autoStarted\.current=true;void update\(\)\},\[\]\)/,'admin bank must auto-sync once when opened');
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

console.log('Phase 19.2 quiz bank contract PASS: recursive manual intake, Google Docs export, normalized red answers, parser-revision retry, registry sync, immediate member availability.');
