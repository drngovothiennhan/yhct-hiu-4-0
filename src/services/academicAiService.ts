import {ensureActive} from './aiRequest';
import {askServerAi,renderAiAnswer,type AiSource} from '../modules/ai';
import {buildAcademicFallback} from './researchLocalAi';
import {searchDriveRag} from './driveRagService';
import {referenceLabel,searchKnowledge,type CentralKnowledgeHit} from './centralKnowledgeService';
import {searchOpenAlex,type ResearchWork} from './researchService';
import {askXiaoZhiMini,type XiaoZhiReply} from './xiaozhiMiniService';

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
const cleanContext=(value:string)=>value.replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(-1400);
const dedupe=(items:ResearchWork[])=>[...new Map(items.map(work=>[(work.doi||work.url||work.id).toLowerCase(),work])).values()];
const literatureSources=(items:ResearchWork[]):AiSource[]=>items.slice(0,6).map(work=>({id:`${work.provider}:${work.id}`,title:work.title,text:`${work.abstract||work.title} ${work.authors.join(', ')} ${work.source} ${work.year||''}`.slice(0,4200),url:work.url}));
const centralSources=(hits:CentralKnowledgeHit[]):AiSource[]=>hits.slice(0,5).map(hit=>{
  const record=hit.record as typeof hit.record&{actions?:string;indications?:string;commonUses?:string;meridian?:string;category?:string};
  const evidence=hit.evidence.find(item=>item.verified&&item.pubmedUrl?.startsWith('https://'));
  const authority=hit.authoritySources.find(item=>item.verified&&item.sourceUrl?.startsWith('https://'));
  const provenance=referenceLabel(hit.evidence,hit.authoritySources,3);
  return{id:`central:${record.id}`,title:`${record.name}${hit.source==='central'?' · Central RAG':' · Local KB'}`,text:[record.name,...(record.aliases||[]),record.category,record.actions,record.indications,record.commonUses,record.meridian,provenance].filter(Boolean).join(' · ').slice(0,4200),url:evidence?.pubmedUrl||authority?.sourceUrl||null};
});
const publicEvidence=(reply:XiaoZhiReply|null):AiSource[]=>reply?.answer?[{id:'web:gemini-google-search',title:'Gemini · Google Search',text:reply.answer.slice(0,4200),url:reply.sources[0]?.url||null}]:[];
const uniqueLinks=(items:Array<{title:string;url:string}>)=>[...new Map(items.filter(item=>item.url?.startsWith('https://')).map(item=>[item.url,item])).values()].slice(0,8);

const publicLiteratureCache=new Map<string,{expires:number;works:ResearchWork[]}>();
async function publicLiterature(query:string){const key=query.toLocaleLowerCase();const cached=publicLiteratureCache.get(key);if(cached&&cached.expires>Date.now())return cached.works;const works=await searchOpenAlex(query,6,false);if(works.length){if(publicLiteratureCache.size>=40)publicLiteratureCache.delete(publicLiteratureCache.keys().next().value!);publicLiteratureCache.set(key,{expires:Date.now()+300000,works})}return works}
async function fallbackAcademic(query:string,localWorks:ResearchWork[]){const works=dedupe([...localWorks,...await publicLiterature(query).catch(()=>[])]).slice(0,8);return{answer:buildAcademicFallback(query,works),sources:works.filter(work=>work.url?.startsWith('https://')).slice(0,6).map(work=>({title:work.title,url:work.url})),provider:'local-research',degraded:true,latencyMs:0,provenance:works.length?`OpenAlex fallback ${works.length}`:'Local fallback',suggestedQueries:[]}}

export async function askAcademicUnified(rawQuery:string,localWorks:ResearchWork[]=[],conversationContext='',signal?:AbortSignal,useInternal=false):Promise<AcademicAiReply>{
  const query=clean(rawQuery).slice(0,1600);if(query.length<2)throw new Error('Câu hỏi học thuật quá ngắn.');
  const context=cleanContext(conversationContext);

  if(!useInternal){
    try{
      const web=await askXiaoZhiMini(query,context,signal);ensureActive(signal);
      return{answer:web.answer,sources:uniqueLinks(web.sources),provider:web.provider,degraded:web.degraded,latencyMs:web.latencyMs,provenance:`${web.provider} · Google Search`,suggestedQueries:[]};
    }catch{
      ensureActive(signal);return fallbackAcademic(query,localWorks);
    }
  }

  const [drive,central,web]=await Promise.all([
    searchDriveRag(query,4,signal).catch(()=>({sources:[],degraded:true,reason:'network'})),
    searchKnowledge(query,'all',5).catch(()=>[]),
    askXiaoZhiMini(query,context,signal).catch(()=>null)
  ]);
  ensureActive(signal);

  const internalSources=[...centralSources(central).slice(0,2),...drive.sources.slice(0,3)],sources=[...internalSources,...publicEvidence(web)].slice(0,6);
  if(!internalSources.length){
    if(web)return{answer:`${web.answer}\n\nTôi chưa tìm thấy tài liệu nội bộ phù hợp để đối chiếu cho câu hỏi này.`,sources:uniqueLinks(web.sources),provider:web.provider,degraded:web.degraded||drive.degraded,latencyMs:web.latencyMs,provenance:`${web.provider} · Drive/Central RAG: 0 kết quả`,suggestedQueries:[]};
    return fallbackAcademic(query,localWorks);
  }

  const continuity=context?` Ngữ cảnh hội thoại/module gần nhất: ${context}. Chỉ dùng ngữ cảnh này để hiểu câu hỏi nối tiếp; nếu mâu thuẫn với bằng chứng mới truy xuất thì ưu tiên bằng chứng và nói rõ khác biệt.`:'';
  const prompt=`Bạn là trợ lý học thuật Y học cổ truyền cho sinh viên HIU. Người dùng đã chủ động bật “Dùng tài liệu nội bộ”. Hãy phân tích các tài liệu Drive/Central RAG được cung cấp, đối chiếu chúng với kết quả Gemini Google Search nếu có, rồi đưa ra một câu trả lời cuối cùng. Nêu ngắn gọn điểm thống nhất hoặc khác biệt quan trọng; không bịa nguồn; phân biệt kiến thức kinh điển với bằng chứng hiện đại khi cần; không thay thế chẩn đoán hoặc điều trị trực tiếp cho người bệnh. Câu hỏi hiện tại: ${query}.${continuity}`;
  const result=await askServerAi(prompt,'research',sources,signal,{useInternal:true});ensureActive(signal);
  const resultLinks=result.citations.filter(c=>c.url?.startsWith('https://')).map(c=>({title:c.label,url:c.url!}));
  const webLinks=web?.sources||[];
  const provenance=[web?`${web.provider} · Google Search`:'',central.length?`Central RAG ${central.length}`:'',drive.sources.length?`Drive ${drive.sources.length}`:'',result.provider].filter(Boolean).join(' · ');
  const answer=result.degraded&&web?`${web.answer}\n\nChưa thể hoàn tất bước tổng hợp tài liệu nội bộ bằng Gemini; kết quả trên hiện chỉ phản ánh nguồn công khai.`:renderAiAnswer(result);
  return{answer,sources:uniqueLinks([...resultLinks,...webLinks]),provider:result.provider,degraded:result.degraded,latencyMs:result.latencyMs+(web?.latencyMs||0),provenance,suggestedQueries:result.suggestedQueries};
}
