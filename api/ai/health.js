import {cloudAiConfigured,cloudAiModel,memberAccess,publicRpc} from '../_lib/member-access.js';
import {geminiAiConfigured,geminiAiModel,geminiPrivateContextAllowed,probeGeminiModel} from '../_lib/gemini-provider.js';

async function geminiProbe(req,res){
  const access=await memberAccess(req,'admin');
  if(!access.ok)return res.status(access.status).json({error:access.error});
  if(req.body?.probe!=='gemini')return res.status(400).json({error:'Unsupported probe'});
  if(!geminiAiConfigured('default'))return res.status(200).json({ok:false,configured:false,provider:'gemini',models:[],checkedAt:new Date().toISOString(),error:'Gemini configuration missing'});
  const fast=geminiAiModel('default'),research=geminiAiModel('research'),models=[...new Set([fast,research])];
  const checks=await Promise.all(models.map(model=>probeGeminiModel(model)));
  return res.status(200).json({ok:checks.every(item=>item.ok),configured:true,provider:'gemini',models:checks,checkedAt:new Date().toISOString()});
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='POST')return geminiProbe(req,res);
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const openAiReady=cloudAiConfigured(),geminiReady=geminiAiConfigured(),cloudReady=openAiReady||geminiReady;
  const academicProviderPriority=geminiReady?'gemini-first':openAiReady?'openai-fallback':'local-only';
  const model=geminiReady?geminiAiModel('research'):openAiReady?cloudAiModel():cloudAiModel();
  let centralRagReady=false,knowledgeStats=null;
  try{
    const stats=await publicRpc('ai_knowledge_stats_v3',{},3500);
    const total=Number(stats?.total||0),evidence=Number(stats?.evidence||0),pubmed=Number(stats?.pubmedVerified||0),scholar=Number(stats?.googleScholarLinks||0);
    const authority=Number(stats?.authoritySources||0),who=Number(stats?.whoVerified||0),nccih=Number(stats?.nccihVerified||0),cochrane=Number(stats?.cochraneVerified||0);
    if(total>=26&&evidence>=10&&pubmed>=10&&scholar>=10&&authority>=8&&who>=3&&nccih>=4&&cochrane>=1){
      centralRagReady=true;
      knowledgeStats={total,evidence,pubmedVerified:pubmed,googleScholarLinks:scholar,authoritySources:authority,whoVerified:who,nccihVerified:nccih,cochraneVerified:cochrane};
    }
  }catch{}
  return res.status(200).json({ok:true,ai:{
    mode:cloudReady?'multi-cloud+local':'local-only',
    cloudReady,
    providers:{openai:openAiReady,gemini:geminiReady},
    academicProviderPriority,
    defaultSearchProvider:geminiReady?'gemini-google-search':openAiReady?'openai-web-fallback':'local-fallback',
    localFallback:true,
    offlineFallback:true,
    centralRag:true,
    centralRagReady,
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
