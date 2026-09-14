const DEFAULT_GEMINI_MODEL='gemini-3.5-flash-lite';
const DEFAULT_GEMINI_RESEARCH_MODEL='gemini-3.8-flash';
const DEFAULT_GEMINI_FALLBACK_MODEL=DEFAULT_GEMINI_RESEARCH_MODEL;
const MAX_ERROR_TEXT=180;
const DEFAULT_PRIMARY_TIMEOUT_MS=6000;
const RESEARCH_PRIMARY_TIMEOUT_MS=6500;
const FALLBACK_TIMEOUT_MS=7500;

const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export const geminiAiEnabled=()=>Boolean(process.env.GEMINI_API_KEY)&&process.env.ENABLE_GEMINI_AI!=='false';
export const geminiPrivateContextAllowed=()=>false;
export const geminiAiModel=(mode='default')=>{
  const configured=mode==='research'
    ?process.env.GEMINI_RESEARCH_MODEL||process.env.GEMINI_MODEL||DEFAULT_GEMINI_RESEARCH_MODEL
    :process.env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL;
  return String(configured).trim();
};
export const geminiAiConfigured=(mode='default')=>Boolean(geminiAiEnabled()&&geminiAiModel(mode));
const geminiModelCandidates=mode=>{
  const primary=geminiAiModel(mode);
  const fallback=mode==='research'
    ?String(process.env.GEMINI_RESEARCH_FALLBACK_MODEL||DEFAULT_GEMINI_MODEL).trim()
    :String(process.env.GEMINI_FALLBACK_MODEL||DEFAULT_GEMINI_FALLBACK_MODEL).trim();
  return[...new Set([primary,fallback].filter(Boolean))];
};

function extractText(payload){
  const parts=[];
  for(const candidate of Array.isArray(payload?.candidates)?payload.candidates:[]){
    for(const part of Array.isArray(candidate?.content?.parts)?candidate.content.parts:[]){if(typeof part?.text==='string')parts.push(part.text)}
  }
  return parts.join('').trim();
}

function extractInteraction(payload){
  const interaction=payload?.interaction||payload,parts=[],citations=[];
  if(typeof interaction?.output_text==='string')parts.push(interaction.output_text);
  for(const step of Array.isArray(interaction?.steps)?interaction.steps:[]){
    if(step?.type!=='model_output')continue;
    for(const block of Array.isArray(step?.content)?step.content:[]){
      if(typeof block?.text==='string')parts.push(block.text);
      for(const annotation of Array.isArray(block?.annotations)?block.annotations:[]){
        const raw=annotation?.url_citation||annotation,url=String(raw?.url||'').trim();
        if(!url.startsWith('https://'))continue;
        citations.push({title:clean(raw?.title||url,220),url});
      }
    }
  }
  const text=[...new Set(parts.map(value=>value.trim()).filter(Boolean))].join('\n').trim();
  return{text,citations:[...new Map(citations.map(item=>[item.url,item])).values()].slice(0,6)};
}

function attemptSignal(parent,timeoutMs){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),abort=()=>controller.abort(parent?.reason);
  if(parent?.aborted)abort();else parent?.addEventListener?.('abort',abort,{once:true});
  return{signal:controller.signal,cleanup(){clearTimeout(timer);parent?.removeEventListener?.('abort',abort)}};
}
const retryableGeminiStatus=status=>[404,429,500,502,503,504].includes(Number(status));

