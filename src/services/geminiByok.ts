const KEY_STORAGE='yhct-gemini-byok-v1';
const MODEL_STORAGE='yhct-gemini-model-v1';
const QUOTA_STORAGE='yhct-gemini-quota-v1';
const MODEL_CACHE_MS=7*24*60*60*1000;
const MAX_PER_MINUTE=5;
const MAX_PER_DAY=50;

type StoredKey={key:string;savedAt:string};
type StoredModel={name:string;savedAt:number};
type QuotaState={minuteStart:number;minuteCount:number;dayKey:string;dayCount:number};
export type GeminiStatus={configured:boolean;maskedKey:string;model:string|null;quota:{minute:number;day:number;minuteLimit:number;dayLimit:number}};
export class GeminiFallbackError extends Error{reason:'not_configured'|'quota'|'rate_limited'|'network'|'provider';constructor(reason:GeminiFallbackError['reason'],message:string){super(message);this.name='GeminiFallbackError';this.reason=reason}}

const safeJson=<T>(raw:string|null,fallback:T):T=>{try{return raw?JSON.parse(raw) as T:fallback}catch{return fallback}};
const dayKey=()=>new Date().toISOString().slice(0,10);
const defaultQuota=():QuotaState=>({minuteStart:Date.now(),minuteCount:0,dayKey:dayKey(),dayCount:0});
const session=()=>window.sessionStorage;
function purgeLegacySecret(){try{localStorage.removeItem(KEY_STORAGE);localStorage.removeItem(MODEL_STORAGE)}catch{}}
function readQuota(){const q=safeJson<QuotaState>(localStorage.getItem(QUOTA_STORAGE),defaultQuota()),now=Date.now(),today=dayKey();if(now-q.minuteStart>=60000){q.minuteStart=now;q.minuteCount=0}if(q.dayKey!==today){q.dayKey=today;q.dayCount=0}return q}
function saveQuota(q:QuotaState){localStorage.setItem(QUOTA_STORAGE,JSON.stringify(q))}
function consumeQuota(){const q=readQuota();if(q.minuteCount>=MAX_PER_MINUTE||q.dayCount>=MAX_PER_DAY)throw new GeminiFallbackError('quota',`Đã chạm giới hạn bảo vệ cục bộ (${MAX_PER_MINUTE}/phút, ${MAX_PER_DAY}/ngày). Trợ lý chuyển sang dữ liệu offline.`);q.minuteCount++;q.dayCount++;saveQuota(q);return q}
function getStoredKey(){purgeLegacySecret();return safeJson<StoredKey|null>(session().getItem(KEY_STORAGE),null)?.key?.trim()||''}
export function maskGeminiKey(key=getStoredKey()){return key?`••••••${key.slice(-4)}`:''}
export function saveGeminiKey(key:string){purgeLegacySecret();const clean=key.trim();if(!clean){session().removeItem(KEY_STORAGE);session().removeItem(MODEL_STORAGE);return}if(clean.length<20)throw new Error('API key không hợp lệ hoặc quá ngắn.');session().setItem(KEY_STORAGE,JSON.stringify({key:clean,savedAt:new Date().toISOString()} satisfies StoredKey));session().removeItem(MODEL_STORAGE)}
export function clearGeminiKey(){purgeLegacySecret();session().removeItem(KEY_STORAGE);session().removeItem(MODEL_STORAGE);localStorage.removeItem(QUOTA_STORAGE)}

async function fetchJson(url:string,init:RequestInit,key:string){
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(url,{...init,signal:controller.signal,headers:{Accept:'application/json','x-goog-api-key':key,...(init.headers||{})}});if(response.status===429)throw new GeminiFallbackError('rate_limited','Gemini báo 429 Too Many Requests; đã chuyển sang phản hồi offline.');if(!response.ok){const body=await response.text().catch(()=> '');throw new GeminiFallbackError('provider',`Gemini HTTP ${response.status}${body?`: ${body.slice(0,180)}`:''}`)}return await response.json()}catch(error){if(error instanceof GeminiFallbackError)throw error;if((error as Error)?.name==='AbortError')throw new GeminiFallbackError('network','Gemini hết thời gian chờ; dùng phản hồi offline.');throw new GeminiFallbackError('network','Không kết nối được Gemini; dùng phản hồi offline.')}finally{window.clearTimeout(timer)}
}

export async function discoverGeminiModel(force=false){
  const key=getStoredKey();if(!key)throw new GeminiFallbackError('not_configured','Chưa cấu hình Gemini BYOK.');
  const cached=safeJson<StoredModel|null>(session().getItem(MODEL_STORAGE),null);if(!force&&cached?.name&&Date.now()-cached.savedAt<MODEL_CACHE_MS)return cached.name;
  const json=await fetchJson('https://generativelanguage.googleapis.com/v1beta/models',{method:'GET'},key) as {models?:Array<{name?:string;supportedGenerationMethods?:string[]}>};
  const candidates=(json.models||[]).filter(m=>m.name&&m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name!.replace(/^models\//,''));
  const ranked=candidates.sort((a,b)=>{const af=/flash/i.test(a)?1:0,bf=/flash/i.test(b)?1:0;if(af!==bf)return bf-af;return b.localeCompare(a,undefined,{numeric:true})});
  const model=ranked[0];if(!model)throw new GeminiFallbackError('provider','Tài khoản Gemini không trả về model hỗ trợ generateContent.');
  session().setItem(MODEL_STORAGE,JSON.stringify({name:model,savedAt:Date.now()} satisfies StoredModel));return model;
}

export async function askGemini(prompt:string,systemContext='Bạn là trợ lý học thuật Y học cổ truyền. Chỉ hỗ trợ học tập, không chẩn đoán hay kê đơn. Khi dữ liệu không chắc chắn phải nói rõ giới hạn.'){
  const key=getStoredKey();if(!key)throw new GeminiFallbackError('not_configured','Chưa cấu hình Gemini BYOK.');
  const text=prompt.trim();if(!text)throw new Error('Nội dung trống.');consumeQuota();
  const model=await discoverGeminiModel();
  const json=await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system_instruction:{parts:[{text:systemContext}]},contents:[{role:'user',parts:[{text:text.slice(0,6000)}]}],generationConfig:{temperature:.35,maxOutputTokens:900}})},key) as {candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>;promptFeedback?:unknown};
  const output=json.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();if(!output)throw new GeminiFallbackError('provider','Gemini không trả về nội dung; dùng phản hồi offline.');return{model,text:output};
}

export function getGeminiStatus():GeminiStatus{
  purgeLegacySecret();const key=getStoredKey(),model=safeJson<StoredModel|null>(session().getItem(MODEL_STORAGE),null)?.name||null,q=readQuota();
  return{configured:Boolean(key),maskedKey:maskGeminiKey(key),model,quota:{minute:q.minuteCount,day:q.dayCount,minuteLimit:MAX_PER_MINUTE,dayLimit:MAX_PER_DAY}};
}
