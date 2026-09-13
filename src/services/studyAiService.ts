import {ensureActive,requestDeadline} from './aiRequest';
import {supabase} from './authService';

export type StudyAiSource={title:string;url:string};
export type StudyAiReply={answer:string;sources:StudyAiSource[];provider:string;degraded:boolean;route?:'research'|null;latencyMs:number};

export async function askStudyGemini(query:string,conversationContext='',pageContext='',signal?:AbortSignal):Promise<StudyAiReply>{
  const {data}=await supabase.auth.getSession(),token=data.session?.access_token;
  if(!token)throw new Error('Hãy đăng nhập thành viên để dùng AI Study OS.');
  ensureActive(signal);
  const deadline=requestDeadline(45000,signal);
  try{
    const response=await fetch('/api/ai/study-assistant',{
      method:'POST',
      signal:deadline.signal,
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({query,conversationContext,pageContext})
    });
    const payload=await response.json().catch(()=>null) as Partial<StudyAiReply>&{error?:string}|null;
    if(!response.ok)throw new Error(payload?.error||`Gemini Study lỗi ${response.status}`);
    return{
      answer:String(payload?.answer||'Gemini Study chưa có câu trả lời.'),
      sources:Array.isArray(payload?.sources)?payload!.sources!.filter(source=>source&&typeof source.url==='string'&&source.url.startsWith('https://')).slice(0,6):[],
      provider:String(payload?.provider||'gemini'),
      degraded:Boolean(payload?.degraded),
      route:payload?.route==='research'?'research':null,
      latencyMs:Number(payload?.latencyMs||0)
    };
  }finally{deadline.dispose()}
}
