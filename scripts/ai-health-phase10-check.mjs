import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const failures=[];
const need=(body,token,label)=>{if(!body.includes(token))failures.push(`${label}: missing ${token}`)};
const forbid=(body,token,label)=>{if(body.includes(token))failures.push(`${label}: forbidden ${token}`)};

const research=read('src/components/research/ResearchAiMini.tsx');
const xiaozhi=read('api/_lib/xiaozhi-mini-handler.js');
const diagnostics=read('api/ai/diagnostics.js');
const systemAdmin=read('src/components/admin/SystemAdminCenter.tsx');
const health=read('api/ai/health.js');
const aiOps=read('src/components/admin/AiOperationsPanel.tsx');
const registry=read('src/modules/ai/providers/registry.ts');

for(const token of ['PUBLIC_SOURCE_BUDGET=2','CENTRAL_SOURCE_BUDGET=2','DRIVE_SOURCE_BUDGET=2','balancedResearchSources(literature,knowledge,drive.sources,internalEnabled)'])need(research,token,'Research source budget');
forbid(research,'sources=[...knowledge,...drive.sources,...literature].slice(0,6)','Research must not let internal sources starve public evidence');

need(xiaozhi,"function logXiaoZhiCompletion",'XiaoZhi completion telemetry');
need(xiaozhi,"event:'xiaozhi_mini',ok:true",'XiaoZhi success telemetry event');
for(const token of ['route:','degraded:','failureClass:','latencyMs:','sourceCount:'])need(xiaozhi,token,'XiaoZhi bounded telemetry fields');
const completionBlock=xiaozhi.slice(xiaozhi.indexOf('function logXiaoZhiCompletion'),xiaozhi.indexOf('function logXiaoZhiFailure'));
for(const forbidden of ['query','pageContext','localContext','input','answer:','.sources'])forbid(completionBlock,forbidden,`XiaoZhi telemetry privacy ${forbidden}`);
forbid(xiaozhi,'error:clean(error?.message','XiaoZhi logs must use failure classes, not provider error text');

need(systemAdmin,"fetch('/api/ai/diagnostics'",'ACC diagnostics canonical Vercel route');
forbid(systemAdmin,"edgeUrl('acc-diagnostics')",'ACC diagnostics must not bypass canonical route');
need(diagnostics,"from '../_lib/diagnostic-policy.js'",'Diagnostic route shared safe policy');
forbid(diagnostics,'api.openai.com','Diagnostic route must not call provider directly');

const policy=await import('../api/_lib/diagnostic-policy.js');
const normalized=policy.normalizeDiagnosticPayload({
  health:{ok:true,serverTime:'2026-09-12T00:00:00Z',postgres:'ok',counts:{members:7},recentErrors:[{token:'secret-health'}],secret:'secret-health-root'},
  logs:[{action:'route.failure',severity:'error',entity_type:'api_route',entity_id:'abc-123',created_at:'2026-09-12T00:00:00Z',metadata:{provider:'gemini',latency_ms:321,token:'secret-token',query:'private question',prompt:'private prompt',body:'private body',email:'private@example.com'}}]
});
if(normalized.logs[0]?.entityType!=='api_route'||normalized.logs[0]?.entityId!=='abc-123'||normalized.logs[0]?.createdAt!=='2026-09-12T00:00:00Z')failures.push('Diagnostic schema mapping lost entity_type/entity_id/created_at');
if(normalized.logs[0]?.metadata?.provider!=='gemini'||normalized.logs[0]?.metadata?.latency_ms!==321)failures.push('Diagnostic metadata allowlist removed safe operational fields');
const normalizedText=JSON.stringify(normalized);
for(const secret of ['secret-health','secret-token','private question','private prompt','private body','private@example.com'])if(normalizedText.includes(secret))failures.push(`Diagnostic redaction leaked ${secret}`);
if(normalized.health?.recentErrorCount!==1)failures.push('Diagnostic health must reduce recentErrors to a count');

for(const token of ["providerStatus:{openai:{configured:openAiReady,liveness:'not_probed'},gemini:{configured:geminiReady,liveness:'not_probed'}}","centralRagStatus:{ready:centralRagReady,reason:centralRagReason}","configuredCloudCount===1?'cloud+local'"])need(health,token,'Health configured-vs-live semantics');
need(aiOps,"?'CONFIG':'OFF'",'ACC must label configured providers as CONFIG, not READY');
need(aiOps,'Live probe Gemini','ACC must distinguish live probe');
need(aiOps,'Cấu hình không được xem là bằng chứng liveness','ACC truthful health semantics');
forbid(aiOps,'readiness · model/provider · latency · degraded mode','ACC must not claim unavailable runtime metrics');

need(registry,"id:'gemini-server',label:'Gemini Server Runtime',kind:'cloud-llm',state:'active'",'Gemini canonical primary registry state');
need(registry,"id:'openai',label:'OpenAI Cloud Runtime',kind:'cloud-llm',state:'optional'",'OpenAI canonical fallback registry state');
need(registry,'never runtime liveness/readiness','Registry must document architecture-only state');

if(failures.length){console.error('AI HEALTH PHASE10 FAILED');for(const failure of failures)console.error(`- ${failure}`);process.exit(1)}
console.log('AI Health Phase 10 PASS: balanced Research provenance, redacted diagnostics, privacy-safe XiaoZhi telemetry, truthful configured/liveness semantics and Gemini-first registry are enforced.');
