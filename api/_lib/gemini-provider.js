const DEFAULT_GEMINI_MODEL='gemini-3.5-flash-lite';
const DEFAULT_GEMINI_RESEARCH_MODEL='gemini-3.5-flash';
const MAX_ERROR_TEXT=180;

const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export const geminiAiEnabled=()=>process.env.ENABLE_GEMINI_AI==='true';
export const geminiAiModel=(mode='default')=>{
  const configured=mode==='research'
    ?process.env.GEMINI_RESEARCH_MODEL||process.env.GEMINI_MODEL||DEFAULT_GEMINI_RESEARCH_MODEL
    :process.env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL;
  return String(configured).trim();
};
export const geminiAiConfigured=(mode='default')=>Boolean(geminiAiEnabled()&&process.env.GEMINI_API_KEY&&geminiAiModel(mode));

function extractText(payload){
  const parts=[];
  for(const candidate of Array.isArray(payload?.candidates)?payload.candidates:[]){
    for(const part of Array.isArray(candidate?.content?.parts)?candidate.content.parts:[]){if(typeof part?.text==='string')parts.push(part.text)}
  }
  return parts.join('').trim();
}

async function requestGemini(body,signal,mode='default'){
  if(!geminiAiConfigured(mode))throw new Error('Gemini configuration missing');
  const model=geminiAiModel(mode),key=process.env.GEMINI_API_KEY;
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:'POST',signal,
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify(body)
  });
  if(!response.ok){
    const detail=await response.json().catch(()=>null),message=clean(detail?.error?.message||'',MAX_ERROR_TEXT);
    throw new Error(`Gemini ${response.status}${message?` ${message}`:''}`);
  }
  const payload=await response.json(),text=extractText(payload);
  if(!text)throw new Error('Gemini returned an empty answer');
  return{text,model};
}

export async function createGeminiJson({systemInstruction,prompt,schema,maxOutputTokens=1800,signal,mode='default'}){
  const body={
    system_instruction:{parts:[{text:clean(systemInstruction,8000)}]},
    contents:[{role:'user',parts:[{text:clean(prompt,24000)}]}],
    generationConfig:{
      temperature:mode==='research'?.18:.2,
      maxOutputTokens:Math.max(256,Math.min(Number(maxOutputTokens)||1800,5000)),
      responseMimeType:'application/json',
      responseJsonSchema:schema
    }
  };
  return requestGemini(body,signal,mode);
}

export async function createGeminiText({systemInstruction,prompt,maxOutputTokens=1100,signal,mode='default'}){
  const body={
    system_instruction:{parts:[{text:clean(systemInstruction,8000)}]},
    contents:[{role:'user',parts:[{text:clean(prompt,20000)}]}],
    generationConfig:{temperature:mode==='research'?.25:.35,maxOutputTokens:Math.max(128,Math.min(Number(maxOutputTokens)||1100,4000))}
  };
  return requestGemini(body,signal,mode);
}
