import {useMemo,useState} from 'react';
import {Bot,ChevronDown,FileSearch,Languages,Lightbulb,Send,Sparkles,X} from 'lucide-react';
import type {Member} from '../../types';
import {searchOpenAlex,type ResearchWork} from '../../services/researchService';
import {askServerAi,renderAiAnswer} from '../../services/aiRuntimeService';
import {buildAcademicFallback,getLocalAiCapability,suggestResearchTopics,translateZeroCost} from '../../services/researchLocalAi';

type Mode='assistant'|'translate'|'topics';
type Props={member:Member;works:ResearchWork[];query:string;onOpenProposal:(title?:string)=>void};
const clean=(v:string)=>v.replace(/\s+/g,' ').trim();
const dedupe=(items:ResearchWork[])=>[...new Map(items.map(w=>[(w.doi||w.url||w.id).toLowerCase(),w])).values()];
const asSources=(items:ResearchWork[])=>items.slice(0,6).map(w=>({id:`${w.provider}:${w.id}`,title:w.title,text:`${w.abstract||w.title} ${w.authors.join(', ')} ${w.source} ${w.year||''}`.slice(0,4200),url:w.url}));

export default function ResearchAiMini({member,works,query,onOpenProposal}:Props){
  const [open,setOpen]=useState(false),[mode,setMode]=useState<Mode>('assistant'),[input,setInput]=useState(''),[answer,setAnswer]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[target,setTarget]=useState<'vi'|'en'>('vi');
  const capabilities=useMemo(()=>getLocalAiCapability(),[open]),topics=useMemo(()=>suggestResearchTopics(input||query,works,4),[input,query,works]);
  const ask=async()=>{const text=clean(input||query);if(!text||busy)return;setBusy(true);setNote('');try{
    const liveOpenAlex=await searchOpenAlex(text,6).catch(()=>[]),evidence=dedupe([...liveOpenAlex,...works]).slice(0,10),sources=asSources(evidence);
    if(sources.length){const result=await askServerAi(text,'research',sources);setAnswer(result.degraded?buildAcademicFallback(text,evidence):renderAiAnswer(result));setNote(result.degraded?`OpenAlex đã trả ${liveOpenAlex.length} kết quả; cloud A.I chưa khả dụng nên dùng fallback local 0đ.`:`OpenAlex live + A.I học thuật có nguồn · ${result.provider} · ${Math.round(result.latencyMs)} ms`)}
    else{try{const result=await askServerAi(text,'research',[]);setAnswer(result.degraded?buildAcademicFallback(text,evidence):renderAiAnswer(result));setNote(result.degraded?'OpenAlex chưa có kết quả và A.I cloud đang degraded; dùng fallback an toàn.':'A.I cloud đang trả lời không kèm nguồn phiên tìm kiếm; cần kiểm chứng tài liệu.')}catch{setAnswer(buildAcademicFallback(text,evidence));setNote('OpenAlex chưa có kết quả; fallback local 0đ.')}}
  }catch(e){setAnswer(buildAcademicFallback(text,works));setNote((e as Error).message||'A.I học thuật chưa khả dụng; đã dùng fallback local.')}finally{setBusy(false)}};
  const translate=async()=>{const text=input.trim();if(!text||busy)return;setBusy(true);setNote('');try{const result=await translateZeroCost(text,target);setAnswer(result.translation);setNote(result.provider==='chrome-local'?'Dịch bằng mô hình local của Chrome: không gửi văn bản lên server.':'Văn bản đã ở đúng ngôn ngữ đích.')}catch(e){setAnswer('');setNote((e as Error).message)}finally{setBusy(false)}};
  return <div className={`research-ai-mini ${open?'is-open':''}`}>
    {open&&<section className="research-ai-mini-panel" role="dialog" aria-label="Trợ lý A.I học thuật"><header><div><b><Bot/> Research A.I Mini</b><small>{member.herbalAlias||member.fullName} · thành viên</small></div><button className="icon-btn" onClick={()=>setOpen(false)} aria-label="Đóng"><X/></button></header>
      <div className="research-ai-status"><Sparkles/><span><b>A.I local-first + OpenAlex live</b><small>Translator local: {capabilities.translator?'sẵn sàng':'tùy Chrome'} · y văn OpenAlex được truy vấn lại theo câu hỏi</small></span></div>
      <div className="research-ai-tabs"><button className={mode==='assistant'?'active':''} onClick={()=>{setMode('assistant');setAnswer('');setNote('')}}><Bot/> Học thuật</button><button className={mode==='translate'?'active':''} onClick={()=>{setMode('translate');setAnswer('');setNote('')}}><Languages/> Dịch</button><button className={mode==='topics'?'active':''} onClick={()=>{setMode('topics');setAnswer('');setNote('')}}><Lightbulb/> Đề tài</button></div>
      {mode==='assistant'&&<><textarea maxLength={4000} value={input} onChange={e=>setInput(e.target.value)} placeholder={query?`Hỏi sâu về: ${query}`:'Hỏi về y văn, phương pháp, khoảng trống nghiên cứu…'}/><button className="research-ai-primary" disabled={busy||!clean(input||query)} onClick={()=>void ask()}><Send/>{busy?'Đang tra OpenAlex & tổng hợp…':'Hỏi A.I học thuật'}</button></>}
      {mode==='translate'&&<><div className="research-translate-head"><span>Dịch tài liệu bằng A.I local khi Chrome hỗ trợ</span><select value={target} onChange={e=>setTarget(e.target.value as 'vi'|'en')}><option value="vi">→ Tiếng Việt</option><option value="en">→ English</option></select></div><textarea maxLength={12000} value={input} onChange={e=>setInput(e.target.value)} placeholder="Dán đoạn tài liệu cần dịch…"/><button className="research-ai-primary" disabled={busy||!input.trim()} onClick={()=>void translate()}><Languages/>{busy?'Đang dịch…':'Dịch 0đ trên thiết bị'}</button></>}
      {mode==='topics'&&<><p className="muted">Đề xuất dựa trên từ khóa và y văn đang hiển thị; không tự khẳng định tính mới.</p><div className="research-topic-list">{topics.map(t=><article key={t.title}><b>{t.title}</b><small>{t.design}</small><p>{t.rationale}</p><button onClick={()=>onOpenProposal(t.title)}><FileSearch/> Dùng đề tài này</button></article>)}</div></>}
      {answer&&<article className="research-ai-answer"><b>Kết quả</b><p>{answer}</p></article>}{note&&<div className="ai-note" role="status">{note}</div>}
      <button className="secondary research-proposal-shortcut" onClick={()=>onOpenProposal(topics[0]?.title||query)}><FileSearch/> Tạo thuyết minh Mẫu 01-SV</button>
    </section>}
    <button className="research-ai-fab" onClick={()=>setOpen(v=>!v)} aria-expanded={open}><Bot/><span>Research A.I</span><ChevronDown/></button>
  </div>;
}
