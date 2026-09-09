import {publicRpc} from './_lib/member-access.js';

const boundedLimit=value=>Math.max(1,Math.min(100,Math.trunc(Number(value))||50));

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');

  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }

  if(req.query?.resource==='academic-feed'){
    res.setHeader('CDN-Cache-Control','no-store');
    try{
      const limit=boundedLimit(req.query?.limit);
      const posts=await publicRpc('academic_feed_v1',{p_limit:limit},6500);
      return res.status(200).json(Array.isArray(posts)?posts:[]);
    }catch(error){
      console.error('public feed gateway failed',String(error?.message||error));
      return res.status(503).json({error:'Academic feed temporarily unavailable'});
    }
  }

  return res.status(200).json({ok:true,app:'YHCT HIU 4.0',version:'4.0.0-final.6-modular',apiVersion:'v1',webFirst:true,moduleIsolation:'final4-modular-v1',installablePwa:true,zeroMandatoryPaidDependency:true,serverTime:new Date().toISOString()});
}
