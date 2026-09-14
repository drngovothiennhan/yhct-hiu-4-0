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
const studyHandler=read('api/_lib/study-assistant-handler.js');
const publicEvidence=read('api/_lib/public-medical-evidence.js');
const studyClient=read('src/services/studyAiService.ts');
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

requireText(access,"DEFAULT_OPENAI_MODEL='gpt-5.6-luna'",'AI server has production-safe default OpenAI model');
requireText(access,'cloudAiModel','AI server centralizes OpenAI model selection');
requireText(access,'cloudAiConfigured','AI server centralizes cloud readiness');
requireText(access,'roleAtLeast','AI server centralizes role hierarchy');
requireText(access,'memberRpc','AI server has authenticated RPC transport');
for(const name of ['get_my_drl_history','list_research_opportunities','list_drl_semesters','search_yhct_knowledge'])requireText(toolsSource,name,`AI read-only tool registry contains ${name}`);
for(const forbidden of ['research_apply_v1','drl_admin_','feedback_submit_v1','system_theme_set_v1'])forbidText(toolsSource,forbidden,`AI tool registry excludes mutation ${forbidden}`);

const toolsModule=await import('../api/_lib/ai-tools.js');
const memberTools=toolsModule.aiToolsForRole('member').map(tool=>tool.name),modTools=toolsModule.aiToolsForRole('mod').map(tool=>tool.name);
if(memberTools.includes('get_my_drl_history')&&memberTools.includes('search_yhct_knowledge'))ok('member receives permitted read-only tools');else fail('member missing required read-only tools');
if(!memberTools.includes('list_drl_semesters')&&modTools.includes('list_drl_semesters'))ok('moderator-only semester tool preserves RBAC');else fail('semester AI tool RBAC incorrect');

requireText(gateway,"memberAccess(req,'member')",'academic AI gateway requires approved-member auth');
requireText(gateway,'AI_TIMEOUT_MS=20000','academic AI gateway timeout bounded');
requireText(gateway,"type:'json_schema'",'academic AI uses Structured Outputs');
requireText(gateway,'store:false','academic AI disables response storage');
requireText(gateway,'executeAiTool(req,access.role,call)','academic AI rechecks RBAC for tool execution');
requireText(gateway,"if(req.body?.mode==='study')return handleStudyAssistant(req,res)",'Study chat and quiz share existing assistant serverless function');
requireText(gateway,"if(req.body?.mode==='xiaozhi-mini')return handleXiaoZhiMini(req,res)",'XiaoZhi shares existing assistant serverless function');

requireText(studyClient,"fetch('/api/ai/assistant'",'Study client uses shared assistant endpoint');
requireText(studyClient,"task:'quiz'",'Study quiz selects quiz task inside shared gateway');
forbidText(studyClient,'/api/ai/study-quiz','Study client has no duplicate quiz endpoint');
requireText(studyHandler,"memberAccess(req,'member')",'Study handler requires approved-member authentication');
requireText(studyHandler,"task==='quiz'",'Study handler routes quiz task');
requireText(studyHandler,'retrievePublicMedicalEvidence','Study quiz retrieves public evidence independently of model quota');
requireText(studyHandler,'runOpenAiEvidenceQuiz','Study quiz has one same-evidence provider failover');
requireText(studyHandler,"provider:'openai-public-evidence'",'Study quiz labels evidence failover truthfully');
requireText(studyHandler,'sourceIndexes','Study quiz binds every question to retrieved public sources');
requireText(studyHandler,'QUIZ_MODEL_BUSY','Study quiz separates model exhaustion from source retrieval failure');
requireText(studyHandler,'X-AI-Evidence-Count','Study quiz exposes evidence count for diagnostics');
requireText(studyHandler,'X-AI-Failover','Study quiz exposes transparent failover header');
forbidText(studyHandler,'web_search_preview','Study quiz does not spend a second paid web-search quota');
forbidText(studyHandler,'runOpenAiQuiz','retired web-search failover stays removed');
requireText(publicEvidence,'api.openalex.org/works','public evidence uses OpenAlex');
requireText(publicEvidence,'ebi.ac.uk/europepmc','public evidence uses Europe PMC');
requireText(publicEvidence,'wikipedia.org/w/api.php','public evidence retains bounded general-source fallback');
requireText(publicEvidence,'physiology','public evidence expands broad Vietnamese medical topics');
if(fs.existsSync(path.join(root,'api/ai/study-quiz.js')))fail('duplicate Study quiz serverless endpoint must remain removed');else ok('duplicate Study quiz serverless endpoint removed');

