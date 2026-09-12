import {cloudAiConfigured,cloudAiModel,memberAccess,publicRpc} from '../_lib/member-access.js';
import {geminiAiConfigured,geminiAiModel,geminiPrivateContextAllowed,probeGeminiModel} from '../_lib/gemini-provider.js';

async function geminiProbe(req,res){
  const access=await memberAccess(req,'admin');
  if(!access.ok)return res.status(access.status).json({error:access.error});
  if(req.body?.probe!=='gemini')return res.status(400).json({error:'Unsupported probe'});
  if(!geminiAiConfigured('default'))return res.status(200).json({ok:false,configured:false,liveness:'not_configured',provider:'gemini',models:[],checkedAt:new Date().toISOString(),error:'Gemini configuration missing'});
  const fast=geminiAiModel('default'),research=geminiAiModel('research'),models=[...new Set([fast,research])];
  const checks=await Promise.all(models.map(model=>probeGeminiModel(model))),ok=checks.every(item=>item.ok);
  return res.status(200).json({ok,configured:true,liveness:ok?'live':'failed',provider:'gemini',models:checks,checkedAt:new Date().toISOString()});
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='POST')return geminiProbe(req,res);
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const openAiReady=cloudAiConfigured(),geminiReady=geminiAiConfigured(),configuredCloudCount=Number(openAiReady)+Number(geminiReady),cloudReady=configuredCloudCount>0;
  const academicProviderPriority=geminiReady?'gemini-first':openAiReady?'openai-fallback':'local-only';
  const model=geminiReady?geminiAiModel('research'):openAiReady?cloudAiModel():'local';
  let centralRagReady=false,knowledgeStats=null,centralRagReason='threshold_not_met';
  try{
    const stats=await publicRpc('ai_knowledge_stats_v3',{},3500);
    const total=Number(stats?.total||0),evidence=Number(stats?.evidence||0),pubmed=Number(stats?.pubmedVerified||0),scholar=Number(stats?.googleScholarLinks||0);
    const authority=Number(stats?.authoritySources||0),who=Number(stats?.whoVerified||0),nccih=Number(stats?.nccihVerified||0),cochrane=Number(stats?.cochraneVerified||0);
    knowledgeStats={total,evidence,pubmedVerified:pubmed,googleScholarLinks:scholar,authoritySources:authority,whoVerified:who,nccihVerified:nccih,cochraneVerified:cochrane};
    if(total>=26&&evidence>=10&&pubmed>=10&&scholar>=10&&authority>=8&&who>=3&&nccih>=4&&cochrane>=1){centralRagReady=true;centralRagReason='ready'}
  }catch{centralRagReason='rpc_error'}
  return res.status(200).json({ok:true,ai:{
    mode:configuredCloudCount===2?'multi-cloud+local':configuredCloudCount===1?'cloud+local':'local-only',
    cloudReady,
    providers:{openai:openAiReady,gemini:geminiReady},
    providerStatus:{openai:{configured:openAiReady,liveness:'not_probed'},gemini:{configured:geminiReady,liveness:'not_probed'}},
    academicProviderPriority,
    defaultSearchProvider:geminiReady?'gemini-google-search':openAiReady?'openai-web-fallback':'local-fallback',
    localFallback:true,
    offlineFallback:true,
    centralRag:true,
    centralRagReady,
    centralRagStatus:{ready:centralRagReady,reason:centralRagReason},
    evidenceBacked:true,
    evidenceSources:['pubmed','doi','google_scholar','who','nccih','cochrane'],
    knowledgeStats,
    structuredOutputs:true,
    citationWhitelist:true,
    functionCalling:true,
    roleBoundTools:true,
    readOnlyTools:true,
    model,
    geminiModels:{fast:geminiAiModel(),research:geminiAiModel('research')},
    sharedAcademicRagToGemini:geminiReady,
    privateContextToGemini:geminiPrivateContextAllowed(),
    internalContextOptIn:true
  }});
}
