import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const state=read('docs/HIU_EXECUTION_STATE.md');
const webCi=read('.github/workflows/web-ci.yml');
const production=read('.github/workflows/vercel-production.yml');

const failures=[];
const requireText=(body,text,label)=>{
  if(!body.includes(text)) failures.push(`${label}: missing ${text}`);
};

requireText(state,'PHASE 11 B2 — GARDEN / HIU Y QUÁN CSS CRITICAL PATH — DONE / PRODUCTION VERIFIED','execution state');
requireText(state,'PHASE 11 B3 — RESEARCH CSS CRITICAL PATH — DONE / PRODUCTION VERIFIED','execution state');
requireText(state,'PHASE 12 — FINAL MULTI-VIEWPORT QA + PRODUCTION VERIFICATION — DONE / PRODUCTION VERIFIED','execution state');
requireText(state,'No feature refactor, business logic, RBAC, data, quiz approval, AI contract or game progression change.','execution state');
requireText(state,'81a44f27846bccaaa69e6bfe7924c349badc83d0','execution state');
requireText(state,'dpl_5aySZJpsBt2B1bzQJLfi3374UHQf','execution state');

for(const command of [
  'npm run audit:performance:dist',
  'node scripts/chrome-real-smoke.mjs',
  'node scripts/chrome-production-content-check.mjs',
  'node scripts/adaptive-viewport-check-v2.mjs'
]) requireText(webCi,command,'Web CI');

for(const token of [
  'CI_PASSED_SHA',
  'VERCEL_PRODUCTION_ALIAS',
  'node scripts/chrome-real-smoke.mjs',
  'node scripts/chrome-production-content-check.mjs',
  '390x844 mobile',
  '1440x1000 desktop'
]) requireText(production,token,'Vercel Production');

if(failures.length){
  console.error('Phase 12 final QA contract FAIL');
  for(const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 12 final QA contract PASS: production-verified state, performance boundary, multi-viewport Chrome CI and exact-SHA production gates are locked.');
