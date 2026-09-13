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
const studyQuiz=read('api/ai/study-quiz.js');
const xiaozhiHandler=read('api/_lib/xiaozhi-mini-handler.js');
const geminiProvider=read('api/_lib/gemini-provider.js');
const health=read('api/ai/health.js');
const runtime=read('src/services/aiRuntimeService.ts');
const academicService=read('src/services/academicAiService.ts');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const miniService=read('src/services/xiaozhiMiniService.ts');
const research=read('src/components/research/ResearchCenter.tsx');
const researchMini=read('src/components/research/ResearchAiMini.tsx');
const examShell=read('src/components/exam/ExamCenter.tsx');
const examImplementation=read('src/components/exam/NationalExamPrepLegacy.tsx');
const exam=`${examShell}\n${examImplementation}`;
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
requireText(gateway,'AI_TIMEOUT_MS=20000','academic AI gateway timeout is bounded');
requireText(gateway,"type:'json_schema'",'academic AI uses Structured Outputs');
requireText(gateway,'store:false','academic AI disables response storage');
requireText(gateway,'allowed=new Map','academic AI validates citations against provided sources');
requireText(gateway,'executeAiTool(req,access.role,call)','academic AI rechecks RBAC for tool execution');
requireText(gateway,'MAX_TOOL_ROUNDS=2','academic AI bounds tool rounds');
requireText(gateway,"if(req.body?.mode==='xiaozhi-mini')return handleXiaoZhiMini(req,res)",'XiaoZhi mode reuses the existing AI serverless gateway');

requireText(xiaozhiHandler,"memberAccess(req,'member')",'XiaoZhi requires approved-member auth');
requireText(xiaozhiHandler,'isResearchIntent','XiaoZhi detects deep research intent for explicit handoff');
requireText(xiaozhiHandler,"route:'research'",'XiaoZhi server returns an explicit Research route');
const {isResearchIntent}=await import('../api/_lib/xiaozhi-mini-handler.js');
for(const query of ['Tạng tượng là gì?','Giải thích âm dương ngũ hành đơn giản','Vitamin C tan trong nước hay dầu?'])isResearchIntent(query)?fail(`ordinary education query incorrectly routed to Research: ${query}`):ok(`ordinary education stays in App Assistant: ${query}`);
for(const query of ['Tìm y văn PubMed về châm cứu mất ngủ','Phân tích meta-analysis về acupuncture insomnia','So sánh bằng chứng lâm sàng và guideline điều trị tăng huyết áp'])isResearchIntent(query)?ok(`research query routes to Research: ${query}`):fail(`research query missed Research handoff: ${query}`);
requireText(xiaozhiHandler,'createGeminiWebSearch','XiaoZhi uses Gemini as primary public-search provider');
if(xiaozhiHandler.indexOf('createGeminiWebSearch')<xiaozhiHandler.indexOf("type:'web_search_preview'"))ok('XiaoZhi attempts Gemini before OpenAI web failover');else fail('XiaoZhi must attempt Gemini before OpenAI web failover');
requireText(geminiProvider,"tools:[{type:'google_search'}]",'Gemini public answers use Google Search grounding');
requireText(geminiProvider,'geminiPrivateContextAllowed=()=>false','Gemini has no environment-level private-context bypass');
requireText(xiaozhiHandler,'store:false','XiaoZhi disables provider response storage');
requireText(xiaozhiHandler,"provider:'local',degraded:true",'XiaoZhi retains bounded degraded fallback');

requireText(studyQuiz,"memberAccess(req,'member')",'Study quiz requires approved-member authentication');
requireText(studyQuiz,'runGemini(topic,count,controller.signal)','Study quiz attempts Gemini first');
requireText(studyQuiz,'runOpenAi(topic,count,controller.signal)','Study quiz has one web-grounded provider failover');
if(studyQuiz.indexOf('runGemini(topic,count,controller.signal)')<studyQuiz.indexOf('runOpenAi(topic,count,controller.signal)'))ok('Study quiz provider order is Gemini-first');else fail('Study quiz must be Gemini-first');
requireText(studyQuiz,"provider:'openai-web-fallback'",'Study quiz labels provider failover truthfully');
requireText(studyQuiz,'invalid_quiz_count','Study quiz fails closed on incomplete question count');
requireText(studyQuiz,'OpenAI quiz has no grounded web source','Study quiz fallback requires public sources');
requireText(studyQuiz,'Gemini quiz has no grounded web source','Study quiz Gemini path requires public sources');

