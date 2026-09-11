export type AiHealth={
  ok:boolean;
  ai:{
    mode:string;
    cloudReady:boolean;
    providers?:{openai:boolean;gemini:boolean};
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
    privateContextToGemini?:boolean;
    internalContextOptIn?:boolean;
  };
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
