import {supabase} from './authService';
import {searchKnowledge as searchLocalKnowledge} from './miniAiEngine';
import type {KnowledgeHit,KnowledgeRecord,OmniFilter} from './miniAiEngine';

export type KnowledgeEvidence={
  id:string;
  title:string;
  citation:string;
  journal:string;
  publicationYear:number;
  evidenceType:'systematic_review'|'meta_analysis'|'systematic_review_meta_analysis'|'network_meta_analysis'|'review';
  evidenceNote:string;
  pmid:string;
  doi:string;
  pubmedUrl:string;
  googleScholarUrl:string;
  verified:boolean;
};

export type CentralKnowledgeHit=KnowledgeHit&{
  source:'central'|'local';
  evidence:KnowledgeEvidence[];
};

const clampLimit=(limit:number)=>Math.max(1,Math.min(Number.isFinite(limit)?Math.floor(limit):8,20));
const kindsForFilter=(filter:OmniFilter):string[]|null=>filter==='medicine'?['formula','herb']:filter==='acupoint'?['acupoint']:filter==='all'?null:[];
const safeEvidence=(value:unknown):KnowledgeEvidence[]=>Array.isArray(value)?value.filter(item=>item&&typeof item==='object'&&typeof (item as KnowledgeEvidence).pmid==='string'&&typeof (item as KnowledgeEvidence).pubmedUrl==='string').slice(0,8) as KnowledgeEvidence[]:[];

export async function searchKnowledgeCentralFirst(query:string,filter:OmniFilter='all',limit=8):Promise<CentralKnowledgeHit[]>{
  const clean=query.trim(),bounded=clampLimit(limit),started=performance.now();
  if(clean.length>=2&&['all','medicine','acupoint'].includes(filter)){
    try{
      const {data,error}=await supabase.rpc('ai_knowledge_search_v2',{p_query:clean,p_kinds:kindsForFilter(filter),p_limit:bounded});
      if(error)throw error;
      if(Array.isArray(data)&&data.length){
        const elapsedMs=Math.round((performance.now()-started)*10)/10;
        return data.slice(0,bounded).map((item:unknown)=>{
          const row=item as {record?:KnowledgeRecord&{evidence?:unknown};score?:number};
          const record=row.record||({id:'',kind:'herb',name:''} as KnowledgeRecord);
          return{record,score:Number(row.score)||0,elapsedMs,source:'central' as const,evidence:safeEvidence(record.evidence)};
        }).filter(hit=>Boolean(hit.record.id&&hit.record.name));
      }
    }catch{
      // Network/RPC failure intentionally falls through to the existing IndexedDB knowledge base.
    }
  }
  const local=await searchLocalKnowledge(clean,filter,bounded);
  return local.map(hit=>({...hit,source:'local' as const,evidence:[]}));
}

export const searchKnowledge=searchKnowledgeCentralFirst;

export function evidenceLabel(evidence:KnowledgeEvidence[],max=3){
  const verified=evidence.filter(item=>item.verified).slice(0,Math.max(1,Math.min(max,5)));
  if(!verified.length)return'';
  return verified.map(item=>`PMID ${item.pmid}${item.doi?` · DOI ${item.doi}`:''} · Google Scholar`).join(' | ');
}
