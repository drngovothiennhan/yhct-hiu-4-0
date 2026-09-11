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
const geminiProvider=read('api/_lib/gemini-provider.js');
const health=read('api/ai/health.js');
const runtime=read('src/services/aiRuntimeService.ts');
const academicService=read('src/services/academicAiService.ts');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const miniService=read('src/services/xiaozhiMiniService.ts');
const research=read('src/components/research/ResearchCenter.tsx');
const researchMini=read('src/components/research/ResearchAiMini.tsx');
const exam=read('src/components/exam/ExamCenter.tsx');
const aiPlatform=read('src/modules/ai/index.ts');
const providerRegistry=read('src/modules/ai/providers/registry.ts');
const aiOps=read('src/components/admin/AiOperationsPanel.tsx');
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
forbidText(xiaozhiHandler,'const academic=','XiaoZhi no longer blocks ordinary public questions before Gemini Search');
requireText(xiaozhiHandler,'isResearchIntent','XiaoZhi detects deep research intent for explicit handoff');
requireText(xiaozhiHandler,"answer:'Học thuật → Trung tâm nghiên cứu'",'XiaoZhi exposes the required research handoff label');
requireText(xiaozhiHandler,"route:'research'",'XiaoZhi server returns an explicit Research route without doing research retrieval');
const {isResearchIntent}=await import('../api/_lib/xiaozhi-mini-handler.js');
for(const query of ['Tạng tượng là gì?','Giải thích âm dương ngũ hành đơn giản','Vitamin C tan trong nước hay dầu?'])isResearchIntent(query)?fail(`ordinary education query incorrectly routed to Research: ${query}`):ok(`ordinary education stays in App Assistant: ${query}`);
for(const query of ['Tìm y văn PubMed về châm cứu mất ngủ','Phân tích meta-analysis về acupuncture insomnia','So sánh bằng chứng lâm sàng và guideline điều trị tăng huyết áp'])isResearchIntent(query)?ok(`research query routes to Research: ${query}`):fail(`research query missed Research handoff: ${query}`);
requireText(xiaozhiHandler,'Trợ lý ứng dụng HIU YHCT 4.0','XiaoZhi is scoped to the application assistant');
requireText(xiaozhiHandler,'tuyệt đối không tự giả định rằng kho Drive/tài liệu nội bộ đã được bật','public Gemini path does not auto-enable internal documents');
requireText(xiaozhiHandler,'createGeminiWebSearch','XiaoZhi uses Gemini as its primary public-search provider');
if(xiaozhiHandler.indexOf('createGeminiWebSearch')<xiaozhiHandler.indexOf("type:'web_search_preview'"))ok('XiaoZhi attempts Gemini before OpenAI web failover');else fail('XiaoZhi must attempt Gemini before OpenAI web failover');
requireText(geminiProvider,"tools:[{type:'google_search'}]",'Gemini public answers use Google Search grounding');
requireText(geminiProvider,'probeGeminiModel','Gemini live probe stays inside the server provider boundary');
requireText(geminiProvider,'geminiPrivateContextAllowed=()=>false','Gemini has no environment-level private-context bypass');
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
requireText(miniService,'hiu.vn','application assistant prioritizes official HIU web sources');
requireText(mini,'askXiaoZhiMini','global A.I Mini calls XiaoZhi service');
requireText(mini,'researchIntent','global A.I Mini detects research intent for explicit handoff');
requireText(mini,'openResearch(text)','global A.I Mini hands research questions to Research A.I');
requireText(mini,'speechSynthesis','global A.I Mini supports speech output');
requireText(mini,'startListening','global A.I Mini supports speech input when available');
requireText(mini,'VOICE_KEY','global A.I Mini persists voice preference');
for(const forbidden of ['searchOpenAlex','searchDriveRag','searchKnowledge','centralKnowledgeService','askAcademicUnified','feedback_submit_v1'])forbidText(mini,forbidden,`global A.I Mini excludes research provider ${forbidden}`);

