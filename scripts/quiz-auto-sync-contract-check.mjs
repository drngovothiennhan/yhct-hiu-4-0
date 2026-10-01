import fs from 'node:fs';
// Chạy bằng: npx tsx scripts/quiz-auto-sync-contract-check.mjs
const fail=[];
const read=p=>fs.readFileSync(p,'utf8');
const need=(body,tokens,label)=>{for(const t of tokens)if(!body.includes(t))fail.push(`${label} missing ${t}`)};
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const mod=await import('../src/services/quizAutoSync.ts');
const M=mod.QUIZ_AUTO_SYNC_INTERVAL_MS,NOW=1_000_000_000_000;
if(!mod.shouldRunQuizAutoSync(NOW,0))fail.push('first run must be allowed');
if(mod.shouldRunQuizAutoSync(NOW,NOW-M+1000))fail.push('must wait full interval');
if(!mod.shouldRunQuizAutoSync(NOW,NOW-M))fail.push('must run after interval');
if(!mod.shouldRunQuizAutoSync(NOW,NOW+5000))fail.push('clock skew must not block forever');
if(M<10*60*1000)fail.push('interval too aggressive for Drive quota');
need(read('src/services/quizAutoSync.ts'),['VITE_QUIZ_AUTO_SYNC','syncQuizBank','inflight'],'quizAutoSync');
need(read('src/App.tsx'),['startQuizAutoSync','canLearning'],'App');
if(!/if\(!member\?\.id\|\|!canLearning\)return;return startQuizAutoSync\(\)/.test(read('src/App.tsx')))fail.push('auto-sync must be gated on canLearning (content manager)');
if(fail.length){console.error('quiz auto-sync contract FAILED\n'+fail.join('\n'));process.exit(1)}
console.log('quiz auto-sync contract OK');
