import {ensureActive,requestDeadline} from './aiRequest';
import type {ResearchWork} from './researchService';

export type ResearchEvidenceResult={works:ResearchWork[];query:string;unavailableProviders:string[]};
const PROVIDERS=new Set<ResearchWork['provider']>(['Europe PMC','OpenAlex','ClinicalTrials.gov','Crossref']);
const clean=(value:unknown,max=500)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const workOf=(value:unknown):ResearchWork|null=>{
  if(!value||typeof value!=='object')return null;
  const x=value as Record<string,unknown>,provider=String(x.provider||'') as ResearchWork['provider'],id=clean(x.id,400),title=clean(x.title,500),url=clean(x.url,1400);
  if(!PROVIDERS.has(provider)||!id||!title||!url.startsWith('https://'))return null;
  return{id,title,authors:Array.isArray(x.authors)?x.authors.map(v=>clean(v,180)).filter(Boolean).slice(0,12):[],year:Number.isFinite(Number(x.year))&&Number(x.year)>0?Number(x.year):null,source:clean(x.source,300)||provider,url,doi:clean(x.doi,300)||undefined,abstract:clean(x.abstract,5000)||undefined,citedBy:Number.isFinite(Number(x.citedBy))&&Number(x.citedBy)>=0?Number(x.citedBy):undefined,provider};
};

export async function searchResearchEvidence(query:string,limit=18,signal?:AbortSignal):Promise<ResearchEvidenceResult>{
  const text=clean(query);if(text.length<2)throw new Error('Nhập chủ đề nghiên cứu rõ hơn.');
  ensureActive(signal);const deadline=requestDeadline(12000,signal);
  try{
    const response=await fetch('/api/knowledge/resources?action=research',{method:'POST',signal:deadline.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({query:text,limit:Math.max(1,Math.min(Number(limit)||18,24))})});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||payload?.ok!==true)throw new Error(clean(payload?.error,300)||'Nguồn bằng chứng công khai tạm thời chưa phản hồi.');
    const data=payload.data||{},works=(Array.isArray(data.works)?data.works:[]).map(workOf).filter((work):work is ResearchWork=>Boolean(work));
    const unavailableProviders=Array.isArray(data.unavailableProviders)?data.unavailableProviders.map((v:unknown)=>clean(v,80)).filter(Boolean).slice(0,4):[];
    return{works,query:clean(data.query)||text,unavailableProviders};
  }catch(error){
    ensureActive(signal);
    if(deadline.signal.aborted)throw new Error('Tra cứu bằng chứng quá thời gian chờ. Hãy thử lại.');
    throw error;
  }finally{deadline.dispose()}
}
