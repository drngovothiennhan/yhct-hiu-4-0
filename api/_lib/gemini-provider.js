const DEFAULT_GEMINI_MODEL='gemini-3.5-flash-lite';
const MAX_ERROR_TEXT=180;

const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export const geminiAiEnabled=()=>process.env.ENABLE_GEMINI_AI==='true';
export const geminiAiModel=()=>String(process.env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL).trim();
export const geminiAiConfigured=()=>Boolean(geminiAiEnabled()&&process.env.GEMINI_API_KEY&&geminiAiModel());

function extractText(payload){
  const parts=[];
  for(const candidate of Array.isArray(payload?.candidates)?payload.candidates:[]){
    for(const part of Array.isArray(candidate?.content?.parts)?candidate.content.parts:[]){if(typeof part?.text==='string')parts.push(part.text)}
  }
  return parts.join('').trim();
}

async function requestGemini(body,signal){
  if(!geminiAiConfigured())throw new Error('Gemini configuration missing');
  const model=geminiAiModel(),key=process.env.GEMINI_API_KEY;
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

export async function createGeminiJson({systemInstruction,prompt,schema,maxOutputTokens=1800,signal}){
  const body={
    system_instruction:{parts:[{text:clean(systemInstruction,8000)}]},
    contents:[{role:'user',parts:[{text:clean(prompt,24000)}]}],
    generationConfig:{
      temperature:.2,
      maxOutputTokens:Math.max(256,Math.min(Number(maxOutputTokens)||1800,4000)),
      responseMimeType:'application/json',
      responseJsonSchema:schema
    }
  };
  return requestGemini(body,signal);
}

export async function createGeminiText({systemInstruction,prompt,maxOutputTokens=1100,signal}){
  const body={
    system_instruction:{parts:[{text:clean(systemInstruction,8000)}]},
    contents:[{role:'user',parts:[{text:clean(prompt,16000)}]}],
    generationConfig:{temperature:.35,maxOutputTokens:Math.max(128,Math.min(Number(maxOutputTokens)||1100,3000))}
  };
  return requestGemini(body,signal);
}