async function requestGemini(bodyFactory,signal,mode='default'){
  if(!geminiAiConfigured(mode))throw new Error('Gemini configuration missing');
  const models=geminiModelCandidates(mode),key=process.env.GEMINI_API_KEY;let lastError=null;
  for(let index=0;index<models.length;index++){
    const model=models[index],canFallback=index<models.length-1,primaryTimeout=mode==='research'?RESEARCH_PRIMARY_TIMEOUT_MS:DEFAULT_PRIMARY_TIMEOUT_MS,attempt=attemptSignal(signal,canFallback?primaryTimeout:FALLBACK_TIMEOUT_MS);
    try{
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
        method:'POST',signal:attempt.signal,
        headers:{'Content-Type':'application/json','x-goog-api-key':key},
        body:JSON.stringify(bodyFactory(model))
      });
      if(!response.ok){
        const detail=await response.json().catch(()=>null),message=clean(detail?.error?.message||'',MAX_ERROR_TEXT),error=new Error(`Gemini ${response.status}${message?` ${message}`:''}`);error.status=response.status;throw error;
      }
      const payload=await response.json(),text=extractText(payload);
      if(!text)throw new Error('Gemini returned an empty answer');
      return{text,model};
    }catch(error){
      lastError=error;
      if(signal?.aborted)throw error;
      const timedOut=error?.name==='AbortError'&&attempt.signal.aborted,retry=canFallback&&(timedOut||retryableGeminiStatus(error?.status));
      if(!retry)throw error;
      console.warn(JSON.stringify({event:'gemini_model_failover',mode,from:model,to:models[index+1],reason:timedOut?'timeout':`http_${error?.status||'unknown'}`}));
    }finally{attempt.cleanup()}
  }
  throw lastError||new Error('Gemini request failed');
}

function generationConfig(mode,maxOutputTokens,jsonSchema=null,model=geminiAiModel(mode)){
  const research38=mode==='research'&&model.startsWith('gemini-3.8-'),config={maxOutputTokens:Math.max(256,Math.min(Number(maxOutputTokens)||1800,5000))};
  if(research38)config.thinkingConfig={thinkingLevel:'medium'};
  else config.temperature=mode==='research'?.18:.2;
  if(jsonSchema){config.responseMimeType='application/json';config.responseJsonSchema=jsonSchema}
  return config;
}

export async function createGeminiJson({systemInstruction,prompt,schema,maxOutputTokens=1800,signal,mode='default'}){
  return requestGemini(model=>({
    system_instruction:{parts:[{text:clean(systemInstruction,8000)}]},
    contents:[{role:'user',parts:[{text:clean(prompt,24000)}]}],
    generationConfig:generationConfig(mode,maxOutputTokens,schema,model)
  }),signal,mode);
}

export async function createGeminiText({systemInstruction,prompt,maxOutputTokens=1100,signal,mode='default'}){
  return requestGemini(model=>{
    const config=generationConfig(mode,maxOutputTokens,null,model);if(!model.startsWith('gemini-3.8-'))config.temperature=mode==='research'?.25:.35;
    return{system_instruction:{parts:[{text:clean(systemInstruction,8000)}]},contents:[{role:'user',parts:[{text:clean(prompt,20000)}]}],generationConfig:config};
  },signal,mode);
}

export async function createGeminiWebSearch({systemInstruction,prompt,signal,mode='default'}){
  if(!geminiAiConfigured(mode))throw new Error('Gemini configuration missing');
  const model=geminiAiModel(mode),key=process.env.GEMINI_API_KEY;
  const input=`${clean(systemInstruction,8000)}\n\n${clean(prompt,20000)}`;
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',signal,
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({model,input,tools:[{type:'google_search'}]})
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>null),message=clean(detail?.error?.message||'',MAX_ERROR_TEXT);
    throw new Error(`Gemini ${response.status}${message?` ${message}`:''}`);
  }
  const parsed=extractInteraction(await response.json());
  if(!parsed.text)throw new Error('Gemini returned an empty answer');
  return{...parsed,model};
}

export async function probeGeminiModel(model,{timeoutMs=7000}={}){
  const safeModel=String(model||'').trim();
  if(!geminiAiEnabled()||!safeModel)return{model:safeModel,ok:false,status:0,displayName:safeModel,error:'Gemini configuration missing'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1000,Math.min(Number(timeoutMs)||7000,10000)));
  try{
    const key=process.env.GEMINI_API_KEY;
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(safeModel)}`,{method:'GET',signal:controller.signal,headers:{'x-goog-api-key':key,accept:'application/json'}});
    const payload=await response.json().catch(()=>null);
    return{model:safeModel,ok:response.ok,status:response.status,displayName:clean(payload?.displayName||payload?.name||safeModel,120),error:response.ok?'':clean(payload?.error?.message||`HTTP ${response.status}`,MAX_ERROR_TEXT)};
  }catch(error){
    return{model:safeModel,ok:false,status:0,displayName:safeModel,error:error?.name==='AbortError'?'timeout':clean(error?.message||'network error',MAX_ERROR_TEXT)};
  }finally{clearTimeout(timer)}
}
