import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import handler from '../api/ai/assistant.js';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const navigation=ts.transpileModule(read('src/services/aiNavigation.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {aiNavigationTarget}=await import(`data:text/javascript;base64,${Buffer.from(navigation).toString('base64')}`);
assert.equal(aiNavigationTarget('Mở lịch học')?.path,'/schedule');
assert.equal(aiNavigationTarget('Giải thích âm dương ngũ hành'),null);

const client=read('src/services/studyAiService.ts');
const gateway=read('api/ai/assistant.js');
const studyHandler=read('api/_lib/study-assistant-handler.js');
const publicEvidence=read('api/_lib/public-medical-evidence.js');
const researchCenter=read('src/components/research/ResearchCenter.tsx');
const researchMini=read('src/components/research/ResearchAiMini.tsx');
const aiCenter=read('src/components/ai/AiCenter.tsx');

assert.match(client,/fetch\('\/api\/ai\/assistant'/);
assert.match(client,/JSON\.stringify\(\{mode:'study',query,conversationContext,pageContext,variationMode\}\)/);
assert.match(client,/JSON\.stringify\(\{mode:'study',task:'quiz',query:cleanTopic,count:requested,variationMode\}\)/,'generated quiz must reuse the shared Study gateway with response variation');
assert.doesNotMatch(client,/\/api\/ai\/study-quiz/,'no duplicate Study quiz endpoint may remain');
assert.match(gateway,/if\(req.body\?\.mode==='study'\)return handleStudyAssistant\(req,res\)/);
assert.ok(!fs.existsSync(new URL('../api/ai/study-assistant.js',import.meta.url)));
assert.ok(!fs.existsSync(new URL('../api/ai/study-quiz.js',import.meta.url)));
assert.match(studyHandler,/task==='quiz'/);
assert.match(studyHandler,/createGroundedQuiz/);
assert.match(studyHandler,/retrievePublicMedicalEvidence/);
assert.match(studyHandler,/runOpenAiEvidenceQuiz/);
assert.match(studyHandler,/createGeminiJson/);
assert.match(studyHandler,/openai-public-evidence/);
assert.match(studyHandler,/QUIZ_MODEL_BUSY/);
assert.match(studyHandler,/X-AI-Evidence-Count/);
assert.match(studyHandler,/sourceIndexes/);
assert.match(studyHandler,/X-AI-Variation/);
assert.match(studyHandler,/suggestions:parsed\.suggestions/);
assert.doesNotMatch(studyHandler,/web_search_preview/,'quiz must not consume a second paid web-search quota');
assert.match(publicEvidence,/api\.openalex\.org\/works/);
assert.match(publicEvidence,/ebi\.ac\.uk\/europepmc/);
assert.match(publicEvidence,/wikipedia\.org\/w\/api\.php/);
assert.match(publicEvidence,/physiology/);
assert.match(studyHandler,/study_focus/);
assert.match(studyHandler,/không coi chúng là bằng chứng học thuật/);

assert.match(aiCenter,/researchQuery:text/);
assert.match(aiCenter,/readStudentJourney\(member\.id\)/);
assert.match(aiCenter,/if\(seed\)setQuery\(seed\)/,'Home Study handoff must remain editable before send');
assert.doesNotMatch(aiCenter,/requestAnimationFrame\(\(\)=>void send\(seed\)\)/,'Home Study handoff must never auto-submit a seeded prompt');
assert.match(aiCenter,/setFreshSession\(true\)/,'Mới must create a fresh AI Study session');
assert.match(aiCenter,/!freshSession&&preferences\?\.focus/,'fresh AI Study session must ignore inherited learning focus');
assert.match(aiCenter,/!freshSession\?studyFocus:''/,'fresh AI Study session must not reuse inherited focus for resource lookup');
assert.match(aiCenter,/aria-label="Gợi ý học tiếp theo"/,'Study follow-ups must be contextual rather than fixed');
assert.match(researchCenter,/<ResearchAiMini/);
assert.doesNotMatch(researchCenter,/ragInternalConsent|setRagInternalConsent/);
assert.match(researchMini,/Dùng tài liệu nội bộ cho lượt này/);
assert.match(researchMini,/setUseInternal\(false\)/);
assert.match(researchMini,/\{useInternal:internalEnabled\}/);
assert.doesNotMatch(read('src/components/ai/UnifiedAiMini.tsx'),/askXiaoZhiMini/);
assert.match(read('src/components/ai/UnifiedAiMini.tsx'),/openStudyAi\(text\)/);

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
assert.ok(entries.length<=12,`Vercel Hobby budget exceeded: ${entries.length}\n${entries.join('\n')}`);

const originalFetch=globalThis.fetch;
const originalKey=process.env.GEMINI_API_KEY,originalEnabled=process.env.ENABLE_GEMINI_AI;
const calls=[];let approved=true,searchFails=false;
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
globalThis.fetch=async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url:String(url),body});
  if(String(url).endsWith('/rpc/current_member_access_v1'))return response({approved,role:'member',memberId:'test-member'});
  if(String(url).endsWith('/interactions'))return searchFails?response({error:{message:'search unavailable'}},503):response({output_text:'Kết luận ngắn\nGiải thích cốt lõi'});
  if(String(url).includes(':generateContent'))return response({candidates:[{content:{parts:[{text:'Gemini text fallback'}]}}]});
  throw new Error(`Unexpected external call: ${url}`);
};
async function invoke(body,method='POST',authenticated=true){
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}};
  await handler({method,body,headers:authenticated?{authorization:`Bearer ${'test'.repeat(12)}`} :{}},res);
  return res;
}
try{
  process.env.GEMINI_API_KEY='test-only';process.env.ENABLE_GEMINI_AI='true';
  assert.equal((await invoke({mode:'study',query:'Tạng tượng là gì?'},'GET')).code,405);
  assert.equal((await invoke({mode:'study',query:'Tạng tượng là gì?'},'POST',false)).code,401);
  approved=false;assert.equal((await invoke({mode:'study',query:'Tạng tượng là gì?'})).code,403);approved=true;
  assert.equal((await invoke({mode:'study',query:''})).code,400);
  const routed=await invoke({mode:'study',query:'Tìm PubMed về châm cứu mất ngủ'});
  assert.equal(routed.body.route,'research');
  const learnerContext='route=/ai | study_focus=Sinh lý nội tiết | study_goal=exam | study_year=2 | daily_minutes=20 | last_module=exam';
  const result=await invoke({mode:'study',query:'Tạng tượng là gì?',conversationContext:'Âm dương ngũ hành',pageContext:learnerContext,variationMode:1});
  assert.equal(result.code,200);assert.equal(result.body.provider,'gemini-web');assert.ok(Array.isArray(result.body.suggestions));assert.equal(result.headers['X-AI-Variation'],'1');
  searchFails=true;const fallback=await invoke({mode:'study',query:'Tạo câu hỏi ôn tập',variationMode:2});
  assert.equal(fallback.code,200);assert.equal(fallback.body.provider,'gemini');assert.equal(fallback.body.degraded,true);assert.ok(Array.isArray(fallback.body.suggestions));
  console.log(`Phase 19.2 shared Study chat + contextual variation + editable handoff + fresh reset + quota-independent quiz gateway PASS · ${entries.length}/12 serverless functions`);
}finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;
  if(originalEnabled===undefined)delete process.env.ENABLE_GEMINI_AI;else process.env.ENABLE_GEMINI_AI=originalEnabled;
}