import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>{console.error(`AI-RUNTIME FAIL: ${message}`);process.exitCode=1};
const ok=message=>console.log(`OK: ${message}`);
const requireText=(text,needle,label)=>text.includes(needle)?ok(label):fail(`${label} (missing ${needle})`);
const forbidText=(text,needle,label)=>!text.includes(needle)?ok(label):fail(`${label} (forbidden ${needle})`);

const access=read('api/_lib/member-access.js');
const toolsSource=read('api/_lib/ai-tools.js');
const gateway=read('api/ai/assistant.js');
const xiaozhiHandler=read('api/_lib/xiaozhi-mini-handler.js');
const health=read('api/ai/health.js');
const runtime=read('src/services/aiRuntimeService.ts');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const miniService=read('src/services/xiaozhiMiniService.ts');
const research=read('src/components/research/ResearchCenter.tsx');
const researchMini=read('src/components/research/ResearchAiMini.tsx');
const exam=read('src/components/exam/ExamCenter.tsx');
const aiPlatform=read('src/modules/ai/index.ts');
const providerRegistry=read('src/modules/ai/providers/registry.ts');
const aiOps=read('src/components/admin/AiOperationsPanel.tsx');
const gemini=read('src/services/geminiByok.ts');
const envExample=read('.env.example');

requireText(access,"DEFAULT_OPENAI_MODEL='gpt-5.6-luna'",'AI server has a production-safe default OpenAI model');
requireText(access,'cloudAiModel','AI server centralizes model selection');
requireText(access,'cloudAiConfigured','AI server centralizes cloud readiness');
requireText(access,'roleAtLeast','AI server centralizes role hierarchy');
requireText(access,'memberRpc','AI server has authenticated RPC transport');

for(const name of ['get_my_drl_history','list_research_opportunities','list_drl_semesters','search_yhct_knowledge'])requireText(toolsSource,name,`AI read-only tool registry contains ${name}`);
requireText(toolsSource,'strict:true','AI function schemas use strict mode');
requireText(toolsSource,'executeAiTool','AI function calls use server registry');
requireText(toolsSource,'memberRpc(req,tool.rpc','AI tools reuse authenticated member RPC transport');
for(const forbidden of ['research_apply_v1','drl_admin_','feedback_submit_v1','system_theme_set_v1'])forbidText(toolsSource,forbidden,`AI tool registry excludes mutation ${forbidden}`);

const toolsModule=await import('../api/_lib/ai-tools.js');
const memberTools=toolsModule.aiToolsForRole('member').map(tool=>tool.name);
const modTools=toolsModule.aiToolsForRole('mod').map(tool=>tool.name);
if(memberTools.includes('get_my_drl_history')&&memberTools.includes('list_research_opportunities')&&memberTools.includes('search_yhct_knowledge'))ok('member receives permitted read-only tools');else fail('member is missing required read-only tools');
if(!memberTools.includes('list_drl_semesters')&&modTools.includes('list_drl_semesters'))ok('moderator-only semester tool preserves RBAC');else fail('semester AI tool RBAC is incorrect');
try{await toolsModule.executeAiTool({headers:{}},'member',{name:'list_drl_semesters',arguments:'{}'});fail('runtime RBAC must reject moderator tool for member')}catch(error){String(error?.message||'').includes('not allowed')?ok('runtime RBAC rejects moderator tool before RPC'):fail('runtime RBAC rejected with unexpected reason')}

requireText(gateway,"memberAccess(req,'member')",'academic AI gateway requires approved-member auth');
requireText(gateway,'new AbortController()','academic AI gateway has provider timeout');
requireText(gateway,'AI_TIMEOUT_MS=20000','academic AI gateway timeout is bounded');
requireText(gateway,"type:'json_schema'",'academic AI uses Structured Outputs');
requireText(gateway,'store:false','academic AI disables response storage');
requireText(gateway,'allowed=new Map','academic AI validates citations against provided sources');
requireText(gateway,'executeAiTool(req,access.role,call)','academic AI rechecks RBAC for tool execution');
requireText(gateway,"body.parallel_tool_calls=false",'academic AI serializes function calls');
requireText(gateway,'MAX_TOOL_ROUNDS=2','academic AI bounds tool rounds');
requireText(gateway,"if(req.body?.mode==='xiaozhi-mini')return handleXiaoZhiMini(req,res)",'XiaoZhi mode reuses the existing AI serverless gateway');
requireText(gateway,"import {handleXiaoZhiMini} from '../_lib/xiaozhi-mini-handler.js'",'XiaoZhi runtime is isolated behind shared gateway');

