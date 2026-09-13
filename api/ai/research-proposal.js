import {memberAccess,memberRpc} from '../_lib/member-access.js';
import {createGeminiJson,geminiAiConfigured,geminiAiModel} from '../_lib/gemini-provider.js';

const MAX_EVIDENCE=10,MAX_TEXT=4200,AI_TIMEOUT_MS=22000;
const clean=(v,max=1000)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const url=value=>{try{const u=new URL(clean(value,1200));return u.protocol==='https:'?u.toString():''}catch{return''}};
const FIELDS=['overview','significance','objectives','populationScope','location','mainContents','methods','expectedResults','reportOutline','assignments','progress','specialNeeds','references'];
const RESPONSE_SCHEMA={type:'object',properties:Object.fromEntries(FIELDS.map(k=>[k,{type:'string'}])),required:FIELDS,additionalProperties:false};

function normalizeEvidence(raw){
  if(!Array.isArray(raw))return[];
  return raw.slice(0,MAX_EVIDENCE).map((x,i)=>({id:`E${i+1}`,title:clean(x?.title,320),source:clean(x?.source,220),year:Number(x?.year)||null,abstract:clean(x?.abstract,1800),url:url(x?.url)})).filter(x=>x.title);
}

async function quota(req,consume=false){return memberRpc(req,'research_proposal_quota_v1',{p_consume:consume})}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Authorization');
  if(req.method!=='GET'&&req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const access=await memberAccess(req,'member');if(!access.ok)return res.status(access.status).json({error:access.error});

  if(req.method==='GET'){
    try{return res.status(200).json({provider:'gemini',configured:geminiAiConfigured('research'),quota:await quota(req,false)})}
    catch(error){return res.status(400).json({error:clean(error?.message||'Không đọc được hạn mức Gemini.',300)})}
  }

  const title=clean(req.body?.title,320),studyDesign=clean(req.body?.studyDesign,160),context=clean(req.body?.context,MAX_TEXT),evidence=normalizeEvidence(req.body?.evidence);
  if(title.length<5)return res.status(400).json({error:'Tên đề tài quá ngắn.'});
  if(!geminiAiConfigured('research'))return res.status(503).json({error:'Gemini Research chưa được cấu hình. Không tạo bản nháp local thay thế.'});

  let usage;
  try{usage=await quota(req,true)}catch(error){return res.status(400).json({error:clean(error?.message||'Không kiểm tra được hạn mức Gemini.',300)})}
  if(usage?.allowed===false)return res.status(429).json({error:'Bạn đã dùng đủ 3 lượt tạo đề cương Gemini trong chu kỳ 6 giờ.',quota:usage});

  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),AI_TIMEOUT_MS);
  try{
    const evidenceBlock=evidence.length?evidence.map(e=>`[${e.id}] ${e.title} | ${e.source}${e.year?` | ${e.year}`:''}${e.abstract?`\n${e.abstract}`:''}${e.url?`\n${e.url}`:''}`).join('\n\n'):'(Chưa có bằng chứng kèm theo)';
    const systemInstruction=[
      'Bạn là Gemini Research Methodologist của Trung tâm Nghiên cứu Y Dược cổ truyền HIU 4.0.',
      'Nhiệm vụ là soạn đề cương nghiên cứu y học cho sinh viên theo Mẫu 01-SV, có tư duy phương pháp học và y học chứng cứ; chỉ trả JSON đúng schema.',
      'Phân biệt rõ YHCT cổ điển, giả thuyết sinh học và bằng chứng lâm sàng hiện đại. Không biến lý luận YHCT thành kết luận hiệu quả điều trị nếu evidence không chứng minh.',
      'Không bịa tài liệu, PMID, DOI, số liệu, cỡ mẫu, công thức, địa điểm, cơ sở nghiên cứu, phê duyệt đạo đức, kinh phí hoặc kết quả.',
      'Nếu thiếu dữ liệu bắt buộc, ghi rõ [CẦN XÁC NHẬN VỚI GVHD] tại đúng mục thay vì tự điền.',
      'Mục tiêu phải đo lường được; thiết kế, đối tượng, biến số, thu thập dữ liệu và phân tích phải nhất quán. Với systematic/scoping review phải nêu khung câu hỏi, nguồn tìm kiếm, tiêu chí chọn, sàng lọc và tổng hợp. Với nghiên cứu quan sát/can thiệp phải nêu biến chính, sai lệch và kế hoạch phân tích phù hợp.',
      'Tài liệu tham khảo chỉ được tạo từ EVIDENCE đã cung cấp và phải giữ URL nguồn; tuyệt đối không tự sinh citation.',
      'Văn phong học thuật tiếng Việt, cụ thể, khả thi cho đề tài sinh viên tối đa 12 tháng; không viết câu sáo rỗng.'
    ].join(' ');
    const prompt=`TÊN ĐỀ TÀI: ${title}\nTHIẾT KẾ DỰ KIẾN: ${studyDesign||'Chưa xác định'}\nBỐI CẢNH/THÔNG TIN NGƯỜI DÙNG: ${context||'(không có)'}\nEVIDENCE ĐƯỢC PHÉP DÙNG:\n${evidenceBlock}`;
    const output=await createGeminiJson({mode:'research',signal:controller.signal,maxOutputTokens:4200,schema:RESPONSE_SCHEMA,systemInstruction,prompt});
    const parsed=JSON.parse(output.text),draft={};for(const key of FIELDS)draft[key]=clean(parsed?.[key],7000);
    return res.status(200).json({provider:'gemini',degraded:false,model:output.model||geminiAiModel('research'),draft,quota:usage});
  }catch(error){
    console.warn('research-proposal-gemini',String(error?.message||error));
    return res.status(error?.name==='AbortError'?504:502).json({error:error?.name==='AbortError'?'Gemini Research quá thời gian chờ. Lượt đã được ghi nhận vì yêu cầu đã gửi tới mô hình.':'Gemini Research chưa tạo được đề cương. Không dùng bản nháp local thay thế.',quota:usage});
  }finally{clearTimeout(timer)}
}
