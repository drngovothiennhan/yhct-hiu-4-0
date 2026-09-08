import {supabase} from './authService';

export type AiMode='fast'|'research'|'exam';
export type AiSource={id:string;title:string;text:string;url?:string|null};
export type AiCitation={id:string;label:string;url:string|null};
export type AiRuntimeAnswer={answer:string;citations:AiCitation[];confidence:'high'|'medium'|'low';safety:'educational'|'needs_source_check'|'refuse_clinical_advice';suggestedQueries:string[];provider:'openai'|'local';degraded:boolean;latencyMs:number;toolsUsed:string[]};
export class AiRuntimeError extends Error{constructor(public kind:'auth'|'timeout'|'network'|'invalid',message:string){super(message);this.name='AiRuntimeError'}}

const TIMEOUT_MS=11000;
const safe=(value:unknown,max=7000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const validSafety=new Set(['educational','needs_source_check','refuse_clinical_advice']);
const validConfidence=new Set(['high','medium','low']);

function normalizeAnswer(value:unknown):AiRuntimeAnswer{
  if(!value||typeof value!=='object')throw new AiRuntimeError('invalid','A.I gateway trả về dữ liệu không hợp lệ.');
  const x=value as Record<string,unknown>,answer=safe(x.answer);
  if(!answer)throw new AiRuntimeError('invalid','A.I gateway không trả về câu trả lời.');
  const citations=Array.isArray(x.citations)?x.citations.slice(0,6).map(item=>{const c=(item||{}) as Record<string,unknown>;return{id:safe(c.id,120),label:safe(c.label,240),url:c.url?safe(c.url,1200):null}}).filter(c=>c.id&&c.label):[];
  const confidence=validConfidence.has(String(x.confidence))?String(x.confidence) as AiRuntimeAnswer['confidence']:'low';
  const safety=validSafety.has(String(x.safety))?String(x.safety) as AiRuntimeAnswer['safety']:'needs_source_check';
  const provider=x.provider==='openai'?'openai':'local';
  const suggestedQueries=Array.isArray(x.suggestedQueries)?x.suggestedQueries.map(v=>safe(v,180)).filter(Boolean).slice(0,3):[];
  const toolsUsed=Array.isArray(x.toolsUsed)?[...new Set(x.toolsUsed.map(v=>safe(v,80)).filter(Boolean))].slice(0,6):[];
  return{answer,citations,confidence,safety,suggestedQueries,provider,degraded:Boolean(x.degraded),latencyMs:Number.isFinite(Number(x.latencyMs))?Number(x.latencyMs):0,toolsUsed};
}

export async function askServerAi(query:string,mode:AiMode='fast',sources:AiSource[]=[]):Promise<AiRuntimeAnswer>{
  const text=safe(query,4000);if(text.length<2)throw new AiRuntimeError('invalid','Câu hỏi quá ngắn.');
  const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new AiRuntimeError('auth','Đăng nhập thành viên để dùng A.I cloud; tra cứu cục bộ vẫn hoạt động.');
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch('/api/ai/assistant',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({query:text,mode,sources:sources.slice(0,6).map(s=>({id:safe(s.id,120),title:safe(s.title,240),text:safe(s.text,4200),url:s.url?safe(s.url,1200):null}))})});
    if(response.status===401||response.status===403)throw new AiRuntimeError('auth','Phiên đăng nhập không đủ quyền dùng A.I cloud.');
    if(!response.ok)throw new AiRuntimeError('network',`A.I gateway lỗi ${response.status}.`);
    return normalizeAnswer(await response.json());
  }catch(error){
    if(error instanceof AiRuntimeError)throw error;
    if((error as Error)?.name==='AbortError')throw new AiRuntimeError('timeout','A.I cloud quá thời gian chờ; hệ thống đã chuyển sang chế độ cục bộ.');
    throw new AiRuntimeError('network','Không kết nối được A.I cloud; hệ thống đã chuyển sang chế độ cục bộ.');
  }finally{window.clearTimeout(timer)}
}

export function renderAiAnswer(result:AiRuntimeAnswer){
  const sourceLine=result.citations.length?`\n\nNguồn: ${result.citations.map((c,i)=>`[${i+1}] ${c.label}`).join(' · ')}`:'';
  const toolLine=result.toolsUsed.length?`\n\nDữ liệu hệ thống: ${result.toolsUsed.join(', ')}`:'';
  const safetyLine=result.safety==='refuse_clinical_advice'?'\n\nLưu ý: nội dung chỉ phục vụ học tập, không thay thế thăm khám/chẩn đoán/kê đơn.':result.safety==='needs_source_check'?'\n\nLưu ý: cần kiểm tra thêm nguồn chuyên môn trước khi áp dụng.':'';
  return`${result.answer}${sourceLine}${toolLine}${safetyLine}`;
}