requireText(miniService,"fetch('/api/ai/assistant'",'XiaoZhi client reuses shared AI endpoint');
requireText(miniService,"mode:'xiaozhi-mini'",'XiaoZhi client selects dedicated gateway mode');
requireText(miniService,'Authorization:`Bearer ${token}`','XiaoZhi client authenticates shared gateway');
forbidText(mini,'askXiaoZhiMini','global task assistant no longer answers learning questions through XiaoZhi');
requireText(mini,'openStudyAi(text)','global task assistant hands ordinary study questions to Gemini Study');
requireText(mini,'researchIntent','global A.I Mini detects research intent for explicit handoff');
requireText(mini,'openResearch(text)','global A.I Mini hands research questions to Research A.I');
requireText(mini,'speechSynthesis','global A.I Mini supports speech output');
requireText(mini,'startListening','global A.I Mini supports speech input when available');
for(const forbidden of ['searchOpenAlex','searchDriveRag','searchKnowledge','centralKnowledgeService','askAcademicUnified','feedback_submit_v1'])forbidText(mini,forbidden,`global A.I Mini excludes research provider ${forbidden}`);

requireText(runtime,"fetch('/api/ai/assistant'",'academic client routes cloud AI through shared server gateway');
requireText(runtime,'internalContextConsent:options.useInternal===true','internal context requires explicit request-scoped opt-in');
requireText(gateway,"source?.id?.startsWith('drive:')||source?.id?.startsWith('central:')",'gateway classifies internal sources');
requireText(gateway,'sources.some(isInternalSource)&&!internalContextConsent','gateway rejects internal context unless opted in');
forbidText(gateway,'GEMINI_ALLOW_PRIVATE_CONTEXT','gateway has no private-context bypass');
requireText(runtime,'renderAiAnswer','academic client has consistent safety/citation renderer');
requireText(academicService,'if(!useInternal)','academic A.I keeps internal retrieval off by default');
requireText(academicService,'askXiaoZhiMini(query,context,signal)','academic public search remains Gemini-first through shared public gateway');
requireText(academicService,"searchDriveRag(query,4,signal)",'academic internal mode retrieves Drive only after opt-in');
requireText(academicService,"searchKnowledge(query,'all',5)",'academic internal mode retrieves Central RAG only after opt-in');
requireText(academicService,'{useInternal:true}','academic internal mode authorizes final synthesis explicitly');

requireText(research,['searchPubMed(query,12)'].find(Boolean),'Research Center retains independent public evidence retrieval');
requireText(research,'searchOpenAlex(query,12)','Research Center retains OpenAlex retrieval');
requireText(research,'searchClinicalTrials(query,8)','Research Center retains ClinicalTrials retrieval');
requireText(research,'<ResearchAiMini','Research Center mounts exactly the canonical Research AI workbench');
for(const stale of ['ragInternalConsent','Research A.I tổng hợp nguồn vừa tìm','summarizeOpenAlex','askServerAi'])forbidText(research,stale,`Research Center excludes retired orchestration ${stale}`);

