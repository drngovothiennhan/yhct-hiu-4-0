import {getLearningResource,listLearningResources,publishLearningResource,upsertLearningResource} from '../_lib/knowledge-gateway.js';

const send=(res,result)=>res.status(result.status||500).json(result.ok?{ok:true,data:result.data}:{ok:false,error:result.error||'Request failed'});
const actionOf=req=>String(req.query?.action||req.body?.action||'').trim().toLowerCase();

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  const action=actionOf(req);

  if(req.method==='GET'){
    if(action==='get')return send(res,await getLearningResource(req,req.query?.key));
    const includeDrafts=String(req.query?.includeDrafts||'')==='1';
    return send(res,await listLearningResources(req,{limit:req.query?.limit,includeDrafts}));
  }

  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(action==='upsert')return send(res,await upsertLearningResource(req,req.body||{}));
  if(action==='publish')return send(res,await publishLearningResource(req,req.body?.key,req.body?.status));
  return res.status(400).json({ok:false,error:'Invalid action'});
}
