import {ensureActive,requestDeadline} from './aiRequest';
import {supabase} from './authService';

export type StudyAiSource={title:string;url:string};
export type StudyAiReply={answer:string;sources:StudyAiSource[];provider:string;degraded:boolean;route?:'research'|null;latencyMs:number};
type GatewayCitation={label?:string;url?:string|null};
type GatewayReply={answer?:string;citations?:GatewayCitation[];provider?:string;degraded?:boolean;latencyMs?:number;error?:string};
const researchIntent=/\b(pubmed|openalex|doi|pmid|systematic|meta[- ]?analysis|clinical trials?|rct|cohort|case[- ]?control|guideline|evidence)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|tổng\s*quan\s*hệ\s*thống|thử\s*nghiệm\s*lâm\s*sàng|bằng\s*chứng|trích\s*dẫn|tài\s*liệu\s*tham\s*khảo|đề\s*cương\s*nghiên\s*cứu/i;
const clean=(value:string,max:number)=>value.replace(/\s+/g,' ').trim().slice(0,max);

export async function askStudyGemini(query:string,conversationContext='',pageContext='',signal?:AbortSignal):Promise<StudyAiReply>{
  const question=clean(query,2200);
  if(researchIntent.test(question))return{answer:'Câu hỏi này cần chế độ Research A.I để kiểm chứng nguồn học thuật sâu hơn.',sources:[],provider:'router',degraded:false,route:'research',latencyMs:0};
  const {data}=await supabase.auth.getSession(),token=data.session?.access_token;
  if(!token)throw new Error('Hãy đăng nhập thành viên để dùng AI Study OS.');
  ensureActive(signal);
  const context=clean(conversationContext,1200),page=clean(pageContext,220);
  const contextualQuery=[
    `CÂU HỎI HIỆN TẠI: ${question}`,
    context?`NGỮ CẢNH HỘI THOẠI GẦN NHẤT (chỉ để hiểu mạch câu hỏi, không xem là bằng chứng): ${context}`:'',
    page?`KHU VỰC ỨNG DỤNG HIỆN TẠI: ${page}`:'',
    'Trả lời trực tiếp câu hỏi hiện tại bằng tiếng Việt, ưu tiên kết luận ngắn → giải thích cốt lõi → mẹo nhớ hoặc ví dụ khi hữu ích. Không suy đoán dữ liệu cá nhân hay tài liệu Drive.'
  ].filter(Boolean).join('\n\n');
  const deadline=requestDeadline(45000,signal);
  try{
    const response=await fetch('/api/ai/assistant',{
      method:'POST',
      signal:deadline.signal,
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
      body:JSON.stringify({query:contextualQuery,mode:'fast',sources:[]})
    });
    const payload=await response.json().catch(()=>null) as GatewayReply|null;
    if(!response.ok)throw new Error(payload?.error||`Gemini Study lỗi ${response.status}`);
    const sources=(Array.isArray(payload?.citations)?payload!.citations!:[]).flatMap(source=>{
      const url=typeof source?.url==='string'?source.url:'';
      if(!url.startsWith('https://'))return[];
      return[{title:String(source?.label||'Nguồn tham khảo'),url}];
    }).slice(0,6);
    return{
      answer:String(payload?.answer||'Gemini Study chưa có câu trả lời.'),
      sources,
      provider:String(payload?.provider||'gemini'),
      degraded:Boolean(payload?.degraded),
      route:null,
      latencyMs:Number(payload?.latencyMs||0)
    };
  }finally{deadline.dispose()}
}
