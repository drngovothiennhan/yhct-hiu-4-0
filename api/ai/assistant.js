import {cloudAiEnabled,cloudAiModel,memberAccess} from '../_lib/member-access.js';
import {aiToolsForRole,executeAiTool} from '../_lib/ai-tools.js';
import {createGeminiJson,geminiAiConfigured,geminiAiModel} from '../_lib/gemini-provider.js';
import {handleXiaoZhiMini} from '../_lib/xiaozhi-mini-handler.js';

const MAX_QUERY=4000;
const MAX_SOURCES=6;
const MAX_SOURCE_TEXT=4200;
const AI_TIMEOUT_MS=20000;
const GEMINI_TIMEOUT_MS=16000;
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

function fallback(sources){
  const answer=sources.length
    ?`Đã chuyển sang chế độ hỗ trợ cục bộ an toàn. ${sources.length} nguồn học thuật vẫn được giữ để đối chiếu; mở nguồn hoặc dùng Trung tâm nghiên cứu nếu cần kiểm chứng sâu hơn.`
    :'Đã chuyển sang chế độ hỗ trợ cục bộ an toàn. Hãy dùng tra cứu kiến thức hoặc Trung tâm nghiên cứu để bổ sung nguồn trước khi kết luận.';
  return{answer,citations:[],confidence:'low',safety:'needs_source_check',suggestedQueries:[],provider:'local',degraded:true,latencyMs:0,toolsUsed:[]};
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
  const answer=clean(parsed?.answer,7000);if(!answer)throw new Error('invalid_response:missing_answer');
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

function providerFailureClass(error){
  const message=String(error?.message||'');
  if(error?.name==='AbortError'||message.includes('timeout'))return'timeout';
  if(message.includes('OpenAI 401')||message.includes('Gemini 401'))return'auth';
  if(message.includes('OpenAI 403')||message.includes('Gemini 403')||message.includes('model_not_found'))return'access';
  if(message.includes('OpenAI 429')||message.includes('Gemini 429'))return message.includes('insufficient_quota')?'quota':'rate_limit';
  if(/(?:OpenAI|Gemini) 5\d\d/.test(message))return'provider_5xx';
  if(message.includes('incomplete'))return'incomplete';
  if(message.includes('invalid_response')||message.includes('JSON'))return'invalid_response';
  return'provider_error';
}

function geminiEligible(mode,sources){
  if(mode==='fast'||!geminiAiConfigured(mode))return false;
  const containsPrivateDriveContext=sources.some(source=>source.id.startsWith('drive:'));
  return !containsPrivateDriveContext||process.env.GEMINI_ALLOW_PRIVATE_CONTEXT==='true';
}

function preferGeminiAcademic(mode,canGemini){
  if(!canGemini||mode==='fast')return false;
  return process.env.AI_ACADEMIC_PROVIDER!=='openai';
}

async function createOpenAiResponse({key,model,input,tools,mode,signal}){
  const body={
    model,
    store:false,
    max_output_tokens:mode==='research'?2600:1800,
    reasoning:{effort:mode==='research'?'low':'none'},
    input,
    text:{format:{type:'json_schema',name:'yhct_ai_answer_v1',strict:true,schema:RESPONSE_SCHEMA}}
  };
  if(Array.isArray(tools)&&tools.length){body.tools=tools;body.tool_choice='auto';body.parallel_tool_calls=false}
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal,
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>null),code=clean(detail?.error?.code||detail?.error?.type||'',80),message=clean(detail?.error?.message||'',120);
    throw new Error(`OpenAI ${response.status}${code?` ${code}`:''}${message?` ${message}`:''}`);
  }
  const payload=await response.json();
  if(payload?.status==='incomplete')throw new Error(`incomplete:${clean(payload?.incomplete_details?.reason||'unknown',80)}`);
  return payload;
}

