import {useEffect,useMemo,useRef,useState} from 'react';
import {Bot,ChevronDown,Database,ExternalLink,FileSearch,Languages,Lightbulb,RotateCcw,Send,Sparkles,X} from 'lucide-react';
import type {Member} from '../../types';
import {searchOpenAlex,type ResearchWork} from '../../services/researchService';
import {askServerAi,type AiCitation,type AiSource} from '../../modules/ai';
import {buildAcademicFallback,getLocalAiCapability,suggestResearchTopics} from '../../services/researchLocalAi';
import {translateAcademic} from '../../services/academicTranslationService';
import {searchDriveRag} from '../../services/driveRagService';
import {referenceLabel,searchKnowledge,type CentralKnowledgeHit} from '../../services/centralKnowledgeService';
import '../../research-ai-leader.css';

type Mode='assistant'|'translate'|'topics';
type Props={member:Member;works:ResearchWork[];query:string;onOpenProposal:(title?:string)=>void};
type ThreadMessage={id:string;role:'user'|'assistant';text:string;citations?:AiCitation[];meta?:string};
const PENDING_KEY='yhct-research-pending-query-v1';
const clean=(v:string)=>v.replace(/\s+/g,' ').trim();
const dedupe=(items:ResearchWork[])=>[...new Map(items.map(w=>[(w.doi||w.url||w.id).toLowerCase(),w])).values()];
const asSources=(items:ResearchWork[]):AiSource[]=>items.slice(0,6).map(w=>({id:`${w.provider}:${w.id}`,title:w.title,text:`${w.abstract||w.title} ${w.authors.join(', ')} ${w.source} ${w.year||''}`.slice(0,4200),url:w.url}));
const sourceCitations=(sources:AiSource[]):AiCitation[]=>sources.filter(s=>s.title).slice(0,6).map(s=>({id:s.id,label:s.title,url:s.url||null}));
const provenanceLine=(citations:AiCitation[])=>citations.length?`\n\nNguồn đã truy xuất: ${citations.map((c,i)=>`[${i+1}] ${c.label}`).join(' · ')}`:'';
const centralSources=(hits:CentralKnowledgeHit[]):AiSource[]=>hits.slice(0,5).map(h=>{const record=h.record as typeof h.record&{actions?:string;indications?:string;commonUses?:string;meridian?:string;category?:string};const evidence=h.evidence.find(x=>x.verified&&x.pubmedUrl?.startsWith('https://'));const authority=h.authoritySources.find(x=>x.verified&&x.sourceUrl?.startsWith('https://'));const provenance=referenceLabel(h.evidence,h.authoritySources,3);const body=[record.name,...(record.aliases||[]),record.category,record.actions,record.indications,record.commonUses,record.meridian,provenance].filter(Boolean).join(' · ');return{id:`central:${record.id}`,title:`${record.name}${h.source==='central'?' · Central RAG':' · Local KB'}`,text:body.slice(0,4200),url:evidence?.pubmedUrl||authority?.sourceUrl||null}});
const threadContext=(items:ThreadMessage[])=>items.slice(-8).map(item=>`${item.role==='user'?'NGƯỜI DÙNG':'GEMINI LEADER'}: ${clean(item.text).slice(0,900)}`).join('\n').slice(0,6500);

