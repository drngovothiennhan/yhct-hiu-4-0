import {useEffect,useMemo,useRef,useState} from 'react';
import {Bot,Database,ExternalLink,FileText,FlaskConical,Languages,SearchCheck,Send,Sparkles,Target} from 'lucide-react';
import type {Member} from '../../types';
import {searchClinicalTrials,searchOpenAlex,searchPubMed,type ResearchWork} from '../../services/researchService';
import {askServerAi,type AiCitation,type AiSource} from '../../modules/ai';
import {translateAcademic} from '../../services/academicTranslationService';
import {searchDriveRag} from '../../services/driveRagService';
import {referenceLabel,searchKnowledge,type CentralKnowledgeHit} from '../../services/centralKnowledgeService';
import '../../research-ai-leader.css';

type Task='evidence'|'pico'|'gap'|'methods'|'translate';
type Props={member:Member;works:ResearchWork[];query:string;onOpenProposal:(title?:string)=>void};
type ThreadMessage={id:string;role:'user'|'assistant';text:string;citations?:AiCitation[];meta?:string};
const PENDING_KEY='yhct-research-pending-query-v1';
const MAX_SOURCES=6;
const clean=(v:string)=>v.replace(/\s+/g,' ').trim();
const message=(role:ThreadMessage['role'],text:string,extra:Pick<ThreadMessage,'citations'|'meta'>|{}={}):ThreadMessage=>({id:crypto.randomUUID(),role,text,...extra});
const dedupe=(items:ResearchWork[])=>[...new Map(items.map(w=>[(w.doi||w.url||w.id).toLowerCase(),w])).values()];
const asSources=(items:ResearchWork[]):AiSource[]=>items.slice(0,MAX_SOURCES).map(w=>({id:`${w.provider}:${w.id}`,title:w.title,text:`${w.abstract||w.title} ${w.authors.join(', ')} ${w.source} ${w.year||''}`.slice(0,4200),url:w.url}));
const centralSources=(hits:CentralKnowledgeHit[]):AiSource[]=>hits.slice(0,3).map(h=>{const record=h.record as typeof h.record&{actions?:string;indications?:string;commonUses?:string;meridian?:string;category?:string};const evidence=h.evidence.find(x=>x.verified&&x.pubmedUrl?.startsWith('https://'));const authority=h.authoritySources.find(x=>x.verified&&x.sourceUrl?.startsWith('https://'));return{id:`central:${record.id}`,title:`${record.name} · nguồn nội bộ`,text:[record.name,...(record.aliases||[]),record.category,record.actions,record.indications,record.commonUses,record.meridian,referenceLabel(h.evidence,h.authoritySources,3)].filter(Boolean).join(' · ').slice(0,4200),url:evidence?.pubmedUrl||authority?.sourceUrl||null}});
const taskInstruction:Record<Exclude<Task,'translate'>,string>={
 evidence:'TỔNG HỢP BẰNG CHỨNG: trả lời câu hỏi trực tiếp; tách kết luận được hỗ trợ, chưa chắc chắn và thiếu dữ liệu; nêu thiết kế nghiên cứu và độ phù hợp của bằng chứng. Không suy diễn hiệu quả điều trị từ lý luận YHCT.',
 pico:'PICO/PICOS: chuyển câu hỏi thành Population, Intervention/Exposure, Comparator, Outcomes, Study design; sau đó đề xuất chuỗi từ khóa PubMed ngắn gọn. Không tự thêm đặc điểm dân số hay can thiệp chưa có căn cứ.',
 gap:'KHOẢNG TRỐNG: đối chiếu các nguồn; chỉ ra điều đã biết, mâu thuẫn, thiếu nhóm đối chứng/đầu ra/thời gian theo dõi và 2–3 câu hỏi nghiên cứu khả thi. Không gọi là tính mới nếu chưa đủ nguồn.',
 methods:'PHƯƠNG PHÁP: đề xuất thiết kế phù hợp, biến chính, tiêu chí chọn, nguồn sai lệch, cách giảm sai lệch và kế hoạch phân tích ở mức khung. Không tự sinh cỡ mẫu, địa điểm, kinh phí hoặc phê duyệt đạo đức.'
};
const tabs:[Task,string,JSX.Element][]=[['evidence','Bằng chứng',<SearchCheck/>],['pico','PICO',<Target/>],['gap','Khoảng trống',<Sparkles/>],['methods','Phương pháp',<FlaskConical/>],['translate','Dịch',<Languages/>]];