async function runGemini({developer,user,sources,started,res,mode}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),GEMINI_TIMEOUT_MS);
  try{
    const output=await createGeminiJson({systemInstruction:developer,prompt:user,schema:RESPONSE_SCHEMA,maxOutputTokens:mode==='research'?3200:2200,signal:controller.signal,mode});
    const structured=parseStructured(output.text,sources),latencyMs=Date.now()-started,model=output.model||geminiAiModel(mode);
    res.setHeader('Server-Timing',`ai;dur=${latencyMs}`);res.setHeader('X-AI-Provider','gemini');res.setHeader('X-AI-Model',model);res.setHeader('X-AI-Tools-Used','0');res.setHeader('X-AI-Degraded','0');
    console.info(JSON.stringify({event:'ai_gateway',ok:true,provider:'gemini',model,mode,sourceCount:sources.length,toolCount:0,latencyMs}));
    return{...structured,provider:'gemini',degraded:false,latencyMs,toolsUsed:[]};
  }finally{clearTimeout(timer)}
}

export default async function handler(req,res){
  if(req.body?.mode==='xiaozhi-mini')return handleXiaoZhiMini(req,res);
  const started=Date.now();
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const access=await memberAccess(req,'member');
  if(!access.ok)return res.status(access.status).json({error:access.error});

  const query=clean(req.body?.query,MAX_QUERY),mode=MODES.has(req.body?.mode)?req.body.mode:'fast',sources=normalizeSources(req.body?.sources);
  if(query.length<2)return res.status(400).json({error:'Query is required'});
  const baseFallback=fallback(sources),key=process.env.OPENAI_API_KEY,model=cloudAiModel(),openAiReady=Boolean(cloudAiEnabled()&&key&&model),canGemini=geminiEligible(mode,sources),geminiFirst=preferGeminiAcademic(mode,canGemini);
  if(!openAiReady&&!canGemini){res.setHeader('X-AI-Degraded','1');res.setHeader('X-AI-Failure-Class','configuration');return res.status(200).json(baseFallback)}

  const sourceBlock=sources.length?sources.map(s=>`[${s.id}] ${s.title}\n${s.text}`).join('\n\n'):'(không có nguồn đính kèm)';
  const developer=[
    'Bạn là trợ lý học thuật Y học Cổ truyền cho sinh viên và nghiên cứu viên.',
    'Chỉ hỗ trợ học tập/nghiên cứu; không chẩn đoán, kê đơn hoặc thay thế bác sĩ.',
    'Không bịa nguồn. sourceIds chỉ được chọn từ ID nguồn được cung cấp; nếu không đủ nguồn, để sourceIds rỗng và safety=needs_source_check.',
    'Ưu tiên tổng hợp dựa trên RAG và nguồn học thuật đã được hệ thống cung cấp, phân biệt kiến thức giáo trình với bằng chứng nghiên cứu khi cần.',
    'Khi cần dữ liệu cá nhân hoặc dữ liệu hệ thống, chỉ dùng các function tool được cấp. Không suy đoán dữ liệu tài khoản.',
    'Các tool hiện tại chỉ đọc dữ liệu. Không yêu cầu hoặc mô phỏng thao tác ghi, xóa, đăng ký, duyệt hoặc thay đổi trạng thái.',
    'Nếu người dùng yêu cầu chẩn đoán/kê đơn cá nhân hóa, safety=refuse_clinical_advice và chuyển sang hướng dẫn học thuật an toàn.',
    'Ưu tiên ngắn gọn, logic, tiếng Việt; nêu rõ giới hạn khi bằng chứng không chắc chắn.'
  ].join(' ');
  const user=`MODE=${mode}\nCÂU HỎI=${query}\nNGUỒN RAG ĐƯỢC PHÉP SỬ DỤNG VÀ TRÍCH DẪN:\n${sourceBlock}\nHãy tổng hợp dựa trên nguồn, không bịa dữ kiện và trả về JSON đúng schema.`;

  let geminiPrimaryFailure='';
  if(geminiFirst){
    try{return res.status(200).json(await runGemini({developer,user,sources,started,res,mode}))}
    catch(error){
      geminiPrimaryFailure=providerFailureClass(error);
      console.warn(JSON.stringify({event:'ai_gateway',ok:false,provider:'gemini',model:geminiAiModel(mode),mode,role:access.role,sourceCount:sources.length,latencyMs:Date.now()-started,failureClass:geminiPrimaryFailure,failover:openAiReady?'openai':'local'}));
      if(!openAiReady){const latencyMs=Date.now()-started;res.setHeader('X-AI-Degraded','1');res.setHeader('X-AI-Failure-Class',`gemini_${geminiPrimaryFailure}`);return res.status(200).json({...baseFallback,latencyMs})}
    }
  }

  if(!openAiReady&&canGemini){
    try{return res.status(200).json(await runGemini({developer,user,sources,started,res,mode}))}
    catch(error){const latencyMs=Date.now()-started,failureClass=providerFailureClass(error);res.setHeader('X-AI-Degraded','1');res.setHeader('X-AI-Failure-Class',failureClass);console.warn(JSON.stringify({event:'ai_gateway',ok:false,provider:'gemini',model:geminiAiModel(mode),mode,role:access.role,sourceCount:sources.length,latencyMs,failureClass}));return res.status(200).json({...baseFallback,latencyMs})}
  }

  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),AI_TIMEOUT_MS),tools=mode==='fast'?aiToolsForRole(access.role):[],toolsUsed=[];
  let input=[{role:'developer',content:developer},{role:'user',content:user}],payload=null;
  try{
    for(let round=0;round<=MAX_TOOL_ROUNDS;round++){
      payload=await createOpenAiResponse({key,model,input,tools,mode,signal:controller.signal});
      const calls=(Array.isArray(payload?.output)?payload.output:[]).filter(item=>item?.type==='function_call');
      if(!calls.length)break;
      if(round>=MAX_TOOL_ROUNDS)throw new Error('tool_round_limit');
      const outputs=[];
      for(const call of calls.slice(0,MAX_TOOL_CALLS_PER_ROUND)){
        const output=await executeAiTool(req,access.role,call);
        toolsUsed.push(clean(call.name,80));
        outputs.push({type:'function_call_output',call_id:call.call_id,output});
      }
      input=[...input,...payload.output,...outputs];
    }
    const structured=parseStructured(extractOutputText(payload),sources),latencyMs=Date.now()-started,uniqueTools=[...new Set(toolsUsed)];
    res.setHeader('Server-Timing',`ai;dur=${latencyMs}`);res.setHeader('X-AI-Provider','openai');res.setHeader('X-AI-Model',model);res.setHeader('X-AI-Tools-Used',String(uniqueTools.length));res.setHeader('X-AI-Degraded','0');
    if(geminiPrimaryFailure)res.setHeader('X-AI-Failover','gemini-to-openai');
    console.info(JSON.stringify({event:'ai_gateway',ok:true,provider:'openai',model,mode,role:access.role,sourceCount:sources.length,toolCount:uniqueTools.length,tools:uniqueTools,latencyMs,failoverFrom:geminiPrimaryFailure?'gemini':null}));
    return res.status(200).json({...structured,provider:'openai',degraded:false,latencyMs,toolsUsed:uniqueTools});
  }catch(error){
    clearTimeout(timer);
    const openAiFailure=providerFailureClass(error);
    if(canGemini&&!geminiFirst&&openAiFailure!=='timeout'){
      try{return res.status(200).json(await runGemini({developer,user,sources,started,res,mode}))}
      catch(geminiError){const latencyMs=Date.now()-started,failureClass=`openai_${openAiFailure}+gemini_${providerFailureClass(geminiError)}`;res.setHeader('Server-Timing',`ai;dur=${latencyMs}`);res.setHeader('X-AI-Degraded','1');res.setHeader('X-AI-Failure-Class',failureClass);console.warn(JSON.stringify({event:'ai_gateway',ok:false,provider:'multi',model,mode,role:access.role,sourceCount:sources.length,toolCount:toolsUsed.length,latencyMs,failureClass}));return res.status(200).json({...baseFallback,latencyMs,toolsUsed:[...new Set(toolsUsed)]})}
    }
    const latencyMs=Date.now()-started,failureClass=geminiPrimaryFailure?`gemini_${geminiPrimaryFailure}+openai_${openAiFailure}`:openAiFailure;
    res.setHeader('Server-Timing',`ai;dur=${latencyMs}`);res.setHeader('X-AI-Degraded','1');res.setHeader('X-AI-Failure-Class',failureClass);
    console.warn(JSON.stringify({event:'ai_gateway',ok:false,provider:geminiPrimaryFailure?'multi':'openai',model,mode,role:access.role,sourceCount:sources.length,toolCount:toolsUsed.length,latencyMs,failureClass}));
    return res.status(200).json({...baseFallback,latencyMs,toolsUsed:[...new Set(toolsUsed)]});
  }finally{clearTimeout(timer)}
}
