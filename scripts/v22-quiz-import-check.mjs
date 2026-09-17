import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import JSZip from 'jszip';
import {parseMcqDocument,normalizeImportQuestion} from '../api/_lib/mcq-parser.js';
import {readUploadedQuizFile,parseExplicitMcqs} from '../api/_lib/drive-quiz.js';
import {handleQuizWorkspace} from '../api/_lib/quiz-workspace.js';
import {handleQuizPipelineV2,isQuizPipelineV2Action,planQuizChunks} from '../api/_lib/quiz-pipeline-v2.js';
const body='Câu 1: Chọn ký tự đầu tiên\nA. Alpha\nB. Beta\nC. Gamma\nD. Delta';

test('legacy parser remains deterministic for compatibility paths',()=>{
 for(const text of [body+'\nĐáp án: A',body.replaceAll('\n',' ')+'\nĐáp án: A']){const p=parseMcqDocument(text);assert.equal(p.ready,1);assert.equal(p.questions[0].correctIndex,0)}
 assert.equal(parseMcqDocument(body+'\nBẢNG ĐÁP ÁN\n1.A').ready,1);
 const conflict=parseMcqDocument(body+'\nĐáp án: B\nĐÁP ÁN\n1.A');assert.equal(conflict.ready,0);assert.equal(conflict.questions[0].correctIndex,null);
 const q=parseMcqDocument(body+'\nĐáp án: A').questions[0],file={id:'fixture',name:'fixture.docx',parentName:'Test'};
 assert.deepEqual(normalizeImportQuestion(q,file),normalizeImportQuestion(q,file));assert.equal(parseExplicitMcqs(body+'\nĐáp án: A',file).length,1);
});

test('legacy DOCX workspace stays safe but is no longer canonical UI',async()=>{
 const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+(body+'\nĐáp án: A').split('\n').map(x=>'<w:p><w:r><w:t>'+x+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>');
 const base64=await zip.generateAsync({type:'base64'}),read=await readUploadedQuizFile('test.docx',base64);assert.equal(parseMcqDocument(read.text).ready,1);await assert.rejects(readUploadedQuizFile('test.doc',base64));await assert.rejects(readUploadedQuizFile('test.docx','!invalid'));
});

test('legacy workspace and pipeline actions remain capability-gated',async()=>{
 const original=globalThis.fetch;
 for(const action of ['quiz-roots','quiz-browse','quiz-preview','quiz-commit','quiz-drafts','quiz-draft']){let status=200;const res={status(n){status=n;return this},json(x){return x}};await handleQuizWorkspace({headers:{},body:{action}},res);assert.equal(status,401)}
 for(const action of ['quiz-start','quiz-process-chunk','quiz-retry']){assert.equal(isQuizPipelineV2Action(action),true);let status=200;const res={status(n){status=n;return this},json(x){return x}};await handleQuizPipelineV2({headers:{},body:{action}},res);assert.equal(status,401)}
 globalThis.fetch=original;
});

test('legacy chunk planner remains deterministic and bounded',()=>{const source=Array.from({length:1800},(_,i)=>`Đoạn ${i}. Nội dung học tập có căn cứ.\n`).join('');const a=planQuizChunks(source),b=planQuizChunks(source);assert.deepEqual(a,b);assert.ok(a.length>1&&a.length<=48);assert.ok(a.every((x,i)=>x.index===i&&x.text.length>0&&x.text.length<=12000))});

test('Phase 19 ACC exposes only Drive Thêm thủ công Update as canonical ingestion',()=>{
 const learning=fs.readFileSync('src/components/admin/LearningContentManagerPanel.tsx','utf8'),acc=fs.readFileSync('src/components/admin/QuizImportCenter.tsx','utf8'),ingest=fs.readFileSync('api/_lib/trusted-quiz-ingest.js','utf8');
 assert.ok(learning.includes('syncQuizBank')&&learning.includes('Thêm thủ công → Cập nhật → dùng ngay')&&learning.includes('đáp án tô đỏ'));
 for(const retired of ['sourceFileBase64','startQuizPipeline','retryQuizPipeline','publishQuizDraft','tryTrustedQuizUpload','accept=".docx,.txt,.pdf'])assert.ok(!learning.includes(retired),`canonical UI must not contain ${retired}`);
 assert.ok(acc.includes('LearningContentManagerPanel')&&!acc.includes('sourceFileBase64'));
 assert.ok(ingest.includes("MANUAL_INTAKE_FOLDER='Thêm thủ công'")&&ingest.includes('rows.filter(isConvertibleDocument)')&&ingest.includes('parseTrustedMarkedDocx'));
 assert.ok(!ingest.includes('parseMcqDocument')&&!ingest.includes('trusted-quiz-upload'));
});

test('student UI keeps imports out of member surface',()=>{const student=fs.readFileSync('src/components/exam/DailyDrivePractice.tsx','utf8');assert.ok(!student.includes('syncDriveQuizBank'));assert.ok(student.includes('recordReview('));assert.ok(fs.readFileSync('src/components/admin/SystemAdminCenter.tsx','utf8').includes('<QuizImportCenter'))});
