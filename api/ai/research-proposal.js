import {cloudAiConfigured,cloudAiModel,memberAccess} from '../_lib/member-access.js';

const MAX_EVIDENCE=10,MAX_TEXT=4200,AI_TIMEOUT_MS=12000;
const clean=(v,max=1000)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const url=value=>{try{const u=new URL(clean(value,1200));return u.protocol==='https:'?u.toString():''}catch{return''}};
const FIELDS=['overview','significance','objectives','populationScope','location','mainContents','methods','expectedResults','reportOutline','assignments','progress','specialNeeds','references'];
const RESPONSE_SCHEMA={type:'object',properties:Object.fromEntries(FIELDS.map(k=>[k,{type:'string'}])),required:FIELDS,additionalProperties:false};

function normalizeEvidence(raw){
  if(!Array.isArray(raw))return[];
  return raw.slice(0,MAX_EVIDENCE).map((x,i)=>({id:`E${i+1}`,title:clean(x?.title,320),source:clean(x?.source,220),year:Number(x?.year)||null,abstract:clean(x?.abstract,1600),url:url(x?.url)})).filter(x=>x.title);
}
function extractOutputText(payload){
  if(typeof payload?.output_text==='string')return payload.output_text;
  const parts=[];for(const item of Array.isArray(payload?.output)?payload.output:[])for(const c of Array.isArray(item?.content)?item.content:[])if(typeof c?.text==='string')parts.push(c.text);return parts.join('').trim();
}
function localFallback(){return{provider:'local',degraded:true,draft:null,reason:'cloud_not_configured'}};

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const access=await memberAccess(req,'member');if(!access.ok)return res.status(access.status).json({error:access.error});
  const title=clean(req.body?.title,320),studyDesign=clean(req.body?.studyDesign,160),context=clean(req.body?.context,MAX_TEXT),evidence=normalizeEvidence(req.body?.evidence);
  if(title.length<5)return res.status(400).json({error:'Tên đề tài quá ngắn.'});
  if(!cloudAiConfigured())return res.status(200).json(localFallback());
  const model=cloudAiModel(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),AI_TIMEOUT_MS);
  try{
    const evidenceBlock=evidence.length?evidence.map(e=>`[${e.id}] ${e.title} | ${e.source}${e.year?` | ${e.year}`:''}${e.abstract?`\n${e.abstract}`:''}${e.url?`\n${e.url}`:''}`).join('\n\n'):'(Chưa có bằng chứng kèm theo)';
    const developer=[
      'Bạn là trợ lý phương pháp nghiên cứu Y học Cổ truyền cho sinh viên Trường Đại học Quốc tế Hồng Bàng.',
      'Soạn nội dung theo Mẫu 01-SV nhưng chỉ trả về JSON đúng schema.',
      'Không bịa tài liệu, số liệu, cỡ mẫu, công thức, cơ sở nghiên cứu, phê duyệt đạo đức hay kinh phí.',
      'Nếu thiếu dữ liệu thì ghi rõ nội dung cần người dùng/GVHD xác nhận thay vì tự điền.',
      'Tài liệu tham khảo chỉ được tạo từ evidence đã cung cấp, định dạng gần IEEE và giữ URL/DOI nếu có.',
      'Mục phương pháp phải phù hợp studyDesign; cỡ mẫu chỉ nêu yêu cầu tính bằng công thức phù hợp, không tự sinh số.',
      'Văn phong học thuật tiếng Việt, súc tích, khả thi cho đề tài sinh viên tối đa 12 tháng.'
    ].join(' ');
    const user=`TÊN ĐỀ TÀI: ${title}\nTHIẾT KẾ DỰ KIẾN: ${studyDesign||'Chưa xác định'}\nBỐI CẢNH DO THÀNH VIÊN CUNG CẤP: ${context||'(không có)'}\nBẰNG CHỨNG ĐƯỢC PHÉP DÙNG:\n${evidenceBlock}`;
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,max_output_tokens:2300,input:[{role:'developer',content:developer},{role:'user',content:user}],text:{format:{type:'json_schema',name:'hiu_research_proposal_v1',strict:true,schema:RESPONSE_SCHEMA}}})});
    if(!response.ok)throw new Error(`OpenAI ${response.status}`);
    const payload=await response.json(),parsed=JSON.parse(extractOutputText(payload)),draft={};for(const key of FIELDS)draft[key]=clean(parsed?.[key],7000);
    return res.status(200).json({provider:'openai',degraded:false,model,draft});
  }catch(error){console.warn('research-proposal-ai',String(error?.message||error));return res.status(200).json({...localFallback(),reason:error?.name==='AbortError'?'timeout':'provider_error'});}finally{clearTimeout(timer)}
}
