import {requestDeadline,ensureActive} from './aiRequest';
import {supabase} from './authService';

export type XiaoZhiSource={title:string;url:string};
export type XiaoZhiReply={answer:string;sources:XiaoZhiSource[];provider:string;degraded:boolean;route?:'research'|null;latencyMs:number};

export async function askXiaoZhiMini(query:string,localContext='',signal?:AbortSignal):Promise<XiaoZhiReply>{
  const {data}=await supabase.auth.getSession(),token=data.session?.access_token;
  if(!token)throw new Error('Hãy đăng nhập thành viên để dùng A.I Mini.');
  ensureActive(signal);const deadline=requestDeadline(45000,signal);
  try{const response=await fetch('/api/ai/assistant',{method:'POST',signal:deadline.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({mode:'xiaozhi-mini',query,localContext,pageContext:`${location.pathname}${location.search}`})});
  const payload=await response.json().catch(()=>null) as Partial<XiaoZhiReply>&{error?:string}|null;
  if(!response.ok)throw new Error(payload?.error||`A.I Mini lỗi ${response.status}`);
  return{answer:String(payload?.answer||'A.I Mini chưa có câu trả lời.'),sources:Array.isArray(payload?.sources)?payload!.sources!.filter(x=>x&&typeof x.url==='string').slice(0,6):[],provider:String(payload?.provider||'unknown'),degraded:Boolean(payload?.degraded),route:payload?.route==='research'?'research':null,latencyMs:Number(payload?.latencyMs||0)};
  }finally{deadline.dispose()}
}
