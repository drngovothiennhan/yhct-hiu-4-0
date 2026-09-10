import {askServerAi,renderAiAnswer,type AiSource} from '../modules/ai';
import {buildAcademicFallback} from './researchLocalAi';
import {searchDriveRag} from './driveRagService';
import {referenceLabel,searchKnowledge,type CentralKnowledgeHit} from './centralKnowledgeService';
import {searchOpenAlex,type ResearchWork} from './researchService';

export type AcademicAiReply={
  answer:string;
  sources:Array<{title:string;url:string}>;
  provider:string;
  degraded:boolean;
  latencyMs:number;
  provenance:string;
  suggestedQueries:string[];
};

const clean=(value:string)=>value.replace(/\s+/g,' ').trim().slice(0,4000);
const cleanContext=(value:string)=>value.replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,5000);
const dedupe=(items:ResearchWork[])=>[...new Map(items.map(work=>[(work.doi||work.url||work.id).toLowerCase(),work])).values()];
const literatureSources=(items:ResearchWork[]):AiSource[]=>items.slice(0,6).map(work=>({id:`${work.provider}:${work.id}`,title:work.title,text:`${work.abstract||work.title} ${work.authors.join(', ')} ${work.source} ${work.year||''}`.slice(0,4200),url:work.url}));
const centralSources=(hits:CentralKnowledgeHit[]):AiSource[]=>hits.slice(0,5).map(hit=>{
  const record=hit.record as typeof hit.record&{actions?:string;indications?:string;commonUses?:string;meridian?:string;category?:string};
  const evidence=hit.evidence.find(item=>item.verified&&item.pubmedUrl?.startsWith('https://'));
  const authority=hit.authoritySources.find(item=>item.verified&&item.sourceUrl?.startsWith('https://'));
  const provenance=referenceLabel(hit.evidence,hit.authoritySources,3);
  return{id:`central:${record.id}`,title:`${record.name}${hit.source==='central'?' · Central RAG':' · Local KB'}`,text:[record.name,...(record.aliases||[]),record.category,record.actions,record.indications,record.commonUses,record.meridian,provenance].filter(Boolean).join(' · ').slice(0,4200),url:evidence?.pubmedUrl||authority?.sourceUrl||null};
});

export async function askAcademicUnified(rawQuery:string,localWorks:ResearchWork[]=[],conversationContext=''):Promise<AcademicAiReply>{
  const query=clean(rawQuery);if(query.length<2)throw new Error('Câu hỏi học thuật quá ngắn.');
  const context=cleanContext(conversationContext);
  const [drive,openAlex,central]=await Promise.all([
    searchDriveRag(query,4).catch(()=>({sources:[],degraded:true,reason:'network'})),
    searchOpenAlex(query,6).catch(()=>[]),
    searchKnowledge(query,'all',5).catch(()=>[])
  ]);
  const evidence=dedupe([...openAlex,...localWorks]).slice(0,10),sources=[...centralSources(central),...drive.sources,...literatureSources(evidence)].slice(0,6);
  const continuity=context?` Ngữ cảnh hội thoại/module gần nhất: ${context}. Chỉ dùng ngữ cảnh này để hiểu câu hỏi nối tiếp; nếu mâu thuẫn với nguồn học thuật mới truy xuất thì ưu tiên nguồn và nói rõ khác biệt.`:'';
  const result=await askServerAi(`Bạn là trợ lý học thuật Y học cổ truyền cho sinh viên HIU. Trả lời câu hỏi sau dựa trên nguồn đã truy xuất, phân biệt kiến thức kinh điển với bằng chứng hiện đại khi cần, không bịa nguồn và không thay thế chẩn đoán/điều trị trực tiếp cho người bệnh.${continuity} Câu hỏi hiện tại: ${query}`,'research',sources);
  const provenance=[central.length?`Central RAG ${central.length}`:'',drive.sources.length?`Drive ${drive.sources.length}`:'',openAlex.length?`OpenAlex ${openAlex.length}`:'',result.provider].filter(Boolean).join(' · ');
  const links=sources.filter(source=>typeof source.url==='string'&&source.url.startsWith('https://')).map(source=>({title:source.title,url:source.url as string}));
  return{answer:result.degraded?buildAcademicFallback(query,evidence):renderAiAnswer(result),sources:links,provider:result.provider,degraded:result.degraded,latencyMs:result.latencyMs,provenance,suggestedQueries:result.suggestedQueries};
}