export default function ResearchAiMini({member,works,query,onOpenProposal}:Props){
 const [task,setTask]=useState<Task>('evidence'),[input,setInput]=useState(''),[messages,setMessages]=useState<ThreadMessage[]>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState('Gemini Research sẵn sàng'),[useInternal,setUseInternal]=useState(false),[target,setTarget]=useState<'vi'|'en'>('vi');
 const pending=useRef<AbortController|null>(null);
 const seed=useMemo(()=>clean(input||query),[input,query]);
 useEffect(()=>()=>pending.current?.abort(),[member.id]);
 useEffect(()=>{try{const value=clean(localStorage.getItem(PENDING_KEY)||'');if(value){localStorage.removeItem(PENDING_KEY);setInput(value)}}catch{}},[member.id]);
 const ask=async()=>{
   const text=seed;if(!text||busy||task==='translate')return;const controller=new AbortController();pending.current=controller;setBusy(true);setStatus('Gemini Research đang truy xuất và đối chiếu nguồn…');setMessages(xs=>[...xs,message('user',text)].slice(-12));
   const internalEnabled=useInternal;setUseInternal(false);
   try{
     const [pubmed,openalex,trials,drive,central]=await Promise.all([searchPubMed(text,8).catch(()=>[]),searchOpenAlex(text,8).catch(()=>[]),searchClinicalTrials(text,5).catch(()=>[]),internalEnabled?searchDriveRag(text,4,controller.signal):Promise.resolve({sources:[],degraded:false}),internalEnabled?searchKnowledge(text,'all',4).catch(()=>[]):Promise.resolve([])]);
     if(controller.signal.aborted)return;
     const publicWorks=dedupe([...pubmed,...openalex,...trials,...works]).slice(0,14),sources=[...asSources(publicWorks).slice(0,internalEnabled?3:6),...centralSources(central).slice(0,internalEnabled?2:0),...drive.sources.slice(0,internalEnabled?1:0)].slice(0,MAX_SOURCES);
     const prompt=['RESEARCH_ROLE=GEMINI_MEDICAL_RESEARCH_LEAD',`TASK=${task}`,`QUESTION=${text}`,taskInstruction[task],'Ưu tiên y học chứng cứ. Phân biệt dữ liệu quan sát, thử nghiệm, tổng quan và ý kiến. Nếu nguồn không đủ để kết luận, phải nói rõ “chưa đủ bằng chứng”.','Mọi khẳng định thực nghiệm quan trọng phải dựa vào SOURCE IDs được hệ thống cung cấp. Không bịa DOI/PMID/tác giả/số liệu.','Trả lời bằng tiếng Việt, cấu trúc rõ, cụ thể; không viết lời dẫn sáo rỗng. Cuối cùng đề xuất tối đa 3 bước nghiên cứu tiếp theo.'].join('\n');
     const result=await askServerAi(prompt,'research',sources,controller.signal,{useInternal:internalEnabled});if(controller.signal.aborted)return;
     if(result.degraded){setStatus('Gemini Research hiện chưa khả dụng. Không tạo câu trả lời local thay thế; các nguồn đã tìm vẫn được giữ bên dưới.');return}
     setMessages(xs=>[...xs,message('assistant',result.answer,{citations:result.citations,meta:`Gemini Research · ${publicWorks.length} kết quả công khai${internalEnabled?' · có đối chiếu nội bộ':''}`})].slice(-12));setInput('');setStatus(`Gemini Research · ${Math.round(result.latencyMs)} ms · ${result.citations.length} nguồn được trích dẫn`);
   }catch(error){if(!controller.signal.aborted)setStatus(`${(error as Error).message||'Gemini Research chưa khả dụng.'} Không tạo kết luận local thay thế.`)}finally{if(pending.current===controller){pending.current=null;setBusy(false)}}
 };
 const translate=async()=>{const text=clean(input||query);if(!text||busy)return;setBusy(true);setStatus('Đang dịch học thuật…');try{const result=await translateAcademic(text,target);if(!result.text)throw new Error(result.note||'Chưa dịch được nội dung.');setMessages(xs=>[...xs,message('user',text),message('assistant',result.text,{meta:`Dịch học thuật · ${result.provider}`})].slice(-12));setInput('');setStatus(`Dịch học thuật · ${result.provider}`)}catch(error){setStatus((error as Error).message)}finally{setBusy(false)}};
 return <section className="research-ai-mini research-ai-leader research-ai-workbench" aria-label="Gemini Research workbench">
   <header className="research-workbench-head"><div><span className="kicker">GEMINI · MEDICAL RESEARCH</span><h3><Bot/> Research A.I</h3><p>Bộ não nghiên cứu: truy xuất → đối chiếu bằng chứng → phân tích → hành động. Không có câu trả lời local giả lập.</p></div><button className="secondary" onClick={()=>onOpenProposal(seed)}><FileText/> Tạo đề cương</button></header>
   <div className="research-ai-tabs research-task-tabs">{tabs.map(([id,label,icon])=><button key={id} className={task===id?'active':''} onClick={()=>setTask(id)}>{icon}{label}</button>)}</div>
   <label className="research-internal-toggle"><Database/><span><b>Dùng tài liệu nội bộ cho lượt này</b><small>{useInternal?'Cho phép đối chiếu Drive/Central RAG một lần':'Mặc định chỉ dùng PubMed · OpenAlex · ClinicalTrials.gov'}</small></span><input type="checkbox" checked={useInternal} disabled={busy||task==='translate'} onChange={e=>setUseInternal(e.target.checked)}/><i aria-hidden="true"/></label>
   {task==='translate'&&<div className="research-translate-head"><span>Dịch học thuật</span><select value={target} onChange={e=>setTarget(e.target.value as 'vi'|'en')}><option value="vi">→ Tiếng Việt</option><option value="en">→ English</option></select></div>}
   <div className="research-thread" aria-live="polite">{messages.length===0?<div className="research-thread-empty"><Bot/><b>{task==='evidence'?'Đặt câu hỏi cần bằng chứng':task==='pico'?'Nhập câu hỏi cần chuẩn hóa PICO':task==='gap'?'Nhập chủ đề cần tìm khoảng trống':task==='methods'?'Nhập câu hỏi/đề tài cần thiết kế phương pháp':'Dán đoạn văn cần dịch'}</b><p>Kết quả A.I chỉ xuất hiện khi Gemini xử lý thành công. Nguồn học thuật vẫn được giữ độc lập để bạn tự kiểm chứng.</p></div>:messages.map(item=><article key={item.id} className={`research-thread-message ${item.role}`}><p>{item.text}</p>{item.citations?.length?<div className="research-thread-sources">{item.citations.map(c=>c.url?<a key={c.id} href={c.url} target="_blank" rel="noreferrer noopener"><ExternalLink/>{c.label}</a>:<span key={c.id}>{c.label}</span>)}</div>:null}{item.meta&&<small>{item.meta}</small>}</article>)}</div>
   <form className="research-leader-compose" onSubmit={e=>{e.preventDefault();void(task==='translate'?translate():ask())}}><textarea maxLength={5000} value={input} onChange={e=>setInput(e.target.value)} placeholder={query?`Phân tích tiếp: ${query}`:'Nhập câu hỏi nghiên cứu, chủ đề YHCT, PICO, khoảng trống hoặc phương pháp…'}/><button className="research-ai-primary" type="submit" disabled={busy||!seed}><Send/>{busy?'Đang xử lý…':task==='translate'?'Dịch':'Phân tích bằng Gemini'}</button></form>
   <p className={`research-workbench-status ${status.includes('chưa')||status.includes('Không')?'warning':''}`} role="status">{status}</p>
 </section>;
}
