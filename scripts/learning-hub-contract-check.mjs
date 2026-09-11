import fs from 'node:fs';
import assert from 'node:assert/strict';

const hub=fs.readFileSync('src/components/exam/ExamCenter.tsx','utf8');
const legacy=fs.readFileSync('src/components/exam/NationalExamPrepLegacy.tsx','utf8');
const css=fs.readFileSync('src/learning-hub.css','utf8');
const contract=fs.readFileSync('src/modules/moduleContract.ts','utf8');

assert.ok(hub.includes("type HubTab='quick'|'bank'|'adaptive'|'exam'"));
assert.ok(hub.includes("new Set<HubTab>(['quick'])"));
assert.ok(hub.includes("visited.has('quick')")&&hub.includes("visited.has('bank')")&&hub.includes("visited.has('adaptive')")&&hub.includes("visited.has('exam')"));
assert.ok(hub.includes('role="tablist"')&&hub.includes('role="tabpanel"')&&hub.includes('aria-selected={tab===id}'));
assert.ok(hub.includes("hidden={tab!=='quick'}")&&hub.includes("hidden={tab!=='bank'}")&&hub.includes("hidden={tab!=='adaptive'}")&&hub.includes("hidden={tab!=='exam'}"));
assert.ok(hub.includes("import NationalExamPrepLegacy from './NationalExamPrepLegacy'"));
for(const marker of ['Thi thử 50 câu','A.I hướng dẫn suy luận','server integrity'])assert.ok(hub.includes(marker),`ExamCenter keeps platform audit marker: ${marker}`);
assert.ok(legacy.includes('National Exam Prep')&&legacy.includes('startExamSessionV2')&&legacy.includes('submitExamSessionV2'));
assert.ok(legacy.includes('<DailyDrivePractice/>')&&legacy.includes('<PracticeBankQuiz/>')&&legacy.includes('<AdaptiveReview identity={identity}/>'));
assert.ok(css.includes('.learning-hub__legacy-exam>.daily-drive')&&css.includes('.learning-hub__legacy-exam>.practice-bank')&&css.includes('.learning-hub__legacy-exam>.adaptive-review'));
assert.ok(css.includes('[role=tabpanel][hidden]')&&css.includes('@media(max-width:480px)'));
assert.ok(contract.includes("export type ModuleId='feed'|'research'|'profile'|'garden'|'notifications'|'schedule'|'drl'|'exam'|'admin'|'acc'"));
assert.ok(contract.includes("exam:{id:'exam',title:'Luyện thi ĐGNL',path:'/exam'"));
assert.ok(!contract.includes("path:'/learning'"));
console.log('Learning Hub structural contract passed.');
