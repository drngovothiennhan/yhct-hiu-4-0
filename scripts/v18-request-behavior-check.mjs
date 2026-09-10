import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(path){const source=fs.readFileSync(path,'utf8');const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)}
const {requestDeadline,ensureActive}=await load('src/services/aiRequest.ts');
const parent=new AbortController(),request=requestDeadline(1000,parent.signal);
parent.abort();assert.equal(request.signal.aborted,true);assert.throws(()=>ensureActive(parent.signal),{name:'AbortError'});request.dispose();
const already=requestDeadline(1000,parent.signal);assert.equal(already.signal.aborted,true);already.dispose();
const timeout=requestDeadline(5);await new Promise(resolve=>setTimeout(resolve,15));assert.equal(timeout.signal.aborted,true);assert.equal(timeout.signal.reason.name,'TimeoutError');timeout.dispose();
const disposed=requestDeadline(5);disposed.dispose();await new Promise(resolve=>setTimeout(resolve,15));assert.equal(disposed.signal.aborted,false);
const {aiNavigationTarget}=await load('src/services/aiNavigation.ts');
assert.equal(aiNavigationTarget('Mở trung tâm nghiên cứu')?.path,'/research');
assert.equal(aiNavigationTarget('Vào HIU - Y - Quán')?.path,'/garden');
assert.equal(aiNavigationTarget('Hãy mở luyện thi')?.path,'/exam');
assert.equal(aiNavigationTarget('Giải thích sinh lý để luyện thi'),null);
assert.equal(aiNavigationTarget('Mở bài thuốc là gì?'),null);
assert.equal(aiNavigationTarget('Xóa dữ liệu'),null);
console.log('V18 PASS: cancellation, expired parent, deadline disposal, Vietnamese navigation and question separation');
