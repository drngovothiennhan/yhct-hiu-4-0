import {supabase} from '../../../services/authService';

export type AiHealth={
  ok:boolean;
  ai:{
    mode:string;
    cloudReady:boolean;
    providers?:{openai:boolean;gemini:boolean};
    academicProviderPriority?:'gemini-first'|'openai-first';
    localFallback:boolean;
    offlineFallback:boolean;
    centralRag:boolean;
    centralRagReady:boolean;
    evidenceBacked:boolean;
    evidenceSources:string[];
    knowledgeStats?:Record<string,number>;
    structuredOutputs:boolean;
    citationWhitelist:boolean;
    functionCalling:boolean;
    roleBoundTools:boolean;
    readOnlyTools:boolean;
    model:string;
    geminiModel?:string|null;
    geminiModels?:{fast:string;research:string};
    privateContextToGemini?:boolean;
    internalContextOptIn?:boolean;
  };
};

export type GeminiProviderCheck={
  ok:boolean;
  configured:boolean;
  provider:'gemini';
  models:Array<{model:string;ok:boolean;status:number;displayName:string;error:string}>;
  checkedAt:string;
  error?:string;
};

export async function fetchAiHealth():Promise<AiHealth>{
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch('/api/ai/health',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error(`AI health HTTP ${response.status}`);
    const data=await response.json() as AiHealth;
    if(!data?.ok||!data?.ai)throw new Error('AI health payload không hợp lệ.');
    return data;
  }finally{window.clearTimeout(timer)}
}

export async function checkGeminiProvider():Promise<GeminiProviderCheck>{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token)throw new Error('Cần đăng nhập tài khoản admin để kiểm tra Gemini.');
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch('/api/ai/gemini-check',{
      method:'POST',signal:controller.signal,
      headers:{Authorization:`Bearer ${session.access_token}`}
    });
    if(response.status===401||response.status===403)throw new Error('Tài khoản hiện tại không có quyền admin để kiểm tra Gemini.');
    if(!response.ok)throw new Error(`Gemini check HTTP ${response.status}`);
    return await response.json() as GeminiProviderCheck;
  }catch(error){
    if(controller.signal.aborted)throw new Error('Kiểm tra Gemini quá thời gian chờ.');
    throw error;
  }finally{window.clearTimeout(timer)}
}
