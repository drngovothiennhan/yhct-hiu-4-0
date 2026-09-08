import {cloudAiEnabled,cloudAiModel,memberAccess} from '../_lib/member-access.js';
import {aiToolsForRole,executeAiTool} from '../_lib/ai-tools.js';

const MAX_QUERY=4000;
const MAX_SOURCES=6;
const MAX_SOURCE_TEXT=4200;
const AI_TIMEOUT_MS=9500;
const MAX_TOOL_ROUNDS=2;
const MAX_TOOL_CALLS_PER_ROUND=3;
const MODES=new Set(['fast','research','exam']);
const CONFIDENCE=new Set(['high','medium','low']);
const SAFETY=new Set(['educational','needs_source_check','refuse_clinical_advice']);

const clean=(value,max=1000)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const safeUrl=value=>{const raw=clean(value,1200);if(!raw)return'';try{const url=new URL(raw);return url.protocol==='https:'?url.toString():''}catch{return''}};
const sourceId=value=>clean(value,120).replace(/[^a-zA-Z0-9:_./-]/g,'-');

function normalizeSources(raw){
  if(!Array.isArray(raw))return[];
  const seen=new Set(),out=[];
  for(const item of raw.slice(0,MAX_SOURCES)){
    const id=sourceId(item?.id);if(!id||seen.has(id))continue;seen.add(id);
    const title=clean(item?.title,240),text=clean(item?.text,MAX_SOURCE_TEXT),url=safeUrl(item?.url);
    if(!title||!text)continue;
    out.push({id,title,text,url});
  }
  return out;
}

function fallback(query,sources){
  const sourceNote=sources.length?` Có ${sources.length} nguồn đã được cung cấp nhưng cloud AI hiện không khả dụng.`:' Chưa có nguồn đã kiểm chứng đi kèm.';
  return{answer:`A.I cloud hiện không khả dụng.${sourceNote} Hệ thống giữ chế độ an toàn: tiếp tục dùng tra cứu cục bộ và Trung tâm nghiên cứu thay vì tự suy đoán cho câu hỏi “${clean(query,180)}”.`,citations:[],confidence:'low',safety:'needs_source_check',suggestedQueries:[],provider:'local',degraded:true,latencyMs:0,toolsUsed:[]};
}

function extractOutputText(payload){
  if(typeof payload?.output_text==='string')return payload.output_text;
  const parts=[];
  for(const item of Array.isArray(payload?.output)?payload.output:[]){
    for(const content of Array.isArray(item?.content)?item.content:[]){if(typeof content?.text==='string')parts.push(content.text)}
  }
  return parts.join('').trim();
}

function parseStructured(raw,sources){
  const parsed=JSON.parse(raw),allowed=new Map(sources.map(x=>[x.id,x]));
  const ids=Array.isArray(parsed?.sourceIds)?parsed.sourceIds.map(sourceId).filter(id=>allowed.has(id)).slice(0,MAX_SOURCES):[];
  const citations=[...new Set(ids)].map(id=>{const source=allowed.get(id);return{id,label:source.title,url:source.url||null}});
  const answer=clean(parsed?.answer,7000);if(!answer)throw new Error('AI response missing answer');
  const confidence=CONFIDENCE.has(parsed?.confidence)?parsed.confidence:'low';
  let safety=SAFETY.has(parsed?.safety)?parsed.safety:'needs_source_check';
  if(!sources.length&&safety==='educational')safety='needs_source_check';
  const suggestedQueries=Array.isArray(parsed?.suggestedQueries)?parsed.suggestedQueries.map(x=>clean(x,180)).filter(Boolean).slice(0,3):[];
  return{answer,citations,confidence,safety,suggestedQueries};
}

const RESPONSE_SCHEMA={
  type:'object',
  properties:{
    answer:{type:'string'},
    sourceIds:{type:'array',items:{type:'string'}},
    confidence:{type:'string',enum:['high','medium','low']},
    safety:{type:'string',enum:['educational','needs_source_check','refuse_clinical_advice']},
    suggestedQueries:{type:'array',items:{type:'string'},maxItems:3}
  },
  required:['answer','sourceIds','confidence','safety','suggestedQueries'],
  additionalProperties:false
};

async function createOpenAiResponse({key,model,input,tools,signal}){
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal,
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model,store:false,max_output_tokens:900,input,
      tools,tool_choice:'auto',parallel_tool_calls:false,
      text:{format:{type:'json_schema',name:'yhct_ai_answer_v1',strict:true,schema:RESPONSE_SCHEMA}}
    })
  });
  if(!response.ok)throw new Error(`OpenAI ${response.status}`);
  return await response.json();
}

