import {cloudAiEnabled,cloudAiModel,memberAccess} from '../_lib/member-access.js';
import {createGeminiJson,createGeminiWebSearch,geminiAiConfigured,geminiAiModel} from '../_lib/gemini-provider.js';

export const maxDuration=60;
const TIMEOUT_MS=24000;
const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const safeUrl=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'?url.toString():''}catch{return''}};
const failureClass=error=>{const text=String(error?.message||'');if(error?.name==='AbortError'||/timeout/i.test(text))return'timeout';if(/\b429\b/.test(text))return'rate_limit';if(/\b5\d\d\b/.test(text))return'provider_5xx';if(/401/.test(text))return'auth';if(/403/.test(text))return'access';if(/JSON|invalid|empty/i.test(text))return'invalid_response';return'provider_error'};

const quizSchema=count=>({type:'object',properties:{topic:{type:'string'},title:{type:'string'},questions:{type:'array',minItems:count,maxItems:count,items:{type:'object',properties:{stem:{type:'string'},options:{type:'array',minItems:4,maxItems:4,items:{type:'string'}},correctIndex:{type:'integer',minimum:0,maximum:3},explanation:{type:'string'}},required:['stem','options','correctIndex','explanation'],additionalProperties:false}}},required:['topic','title','questions'],additionalProperties:false});

function normalizeQuiz(raw,count){
  const parsed=typeof raw==='string'?JSON.parse(raw):raw;
  const questions=Array.isArray(parsed?.questions)?parsed.questions.map(question=>({
    stem:clean(question?.stem,1200),
    options:Array.isArray(question?.options)?question.options.map(x=>clean(x,700)).slice(0,4):[],
    correctIndex:Number(question?.correctIndex),
    explanation:clean(question?.explanation,1800)
  })).filter(question=>question.stem&&question.options.length===4&&question.options.every(Boolean)&&Number.isInteger(question.correctIndex)&&question.correctIndex>=0&&question.correctIndex<4&&question.explanation):[];
  if(questions.length!==count)throw new Error(`invalid_quiz_count:${questions.length}/${count}`);
  return{topic:clean(parsed?.topic,220),title:clean(parsed?.title,320)||'Đề ôn tập A.I',questions};
}

function extractOpenAiText(payload){
  if(typeof payload?.output_text==='string'&&payload.output_text.trim())return payload.output_text.trim();
  const parts=[];for(const item of Array.isArray(payload?.output)?payload.output:[])for(const block of Array.isArray(item?.content)?item.content:[])if(typeof block?.text==='string')parts.push(block.text);return parts.join('').trim();
}
function extractOpenAiSources(payload){
  const rows=[];
  for(const item of Array.isArray(payload?.output)?payload.output:[]){
    if(item?.type==='web_search_call')for(const source of Array.isArray(item?.action?.sources)?item.action.sources:[]){const url=safeUrl(source?.url);if(url)rows.push({title:clean(source?.title||url,260),url})}
    for(const block of Array.isArray(item?.content)?item.content:[])for(const annotation of Array.isArray(block?.annotations)?block.annotations:[]){const raw=annotation?.url_citation||annotation,url=safeUrl(raw?.url);if(url)rows.push({title:clean(raw?.title||url,260),url})}
  }
  return [...new Map(rows.map(x=>[x.url,x])).values()].slice(0,6);
}

const SYSTEM=[
  'Bạn là bộ tạo câu hỏi ôn tập y khoa cho sinh viên Y học cổ truyền HIU.',
  'Mỗi câu phải có đúng 4 lựa chọn, chỉ một đáp án đúng, giải thích ngắn gọn và không dùng dữ kiện bịa.',
  'Ưu tiên nguồn học thuật/y khoa công khai đáng tin cậy. Phân biệt kiến thức YHCT cổ điển với bằng chứng y sinh hiện đại; không biến lý luận YHCT thành kết luận điều trị đã được chứng minh.',
  'Không tạo câu hỏi chẩn đoán/kê đơn cá nhân hóa. Không sao chép nguyên văn dài từ nguồn.',
  'Trả JSON đúng schema, không thêm markdown.'
].join(' ');

