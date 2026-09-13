import {memberAccess} from './member-access.js';
import {createGeminiText,createGeminiWebSearch,geminiAiConfigured,geminiAiModel} from './gemini-provider.js';

const TIMEOUT_MS=20000;
const MAX_QUERY=2200;
const MAX_CONTEXT=6500;
const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const researchIntent=value=>/\b(pubmed|openalex|doi|pmid|systematic|meta[- ]?analysis|clinical trials?|rct|cohort|case[- ]?control|guideline|evidence)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|tổng\s*quan\s*hệ\s*thống|thử\s*nghiệm\s*lâm\s*sàng|bằng\s*chứng|trích\s*dẫn|tài\s*liệu\s*tham\s*khảo|đề\s*cương\s*nghiên\s*cứu/i.test(clean(value,MAX_QUERY));

export async function handleStudyAssistant(req,res){
  const started=Date.now();
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const access=await memberAccess(req,'member');
  if(!access.ok)return res.status(access.status).json({error:access.error});

  const query=clean(req.body?.query,MAX_QUERY),conversationContext=clean(req.body?.conversationContext,MAX_CONTEXT),pageContext=clean(req.body?.pageContext,600);
  if(query.length<2)return res.status(400).json({error:'Query is required'});
  if(researchIntent(query))return res.status(200).json({answer:'Câu hỏi này cần chế độ Research A.I để kiểm chứng nguồn học thuật sâu hơn.',sources:[],provider:'router',degraded:false,route:'research',latencyMs:Date.now()-started});
  if(!geminiAiConfigured('default'))return res.status(503).json({error:'Gemini Study chưa được cấu hình trên máy chủ.'});

  const instructions=[
    'Bạn là Gemini Study, trợ lý học tập chính của HIU YHCT 4.0 dành cho sinh viên Y học cổ truyền.',
    'Mục tiêu là hiểu đúng câu hỏi hiện tại, trả lời sát ngữ cảnh, ngắn gọn nhưng đủ ý và ưu tiên cách trình bày giúp học nhanh.',
    'CONVERSATION_CONTEXT chỉ dùng để hiểu đại từ, chủ đề đang học và mạch hội thoại; không coi lịch sử trả lời AI là bằng chứng sự thật.',
    'PAGE_CONTEXT chỉ cho biết người dùng đang ở khu vực nào của ứng dụng; không được suy đoán dữ liệu cá nhân hay dữ liệu Drive.',
    'Nếu câu hỏi là kiến thức học tập, ưu tiên cấu trúc: kết luận ngắn → giải thích cốt lõi → mẹo nhớ hoặc ví dụ khi hữu ích.',
    'Nếu người dùng yêu cầu so sánh, trình bày khác biệt theo tiêu chí rõ ràng. Nếu yêu cầu ôn tập/quiz, tạo câu hỏi có đáp án và giải thích ngắn.',
    'Không chẩn đoán, kê đơn hay thay thế bác sĩ. Với nội dung lâm sàng cá nhân hóa, chuyển sang giải thích học thuật an toàn.',
    'Khi dùng Google Search, chỉ nêu nguồn thực sự tìm thấy; không bịa URL. Nếu nguồn mâu thuẫn hoặc chưa chắc chắn, nói rõ giới hạn.',
    'Trả lời bằng tiếng Việt tự nhiên, tránh văn phong máy móc, tránh lặp lại câu hỏi và tránh markdown phức tạp.'
  ].join(' ');
  const prompt=`CÂU HỎI HIỆN TẠI: ${query}\n\nCONVERSATION_CONTEXT: ${conversationContext||'không có'}\n\nPAGE_CONTEXT: ${pageContext||'không rõ'}\n\nHãy trả lời trực tiếp câu hỏi hiện tại và chỉ dùng ngữ cảnh trước đó khi thực sự liên quan.`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    try{
      const output=await createGeminiWebSearch({systemInstruction:instructions,prompt,signal:controller.signal,mode:'default'});
      const latencyMs=Date.now()-started;
      res.setHeader('Server-Timing',`study-ai;dur=${latencyMs}`);
      res.setHeader('X-AI-Provider','gemini-web');
      res.setHeader('X-AI-Model',output.model||geminiAiModel());
      return res.status(200).json({answer:clean(output.text,7000),sources:Array.isArray(output.citations)?output.citations.slice(0,6):[],provider:'gemini-web',degraded:false,route:null,latencyMs});
    }catch(primaryError){
      if(controller.signal.aborted)throw primaryError;
      const fallback=await createGeminiText({systemInstruction:instructions,prompt,maxOutputTokens:1800,signal:controller.signal,mode:'default'});
      const latencyMs=Date.now()-started;
      res.setHeader('Server-Timing',`study-ai;dur=${latencyMs}`);
      res.setHeader('X-AI-Provider','gemini');
      res.setHeader('X-AI-Model',fallback.model||geminiAiModel());
      return res.status(200).json({answer:clean(fallback.text,7000),sources:[],provider:'gemini',degraded:true,route:null,latencyMs});
    }
  }catch(error){
    const latencyMs=Date.now()-started;
    console.warn(JSON.stringify({event:'gemini_study',ok:false,latencyMs,error:clean(error?.message||'provider error',180)}));
    return res.status(error?.name==='AbortError'?504:502).json({error:error?.name==='AbortError'?'Gemini Study quá thời gian phản hồi.':'Gemini Study tạm thời chưa phản hồi. Vui lòng thử lại.'});
  }finally{clearTimeout(timer)}
}
