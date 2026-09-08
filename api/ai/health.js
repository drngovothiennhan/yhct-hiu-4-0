import {cloudAiConfigured,cloudAiModel,publicRpc} from '../_lib/member-access.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const cloudReady=cloudAiConfigured(),model=cloudAiModel();
  let centralRagReady=false,knowledgeStats=null;
  try{
    const stats=await publicRpc('ai_knowledge_stats_v2',{},3500);
    const total=Number(stats?.total||0),evidence=Number(stats?.evidence||0),pubmed=Number(stats?.pubmedVerified||0),scholar=Number(stats?.googleScholarLinks||0);
    if(total>=26&&evidence>=10&&pubmed>=10&&scholar>=10){centralRagReady=true;knowledgeStats:{total:number;evidence:number;pubmedVerified:number;googleScholarLinks:number};knowledgeStats={total,evidence,pubmedVerified:pubmed,googleScholarLinks:scholar};}
  }catch{}
  return res.status(200).json({ok:true,ai:{
    mode:cloudReady?'cloud+local':'local-only',
    cloudReady,
    localFallback:true,
    offlineFallback:true,
    centralRag:true,
    centralRagReady,
    evidenceBacked:true,
    evidenceSources:['pubmed','google_scholar'],
    knowledgeStats,
    structuredOutputs:true,
    citationWhitelist:true,
    functionCalling:true,
    roleBoundTools:true,
    readOnlyTools:true,
    model
  }});
}