async function runGemini(topic,count,signal){
  if(!geminiAiConfigured('default'))throw new Error('Gemini configuration missing');
  const research=await createGeminiWebSearch({mode:'default',signal,systemInstruction:SYSTEM,prompt:`Tìm nguồn công khai đủ để tạo ${count} câu trắc nghiệm về "${topic}". Ghi chú ngắn các điểm kiến thức có thể kiểm chứng; không tự tạo nguồn.`});
  const sources=Array.isArray(research.citations)?research.citations.filter(x=>safeUrl(x?.url)).slice(0,6):[];
  if(!sources.length)throw new Error('Gemini quiz has no grounded web source');
  const sourceList=sources.map((source,index)=>`[S${index+1}] ${source.title} — ${source.url}`).join('\n');
  const output=await createGeminiJson({mode:'default',signal,maxOutputTokens:4600,schema:quizSchema(count),systemInstruction:SYSTEM,prompt:`CHỦ ĐỀ: ${topic}\nSỐ CÂU: ${count}\nGHI CHÚ TRA CỨU CÓ NGUỒN:\n${clean(research.text,14000)}\nNGUỒN:\n${sourceList}\nTạo đúng ${count} câu. Không dùng kiến thức ngoài phạm vi các điểm đã tra cứu nếu đó là khẳng định thực nghiệm.`});
  return{...normalizeQuiz(output.text,count),sources,provider:'gemini-google-search',model:output.model||geminiAiModel('default')};
}

async function runOpenAi(topic,count,signal){
  const key=process.env.OPENAI_API_KEY,model=cloudAiModel();
  if(!cloudAiEnabled()||!key||!model)throw new Error('OpenAI fallback configuration missing');
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({
    model,store:false,max_output_tokens:4600,instructions:SYSTEM,
    input:`Tìm nguồn công khai phù hợp và tạo đúng ${count} câu trắc nghiệm về "${topic}". Mỗi câu phải dựa trên thông tin có thể kiểm chứng từ kết quả tìm kiếm.`,
    tools:[{type:'web_search_preview',search_context_size:'medium'}],tool_choice:'auto',include:['web_search_call.action.sources'],
    text:{format:{type:'json_schema',name:'yhct_study_quiz_v1',strict:true,schema:quizSchema(count)}}
  })});
  if(!response.ok){const detail=await response.json().catch(()=>null);throw new Error(`OpenAI ${response.status}: ${clean(detail?.error?.message||'provider error',180)}`)}
  const payload=await response.json(),sources=extractOpenAiSources(payload);if(!sources.length)throw new Error('OpenAI quiz has no grounded web source');
  return{...normalizeQuiz(extractOpenAiText(payload),count),sources,provider:'openai-web-fallback',model};
}

export default async function handler(req,res){
  const started=Date.now();res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const access=await memberAccess(req,'member');if(!access.ok)return res.status(access.status).json({error:access.error});
  const topic=clean(req.body?.topic||req.body?.query,220),count=Math.max(5,Math.min(20,Math.trunc(Number(req.body?.count)||10)));
  if(topic.length<2)return res.status(400).json({error:'Hãy nhập chủ đề muốn A.I tạo đề.'});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  let geminiFailure='';
  try{
    try{
      const quiz=await runGemini(topic,count,controller.signal),latencyMs=Date.now()-started;
      console.info(JSON.stringify({event:'study_quiz',ok:true,provider:quiz.provider,role:access.role,count,latencyMs}));
      res.setHeader('X-AI-Provider',quiz.provider);res.setHeader('X-AI-Degraded','0');return res.status(200).json({aiGenerated:true,...quiz,generatedAt:new Date().toISOString(),degraded:false,latencyMs});
    }catch(error){
      geminiFailure=failureClass(error);console.warn(JSON.stringify({event:'study_quiz',ok:false,provider:'gemini',role:access.role,count,latencyMs:Date.now()-started,failureClass:geminiFailure,failover:'openai-web'}));
      const quiz=await runOpenAi(topic,count,controller.signal),latencyMs=Date.now()-started;
      console.info(JSON.stringify({event:'study_quiz',ok:true,provider:quiz.provider,role:access.role,count,latencyMs,failoverFrom:geminiFailure}));
      res.setHeader('X-AI-Provider',quiz.provider);res.setHeader('X-AI-Degraded','0');res.setHeader('X-AI-Failover','gemini');return res.status(200).json({aiGenerated:true,...quiz,generatedAt:new Date().toISOString(),degraded:false,latencyMs,failoverFrom:geminiFailure});
    }
  }catch(error){
    const finalFailure=failureClass(error);console.warn(JSON.stringify({event:'study_quiz',ok:false,provider:'all',role:access.role,count,latencyMs:Date.now()-started,failureClass:finalFailure,geminiFailure}));
    res.setHeader('X-AI-Degraded','1');return res.status(error?.name==='AbortError'?504:503).json({error:'A.I tạo đề tạm thời chưa truy xuất được nguồn công khai. Hãy thử lại sau hoặc chọn Đề HIU đã duyệt.'});
  }finally{clearTimeout(timer)}
}
