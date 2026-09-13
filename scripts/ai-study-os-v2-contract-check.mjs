import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[AI Study OS V2 contract] ${message}`)};
const requireText=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbidText=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const router=read('src/v2/study-os/intentRouter.ts');
const home=read('src/components/home/StudentHome.tsx');
const studyHub=read('src/components/home/StudyHubV2.tsx');
const v2Css=read('src/components/home/study-hub-v2.css');
const main=read('src/main.tsx');

if(fs.existsSync(new URL('../src/v2/study-os/canary.ts',import.meta.url)))fail('legacy Study OS canary runtime must not return after Phase 17E convergence');
requireText(home,/lazy\(\(\)=>import\(['"]\.\/StudyHubV2['"]\)\)/,'StudyHubV2 must remain lazy-loaded');
requireText(home,/return <Suspense[\s\S]*<StudyHubV2 \{\.\.\.props\}/,'StudentHome must render StudyHubV2 as the sole Home runtime');
forbidText(home,/StudentHomeLegacy|studyOsV2CanaryEnabled|studyos|yhct:ai:open/i,'legacy Home/runtime assistant path must not remain');
forbidText(main,/study-hub-v2\.css/,'V2 CSS must not be imported from the application entry');
forbidText(home,/student-home\.css|study-hub-v2\.css/,'legacy/V2 CSS must stay out of the Home wrapper');
requireText(v2Css,/\.study-os-v2/,'V2 styles must remain isolated under the study-os-v2 namespace');

requireText(router,/destination:'research'/,'router must preserve dedicated Research destination');
requireText(router,/destination:'exam'/,'router must preserve canonical exam destination');
requireText(router,/destination:'assistant'/,'router must preserve a provider-agnostic normal-learning destination');
forbidText(router,/fetch\s*\(/,'intent routing must remain deterministic and must not call an LLM/provider');
forbidText(router,/gemini|openai/i,'intent routing must remain provider-agnostic');

requireText(studyHub,/MY HIU YHCT · AI STUDY OS/,'production Home must identify the unified Study OS surface');
forbidText(studyHub,/CANARY/,'production Home must not show canary labeling');
requireText(studyHub,/yhct-ai-center-pending-query-v1/,'ordinary study requests must seed the dedicated AI Center');
requireText(studyHub,/onNavigate\(['"]ai['"]\)/,'ordinary study requests must route to the dedicated AI Center');
forbidText(studyHub,/yhct:ai:open/,'Study OS Home must not reopen the floating task assistant for normal learning');
requireText(studyHub,/yhct-research-pending-query-v1/,'research requests must reuse the existing Research handoff contract');
requireText(studyHub,/onNavigate\(['"]research['"]\)/,'research intent must route to the existing Research module');
requireText(studyHub,/onNavigate\(['"]exam['"]\)/,'quiz intent must route to the canonical exam module');
forbidText(studyHub,/drive\.google\.com|GEMINI_API_KEY|GOOGLE_AI_API_KEY|OPENAI_API_KEY/,'student V2 must not expose Drive URLs or provider secrets');
forbidText(studyHub,/OpenAI|provider/i,'student V2 must not expose backend jargon or alternate provider branding');

console.log('AI Study OS V2 converged production contracts: PASS');
