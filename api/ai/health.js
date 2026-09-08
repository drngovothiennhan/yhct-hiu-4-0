import {cloudAiEnabled} from '../_lib/member-access.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const cloudReady=Boolean(cloudAiEnabled()&&process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL);
  return res.status(200).json({ok:true,ai:{mode:cloudReady?'cloud+local':'local-only',cloudReady,localFallback:true,structuredOutputs:true,citationWhitelist:true}});
}
