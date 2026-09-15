const DEFAULT_GEMINI_MODEL='gemini-3.5-flash-lite';
const DEFAULT_GEMINI_RESEARCH_MODEL='gemini-3.8-flash';
const DEFAULT_GEMINI_FALLBACK_MODEL=DEFAULT_GEMINI_RESEARCH_MODEL;
const DEFAULT_GEMINI_WEB_SEARCH_MODEL='gemini-3.8-flash';
const DEFAULT_GEMINI_WEB_SEARCH_FALLBACK_MODEL='gemini-3.6-flash';
const MAX_ERROR_TEXT=180;
const DEFAULT_PRIMARY_TIMEOUT_MS=7500;
const RESEARCH_PRIMARY_TIMEOUT_MS=10000;
const FALLBACK_TIMEOUT_MS=8500;

const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export const geminiAiEnabled=()=>Boolean(process.env.GEMINI_API_KEY)&&process.env.ENABLE_GEMINI_AI!=='false';
export const geminiPrivateContextAllowed=()=>false;
export const geminiAiModel=(mode='default')=>{
  const configured=mode==='research'
    ?process.env.GEMINI_RESEARCH_MODEL||process.env.GEMINI_MODEL||DEFAULT_GEMINI_RESEARCH_MODEL
    :process.env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL;
  return String(configured).trim();
};
export const geminiWebSearchModel=()=>String(process.env.GEMINI_WEB_SEARCH_MODEL||DEFAULT_GEMINI_WEB_SEARCH_MODEL).trim();
const geminiWebSearchModels=()=>[...new Set([
  geminiWebSearchModel(),
  String(process.env.GEMINI_WEB_SEARCH_FALLBACK_MODEL||DEFAULT_GEMINI_WEB_SEARCH_FALLBACK_MODEL).trim()
].filter(Boolean))];
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
        const raw=annotation?.url_citation||annotation,url=String(raw?.url||raw?.uri||'').trim();
        if(!url.startsWith('https://'))continue;
        citations.push({title:clean(raw?.title||url,220),url});
      }
    }
  }
  const text=[...new Set(parts.map(value=>value.trim()).filter(Boolean))].join('\n').trim();
  return{text,citations:[...new Map(citations.map(item=>[item.url,item])).values()].slice(0,6)};
}

function extractGroundedGenerateContent(payload){
  const text=extractText(payload),citations=[];
  for(const candidate of Array.isArray(payload?.candidates)?payload.candidates:[]){
    const chunks=Array.isArray(candidate?.groundingMetadata?.groundingChunks)?candidate.groundingMetadata.groundingChunks:[];
    for(const chunk of chunks){
      const web=chunk?.web||{},url=String(web?.uri||web?.url||'').trim();
      if(!url.startsWith('https://'))continue;
      citations.push({title:clean(web?.title||url,220),url});
    }
  }
  return{text,citations:[...new Map(citations.map(item=>[item.url,item])).values()].slice(0,6)};
}

function attemptSignal(parent,timeoutMs){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),abort=()=>controller.abort(parent?.reason);
  if(parent?.aborted)abort();else parent?.addEventListener?.('abort',abort,{once:true});
  return{signal:controller.signal,cleanup(){clearTimeout(timer);parent?.removeEventListener?.('abort',abort)}};
}
const retryableGeminiStatus=status=>[408,404,429,500,502,503,504].includes(Number(status));
const transientNetworkError=error=>error?.name==='TypeError'||/fetch failed|network|socket|econnreset|etimedout/i.test(String(error?.message||''));

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
      const timedOut=error?.name==='AbortError'&&attempt.signal.aborted,retry=canFallback&&(timedOut||transientNetworkError(error)||retryableGeminiStatus(error?.status));
      if(!retry)throw error;
      console.warn(JSON.stringify({event:'gemini_model_failover',mode,from:model,to:models[index+1],reason:timedOut?'timeout':transientNetworkError(error)?'network':`http_${error?.status||'unknown'}`}));
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

async function requestInteractionWebSearch(model,input,key,signal){
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
    method:'POST',signal,
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({model,input,tools:[{type:'google_search'}]})
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>null),message=clean(detail?.error?.message||'',MAX_ERROR_TEXT),error=new Error(`Gemini web interaction ${response.status}${message?` ${message}`:''}`);error.status=response.status;throw error;
  }
  const parsed=extractInteraction(await response.json());
  if(!parsed.text)throw new Error('Gemini web interaction returned an empty answer');
  if(!parsed.citations.length)throw new Error('Gemini web interaction returned no citations');
  return{...parsed,model};
}

async function requestGenerateContentWebSearch(model,input,key,signal){
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',signal,
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{role:'user',parts:[{text:input}]}],tools:[{google_search:{}}]})
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>null),message=clean(detail?.error?.message||'',MAX_ERROR_TEXT),error=new Error(`Gemini grounded generateContent ${response.status}${message?` ${message}`:''}`);error.status=response.status;throw error;
  }
  const parsed=extractGroundedGenerateContent(await response.json());
  if(!parsed.text)throw new Error('Gemini grounded generateContent returned an empty answer');
  if(!parsed.citations.length)throw new Error('Gemini grounded generateContent returned no citations');
  return{...parsed,model};
}

