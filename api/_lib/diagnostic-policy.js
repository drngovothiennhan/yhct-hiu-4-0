import {cloudAiEnabled,cloudAiModel} from './member-access.js';
import {createGeminiText,geminiAiConfigured,geminiAiModel} from './gemini-provider.js';

const SAFE_METADATA_KEYS=new Set(['route','module','status','status_code','provider','failureClass','failure_class','operation','scope','source','count','duration_ms','latency_ms','deployment_sha','http_status']);
const safe=(value,max=4000)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const safePrimitive=(value,max=240)=>typeof value==='number'||typeof value==='boolean'?value:typeof value==='string'?safe(value,max):null;

export function sanitizeDiagnosticMetadata(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return{};
  const out={};
  for(const [key,raw] of Object.entries(value)){
    if(!SAFE_METADATA_KEYS.has(key))continue;
    const normalized=safePrimitive(raw);
    if(normalized!==null&&normalized!=='')out[key]=normalized;
  }
  return out;
}

export function normalizeDiagnosticLogs(value){
  if(!Array.isArray(value))return[];
  return value.slice(0,50).map(item=>{
    const row=item&&typeof item==='object'?item:{};
    return{
      action:safe(row.action,240),
      severity:safe(row.severity,40),
      entityType:safe(row.entity_type??row.entityType??row.entity,120),
      entityId:safe(row.entity_id??row.entityId,120),
      createdAt:safe(row.created_at??row.createdAt,80),
      metadata:sanitizeDiagnosticMetadata(row.metadata)
    };
  });
}

export function normalizeDiagnosticHealth(value){
  const row=value&&typeof value==='object'?value:{};
  const rawCounts=row.counts&&typeof row.counts==='object'&&!Array.isArray(row.counts)?row.counts:{};
  const counts={};
  for(const [key,raw] of Object.entries(rawCounts).slice(0,30)){
    const n=Number(raw);
    if(Number.isFinite(n))counts[safe(key,80)]=n;
  }
  return{
    ok:Boolean(row.ok),
    serverTime:safe(row.serverTime??row.server_time,80),
    postgres:safe(row.postgres,80),
    counts,
    recentErrorCount:Array.isArray(row.recentErrors)?row.recentErrors.length:Number.isFinite(Number(row.recentErrorCount))?Number(row.recentErrorCount):0
  };
}

export function normalizeDiagnosticPayload(body){
  return{logs:normalizeDiagnosticLogs(body?.logs),health:normalizeDiagnosticHealth(body?.health)};
}

export function buildDiagnosticPrompt({health,logs}){
  return`Bạn là Principal DevSecOps cho YHCT HIU 4.0. Không được đề xuất bỏ RBAC/RLS, không tiết lộ secret, không chạy lệnh phá hủy. Trả lời tiếng Việt theo 4 mục: Phát hiện; Root cause khả dĩ; Suggested patch; Gate kiểm thử. Mọi patch phải qua staging+CI trước production. Chỉ dùng snapshot vận hành đã được allowlist; không suy đoán dữ liệu cá nhân. HEALTH=${JSON.stringify(health).slice(0,7000)} LOGS=${JSON.stringify(logs).slice(0,15000)}`;
}

const failureClass=error=>{const message=String(error?.message||'');if(error?.name==='AbortError'||/timeout/i.test(message))return'timeout';if(/\b401\b/.test(message))return'auth';if(/\b403\b/.test(message))return'access';if(/\b429\b/.test(message))return'rate_limit';if(/\b5\d\d\b/.test(message))return'provider_5xx';return'provider_error'};

async function openAiDiagnostic(input,timeoutMs){
  const key=process.env.OPENAI_API_KEY,model=cloudAiModel();
  if(!cloudAiEnabled()||!key||!model)return null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,input,max_output_tokens:900})});
    if(!response.ok)throw new Error(`OpenAI ${response.status}`);
    const result=await response.json(),text=result.output_text||result.output?.flatMap(item=>item.content||[]).map(part=>part.text||'').join('')||'';
    if(!safe(text))throw new Error('OpenAI empty response');
    return{text:safe(text),provider:'openai',model};
  }finally{clearTimeout(timer)}
}

export async function runDiagnosticProvider(input,{timeoutMs=12000}={}){
  const prompt=safe(input,24000),bounded=Math.max(3000,Math.min(Number(timeoutMs)||12000,15000));
  if(geminiAiConfigured('default')){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),bounded);
    try{
      const output=await createGeminiText({systemInstruction:'Phân tích vận hành an toàn, không tiết lộ secret hoặc dữ liệu cá nhân.',prompt,maxOutputTokens:900,signal:controller.signal,mode:'default'});
      return{text:safe(output.text),provider:'gemini',model:output.model||geminiAiModel()};
    }catch(error){console.warn(JSON.stringify({event:'ai_diagnostic_provider',ok:false,provider:'gemini',failureClass:failureClass(error),failover:'openai'}))}
    finally{clearTimeout(timer)}
  }
  try{return await openAiDiagnostic(prompt,bounded)}catch(error){console.warn(JSON.stringify({event:'ai_diagnostic_provider',ok:false,provider:'openai',failureClass:failureClass(error),failover:'local'}));return null}
}