requireText(runtime,"fetch('/api/ai/assistant'",'academic client routes cloud AI through shared server gateway');
requireText(runtime,'Authorization:`Bearer ${session.access_token}`','academic client authenticates gateway requests');
requireText(runtime,'internalContextConsent:options.useInternal===true','internal context requires an explicit request-scoped opt-in');
requireText(gateway,"source?.id?.startsWith('drive:')||source?.id?.startsWith('central:')",'gateway classifies Drive and Central RAG as internal sources');
requireText(gateway,'sources.some(isInternalSource)&&!internalContextConsent','gateway rejects internal context unless explicitly opted in');
forbidText(gateway,'GEMINI_ALLOW_PRIVATE_CONTEXT','gateway has no environment bypass for private-context consent');
const clientBudget=Number(runtime.match(/TIMEOUT_MS=(\d+)/)?.[1]);
const openAiBudget=Number(gateway.match(/AI_TIMEOUT_MS=(\d+)/)?.[1]);
const geminiBudget=Number(gateway.match(/GEMINI_TIMEOUT_MS=(\d+)/)?.[1]);
if(clientBudget>openAiBudget+geminiBudget&&clientBudget<=45000)ok('client allows one bounded Gemini/OpenAI failover');else fail('client deadline must cover both providers and remain bounded');
requireText(runtime,'renderAiAnswer','academic client has consistent safety/citation renderer');
requireText(academicService,'if(!useInternal)','academic A.I keeps internal retrieval off by default');
requireText(academicService,'askXiaoZhiMini(query,context,signal)','academic public search goes through Gemini-first web search');
requireText(academicService,"searchDriveRag(query,4,signal)",'academic internal mode retrieves Drive only after opt-in');
requireText(academicService,"searchKnowledge(query,'all',5)",'academic internal mode retrieves Central RAG only after opt-in');
requireText(academicService,'{useInternal:true}','academic internal mode explicitly authorizes final Gemini synthesis');
requireText(academicService,'đối chiếu chúng với kết quả Gemini Google Search','academic internal mode asks Gemini to cross-check web and internal evidence');
requireText(researchMini,"from '../../modules/ai'",'Research A.I Mini routes through AI Platform facade');
requireText(researchMini,'searchDriveRag','Research A.I retains Drive RAG worker');
requireText(researchMini,'searchOpenAlex','Research A.I retains OpenAlex worker');
requireText(researchMini,'searchPubMed','Research A.I retains PubMed worker');
requireText(researchMini,'searchClinicalTrials','Research A.I retains ClinicalTrials worker');
requireText(researchMini,'searchKnowledge','Research A.I Mini retains Central RAG worker');
requireText(researchMini,'RESEARCH_LEADER=GEMINI','Research A.I explicitly makes Gemini the leader');
requireText(researchMini,"askServerAi(leaderPrompt,'research'",'Gemini Research leader performs final synthesis');
requireText(researchMini,'result.suggestedQueries','Research A.I surfaces Gemini follow-up suggestions');
requireText(research,"askServerAi(query,'research',sources,undefined,{useInternal:true})",'Research Center sends explicitly selected Drive sources to Gemini');
requireText(researchMini,"internalEnabled?searchDriveRag",'Research A.I skips Drive retrieval until the user opts in');
requireText(researchMini,"internalEnabled?searchKnowledge",'Research A.I skips Central RAG until the user opts in');
requireText(researchMini,'Dùng tài liệu nội bộ','Research A.I exposes the internal-document opt-in; global Mini does not');
requireText(researchMini,'setUseInternal(false)','Research A.I consumes internal-document consent after each request');
requireText(researchMini,'{useInternal:internalEnabled}','Research A.I sends request-scoped consent to the shared gateway');
requireText(research,'ragInternalConsent','Research Center RAG synthesis has an explicit request consent gate');
requireText(research,'setRagInternalConsent(false)','Research Center consumes RAG consent after each synthesis');
requireText(research,'aiAnswer.citations','Research Center renders server-validated citations');
requireText(exam,"from '../../modules/ai'",'Exam A.I Tutor routes through AI Platform facade');
requireText(exam,'answer.degraded?localTutor','Exam tutor retains contextual local fallback');

requireText(health,"req.method!=='GET'",'AI readiness endpoint rejects unsupported status methods');
requireText(health,'cloudAiConfigured()','AI readiness uses centralized readiness contract');
requireText(health,'cloudAiModel()','AI readiness reports non-secret model');
requireText(health,'centralRagReady','AI readiness reports Central RAG state');
requireText(health,'readOnlyTools:true','AI readiness advertises read-only tool policy');
requireText(health,"defaultSearchProvider:geminiReady?'gemini-google-search'",'AI readiness advertises Gemini Google Search as the default provider');
requireText(health,'internalContextOptIn:true','AI readiness advertises opt-in internal context');
forbidText(health,'process.env.','AI readiness does not read or serialize environment values directly');

requireText(aiPlatform,"export * from './core/gateway'",'AI Platform exposes one academic gateway facade');
requireText(aiPlatform,"export * from './providers/registry'",'AI Platform exposes provider registry');
for(const core of ['gemini-server','central-rag','drive-rag','openalex','pubmed','clinicaltrials'])requireText(providerRegistry,`id:'${core}'`,`AI provider registry contains implemented core ${core}`);
for(const dead of ['gemini-byok','unpaywall','candidateZeroCostProviders'])forbidText(providerRegistry,dead,`AI provider registry excludes dead/expansion adapter ${dead}`);
requireText(aiOps,'fetchAiHealth','Admin A.I Operations reads non-secret readiness');
forbidText(aiOps,'candidateZeroCostProviders','Admin A.I Operations does not advertise provider expansion');
forbidText(aiOps,'Adapter 0đ có thể tích hợp tiếp','Admin A.I Operations has no provider-sprawl catalog');
forbidText(aiOps,'GEMINI_ALLOW_PRIVATE_CONTEXT','Admin A.I Operations has no obsolete privacy bypass');

requireText(envExample,'ENABLE_CLOUD_AI=false','handoff env documents fail-closed cloud flag');
requireText(envExample,'OPENAI_MODEL=gpt-5.6-luna','handoff env documents default model override');

const srcFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(ts|tsx|js|jsx)$/.test(entry.name))srcFiles.push(full)}}
walk(path.join(root,'src'));
for(const file of srcFiles){const text=fs.readFileSync(file,'utf8');if(text.includes('OPENAI_API_KEY'))fail(`server secret name leaked into browser source: ${path.relative(root,file)}`)}
if(!process.exitCode)ok(`AI runtime acceptance passed across ${srcFiles.length} browser source files with application-assistant Mini, Gemini-first public search, Gemini Research leader and opt-in internal RAG`);
