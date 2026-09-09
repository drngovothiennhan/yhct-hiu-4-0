import {cloudAiEnabled,cloudAiModel,memberAccess} from './member-access.js';

const TIMEOUT_MS=20000;
const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const safeUrl=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'?url.toString():''}catch{return''}};
function extractText(payload){if(typeof payload?.output_text==='string'&&payload.output_text.trim())return payload.output_text.trim();const parts=[];for(const item of Array.isArray(payload?.output)?payload.output:[])for(const content of Array.isArray(item?.content)?item.content:[])if(typeof content?.text==='string')parts.push(content.text);return parts.join('\n').trim()}
function extractSources(payload){const found=[];for(const item of Array.isArray(payload?.output)?payload.output:[]){for(const content of Array.isArray(item?.content)?item.content:[]){for(const ann of Array.isArray(content?.annotations)?content.annotations:[]){const raw=ann?.url_citation||ann;const url=safeUrl(raw?.url);if(url)found.push({title:clean(raw?.title||url,220),url})}}if(item?.type==='web_search_call'){for(const source of Array.isArray(item?.action?.sources)?item.action.sources:[]){const url=safeUrl(source?.url);if(url)found.push({title:clean(source?.title||url,220),url})}}}return [...new Map(found.map(x=>[x.url,x])).values()].slice(0,6)}
const academic=/\b(pubmed|openalex|doi|systematic review|meta[- ]?analysis|clinical trial)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|phương\s*tễ|huyệt\s*vị|dược\s*lý|cơ\s*chế\s*bệnh|chẩn\s*đoán\s*lâm\s*sàng|kê\s*đơn|điều\s*trị\s*bệnh/i;

export async function handleXiaoZhiMini(req,res){
  const started=Date.now();res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const access=await memberAccess(req,'member');if(!access.ok)return res.status(access.status).json({error:access.error});
  const query=clean(req.body?.query,1600),pageContext=clean(req.body?.pageContext,1600),localContext=clean(req.body?.localContext,5000);
  if(query.length<2)return res.status(400).json({error:'Query is required'});
  if(academic.test(query))return res.status(200).json({answer:'Nội dung này thuộc nhóm học thuật/chuyên môn. A.I Mini đã tách khỏi chức năng học thuật; hãy mở Trung tâm nghiên cứu để sử dụng A.I nghiên cứu có nguồn.',sources:[],provider:'policy-router',degraded:false,route:'research',latencyMs:Date.now()-started});
  const key=process.env.OPENAI_API_KEY,model=cloudAiModel();
  if(!cloudAiEnabled()||!key||!model)return res.status(200).json({answer:'A.I Mini đang ở chế độ cục bộ. Tôi vẫn có thể hỗ trợ điểm hoạt động, lịch CLB và điều hướng hệ thống; tra cứu web tạm thời chưa sẵn sàng.',sources:[],provider:'local',degraded:true,latencyMs:Date.now()-started});
  const instructions=[
    'Bạn là A.I Mini của mạng xã hội HIU YHCT 4.0, lớp tương tác giọng nói và công cụ theo phong cách XiaoZhi.',
    'Bạn được phép trả lời rộng về thông tin công khai ngoài hệ thống: tin tức, công nghệ, giáo dục, văn hóa, đời sống, giao thông, thời tiết, thể thao, sự kiện và kiến thức phổ thông khi phù hợp.',
    'Khi câu hỏi phụ thuộc thông tin mới, đang thay đổi hoặc nguồn bên ngoài, phải ưu tiên web search; trả lời ngắn gọn và giữ các URL nguồn hợp lệ để giao diện hiển thị.',
    'Vai trò nội bộ gồm lịch CLB, điểm hoạt động khi có context và hướng dẫn tính năng mạng xã hội.',
    'KHÔNG trả lời nội dung học thuật/chuyên môn Y học cổ truyền, chẩn đoán, điều trị, kê đơn hoặc nghiên cứu y khoa; với nhóm này chỉ hướng người dùng sang Trung tâm nghiên cứu.',
    'Không bịa dữ liệu cá nhân. Chỉ sử dụng dữ liệu nội bộ có trong LOCAL_CONTEXT.',
    'Trả lời tiếng Việt tự nhiên, súc tích, phù hợp để đọc thành tiếng; không dùng markdown phức tạp.'
  ].join(' ');
  const input=`CÂU HỎI: ${query}\nTRANG HIỆN TẠI: ${pageContext||'không rõ'}\nLOCAL_CONTEXT: ${localContext||'không có'}\nHãy trả lời trực tiếp.`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,max_output_tokens:1100,instructions,input,tools:[{type:'web_search_preview',search_context_size:'low'}],tool_choice:'auto',include:['web_search_call.action.sources']})});
    if(!response.ok){const detail=await response.json().catch(()=>null);throw new Error(`AI ${response.status}: ${clean(detail?.error?.message||'provider error',160)}`)}
    const payload=await response.json(),answer=clean(extractText(payload),6500);if(!answer)throw new Error('AI returned an empty answer');
    const sources=extractSources(payload),latencyMs=Date.now()-started;res.setHeader('Server-Timing',`xiaozhi;dur=${latencyMs}`);res.setHeader('X-AI-Provider','openai-web');
    return res.status(200).json({answer,sources,provider:'openai-web',degraded:false,route:null,latencyMs});
  }catch(error){const latencyMs=Date.now()-started;console.warn(JSON.stringify({event:'xiaozhi_mini',ok:false,role:access.role,latencyMs,error:clean(error?.message,180)}));return res.status(200).json({answer:'Tôi chưa kết nối được nguồn bên ngoài lúc này. Các chức năng nội bộ như điểm hoạt động, lịch CLB và điều hướng ứng dụng vẫn dùng được.',sources:[],provider:'local',degraded:true,latencyMs})}finally{clearTimeout(timer)}
}
