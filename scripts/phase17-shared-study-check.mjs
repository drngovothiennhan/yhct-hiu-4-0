import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import handler from '../api/ai/assistant.js';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const navigation=ts.transpileModule(read('src/services/aiNavigation.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {aiNavigationTarget}=await import(`data:text/javascript;base64,${Buffer.from(navigation).toString('base64')}`);
assert.equal(aiNavigationTarget('Mở lịch học')?.path,'/schedule');
assert.equal(aiNavigationTarget('Giải thích âm dương ngũ hành'),null);
assert.match(read('src/components/ai/AiCenter.tsx'),/researchQuery:text/);
assert.match(read('src/components/ai/AiCenter.tsx'),/localStorage.setItem\(RESEARCH_PENDING_KEY,seed\)/);
const client=read('src/services/studyAiService.ts');
assert.match(client,/fetch\('\/api\/ai\/assistant'/);
assert.match(client,/JSON\.stringify\(\{mode:'study',query,conversationContext,pageContext\}\)/);
assert.match(read('api/ai/assistant.js'),/if\(req.body\?\.mode==='study'\)return handleStudyAssistant\(req,res\)/);
assert.ok(!fs.existsSync(new URL('../api/ai/study-assistant.js',import.meta.url)));
assert.match(read('api/_lib/study-assistant-handler.js'),/export async function handleStudyAssistant/);
assert.doesNotMatch(read('src/components/ai/UnifiedAiMini.tsx'),/askXiaoZhiMini/);
assert.match(read('src/components/ai/UnifiedAiMini.tsx'),/openStudyAi\(text\)/);
assert.match(read('api/ai/assistant.js'),/internalContextConsent/);

// Vite project: Vercel excludes underscore-prefixed files/directories in api/.
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
console.log(`Serverless source entrypoints: ${entries.length}/12\n${entries.join('\n')}`);

const originalFetch=globalThis.fetch;
const originalKey=process.env.GEMINI_API_KEY,originalEnabled=process.env.ENABLE_GEMINI_AI;
const calls=[];
let role='member',approved=true,searchFails=false;
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
globalThis.fetch=async(url,options)=>{
  calls.push({url:String(url),body:JSON.parse(options.body)});
  if(String(url).endsWith('/rpc/current_member_access_v1'))return response({approved,role,memberId:'test-member'});
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
  assert.equal(calls.length,0);
  approved=false;assert.equal((await invoke({mode:'study',query:'Tạng tượng là gì?'})).code,403);approved=true;
  assert.equal((await invoke({mode:'study',query:''})).code,400);
  for(const query of ['Tìm PubMed về châm cứu mất ngủ','DOI','PMID','systematic review','meta-analysis','guideline','clinical trial','RCT','evidence','nghiên cứu','y văn','trích dẫn','tài liệu tham khảo','bằng chứng khoa học']){
    const before=calls.length,result=await invoke({mode:'study',query});
    assert.equal(result.body.route,'research',query);assert.equal(calls.length,before+1,'Research handoff must not call an AI provider');
  }
  for(const query of ['Tạng tượng là gì?','So sánh Tỳ khí hư và Tỳ dương hư','Vậy điểm khác nhau quan trọng nhất là gì?']){
    const result=await invoke({mode:'study',query,conversationContext:'So sánh Tỳ khí hư và Tỳ dương hư',pageContext:'ai',sources:[{id:'drive:private',text:'PRIVATE_SOURCE_SENTINEL'}]});
    assert.equal(result.code,200);assert.equal(result.body.provider,'gemini-web');assert.equal(result.body.route,null);
    assert.ok(result.body.answer.includes('\n'),'Preserve readable answer paragraphs');
    const prompt=calls.at(-1).body.input;
    assert.ok(prompt.includes(`CÂU HỎI HIỆN TẠI: ${query}`));
    assert.ok(prompt.includes('CONVERSATION_CONTEXT: So sánh Tỳ khí hư và Tỳ dương hư'));
    assert.ok(prompt.includes('PAGE_CONTEXT: ai'));assert.ok(!prompt.includes('PRIVATE_SOURCE_SENTINEL'));
  }
  searchFails=true;const fallback=await invoke({mode:'study',query:'Tạo câu hỏi ôn tập'});
  assert.equal(fallback.code,200);assert.equal(fallback.body.provider,'gemini');assert.equal(fallback.body.degraded,true);
  assert.deepEqual(fallback.body.sources,[]);
  delete process.env.GEMINI_API_KEY;
  assert.equal((await invoke({mode:'study',query:'Tạng tượng là gì?'})).code,503);
  for(const mode of ['fast','research','exam','xiaozhi-mini'])assert.equal((await invoke({mode,query:'test'},'POST',false)).code,401,`${mode} authentication preserved`);
  console.log('Phase 17 shared Study gateway runtime + privacy + fallback contracts: PASS');
}finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;
  if(originalEnabled===undefined)delete process.env.ENABLE_GEMINI_AI;else process.env.ENABLE_GEMINI_AI=originalEnabled;
}
