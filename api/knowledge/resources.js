import {getLearningResource,listLearningResources,publishLearningResource,upsertLearningResource} from '../_lib/knowledge-gateway.js';
import {retrievePublicResearchEvidence} from '../_lib/public-medical-evidence.js';
import {serveProtectedLearningResource} from '../_lib/learning-resource-reader.js';

const send=(res,result)=>res.status(result.status||500).json(result.ok?{ok:true,data:result.data}:{ok:false,error:result.error||'Request failed'});
const actionOf=req=>String(req.query?.action||req.body?.action||'').trim().toLowerCase();
const clean=value=>String(value||'').replace(/\s+/g,' ').trim().slice(0,500);

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization, Origin');
  const origin=String(req.headers?.origin||'');
  if(origin==='https://hiutmc.com'||origin==='https://www.hiutmc.com'){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers','Accept-Ranges, Content-Length, Content-Range, Content-Type');
    res.setHeader('Access-Control-Max-Age','600');
  }
  if(req.method==='OPTIONS')return res.status(204).end();
  const action=actionOf(req);

  if(req.method==='GET'&&action==='reader')return serveProtectedLearningResource(req,res);

  if(req.method==='GET'){
    if(action==='get')return send(res,await getLearningResource(req,req.query?.key));
    const includeDrafts=String(req.query?.includeDrafts||'')==='1';
    return send(res,await listLearningResources(req,{limit:req.query?.limit,includeDrafts}));
  }

  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  if(action==='research'){
    const query=clean(req.body?.query),limit=Math.max(1,Math.min(Number(req.body?.limit)||18,24));
    if(query.length<2)return res.status(400).json({ok:false,error:'Query is required'});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10500);
    try{
      const data=await retrievePublicResearchEvidence(query,{signal:controller.signal,limit});
      return res.status(200).json({ok:true,data});
    }catch{
      return res.status(502).json({ok:false,error:'Nguồn bằng chứng công khai tạm thời chưa phản hồi.'});
    }finally{clearTimeout(timer)}
  }
  if(action==='upsert')return send(res,await upsertLearningResource(req,req.body||{}));
  if(action==='publish')return send(res,await publishLearningResource(req,req.body?.key,req.body?.status));
  return res.status(400).json({ok:false,error:'Invalid action'});
}
