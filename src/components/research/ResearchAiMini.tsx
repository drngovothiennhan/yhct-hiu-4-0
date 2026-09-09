import {useMemo,useState} from 'react';
import {Bot,ChevronDown,FileSearch,Languages,Lightbulb,Send,Sparkles,X} from 'lucide-react';
import type {Member} from '../../types';
import {searchOpenAlex,type ResearchWork} from '../../services/researchService';
import {askServerAi,renderAiAnswer,type AiSource} from '../../modules/ai';
import {buildAcademicFallback,getLocalAiCapability,suggestResearchTopics} from '../../services/researchLocalAi';
import {translateAcademic} from '../../services/academicTranslationService';
import {searchDriveRag} from '../../services/driveRagService';
import {referenceLabel,searchKnowledge,type CentralKnowledgeHit} from '../../services/centralKnowledgeService';

type Mode='assistant'|'translate'|'topics';
type Props={member:Member;works:ResearchWork[];query:string;onOpenProposal:(title?:string)=>void};
const clean=(v:string)=>v.replace(/\s+/g,' ').trim();
const dedupe=(items:ResearchWork[])=>[...new Map(items.map(w=>[(w.doi||w.url||w.id).toLowerCase(),w])).values()];
const asSources=(items:ResearchWork[]):AiSource[]=>items.slice(0,6).map(w=>({id:`${w.provider}:${w.id}`,title:w.title,text:`${w.abstract||w.title} ${w.authors.join(', ')} ${w.source} ${w.year||''}`.slice(0,4200),url:w.url}));
const centralSources=(hits:CentralKnowledgeHit[]):AiSource[]=>hits.slice(0,5).map(h=>{
  const record=h.record as typeof h.record&{actions?:string;indications?:string;commonUses?:string;meridian?:string;category?:string};
  const evidence=h.evidence.find(x=>x.verified&&x.pubmedUrl?.startsWith('https://'));
  const authority=h.authoritySources.find(x=>x.verified&&x.sourceUrl?.startsWith('https://'));
  const provenance=referenceLabel(h.evidence,h.authoritySources,3);
  const body=[record.name,...(record.aliases||[]),record.category,record.actions,record.indications,record.commonUses,record.meridian,provenance].filter(Boolean).join(' · ');
  return{id:`central:${record.id}`,title:`${record.name}${h.source==='central'?' · Central RAG':' · Local KB'}`,text:body.slice(0,4200),url:evidence?.pubmedUrl||authority?.sourceUrl||null};
});