export default function ResearchAiMini({member,works,query,onOpenProposal}:Props){
  const [open,setOpen]=useState(false),[mode,setMode]=useState<Mode>('assistant'),[input,setInput]=useState(''),[messages,setMessages]=useState<ThreadMessage[]>([]),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[target,setTarget]=useState<'vi'|'en'>('vi'),[useInternal,setUseInternal]=useState(false),[suggestions,setSuggestions]=useState<string[]>([]);
  const pending=useRef<AbortController|null>(null),queued=useRef('');
  const capabilities=useMemo(()=>getLocalAiCapability(),[open]),topics=useMemo(()=>suggestResearchTopics(input||query,works,4),[input,query,works]);
  const cancel=()=>{pending.current?.abort();pending.current=null;setBusy(false);setNote('Đã hủy yêu cầu hiện tại. Cuộc hội thoại vẫn được giữ.');};
  const reset=()=>{cancel();setMessages([]);setSuggestions([]);setInput('');setNote('Đã bắt đầu phiên nghiên cứu mới.');};
  useEffect(()=>()=>{pending.current?.abort()},[member.id]);

  const ask=async(raw?:string)=>{const text=clean(raw||input||query);if(!text||busy)return;const controller=new AbortController();pending.current=controller;setBusy(true);setNote('Gemini Leader đang phân công nguồn…');setMessages(xs=>[...xs,{id:crypto.randomUUID(),role:'user',text}].slice(-18));setInput('');try{
    const [drive,liveOpenAlex,central]=await Promise.all([useInternal?searchDriveRag(text,4,controller.signal):Promise.resolve({sources:[],degraded:false}),searchOpenAlex(text,6).catch(()=>[]),useInternal?searchKnowledge(text,'all',5).catch(()=>[]):Promise.resolve([])]);
    if(controller.signal.aborted)return;
    const evidence=dedupe([...liveOpenAlex,...works]).slice(0,10),literature=asSources(evidence),knowledge=centralSources(central),sources=[...knowledge,...drive.sources,...literature].slice(0,6),workers=[liveOpenAlex.length?`OpenAlex ${liveOpenAlex.length}`:'OpenAlex 0',useInternal?`Drive ${drive.sources.length}`:'Drive tắt',useInternal?`Central RAG ${central.length}`:'Central RAG tắt'];
    const leaderPrompt=['RESEARCH_LEADER=GEMINI',`CÂU HỎI MỚI: ${text}`,`NGỮ CẢNH HỘI THOẠI:\n${threadContext(messages)||'(lượt đầu)'}`,`WORKERS ĐÃ THỰC THI: ${workers.join(' · ')}`,'Bạn là leader của Trung tâm nghiên cứu: tổng hợp kết quả workers, đối chiếu nguồn, phát hiện mâu thuẫn/thiếu bằng chứng, trả lời trực tiếp câu hỏi mới và đề xuất tối đa 3 bước hỏi tiếp hữu ích. Không bịa dữ liệu hoặc nguồn.'].join('\n');
    const result=await askServerAi(leaderPrompt,'research',sources,controller.signal,{useInternal});if(controller.signal.aborted)return;
    const fallbackRefs=sourceCitations(sources),citations=result.citations.length?result.citations:fallbackRefs,answer=result.degraded?`${buildAcademicFallback(text,evidence)}${provenanceLine(citations)}`:result.answer;
    setMessages(xs=>[...xs,{id:crypto.randomUUID(),role:'assistant',text:answer,citations,meta:`Gemini Leader · ${workers.join(' · ')}${result.degraded?' · fallback':''}`}].slice(-18));
    setSuggestions(result.suggestedQueries.length?result.suggestedQueries:['Đâu là bằng chứng mạnh nhất cho kết luận vừa rồi?','Có điểm nào còn mâu thuẫn giữa các nguồn?','Đề xuất bước nghiên cứu tiếp theo phù hợp.']);
    setNote(`Gemini Leader · ${workers.join(' · ')} · ${Math.round(result.latencyMs)} ms`);
  }catch(e){if(controller.signal.aborted)return;const fallbackSources=asSources(works),citations=sourceCitations(fallbackSources),fallback=`${buildAcademicFallback(text,works)}${provenanceLine(citations)}`;setMessages(xs=>[...xs,{id:crypto.randomUUID(),role:'assistant',text:fallback,citations,meta:'Fallback học thuật cục bộ · vẫn giữ provenance nguồn'}].slice(-18));setSuggestions([]);setNote((e as Error).message||'Research A.I chưa khả dụng; đã dùng fallback local có nguồn.')}finally{if(pending.current===controller){pending.current=null;setBusy(false)}}};

  useEffect(()=>{let seed='';try{seed=clean(localStorage.getItem(PENDING_KEY)||'');if(seed)localStorage.removeItem(PENDING_KEY)}catch{}if(!seed||queued.current===seed)return;queued.current=seed;setOpen(true);setMode('assistant');setInput(seed);const id=window.setTimeout(()=>void ask(seed),50);return()=>window.clearTimeout(id)},[member.id]);

  const translate=async()=>{const text=clean(input);if(!text||busy)return;const controller=new AbortController();pending.current=controller;setBusy(true);setNote('Gemini Leader → Translator worker');setMessages(xs=>[...xs,{id:crypto.randomUUID(),role:'user',text:`Dịch học thuật (${target==='vi'?'→ Tiếng Việt':'→ English'}): ${text}`}].slice(-18));try{const result=await translateAcademic(text,target);if(controller.signal.aborted)return;const answer=result.text||result.note||'Chưa dịch được nội dung.';setMessages(xs=>[...xs,{id:crypto.randomUUID(),role:'assistant',text:answer,meta:`Translator worker · ${result.provider}`}].slice(-18));setInput('');setSuggestions(['Giải thích các thuật ngữ chuyên môn trong bản dịch','Tóm tắt bản dịch thành các ý nghiên cứu chính']);setNote(`Gemini Leader đã nhận kết quả từ Translator · ${result.provider}`)}catch(e){if(!controller.signal.aborted)setNote((e as Error).message)}finally{if(pending.current===controller){pending.current=null;setBusy(false)}}};

  return <div className={`research-ai-mini research-ai-leader ${open?'is-open':''}`}>
    {open&&<section className="research-ai-mini-panel research-leader-panel" role="dialog" aria-label="Gemini Research A.I"><header><div><b><Bot/> Gemini Research · Leader</b><small>{member.herbalAlias||member.fullName} · hội thoại nghiên cứu liên tục</small></div><button className="icon-btn" onClick={()=>{cancel();setOpen(false)}} aria-label="Đóng"><X/></button></header>
      <div className="research-ai-status"><Sparkles/><span><b>Gemini điều phối toàn bộ Trung tâm nghiên cứu</b><small>Gemini Leader → OpenAlex · Central RAG · Drive RAG · Translator · công cụ đề tài</small></span></div>
      <div className="research-worker-strip"><span className="active">Gemini Leader</span><span>OpenAlex</span><span>Central RAG</span><span>Drive RAG</span><span>Translator</span></div>
      <div className="research-ai-tabs"><button className={mode==='assistant'?'active':''} onClick={()=>{cancel();setMode('assistant')}}><Bot/> Hội thoại</button><button className={mode==='translate'?'active':''} onClick={()=>{cancel();setMode('translate')}}><Languages/> Dịch</button><button className={mode==='topics'?'active':''} onClick={()=>{cancel();setMode('topics')}}><Lightbulb/> Đề tài</button></div>
      {mode==='assistant'&&<><label className="research-internal-toggle"><Database/><span><b>Dùng tài liệu nội bộ</b><small>{useInternal?'Gemini Leader được phép đối chiếu Drive + Central RAG trong lượt hỏi':'Mặc định chỉ dùng nguồn học thuật công khai/OpenAlex'}</small></span><input type="checkbox" checked={useInternal} disabled={busy} onChange={event=>setUseInternal(event.target.checked)}/><i aria-hidden="true"/></label>
        <div className="research-thread" aria-live="polite">{messages.length===0?<div className="research-thread-empty"><Bot/><b>Bắt đầu một câu hỏi nghiên cứu</b><p>Gemini giữ mạch hội thoại, điều phối các nguồn và gợi ý bước tiếp theo. Bật tài liệu nội bộ khi cần phân tích kho Drive.</p></div>:messages.map(item=><article key={item.id} className={`research-thread-message ${item.role}`}><p>{item.text}</p>{item.citations?.length?<div className="research-thread-sources">{item.citations.map(c=>c.url?<a key={c.id} href={c.url} target="_blank" rel="noreferrer"><ExternalLink/>{c.label}</a>:<span key={c.id}>{c.label}</span>)}</div>:null}{item.meta&&<small>{item.meta}</small>}</article>)}{busy&&<div className="research-leader-thinking"><i/><i/><i/><span>Gemini Leader đang tổng hợp các worker…</span></div>}</div>
        {suggestions.length>0&&<div className="research-suggestions">{suggestions.slice(0,3).map(value=><button key={value} disabled={busy} onClick={()=>void ask(value)}><Sparkles/>{value}</button>)}</div>}
        <form className="research-leader-compose" onSubmit={e=>{e.preventDefault();void ask()}}><textarea maxLength={4000} value={input} onChange={e=>setInput(e.target.value)} placeholder={query?`Hỏi tiếp về: ${query}`:'Hỏi y văn, phân tích tài liệu, phương pháp nghiên cứu, khoảng trống bằng chứng…'}/><button className="research-ai-primary" type="submit" disabled={busy||!clean(input||query)}><Send/>{busy?'Đang điều phối…':'Gửi cho Gemini Leader'}</button></form></>}
      {mode==='translate'&&<><div className="research-translate-head"><span>Gemini Leader giao Translator worker xử lý bản dịch học thuật</span><select value={target} onChange={e=>setTarget(e.target.value as 'vi'|'en')}><option value="vi">→ Tiếng Việt</option><option value="en">→ English</option></select></div><textarea maxLength={5000} value={input} onChange={e=>setInput(e.target.value)} placeholder="Dán đoạn tài liệu cần dịch…"/><button className="research-ai-primary" disabled={busy||!input.trim()} onClick={()=>void translate()}><Languages/>{busy?'Đang dịch…':'Giao Translator'}</button></>}
      {mode==='topics'&&<><p className="muted">Gemini Leader dùng đề xuất này như worker gợi ý ban đầu; tính mới vẫn phải kiểm chứng bằng y văn.</p><div className="research-topic-list">{topics.map(t=><article key={t.title}><b>{t.title}</b><small>{t.design}</small><p>{t.rationale}</p><div className="research-topic-actions"><button onClick={()=>{setMode('assistant');setInput(t.title);void ask(t.title)}}><Bot/> Phân tích với Gemini</button><button onClick={()=>onOpenProposal(t.title)}><FileSearch/> Dùng đề tài này</button></div></article>)}</div></>}
      {busy&&<button className="secondary" onClick={cancel}>Hủy yêu cầu hiện tại</button>}
      {note&&<div className="ai-note" role="status">{note}</div>}
      <div className="research-leader-footer"><button className="secondary" onClick={reset}><RotateCcw/>Phiên nghiên cứu mới</button><button className="secondary research-proposal-shortcut" onClick={()=>onOpenProposal(topics[0]?.title||query)}><FileSearch/>Tạo thuyết minh Mẫu 01-SV</button></div>
      <small className="research-leader-capability">Translator local: {capabilities.translator?'sẵn sàng':'fallback API miễn phí'} · Cloud + Drive RAG + Central RAG + OpenAlex</small>
    </section>}
    <button className="research-ai-fab" onClick={()=>{if(open)cancel();setOpen(v=>!v)}} aria-expanded={open}><Bot/><span>Research A.I</span><ChevronDown/></button>
  </div>;
}
