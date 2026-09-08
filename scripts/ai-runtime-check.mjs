import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>{console.error(`AI-RUNTIME FAIL: ${message}`);process.exitCode=1};
const ok=message=>console.log(`OK: ${message}`);
const requireText=(text,needle,label)=>text.includes(needle)?ok(label):fail(`${label} (missing ${needle})`);

const access=read('api/_lib/member-access.js');
const toolsSource=read('api/_lib/ai-tools.js');
const gateway=read('api/ai/assistant.js');
const health=read('api/ai/health.js');
const runtime=read('src/services/aiRuntimeService.ts');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const research=read('src/components/research/ResearchCenter.tsx');
const gemini=read('src/services/geminiByok.ts');
const envExample=read('.env.example');

requireText(access,"DEFAULT_OPENAI_MODEL='gpt-5.6-luna'",'AI server has a production-safe default OpenAI model');
requireText(access,'cloudAiModel','AI server centralizes model selection');
requireText(access,'cloudAiConfigured','AI server centralizes cloud readiness');
requireText(access,'roleAtLeast','AI server centralizes role hierarchy');
requireText(access,'memberRpc','AI server has an authenticated RPC transport for scoped tools');

requireText(toolsSource,'get_my_drl_history','member tool exposes only own published DRL history');
requireText(toolsSource,'list_research_opportunities','member tool exposes read-only research opportunity feed');
requireText(toolsSource,'list_drl_semesters','moderation tool exposes read-only semester status');
requireText(toolsSource,"minRole:'mod'",'semester tool is gated to moderator or higher');
requireText(toolsSource,'strict:true','AI function schemas use strict mode');
requireText(toolsSource,'executeAiTool','AI tool calls are executed through the server registry');
requireText(toolsSource,'memberRpc(req,tool.rpc','AI tools reuse the authenticated member RPC transport');
for(const forbidden of ['research_apply_v1','drl_admin_','feedback_submit_v1','system_theme_set_v1']){
  if(toolsSource.includes(forbidden))fail(`AI tool registry must remain read-only; forbidden mutation RPC found: ${forbidden}`);else ok(`AI tool registry excludes mutation RPC ${forbidden}`);
}

const toolsModule=await import('../api/_lib/ai-tools.js');
const memberTools=toolsModule.aiToolsForRole('member').map(tool=>tool.name);
const modTools=toolsModule.aiToolsForRole('mod').map(tool=>tool.name);
const adminTools=toolsModule.aiToolsForRole('admin').map(tool=>tool.name);
if(memberTools.includes('get_my_drl_history')&&memberTools.includes('list_research_opportunities'))ok('member receives permitted read-only tools');else fail('member is missing required read-only tools');
if(!memberTools.includes('list_drl_semesters'))ok('member cannot receive moderator semester tool');else fail('member must not receive moderator semester tool');
if(modTools.includes('list_drl_semesters')&&adminTools.includes('list_drl_semesters'))ok('moderator hierarchy receives semester tool');else fail('moderator/admin must receive semester tool');
if(memberTools.every(name=>toolsModule.AI_TOOL_NAMES.includes(name)))ok('member tool exposure is registry-bound');else fail('member tool exposure contains an unregistered tool');
try{
  await toolsModule.executeAiTool({headers:{}},'member',{name:'list_drl_semesters',arguments:'{}'});
  fail('runtime RBAC must reject moderator tool for member');
}catch(error){
  String(error?.message||'').includes('not allowed')?ok('runtime RBAC rejects moderator tool before any RPC'):fail('runtime RBAC rejected member tool with unexpected reason');
}
try{
  await toolsModule.executeAiTool({headers:{}},'admin',{name:'research_apply_v1',arguments:'{}'});
  fail('runtime registry must reject unregistered mutation tool');
}catch(error){
  String(error?.message||'').includes('not allowed')?ok('runtime registry rejects mutation tool before any RPC'):fail('runtime registry rejected mutation tool with unexpected reason');
}