requireText(xiaozhiHandler,"memberAccess(req,'member')",'XiaoZhi requires approved-member auth');
requireText(xiaozhiHandler,'isResearchIntent','XiaoZhi detects deep research intent');
requireText(xiaozhiHandler,"route:'research'",'XiaoZhi returns explicit Research route');
requireText(xiaozhiHandler,'createGeminiWebSearch','XiaoZhi uses Gemini as primary public-search provider');
requireText(geminiProvider,"tools:[{type:'google_search'}]",'Gemini public answers use Google Search grounding');
requireText(geminiProvider,'geminiPrivateContextAllowed=()=>false','Gemini has no environment private-context bypass');
requireText(xiaozhiHandler,'store:false','XiaoZhi disables provider response storage');
requireText(xiaozhiHandler,"provider:'local',degraded:true",'XiaoZhi retains bounded degraded fallback');
requireText(miniService,"fetch('/api/ai/assistant'",'XiaoZhi client reuses shared AI endpoint');
forbidText(mini,'askXiaoZhiMini','global task assistant no longer answers learning questions through XiaoZhi');
requireText(mini,'openStudyAi(text)','global task assistant hands study questions to Gemini Study');
requireText(mini,'openResearch(text)','global task assistant hands research questions to Research A.I');

requireText(runtime,"fetch('/api/ai/assistant'",'academic client routes cloud AI through shared gateway');
requireText(runtime,'internalContextConsent:options.useInternal===true','internal context requires request-scoped opt-in');
requireText(gateway,'sources.some(isInternalSource)&&!internalContextConsent','gateway rejects internal context unless opted in');
forbidText(gateway,'GEMINI_ALLOW_PRIVATE_CONTEXT','gateway has no private-context bypass');
requireText(academicService,'if(!useInternal)','academic A.I keeps internal retrieval off by default');
requireText(academicService,"searchDriveRag(query,4,signal)",'academic internal mode retrieves Drive only after opt-in');
requireText(academicService,"searchKnowledge(query,'all',5)",'academic internal mode retrieves Central RAG only after opt-in');

requireText(research,'searchPubMed(query,12)','Research Center retains independent PubMed retrieval');
requireText(research,'searchOpenAlex(query,12)','Research Center retains OpenAlex retrieval');
requireText(research,'searchClinicalTrials(query,8)','Research Center retains ClinicalTrials retrieval');
requireText(research,'<ResearchAiMini','Research Center mounts canonical Research workbench');
for(const stale of ['ragInternalConsent','Research A.I tổng hợp nguồn vừa tìm','summarizeOpenAlex','askServerAi'])forbidText(research,stale,`Research Center excludes retired orchestration ${stale}`);
requireText(researchMini,'RESEARCH_ROLE=GEMINI_MEDICAL_RESEARCH_LEAD','Research A.I assigns Gemini medical-research leadership');
requireText(researchMini,"internalEnabled?searchDriveRag",'Research A.I skips Drive until explicit opt-in');
requireText(researchMini,"internalEnabled?searchKnowledge",'Research A.I skips Central RAG until explicit opt-in');
requireText(researchMini,'setUseInternal(false)','Research A.I consumes internal-document consent after each request');
requireText(researchMini,'PUBLIC_SOURCE_BUDGET=2','Research A.I bounds public evidence');
requireText(researchMini,'CENTRAL_SOURCE_BUDGET=2','Research A.I bounds Central RAG');
requireText(researchMini,'DRIVE_SOURCE_BUDGET=2','Research A.I bounds Drive evidence');
for(const stale of ['buildAcademicFallback','Fallback học thuật cục bộ','A.I local 0đ'])forbidText(researchMini,stale,`Research A.I forbids local pseudo-answer ${stale}`);

requireText(exam,"from '../../modules/ai'",'Exam A.I Tutor routes through AI Platform facade');
requireText(exam,'answer.degraded?localTutor','Exam tutor retains contextual non-answer-leaking fallback');
requireText(health,"req.method!=='GET'",'AI readiness endpoint rejects unsupported methods');
requireText(health,'centralRagReady','AI health reports live Central RAG state');
requireText(health,'internalContextOptIn:true','AI health advertises internal-context opt-in');
forbidText(health,'process.env.','AI readiness does not serialize environment values');
requireText(aiPlatform,"export * from './core/gateway'",'AI Platform exposes one academic gateway facade');
for(const core of ['gemini-server','central-rag','drive-rag','openalex','pubmed','clinicaltrials'])requireText(providerRegistry,`id:'${core}'`,`provider registry contains ${core}`);
for(const dead of ['gemini-byok','unpaywall','candidateZeroCostProviders'])forbidText(providerRegistry,dead,`provider registry excludes dead adapter ${dead}`);
requireText(aiOps,'fetchAiHealth','Admin A.I Operations reads non-secret readiness');
forbidText(aiOps,'GEMINI_ALLOW_PRIVATE_CONTEXT','Admin A.I Operations has no obsolete privacy bypass');
requireText(envExample,'ENABLE_CLOUD_AI=false','env handoff defaults cloud AI fail-closed');

const srcFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(ts|tsx|js|jsx)$/.test(entry.name))srcFiles.push(full)}}
walk(path.join(root,'src'));
for(const file of srcFiles){const text=fs.readFileSync(file,'utf8');if(text.includes('OPENAI_API_KEY'))fail(`server secret name leaked into browser source: ${path.relative(root,file)}`)}
if(!process.exitCode)ok(`AI runtime acceptance passed across ${srcFiles.length} browser source files with quota-independent public evidence, shared Gemini-first Study quiz, task-only assistant, Gemini Research and opt-in internal RAG`);
