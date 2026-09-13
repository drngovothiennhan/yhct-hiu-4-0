import {ensureActive,requestDeadline} from './aiRequest';
import {supabase} from './authService';

export type StudyAiSource={title:string;url:string};
export type StudyAiReply={answer:string;sources:StudyAiSource[];provider:string;degraded:boolean;route?:'research'|null;latencyMs:number};
export type StudyAiQuizQuestion={stem:string;options:string[];correctIndex:number;explanation:string};
export type StudyAiQuiz={aiGenerated:true;topic:string;title:string;questions:StudyAiQuizQuestion[];sources:StudyAiSource[];provider:string;degraded:boolean;generatedAt:string;latencyMs:number};

async function memberToken(){
  const {data}=await supabase.auth.getSession(),token=data.session?.access_token;
  if(!token)throw new Error('Hãy đăng nhập thành viên để dùng AI Study OS.');
  return token;
}

export async function askStudyGemini(query:string,conversationContext='',pageContext='',signal?:AbortSignal):Promise<StudyAiReply>{
  const token=await memberToken();
  ensureActive(signal);
  const deadline=requestDeadline(45000,signal);
  try{
    const response=await fetch('/api/ai/assistant',{
      method:'POST',
      signal:deadline.signal,
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({mode:'study',query,conversationContext,pageContext})
    });
    const payload=await response.json().catch(()=>null) as Partial<StudyAiReply>&{error?:string}|null;
    if(!response.ok)throw new Error(payload?.error||`Gemini Study lỗi ${response.status}`);
    return{
      answer:String(payload?.answer||'Gemini Study chưa có câu trả lời.'),
      sources:Array.isArray(payload?.sources)?payload.sources.filter(source=>source&&typeof source.url==='string'&&source.url.startsWith('https://')).slice(0,6):[],
      provider:String(payload?.provider||'gemini'),
      degraded:Boolean(payload?.degraded),
      route:payload?.route==='research'?'research':null,
      latencyMs:Number(payload?.latencyMs||0)
    };
  }finally{deadline.dispose()}
}

export async function generateStudyGeminiQuiz(topic:string,count:number,signal?:AbortSignal):Promise<StudyAiQuiz>{
  const cleanTopic=String(topic||'').replace(/\s+/g,' ').trim().slice(0,220);
  if(cleanTopic.length<2)throw new Error('Hãy nhập chủ đề muốn Gemini tạo đề.');
  const requested=Math.max(5,Math.min(20,Math.trunc(Number(count)||10)));
  const token=await memberToken();
  ensureActive(signal);
  const deadline=requestDeadline(45000,signal);
  try{
    const response=await fetch('/api/ai/assistant',{
      method:'POST',
      signal:deadline.signal,
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({mode:'study',task:'quiz',query:cleanTopic,count:requested})
    });
    const payload=await response.json().catch(()=>null) as Partial<StudyAiQuiz>&{error?:string}|null;
    if(!response.ok)throw new Error(payload?.error||`Gemini tạo đề lỗi ${response.status}`);
    const questions=Array.isArray(payload?.questions)?payload.questions.filter(question=>{
      const correct=Number(question?.correctIndex);
      return Boolean(question&&typeof question.stem==='string'&&Array.isArray(question.options)&&question.options.length===4&&Number.isInteger(correct)&&correct>=0&&correct<4&&typeof question.explanation==='string');
    }).slice(0,requested):[];
    if(!questions.length)throw new Error('Gemini chưa tạo được câu hỏi hợp lệ. Vui lòng thử lại.');
    const sources=Array.isArray(payload?.sources)?payload.sources.filter(source=>source&&typeof source.url==='string'&&source.url.startsWith('https://')).slice(0,6):[];
    if(!sources.length)throw new Error('Đề A.I chưa có nguồn web xác minh nên không được phát hành.');
    return{
      aiGenerated:true,
      topic:String(payload?.topic||cleanTopic),
      title:String(payload?.title||'Đề ôn tập do Gemini tạo'),
      questions,
      sources,
      provider:String(payload?.provider||'gemini-web'),
      degraded:Boolean(payload?.degraded),
      generatedAt:String(payload?.generatedAt||new Date().toISOString()),
      latencyMs:Number(payload?.latencyMs||0)
    };
  }finally{deadline.dispose()}
}
