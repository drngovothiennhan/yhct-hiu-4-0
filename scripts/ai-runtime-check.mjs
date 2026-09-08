import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>{console.error(`AI-RUNTIME FAIL: ${message}`);process.exitCode=1};
const ok=message=>console.log(`OK: ${message}`);
const requireText=(text,needle,label)=>text.includes(needle)?ok(label):fail(`${label} (missing ${needle})`);

const gateway=read('api/ai/assistant.js');
const health=read('api/ai/health.js');
const runtime=read('src/services/aiRuntimeService.ts');
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const research=read('src/components/research/ResearchCenter.tsx');
const gemini=read('src/services/geminiByok.ts');
const envExample=read('.env.example');

requireText(gateway,"memberAccess(req,'member')",'AI gateway requires approved member auth');
requireText(gateway,'new AbortController()','AI gateway has provider timeout cancellation');
requireText(gateway,'AI_TIMEOUT_MS=9500','AI gateway timeout is bounded');
requireText(gateway,"type:'json_schema'",'OpenAI response uses Structured Outputs JSON schema');
requireText(gateway,'store:false','OpenAI response storage is disabled by default');
requireText(gateway,'sourceIds','AI output cites source IDs instead of arbitrary URLs');
requireText(gateway,'allowed=new Map','server validates citations against supplied source whitelist');
requireText(gateway,"safety:'needs_source_check'",'degraded path explicitly requires source checking');
requireText(gateway,"console.info(JSON.stringify({event:'ai_gateway'",'AI gateway emits prompt-free operational telemetry');

requireText(health,"req.method!=='GET'",'AI readiness endpoint is read-only');
requireText(health,'cloudAiEnabled()','AI readiness uses the same cloud feature gate as runtime');
requireText(health,"mode:cloudReady?'cloud+local':'local-only'",'AI readiness exposes cloud-vs-local mode without secrets');
requireText(health,'localFallback:true','AI readiness confirms local fallback is always present');
if(/process\.env\.[A-Z0-9_]+\s*[,}]/.test(health))fail('AI readiness must not serialize environment variable values');else ok('AI readiness does not serialize secret/env values');

requireText(runtime,"fetch('/api/ai/assistant'",'client routes cloud AI through the server gateway');
requireText(runtime,'Authorization:`Bearer ${session.access_token}`','client authenticates AI gateway requests');
requireText(runtime,'TIMEOUT_MS=11000','client AI request has bounded timeout');
requireText(runtime,"provider:'openai'|'local'",'client exposes provider/degraded contract');
requireText(runtime,'renderAiAnswer','client has a consistent safety/citation renderer');

const localIndex=mini.indexOf('searchKnowledge(text');
const serverIndex=mini.indexOf("askServerAi(text,'fast')");
if(localIndex>=0&&serverIndex>localIndex)ok('A.I Mini stays local-first before cloud escalation');else fail('A.I Mini must search local knowledge before calling cloud AI');
requireText(mini,'getGeminiStatus().configured','Gemini remains an optional fallback only');
requireText(research,"askServerAi(query,'research',sources)",'Research Center sends bounded RAG sources to AI gateway');
requireText(research,'aiAnswer.citations','Research Center renders server-validated citations');

if(gemini.includes('localStorage.setItem(KEY_STORAGE'))fail('Gemini API key must never be persisted in localStorage');else ok('Gemini API key is not persisted in localStorage');
requireText(gemini,'session().setItem(KEY_STORAGE','Gemini BYOK secret is session-scoped');
requireText(gemini,'purgeLegacySecret','legacy persisted BYOK secrets are actively purged');
requireText(envExample,'ENABLE_CLOUD_AI=false','handoff env documents fail-closed cloud AI flag');

const srcFiles=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(/\.(ts|tsx|js|jsx)$/.test(entry.name))srcFiles.push(full)}}
walk(path.join(root,'src'));
for(const file of srcFiles){const text=fs.readFileSync(file,'utf8');if(text.includes('OPENAI_API_KEY'))fail(`server secret name leaked into browser source: ${path.relative(root,file)}`)}
if(!process.exitCode)ok(`AI runtime acceptance passed across ${srcFiles.length} browser source files`);
