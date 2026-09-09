import {publicRpc} from '../_lib/member-access.js';

const boundedLimit=value=>Math.max(1,Math.min(100,Math.trunc(Number(value))||50));

export default async function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Method not allowed'});
  }
  res.setHeader('Cache-Control','no-store, max-age=0');
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