const currentQuestion=value=>{
  const raw=String(value??''),match=raw.match(/CÂU HỎI HIỆN TẠI:\s*([^\n]+)/i);
  return clean(match?.[1]||raw,520);
};
const publicEvidenceQuery=value=>{
  const original=currentQuestion(value),plain=original.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
  if(/tang huyet ap|hypertension/.test(plain))return'hypertension guideline adults';
  if(/hoat dong the luc|physical activity/.test(plain))return'WHO physical activity adults guideline';
  return original;
};
async function publicEvidenceRows(prompt,signal){
  const query=publicEvidenceQuery(prompt),rows=[];
  try{
    const url=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.searchParams.set('query',query);url.searchParams.set('format','json');url.searchParams.set('resultType','core');url.searchParams.set('pageSize','6');
    const response=await fetch(url,{signal,headers:{accept:'application/json','user-agent':'HIU-YHCT-StudyOS/4.0'}});
    if(response.ok){
      const payload=await response.json();
      for(const item of Array.isArray(payload?.resultList?.result)?payload.resultList.result:[]){
        const source=clean(item?.source||'MED',24),id=clean(item?.id||item?.pmid||item?.pmcid||'',100),title=clean(item?.title,260),snippet=clean(item?.abstractText,1800);
        if(!id||!title)continue;
        rows.push({title,url:`https://europepmc.org/article/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,snippet,provider:'Europe PMC'});
        if(rows.length>=6)break;
      }
    }
  }catch{}
  if(rows.length)return rows;
  try{
    const url=new URL('https://api.openalex.org/works');url.searchParams.set('search',query);url.searchParams.set('per-page','6');url.searchParams.set('select','id,doi,title,publication_year');
    const response=await fetch(url,{signal,headers:{accept:'application/json','user-agent':'HIU-YHCT-StudyOS/4.0'}});
    if(response.ok){
      const payload=await response.json();
      for(const item of Array.isArray(payload?.results)?payload.results:[]){
        const title=clean(item?.title,260),doi=String(item?.doi||'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,''),id=String(item?.id||'').trim(),urlValue=doi?`https://doi.org/${doi}`:id.startsWith('https://')?id:'';
        if(title&&urlValue)rows.push({title,url:urlValue,snippet:'',provider:'OpenAlex'});
        if(rows.length>=6)break;
      }
    }
  }catch{}
  return rows;
}
async function requestPublicEvidenceWebFallback(systemInstruction,prompt,signal,mode,lastError){
  const rows=await publicEvidenceRows(prompt,signal);
  if(!rows.length)throw lastError||new Error('Public evidence fallback unavailable');
  const citations=rows.map(({title,url})=>({title,url})).filter(item=>item.url.startsWith('https://')).slice(0,6);
  const evidence=rows.map((item,index)=>`[${index}] ${item.title}\nNguồn: ${item.provider}\nURL: ${item.url}${item.snippet?`\nTrích yếu: ${item.snippet}`:''}`).join('\n\n');
  const output=await createGeminiText({
    systemInstruction:`${systemInstruction} Google Search đang bị giới hạn quota. Chỉ dùng gói nguồn công khai Europe PMC/OpenAlex bên dưới cho các thông tin cần nguồn; không bịa URL hay tuyên bố đã truy xuất Google Search.`,
    prompt:`${prompt}\n\nGÓI NGUỒN CÔNG KHAI DỰ PHÒNG:\n${evidence}`,
    maxOutputTokens:1800,signal,mode
  });
  console.warn(JSON.stringify({event:'gemini_web_search_public_evidence_fallback',sources:citations.length,model:output.model}));
  return{text:output.text,citations,model:output.model};
}

export async function createGeminiWebSearch({systemInstruction,prompt,signal,mode='default'}){
  if(!geminiAiConfigured(mode))throw new Error('Gemini configuration missing');
  const models=geminiWebSearchModels(),key=process.env.GEMINI_API_KEY,input=`${clean(systemInstruction,8000)}\n\n${clean(prompt,20000)}`;
  if(!models.length)throw new Error('Gemini web-search model missing');
  let lastError=null;
  try{return await requestInteractionWebSearch(models[0],input,key,signal)}
  catch(error){
    lastError=error;console.warn(JSON.stringify({event:'gemini_web_search_failover',transport:'interactions',model:models[0],reason:`http_${error?.status||'unknown'}`}));
    if(Number(error?.status)===429&&!signal?.aborted)return requestPublicEvidenceWebFallback(systemInstruction,prompt,signal,mode,error);
  }
  for(const model of models){
    if(signal?.aborted)throw lastError||new Error('Gemini web search aborted');
    try{return await requestGenerateContentWebSearch(model,input,key,signal)}
    catch(error){lastError=error;console.warn(JSON.stringify({event:'gemini_web_search_failover',transport:'generateContent',model,reason:`http_${error?.status||'unknown'}`}))}
  }
  if(!signal?.aborted)try{return await requestPublicEvidenceWebFallback(systemInstruction,prompt,signal,mode,lastError)}catch(error){lastError=error}
  throw lastError||new Error('Gemini web search failed');
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