export default function ResearchAiMini({member,works,query,onOpenProposal}:Props){
  const [open,setOpen]=useState(false),[mode,setMode]=useState<Mode>('assistant'),[input,setInput]=useState(''),[answer,setAnswer]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[target,setTarget]=useState<'vi'|'en'>('vi');
  const capabilities=useMemo(()=>getLocalAiCapability(),[open]),topics=useMemo(()=>suggestResearchTopics(input||query,works,4),[input,query,works]);
  const ask=async()=>{const text=clean(input||query);if(!text||busy)return;setBusy(true);setNote('');try{
    const [drive,liveOpenAlex,central]=await Promise.all([searchDriveRag(text,4),searchOpenAlex(text,6).catch(()=>[]),searchKnowledge(text,'all',5).catch(()=>[])]),evidence=dedupe([...liveOpenAlex,...works]).slice(0,10),literature=asSources(evidence),knowledge=centralSources(central),sources=[...knowledge,...drive.sources,...literature].slice(0,6);
    if(sources.length){const result=await askServerAi(text,'research',sources);setAnswer(result.degraded?buildAcademicFallback(text,evidence):renderAiAnswer(result));const provenance=[central.length?`Central RAG ${central.length}`:'',drive.sources.length?`Drive ${drive.sources.length}`:'',liveOpenAlex.length?`OpenAlex ${liveOpenAlex.length}`:'',result.provider].filter(Boolean).join(' · ');setNote(result.degraded?`Nguồn đã truy xuất: ${provenance}. Cloud A.I đang chuyển chế độ nên dùng fallback học thuật có nguồn.`:`Nguồn: ${provenance} · ${Math.round(result.latencyMs)} ms`)}
    else{const result=await askServerAi(text,'research',[]);setAnswer(result.degraded?buildAcademicFallback(text,evidence):renderAiAnswer(result));setNote(result.degraded?'Drive/Central RAG/OpenAlex chưa có nguồn phù hợp; dùng fallback local.':'A.I cloud chưa có nguồn truy xuất trong lượt này; cần kiểm chứng.')}
  }catch(e){setAnswer(buildAcademicFallback(text,works));setNote((e as Error).message||'A.I học thuật chưa khả dụng; đã dùng fallback local.')}finally{setBusy(false)}};
  const translate=async()=>{const text=input.trim();if(!text||busy)return;setBusy(true);setNote('');const result=await translateAcademic(text,target);setAnswer(result.text);setNote(result.text?`Dịch qua ${result.provider}. Ưu tiên local Chrome; khi local không có sẽ dùng API dịch miễn phí, có thể chịu giới hạn công cộng.`:(result.note||'Chưa dịch được nội dung.'));setBusy(false)};
  return <div className={`research-ai-mini ${open?'is-open':''}`}>
    {open&&<section className="research-ai-mini-panel" role="dialog" aria-label="Trợ lý A.I học thuật"><header><div><b><Bot/> Research A.I Mini</b><small>{member.herbalAlias||member.fullName} · thành viên</small></div><button className="icon-btn" onClick={()=>setOpen(false)} aria-label="Đóng"><X/></button></header>
      <div className="research-ai-status"><Sparkles/><span><b>AI Platform · Cloud + Drive RAG + Central RAG + OpenAlex</b><small>Kho học thuật tập trung ở Trung tâm nghiên cứu · Translator local: {capabilities.translator?'sẵn sàng':'fallback API miễn phí'}</small></span></div>
      <div className="research-ai-tabs"><button className={mode==='assistant'?'active':''} onClick={()=>{setMode('assistant');setAnswer('');setNote('')}}><Bot/> Học thuật</button><button className={mode==='translate'?'active':''} onClick={()=>{setMode('translate');setAnswer('');setNote('')}}><Languages/> Dịch</button><button className={mode==='topics'?'active':''} onClick={()=>{setMode('topics');setAnswer('');setNote('')}}><Lightbulb/> Đề tài</button></div>
      {mode==='assistant'&&<><textarea maxLength={4000} value={input} onChange={e=>setInput(e.target.value)} placeholder={query?`Hỏi sâu về: ${query}`:'Hỏi về y văn, phương pháp, khoảng trống nghiên cứu…'}/><button className="research-ai-primary" disabled={busy||!clean(input||query)} onClick={()=>void ask()}><Send/>{busy?'Đang truy xuất Central RAG/Drive/OpenAlex…':'Hỏi A.I học thuật'}</button></>}
      {mode==='translate'&&<><div className="research-translate-head"><span>Dịch học thuật: local Chrome → API miễn phí</span><select value={target} onChange={e=>setTarget(e.target.value as 'vi'|'en')}><option value="vi">→ Tiếng Việt</option><option value="en">→ English</option></select></div><textarea maxLength={5000} value={input} onChange={e=>setInput(e.target.value)} placeholder="Dán đoạn tài liệu cần dịch…"/><button className="research-ai-primary" disabled={busy||!input.trim()} onClick={()=>void translate()}><Languages/>{busy?'Đang dịch…':'Dịch học thuật'}</button></>}
      {mode==='topics'&&<><p className="muted">Đề xuất dựa trên từ khóa và y văn đang hiển thị; không tự khẳng định tính mới.</p><div className="research-topic-list">{topics.map(t=><article key={t.title}><b>{t.title}</b><small>{t.design}</small><p>{t.rationale}</p><button onClick={()=>onOpenProposal(t.title)}><FileSearch/> Dùng đề tài này</button></article>)}</div></>}
      {answer&&<article className="research-ai-answer"><b>Kết quả</b><p>{answer}</p></article>}{note&&<div className="ai-note" role="status">{note}</div>}
      <button className="secondary research-proposal-shortcut" onClick={()=>onOpenProposal(topics[0]?.title||query)}><FileSearch/> Tạo thuyết minh Mẫu 01-SV</button>
    </section>}
    <button className="research-ai-fab" onClick={()=>setOpen(v=>!v)} aria-expanded={open}><Bot/><span>Research A.I</span><ChevronDown/></button>
  </div>;
}
