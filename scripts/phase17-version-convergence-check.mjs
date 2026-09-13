import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Phase 17 version convergence] ${message}`)};
const need=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbid=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const home=read('src/components/home/StudentHome.tsx');
const app=read('src/App.tsx');
const aiCenter=read('src/components/ai/AiCenter.tsx');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const assistant=read('api/ai/assistant.js');
const game=read('src/components/game/HerbGardenGame.tsx');
const sw=read('public/service-worker.js');
const main=read('src/main.tsx');
const deployment=read('.github/workflows/vercel-production.yml');
const quizAccEntry=read('src/components/admin/QuizImportCenter.tsx');
const quizBankManager=read('src/components/admin/LearningContentManagerPanel.tsx');
const trustedQuizIngest=read('api/_lib/trusted-quiz-ingest.js');

if(fs.existsSync(new URL('../src/v2/study-os/canary.ts',import.meta.url)))fail('legacy Home canary still exists');
need(home,/StudyHubV2/,'StudentHome must use the canonical StudyHubV2');
forbid(home,/StudentHomeLegacy|studyOsV2CanaryEnabled|studyos=legacy|student-home\.css|yhct:ai:open/i,'legacy Home runtime or overlapping assistant path detected');
need(app,/tab==='ai'&&member&&<AiCenter/,'dedicated AI Center must remain canonical');
need(aiCenter,/askStudyGemini/,'Gemini Study must remain the learning answer path');
forbid(mini,/askXiaoZhiMini/,'XiaoZhi must not regain academic answering');
need(mini,/openStudyAi\(text\)/,'XiaoZhi task assistant must hand academic questions to Study');
need(assistant,/mode==='study'.*handleStudyAssistant/s,'Study must share the existing assistant gateway');
if(fs.existsSync(new URL('../api/ai/study-assistant.js',import.meta.url)))fail('standalone Study serverless endpoint must remain removed');
need(game,/import HiuYQuanGameV20 from/,'V20 must remain the canonical HIU Y Quan runtime');
forbid(game,/^import HiuYQuanGame from/m,'legacy HIU Y Quan UI must not be imported at runtime');

need(quizAccEntry,/LearningContentManagerPanel/,'ACC learning entry must use the canonical quiz-bank manager');
forbid(quizAccEntry,/qi-flow|Chọn nguồn|Chia phần & xử lý|Xem & đối chiếu|Chọn thư mục Drive hoặc tải DOCX\/TXT\/PDF/i,'legacy ACC quiz workflow/copy must not return');
need(quizBankManager,/syncQuizBank/,'canonical ACC quiz manager must retain the bank update action');
need(quizBankManager,/>Cập nhật<|:'Cập nhật'/,'canonical ACC quiz manager must expose the Update button');
need(trustedQuizIngest,/MANUAL_INTAKE_FOLDER='Thêm thủ công'/,'quiz-bank Update must target the agreed manual intake folder');
need(trustedQuizIngest,/listChildren\(manual\.id,100\)/,'manual intake folder must be scanned directly');
need(trustedQuizIngest,/practice_trusted_quiz_ingest_v1/,'manual intake Update must use the trusted direct-bank RPC');
forbid(trustedQuizIngest,/practice_drive_ingest_admin_v1/,'manual intake Update must not use the generic draft ingest path');

need(sw,/key=>key!==CACHE&&key\.startsWith\('yhct-hiu-4-'\)/,'service worker must evict prior app cache generations');
need(sw,/url\.pathname\.startsWith\('\/api\/'\)/,'service worker must bypass API responses');
need(main,/__YHCT_RELEASE_ID__/,'PWA registration must stay release-aware');
need(main,/updateViaCache:'none'/,'service worker updates must bypass browser HTTP cache');
need(deployment,/workflow_run/,'production deployment must remain tied to completed Web CI');
need(deployment,/workflow_run\.conclusion == 'success'/,'production deployment must fail closed unless Web CI succeeds');
need(deployment,/workflow_run\.head_branch == 'main'/,'production deployment must target main only');

const entries=[];
function walk(dir,relative=''){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name.startsWith('_')||entry.name.startsWith('.'))continue;
    const name=relative+entry.name;
    if(entry.isDirectory())walk(new URL(`${entry.name}/`,dir),`${name}/`);
    else if(/\.(?:js|mjs|cjs|ts|tsx|py|go|rb)$/.test(name)&&!name.endsWith('.d.ts'))entries.push(`api/${name}`);
  }
}
walk(new URL('../api/',import.meta.url));
if(entries.length>12)fail(`Vercel Hobby function budget exceeded: ${entries.length}`);

console.log(`Phase 17 version convergence: PASS · sole Study OS Home · canonical ACC quiz bank · shared Study gateway · task-only XiaoZhi · V20 clinic · release-aware PWA · ${entries.length}/12 functions`);
