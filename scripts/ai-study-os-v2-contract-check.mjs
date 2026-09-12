import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[AI Study OS V2 contract] ${message}`)};
const requireText=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbidText=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const canary=read('src/v2/study-os/canary.ts');
const router=read('src/v2/study-os/intentRouter.ts');
const home=read('src/components/home/StudentHome.tsx');
const studyHub=read('src/components/home/StudyHubV2.tsx');
const v2Css=read('src/components/home/study-hub-v2.css');
const main=read('src/main.tsx');

requireText(canary,/CANARY_PARAM\s*=\s*['"]studyos['"]/,'canary query parameter must remain explicit');
requireText(canary,/CANARY_VALUE\s*=\s*['"]v2['"]/,'canary value must remain explicit');
requireText(canary,/if\(!raw\)return false/,'Study OS V2 must remain default-off in Phase 13A');

requireText(home,/lazy\(\(\)=>import\(['"]\.\/StudyHubV2['"]\)\)/,'StudyHubV2 must remain lazy-loaded');
requireText(home,/studyOsV2CanaryEnabled\(\)/,'StudentHome must gate V2 behind explicit canary');
requireText(home,/return <StudentHomeLegacy/,'legacy Home must remain the default fallback');
forbidText(main,/study-hub-v2\.css/,'V2 CSS must not be imported from the application entry');
forbidText(home,/study-hub-v2\.css/,'V2 CSS must stay owned by the lazy StudyHubV2 chunk');
requireText(v2Css,/\.study-os-v2/,'V2 styles must remain isolated under the study-os-v2 namespace');

requireText(router,/destination:'research'/,'router must preserve dedicated Research destination');
requireText(router,/destination:'exam'/,'router must preserve canonical exam destination');
requireText(router,/destination:'assistant'/,'router must preserve single App Assistant destination for normal learning');
forbidText(router,/fetch\s*\(/,'intent routing must remain deterministic and must not call an LLM/provider');
forbidText(router,/gemini|openai/i,'intent routing must remain provider-agnostic');

requireText(studyHub,/yhct:ai:open/,'ordinary study requests must reuse the canonical App Assistant launcher');
requireText(studyHub,/yhct-research-pending-query-v1/,'research requests must reuse the existing Research handoff contract');
requireText(studyHub,/onNavigate\(['"]research['"]\)/,'research intent must route to the existing Research module');
requireText(studyHub,/onNavigate\(['"]exam['"]\)/,'quiz intent must route to the canonical exam module');
forbidText(studyHub,/drive\.google\.com|GEMINI_API_KEY|GOOGLE_AI_API_KEY|OPENAI_API_KEY/,'student V2 must not expose Drive URLs or provider secrets');
forbidText(studyHub,/Gemini|OpenAI|provider/i,'student V2 must not expose provider branding/jargon');

console.log('AI Study OS V2 contracts: PASS');
