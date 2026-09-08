import {cloudAiConfigured,cloudAiModel} from '../_lib/member-access.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const cloudReady=cloudAiConfigured(),model=cloudAiModel();
  return res.status(200).json({ok:true,ai:{mode:cloudReady?'cloud+local':'local-only',cloudReady,localFallback:true,structuredOutputs:true,citationWhitelist:true,functionCalling:true,roleBoundTools:true,readOnlyTools:true,model}});
}
