import {memberAccess} from '../_lib/member-access.js';
import {geminiAiConfigured,geminiAiModel} from '../_lib/gemini-provider.js';

const TIMEOUT_MS=7000;
const clean=(value,max=180)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

async function probeModel(model){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,{
      method:'GET',signal:controller.signal,
      headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,accept:'application/json'}
    });
    const payload=await response.json().catch(()=>null);
    return{
      model,
      ok:response.ok,
      status:response.status,
      displayName:clean(payload?.displayName||payload?.name||model,120),
      error:response.ok?'':clean(payload?.error?.message||`HTTP ${response.status}`)
    };
  }catch(error){
    return{model,ok:false,status:0,displayName:model,error:error?.name==='AbortError'?'timeout':clean(error?.message||'network error')};
  }finally{clearTimeout(timer)}
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const access=await memberAccess(req,'admin');
  if(!access.ok)return res.status(access.status).json({error:access.error});
  if(!geminiAiConfigured('default'))return res.status(200).json({ok:false,configured:false,provider:'gemini',models:[],checkedAt:new Date().toISOString(),error:'Gemini configuration missing'});
  const fast=geminiAiModel('default'),research=geminiAiModel('research'),models=[...new Set([fast,research])];
  const checks=await Promise.all(models.map(probeModel));
  return res.status(200).json({
    ok:checks.every(item=>item.ok),
    configured:true,
    provider:'gemini',
    models:checks,
    checkedAt:new Date().toISOString()
  });
}