requireText(researchMini,"from '../../modules/ai'",'Research A.I routes through AI Platform facade');
requireText(researchMini,'RESEARCH_ROLE=GEMINI_MEDICAL_RESEARCH_LEAD','Research A.I explicitly assigns Gemini medical-research leadership');
requireText(researchMini,"searchPubMed(text,8)",'Research A.I retains PubMed worker');
requireText(researchMini,"searchOpenAlex(text,8)",'Research A.I retains OpenAlex worker');
requireText(researchMini,"searchClinicalTrials(text,5)",'Research A.I retains ClinicalTrials worker');
requireText(researchMini,"internalEnabled?searchDriveRag",'Research A.I skips Drive retrieval until explicit opt-in');
requireText(researchMini,"internalEnabled?searchKnowledge",'Research A.I skips Central RAG until explicit opt-in');
requireText(researchMini,'setUseInternal(false)','Research A.I consumes internal-document consent after each request');
requireText(researchMini,'{useInternal:internalEnabled}','Research A.I sends request-scoped internal consent to gateway');
requireText(researchMini,"askServerAi(prompt,'research',sources,controller.signal,{useInternal:internalEnabled})",'Gemini Research performs final synthesis through canonical gateway');
requireText(researchMini,'result.citations','Research A.I renders server-validated citations');
requireText(researchMini,'PUBLIC_SOURCE_BUDGET=2','Research A.I bounds public evidence contribution');
requireText(researchMini,'CENTRAL_SOURCE_BUDGET=2','Research A.I bounds Central RAG contribution');
requireText(researchMini,'DRIVE_SOURCE_BUDGET=2','Research A.I bounds Drive contribution');
for(const stale of ['buildAcademicFallback','Fallback học thuật cục bộ','A.I local 0đ'])forbidText(researchMini,stale,`Research A.I forbids local pseudo-answer ${stale}`);

requireText(exam,"from '../../modules/ai'",'Exam A.I Tutor routes through AI Platform facade');
requireText(exam,'answer.degraded?localTutor','Exam tutor retains contextual non-answer-leaking fallback');

requireText(health,"req.method!=='GET'",'AI readiness endpoint rejects unsupported methods');
requireText(health,'cloudAiConfigured()','AI readiness uses centralized readiness contract');
requireText(health,'cloudAiModel()','AI readiness reports non-secret model');
requireText(health,'centralRagReady','AI readiness reports Central RAG state');
requireText(health,'readOnlyTools:true','AI readiness advertises read-only tool policy');
requireText(health,"defaultSearchProvider:geminiReady?'gemini-google-search'",'AI readiness advertises Gemini Google Search as default');
requireText(health,'internalContextOptIn:true','AI readiness advertises opt-in internal context');
forbidText(health,'process.env.','AI readiness does not serialize environment values');

requireText(aiPlatform,"export * from './core/gateway'",'AI Platform exposes one academic gateway facade');
requireText(aiPlatform,"export * from './providers/registry'",'AI Platform exposes provider registry');
for(const core of ['gemini-server','central-rag','drive-rag','openalex','pubmed','clinicaltrials'])requireText(providerRegistry,`id:'${core}'`,`AI provider registry contains core ${core}`);
for(const dead of ['gemini-byok','unpaywall','candidateZeroCostProviders'])forbidText(providerRegistry,dead,`AI provider registry excludes dead adapter ${dead}`);
requireText(aiOps,'fetchAiHealth','Admin A.I Operations reads non-secret readiness');
forbidText(aiOps,'candidateZeroCostProviders','Admin A.I Operations does not advertise provider sprawl');
forbidText(aiOps,'GEMINI_ALLOW_PRIVATE_CONTEXT','Admin A.I Operations has no obsolete privacy bypass');
requireText(envExample,'ENABLE_CLOUD_AI=false','handoff env documents fail-closed cloud flag');
requireText(envExample,'OPENAI_MODEL=gpt-5.6-luna','handoff env documents default model override');

const srcFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(ts|tsx|js|jsx)$/.test(entry.name))srcFiles.push(full)}}
walk(path.join(root,'src'));
for(const file of srcFiles){const text=fs.readFileSync(file,'utf8');if(text.includes('OPENAI_API_KEY'))fail(`server secret name leaked into browser source: ${path.relative(root,file)}`)}
if(!process.exitCode)ok(`AI runtime acceptance passed across ${srcFiles.length} browser source files with task-only assistant, resilient Gemini-first Study quiz, single Gemini Research workbench, opt-in internal RAG and provider failover`);
