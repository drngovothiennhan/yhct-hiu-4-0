import {cloudAiConfigured,cloudAiModel,publicRpc} from '../_lib/member-access.js';
import {geminiAiConfigured,geminiAiModel} from '../_lib/gemini-provider.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const openAiReady=cloudAiConfigured(),geminiReady=geminiAiConfigured(),cloudReady=openAiReady||geminiReady,model=openAiReady?cloudAiModel():geminiReady?geminiAiModel():cloudAiModel();
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
    geminiModel:geminiReady?geminiAiModel():null,
    privateContextToGemini:process.env.GEMINI_ALLOW_PRIVATE_CONTEXT==='true'
  }});
}