export default async function handler(req,res){
  const started=Date.now();
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const access=await memberAccess(req,'member');
  if(!access.ok)return res.status(access.status).json({error:access.error});

  const query=clean(req.body?.query,MAX_QUERY),mode=MODES.has(req.body?.mode)?req.body.mode:'fast',sources=normalizeSources(req.body?.sources);
  if(query.length<2)return res.status(400).json({error:'Query is required'});
  const baseFallback=fallback(query,sources);
  const key=process.env.OPENAI_API_KEY,model=cloudAiModel();
  if(!cloudAiEnabled()||!key||!model)return res.status(200).json(baseFallback);

  const sourceBlock=sources.length?sources.map(s=>`[${s.id}] ${s.title}\n${s.text}`).join('\n\n'):'(không có nguồn đính kèm)';
  const developer=[
    'Bạn là trợ lý học thuật Y học Cổ truyền cho sinh viên và nghiên cứu viên.',
    'Chỉ hỗ trợ học tập/nghiên cứu; không chẩn đoán, kê đơn hoặc thay thế bác sĩ.',
    'Không bịa nguồn. sourceIds chỉ được chọn từ ID nguồn được cung cấp; nếu không đủ nguồn, để sourceIds rỗng và safety=needs_source_check.',
    'Khi cần dữ liệu cá nhân hoặc dữ liệu hệ thống, chỉ dùng các function tool được cấp. Không suy đoán dữ liệu tài khoản.',
    'Các tool hiện tại chỉ đọc dữ liệu. Không yêu cầu hoặc mô phỏng thao tác ghi, xóa, đăng ký, duyệt hoặc thay đổi trạng thái.',
    'Nếu người dùng yêu cầu chẩn đoán/kê đơn cá nhân hóa, safety=refuse_clinical_advice và chuyển sang hướng dẫn học thuật an toàn.',
    'Ưu tiên ngắn gọn, logic, tiếng Việt; nêu rõ giới hạn khi bằng chứng không chắc chắn.'
  ].join(' ');
  const user=`MODE=${mode}\nCÂU HỎI=${query}\nNGUỒN ĐƯỢC PHÉP TRÍCH DẪN:\n${sourceBlock}\nHãy trả về JSON đúng schema sau khi đã dùng tool nếu thực sự cần.`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),AI_TIMEOUT_MS);
  const tools=aiToolsForRole(access.role),toolsUsed=[];
  let input=[{role:'developer',content:developer},{role:'user',content:user}],payload=null;
  try{
    for(let round=0;round<=MAX_TOOL_ROUNDS;round++){
      payload=await createOpenAiResponse({key,model,input,tools,signal:controller.signal});
      const calls=(Array.isArray(payload?.output)?payload.output:[]).filter(item=>item?.type==='function_call');
      if(!calls.length)break;
      if(round>=MAX_TOOL_ROUNDS)throw new Error('AI tool round limit exceeded');
      const outputs=[];
      for(const call of calls.slice(0,MAX_TOOL_CALLS_PER_ROUND)){
        const output=await executeAiTool(req,access.role,call);
        toolsUsed.push(clean(call.name,80));
        outputs.push({type:'function_call_output',call_id:call.call_id,output});
      }
      input=[...input,...payload.output,...outputs];
    }
    const structured=parseStructured(extractOutputText(payload),sources),latencyMs=Date.now()-started,uniqueTools=[...new Set(toolsUsed)];
    res.setHeader('Server-Timing',`ai;dur=${latencyMs}`);res.setHeader('X-AI-Provider','openai');res.setHeader('X-AI-Model',model);res.setHeader('X-AI-Tools-Used',String(uniqueTools.length));
    console.info(JSON.stringify({event:'ai_gateway',ok:true,provider:'openai',model,mode,role:access.role,sourceCount:sources.length,toolCount:uniqueTools.length,tools:uniqueTools,latencyMs}));
    return res.status(200).json({...structured,provider:'openai',degraded:false,latencyMs,toolsUsed:uniqueTools});
  }catch(error){
    const latencyMs=Date.now()-started,reason=error?.name==='AbortError'?'timeout':clean(error?.message,180)||'provider_error';
    console.warn(JSON.stringify({event:'ai_gateway',ok:false,provider:'openai',model,mode,role:access.role,sourceCount:sources.length,toolCount:toolsUsed.length,latencyMs,reason}));
    return res.status(200).json({...baseFallback,latencyMs,toolsUsed:[...new Set(toolsUsed)]});
  }finally{clearTimeout(timer)}
}