requireText(xiaozhiHandler,"memberAccess(req,'member')",'XiaoZhi requires approved-member auth');
requireText(xiaozhiHandler,'const academic=','XiaoZhi has server-side academic policy router');
requireText(xiaozhiHandler,"route:'research'",'XiaoZhi routes academic intent to Research Center');
requireText(xiaozhiHandler,"type:'web_search_preview'",'XiaoZhi can use bounded web search');
requireText(xiaozhiHandler,"search_context_size:'low'",'XiaoZhi web search uses low-cost context');
requireText(xiaozhiHandler,'extractSources','XiaoZhi extracts source links from provider output');
requireText(xiaozhiHandler,'safeUrl','XiaoZhi source URLs are protocol-validated');
requireText(xiaozhiHandler,'store:false','XiaoZhi disables provider response storage');
requireText(xiaozhiHandler,'TIMEOUT_MS=20000','XiaoZhi provider request is bounded');
requireText(xiaozhiHandler,"provider:'local',degraded:true",'XiaoZhi has local degraded fallback');

requireText(miniService,"fetch('/api/ai/assistant'",'XiaoZhi client reuses shared AI endpoint');
requireText(miniService,"mode:'xiaozhi-mini'",'XiaoZhi client selects dedicated gateway mode');
requireText(miniService,'Authorization:`Bearer ${token}`','XiaoZhi client authenticates shared gateway');
requireText(mini,'askXiaoZhiMini','global A.I Mini calls XiaoZhi service');
requireText(mini,'academicIntent','global A.I Mini routes academic intents away locally');
requireText(mini,'speechSynthesis','global A.I Mini supports speech output');
requireText(mini,'startListening','global A.I Mini supports speech input when available');
requireText(mini,'VOICE_KEY','global A.I Mini persists voice preference');
for(const forbidden of ['searchOpenAlex','searchDriveRag','searchKnowledge','centralKnowledgeService','feedback_submit_v1'])forbidText(mini,forbidden,`global A.I Mini excludes academic/legacy provider ${forbidden}`);

requireText(runtime,"fetch('/api/ai/assistant'",'academic client routes cloud AI through shared server gateway');
requireText(runtime,'Authorization:`Bearer ${session.access_token}`','academic client authenticates gateway requests');
requireText(runtime,'TIMEOUT_MS=24000','academic client request timeout exceeds server budget safely');
requireText(runtime,'renderAiAnswer','academic client has consistent safety/citation renderer');
requireText(researchMini,"from '../../modules/ai'",'Research A.I Mini routes through AI Platform facade');
requireText(researchMini,'searchDriveRag','Research A.I Mini retains Drive RAG');
requireText(researchMini,'searchOpenAlex','Research A.I Mini retains OpenAlex');
requireText(researchMini,'searchKnowledge','Research A.I Mini retains Central RAG');
requireText(research,"askServerAi(query,'research',sources)",'Research Center sends bounded sources to academic gateway');
requireText(research,'aiAnswer.citations','Research Center renders server-validated citations');
requireText(exam,"from '../../modules/ai'",'Exam A.I Tutor routes through AI Platform facade');
requireText(exam,'answer.degraded?localTutor','Exam tutor retains contextual local fallback');

requireText(health,"req.method!=='GET'",'AI readiness endpoint is read-only');
requireText(health,'cloudAiConfigured()','AI readiness uses centralized readiness contract');
requireText(health,'cloudAiModel()','AI readiness reports non-secret model');
requireText(health,'centralRagReady','AI readiness reports Central RAG state');
requireText(health,'readOnlyTools:true','AI readiness advertises read-only tool policy');
if(/process\.env\.[A-Z0-9_]+\s*[,}]/.test(health))fail('AI readiness must not serialize environment values');else ok('AI readiness does not serialize env values');

requireText(aiPlatform,"export * from './core/gateway'",'AI Platform exposes one academic gateway facade');
requireText(aiPlatform,"export * from './providers/registry'",'AI Platform exposes provider registry');
for(const candidate of ['semantic-scholar','europe-pmc','crossref','opencitations','unpaywall'])requireText(providerRegistry,`id:'${candidate}'`,`AI provider registry includes ${candidate}`);
requireText(aiOps,'fetchAiHealth','Admin A.I Operations reads non-secret readiness');
requireText(aiOps,'candidateZeroCostProviders','Admin A.I Operations exposes zero-cost candidate adapters');

forbidText(gemini,'localStorage.setItem(KEY_STORAGE','Gemini API key is not persisted in localStorage');
requireText(gemini,'session().setItem(KEY_STORAGE','Gemini BYOK secret is session-scoped');
requireText(gemini,'purgeLegacySecret','legacy persisted BYOK secrets are purged');
requireText(envExample,'ENABLE_CLOUD_AI=false','handoff env documents fail-closed cloud flag');
requireText(envExample,'OPENAI_MODEL=gpt-5.6-luna','handoff env documents default model override');

const srcFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(ts|tsx|js|jsx)$/.test(entry.name))srcFiles.push(full)}}
walk(path.join(root,'src'));
for(const file of srcFiles){const text=fs.readFileSync(file,'utf8');if(text.includes('OPENAI_API_KEY'))fail(`server secret name leaked into browser source: ${path.relative(root,file)}`)}
if(!process.exitCode)ok(`AI runtime acceptance passed across ${srcFiles.length} browser source files with Research/XiaoZhi separation`);
