import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import JSZip from 'jszip';
import {parseMcqDocument,normalizeImportQuestion} from '../api/_lib/mcq-parser.js';
import {readUploadedQuizFile,parseExplicitMcqs} from '../api/_lib/drive-quiz.js';
import {handleQuizWorkspace} from '../api/_lib/quiz-workspace.js';
const body='Câu 1: Chọn ký tự đầu tiên\nA. Alpha\nB. Beta\nC. Gamma\nD. Delta';
test('numbered, inline, multiline and answer zero',()=>{
 for(const text of [body+'\nĐáp án: A',body.replaceAll('\n',' ')+'\nĐáp án: A',body.replace('B. Beta','B. Beta\ntiếp dòng')+'\nĐáp án đúng là A']){
  const p=parseMcqDocument(text);assert.equal(p.ready,1);assert.equal(p.questions[0].correctIndex,0);assert.equal(p.sourceText,text);
 }
});
test('answer key and conflicts',()=>{
 assert.equal(parseMcqDocument(body+'\nBẢNG ĐÁP ÁN\n1.A').ready,1);
 const p=parseMcqDocument(body+'\nĐáp án: B\nĐÁP ÁN\n1.A');assert.equal(p.ready,0);assert.equal(p.questions[0].correctIndex,null);
});
test('no guesses, dropped questions or unsafe automatic imports',()=>{
 for(const text of [body+'\nĐáp án: A và B',body.replace('A. Alpha','*A. Alpha')+'\nĐáp án: B',body,body.replace('D. Delta',''),body+'\nE. Epsilon\nĐáp án: A',body.replace('Câu 1: ','')+'\nĐáp án: A',body.replace('B. Beta','B. Alpha')+'\nĐáp án: A',body.replace('A. Alpha','*A. Alpha')]){
  const p=parseMcqDocument(text);assert.equal(p.total,1);assert.equal(p.ready,0);assert.ok(p.questions[0].issues.length);
 }
 assert.equal(parseMcqDocument('Tài liệu lý thuyết không có câu hỏi.').total,0);
 assert.throws(()=>parseMcqDocument('a'.repeat(400001)));
});
test('duplicates and normalization',()=>{
 const p=parseMcqDocument(body+'\nĐáp án: A\n'+body+'\nĐáp án: A');assert.equal(p.total,2);assert.equal(p.ready,0);
 const q=parseMcqDocument(body+'\nĐáp án: A').questions[0],file={id:'fixture',name:'fixture.docx',parentName:'Test'};
 assert.deepEqual(normalizeImportQuestion(q,file),normalizeImportQuestion(q,file));
 assert.equal(parseExplicitMcqs(body+'\nĐáp án: A',file).length,1);
 assert.throws(()=>normalizeImportQuestion({...q,correctIndex:null},file));
 assert.throws(()=>normalizeImportQuestion({...q,options:['A','A','C','D']},file));
});
test('real DOCX extraction and upload rejection',async()=>{
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+(body+'\nĐáp án: A').split('\n').map(x=>'<w:p><w:r><w:t>'+x+'</w:t></w:r></w:p>').join('')+'</w:body></w:document>');
 const base64=await zip.generateAsync({type:'base64'});
 const read=await readUploadedQuizFile('test.docx',base64);
 assert.equal(parseMcqDocument(read.text).ready,1);
 assert.equal((await readUploadedQuizFile('test.docx',base64)).sourceHash,read.sourceHash);
 await assert.rejects(readUploadedQuizFile('test.doc',base64));
 await assert.rejects(readUploadedQuizFile('test.docx','!invalid'));
 await assert.rejects(readUploadedQuizFile('test.docx','A'.repeat(2800001)));
});
test('all workspace actions require learning-content capability; regular member is rejected before Drive',async()=>{
 const original=globalThis.fetch;
 for(const action of ['quiz-roots','quiz-browse','quiz-preview','quiz-commit','quiz-drafts','quiz-draft']){
  let status=200;const res={status(n){status=n;return this},json(x){return x}};
  await handleQuizWorkspace({headers:{},body:{action}},res);assert.equal(status,401);
  globalThis.fetch=async()=>new Response(JSON.stringify({approved:true,role:'member',learningContentManager:false}));
  await handleQuizWorkspace({headers:{authorization:'Bearer '+ 'a'.repeat(40)},body:{action}},res);assert.equal(status,403);
 }
 globalThis.fetch=original;
});
test('student UI delegates all imports to ACC and records flashcards',()=>{
 const student=fs.readFileSync('src/components/exam/DailyDrivePractice.tsx','utf8');
 assert.ok(!student.includes('syncDriveQuizBank'));assert.ok(student.includes('recordReview('));
 assert.ok(fs.readFileSync('src/components/admin/SystemAdminCenter.tsx','utf8').includes('<QuizImportCenter'));
});

test('clearing an answer with learning-content capability cannot silently import the old answer',async()=>{
 const original=globalThis.fetch;
 const q=parseMcqDocument(body+'\nĐáp án: A').questions[0];
 let committed=false,status=200;
 try{
  globalThis.fetch=async(url,init)=>{
   if(String(url).includes('current_member_access'))return new Response(JSON.stringify({approved:true,role:'member',positionTitle:'Ban Quản lý Học tập',learningContentManager:true}));
   const args=JSON.parse(init.body);
   if(args.p_action==='commit')committed=true;
   return new Response(JSON.stringify({revision:1,questions:[q],file:{id:'fixture',name:'test.docx',parentName:'Test'}}));
  };
  const res={status(n){status=n;return this},json(x){return x}};
  await handleQuizWorkspace({headers:{authorization:'Bearer '+ 'a'.repeat(40)},body:{action:'quiz-commit',id:'test',revision:1,selection:[{id:q.id,correctIndex:null,confirmed:true}]}},res);
  assert.equal(status,400);assert.equal(committed,false);
 }finally{globalThis.fetch=original}
});