requireText(gateway,"memberAccess(req,'member')",'AI gateway requires approved member auth');
requireText(gateway,'new AbortController()','AI gateway has provider timeout cancellation');
requireText(gateway,'AI_TIMEOUT_MS=9500','AI gateway timeout is bounded');
requireText(gateway,"type:'json_schema'",'OpenAI response uses Structured Outputs JSON schema');
requireText(gateway,'store:false','OpenAI response storage is disabled by default');
requireText(gateway,'sourceIds','AI output cites source IDs instead of arbitrary URLs');
requireText(gateway,'allowed=new Map','server validates citations against supplied source whitelist');
requireText(gateway,"safety:'needs_source_check'",'degraded path explicitly requires source checking');
requireText(gateway,"console.info(JSON.stringify({event:'ai_gateway'",'AI gateway emits prompt-free operational telemetry');
requireText(gateway,'model=cloudAiModel()','AI gateway uses shared server-side model selection');
requireText(gateway,"res.setHeader('X-AI-Model',model)",'AI gateway exposes non-secret model observability');
requireText(gateway,'aiToolsForRole(access.role)','AI gateway exposes tools according to authenticated role');
requireText(gateway,"tool_choice:'auto'",'AI gateway allows model-selected read-only function calls');
requireText(gateway,'parallel_tool_calls:false','AI gateway serializes function calls for strict RBAC control');
requireText(gateway,"type:'function_call_output'",'AI gateway returns function outputs through Responses API contract');
requireText(gateway,'MAX_TOOL_ROUNDS=2','AI gateway bounds tool-call rounds');
requireText(gateway,'MAX_TOOL_CALLS_PER_ROUND=3','AI gateway bounds tool-call fanout');
requireText(gateway,'executeAiTool(req,access.role,call)','AI gateway re-checks role when executing each tool');
requireText(gateway,"res.setHeader('X-AI-Tools-Used'",'AI gateway exposes non-sensitive tool-count observability');
requireText(gateway,'toolsUsed','AI gateway returns bounded tool provenance to the client');

requireText(health,"req.method!=='GET'",'AI readiness endpoint is read-only');
requireText(health,'cloudAiConfigured()','AI readiness uses the same cloud readiness contract as runtime');
requireText(health,'cloudAiModel()','AI readiness reports the effective non-secret model');
requireText(health,"mode:cloudReady?'cloud+local':'local-only'",'AI readiness exposes cloud-vs-local mode without secrets');
requireText(health,'localFallback:true','AI readiness confirms local fallback is always present');
requireText(health,'functionCalling:true','AI readiness advertises function calling capability');
requireText(health,'roleBoundTools:true','AI readiness advertises role-bound tools');
requireText(health,'readOnlyTools:true','AI readiness advertises read-only tool policy');
if(/process\.env\.[A-Z0-9_]+\s*[,}]/.test(health))fail('AI readiness must not serialize environment variable values');else ok('AI readiness does not serialize secret/env values');

requireText(runtime,"fetch('/api/ai/assistant'",'client routes cloud AI through the server gateway');
requireText(runtime,'Authorization:`Bearer ${session.access_token}`','client authenticates AI gateway requests');
requireText(runtime,'TIMEOUT_MS=11000','client AI request has bounded timeout');
requireText(runtime,"provider:'openai'|'local'",'client exposes provider/degraded contract');
requireText(runtime,'toolsUsed:string[]','client exposes server tool provenance');
requireText(runtime,'Dữ liệu hệ thống:','client visibly labels system tool provenance');
requireText(runtime,'renderAiAnswer','client has a consistent safety/citation renderer');

const localIndex=mini.indexOf('searchKnowledge(text');
const driveIndex=mini.indexOf('searchDriveRag(text');
const firstCloudCallIndex=mini.indexOf('askServerAi(');
if(localIndex>=0&&driveIndex>=0&&firstCloudCallIndex>localIndex&&firstCloudCallIndex>driveIndex)ok('A.I Mini retrieves local/Drive knowledge before cloud escalation');else fail('A.I Mini must retrieve local/Drive knowledge before calling cloud AI');
requireText(mini,'getGeminiStatus().configured','Gemini remains an optional fallback only');
requireText(research,"askServerAi(query,'research',sources)",'Research Center sends bounded RAG sources to AI gateway');
requireText(research,'aiAnswer.citations','Research Center renders server-validated citations');

if(gemini.includes('localStorage.setItem(KEY_STORAGE'))fail('Gemini API key must never be persisted in localStorage');else ok('Gemini API key is not persisted in localStorage');
requireText(gemini,'session().setItem(KEY_STORAGE','Gemini BYOK secret is session-scoped');
requireText(gemini,'purgeLegacySecret','legacy persisted BYOK secrets are actively purged');
requireText(envExample,'ENABLE_CLOUD_AI=false','handoff env documents fail-closed cloud AI flag');
requireText(envExample,'OPENAI_MODEL=gpt-5.6-luna','handoff env documents the default OpenAI model override');

const srcFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(ts|tsx|js|jsx)$/.test(entry.name))srcFiles.push(full)}}
walk(path.join(root,'src'));
for(const file of srcFiles){const text=fs.readFileSync(file,'utf8');if(text.includes('OPENAI_API_KEY'))fail(`server secret name leaked into browser source: ${path.relative(root,file)}`)}
if(!process.exitCode)ok(`AI runtime acceptance passed across ${srcFiles.length} browser source files`);
