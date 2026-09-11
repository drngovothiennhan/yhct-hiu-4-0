import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {pdfQuizLimits,readUploadedPdfFile} from '../api/_lib/pdf-quiz-source.js';

function escapePdfText(value){return String(value).replace(/([\\()])/g,'\\$1')}
function makePdf(text='PDF quiz source test'){
 const stream=text?`BT /F1 14 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`:'';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
 ];
 let out='%PDF-1.4\n',offsets=[0];
 objects.forEach((body,index)=>{offsets[index+1]=Buffer.byteLength(out);out+=`${index+1} 0 obj\n${body}\nendobj\n`});
 const xref=Buffer.byteLength(out);out+='xref\n0 6\n0000000000 65535 f \n';
 for(let i=1;i<=5;i++)out+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
 out+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(out,'ascii');
}

const b64=buffer=>buffer.toString('base64');

test('PDF upload extraction is server-side, deterministic and bounded',async()=>{
 assert.deepEqual(pdfQuizLimits,{maxBytes:2_000_000,maxPages:80,maxSourceText:400_000});
 const buffer=makePdf('PDF quiz source test');
 const read=await readUploadedPdfFile('lesson.pdf',b64(buffer));
 assert.equal(read.file.mimeType,'application/pdf');
 assert.equal(read.pdfPages,1);
 assert.ok(read.text.includes('PDF quiz source test'));
 assert.equal(read.sourceHash,createHash('sha256').update(buffer).digest('hex'));
 assert.equal(read.file.id,`upload-${read.sourceHash}`);
});

test('PDF upload fails closed for invalid signature and image-only/no-text source',async()=>{
 await assert.rejects(readUploadedPdfFile('fake.pdf',Buffer.from('not a pdf').toString('base64')),/chữ ký PDF/i);
 await assert.rejects(readUploadedPdfFile('scan.pdf',b64(makePdf(''))),/không có lớp văn bản|không OCR/i);
 await assert.rejects(readUploadedPdfFile('lesson.txt',b64(makePdf('text'))),/không phải PDF/i);
});

test('PDF upload wiring remains inside resumable human-reviewed pipeline',async()=>{
 const fs=await import('node:fs');
 const api=fs.readFileSync('api/_lib/quiz-pipeline-v2.js','utf8');
 const service=fs.readFileSync('src/services/quizWorkspaceService.ts','utf8');
 const learning=fs.readFileSync('src/components/admin/LearningContentManagerPanel.tsx','utf8');
 const acc=fs.readFileSync('src/components/admin/QuizImportCenter.tsx','utf8');
 const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 assert.equal(pkg.dependencies['pdf-parse'],'2.4.5');
 assert.ok(api.includes('readUploadedPdfFile')&&api.includes("/\\.pdf$/i.test(fileName)")&&api.includes("rpc('save',id,payload)"));
 assert.ok(service.includes('docx|txt|pdf'));
 assert.ok(learning.includes('.docx,.txt,.pdf')&&acc.includes('.docx,.txt,.pdf'));
 assert.ok(learning.includes('quiz-commit')&&acc.includes("quizWorkspace('quiz-commit'"));
});
