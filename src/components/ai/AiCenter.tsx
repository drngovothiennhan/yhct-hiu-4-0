import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,ExternalLink,FlaskConical,GraduationCap,Lightbulb,LoaderCircle,RotateCcw,Send,Square} from 'lucide-react';
import type {Member} from '../../types';
import {askStudyGemini,type StudyAiSource} from '../../services/studyAiService';
import {recordAiUse} from '../../services/studentJourneyService';
import '../../ai-center.css';

type Message={id:string;role:'user'|'assistant';text:string;sources?:StudyAiSource[];research?:boolean};
const AI_PENDING_KEY='yhct-ai-center-pending-query-v1';
const prompts=[
  {label:'Hiểu bài',text:'Giải thích phần tôi đang học theo cách dễ nhớ, nêu ý cốt lõi trước.',icon:'learn'},
  {label:'Ôn 10 phút',text:'Tạo cho tôi một phiên ôn nhanh 10 phút cho chủ đề đang học, ưu tiên kiến thức trọng tâm.',icon:'review'},
  {label:'Tự kiểm tra',text:'Tạo 5 câu trắc nghiệm kiểm tra nhanh chủ đề đang học, có đáp án và giải thích ngắn.',icon:'quiz'},
  {label:'So sánh',text:'So sánh hai khái niệm tôi đang học theo bảng tiêu chí ngắn gọn và chỉ ra điểm dễ nhầm.',icon:'compare'}
] as const;
const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const contextOf=(messages:Message[])=>messages.slice(-8).map(item=>`${item.role==='user'?'NGƯỜI DÙNG':'GEMINI STUDY'}: ${clean(item.text).slice(0,900)}`).join('\n').slice(0,7000);

export default function AiCenter({member,onOpenResearch}:{member:Member;onOpenResearch:()=>void}){
  const [messages,setMessages]=useState<Message[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  const request=useRef<AbortController|null>(null),turn=useRef(0);
  const displayName=useMemo(()=>member.herbalAlias||member.fullName,[member.herbalAlias,member.fullName]);
  const stop=()=>{turn.current++;request.current?.abort();request.current=null;setBusy(false);setStatus('Đã dừng yêu cầu.')};
  const reset=()=>{stop();setMessages([]);setQuery('');setStatus('')};
  const send=async(value=query)=>{
    const text=clean(value);if(!text||busy)return;
    const id=++turn.current,controller=new AbortController();request.current=controller;setBusy(true);setStatus('');setQuery('');
    const user:Message={id:crypto.randomUUID(),role:'user',text};setMessages(current=>[...current,user]);
    try{
      const reply=await askStudyGemini(text,contextOf(messages),`${location.pathname}${location.search}`,controller.signal);if(id!==turn.current)return;
      if(reply.route==='research'){
        setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',text:reply.answer,research:true}]);
      }else{
        setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',text:reply.answer,sources:reply.sources}]);
      }
      recordAiUse(member.id);
    }catch(error){if(controller.signal.aborted||id!==turn.current)return;setStatus((error as Error).message||'Gemini Study chưa thể xử lý yêu cầu lúc này.')}
    finally{if(id===turn.current){request.current=null;setBusy(false)}}
  };
  useEffect(()=>{let seed='';try{seed=clean(localStorage.getItem(AI_PENDING_KEY)||'');if(seed)localStorage.removeItem(AI_PENDING_KEY)}catch{}if(!seed)return;const frame=requestAnimationFrame(()=>void send(seed));return()=>cancelAnimationFrame(frame)},[]);
  const submit=(event:FormEvent)=>{event.preventDefault();void send()};
  const continueWith=(instruction:string)=>void send(instruction);
  return <section className="ai-center" aria-label="AI Study OS HIU YHCT">
    <header className="ai-center__header"><div><small>AI STUDY OS · GEMINI</small><h2>Học cùng một trợ lý hiểu mạch câu hỏi</h2><p>Hỏi kiến thức, ôn nhanh, tự kiểm tra hoặc chuyển sang Research khi cần bằng chứng chuyên sâu.</p></div><div><button type="button" onClick={reset}><RotateCcw/>Mới</button>{busy&&<button type="button" className="danger" onClick={stop}><Square/>Dừng</button>}</div></header>
    <div className="ai-center__suggestions" aria-label="Công cụ học nhanh">{prompts.map(prompt=><button type="button" key={prompt.label} disabled={busy} onClick={()=>void send(prompt.text)}>{prompt.icon==='quiz'?<GraduationCap/>:prompt.icon==='learn'?<Lightbulb/>:<BookOpen/>}<span>{prompt.label}</span></button>)}<button type="button" className="research" onClick={onOpenResearch}><FlaskConical/><span>Research</span></button></div>
    <div className="ai-center__conversation" aria-live="polite">
      {messages.length===0?<div className="ai-center__empty"><span className="ai-center__empty-icon"><Lightbulb/></span><h3>Chào {displayName}</h3><p>Nhập điều bạn đang chưa hiểu. AI sẽ bám theo các lượt trước để trả lời đúng ngữ cảnh hơn.</p><small>Ví dụ: “Vì sao ADH làm nước tiểu cô đặc?” hoặc “So sánh thận âm hư và thận dương hư”.</small></div>:messages.map((item,index)=><article key={item.id} className={`ai-center__message ${item.role}`}><div>{item.text}</div>{item.sources?.length?<div className="ai-center__sources">{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink/>{source.title}</a>)}</div>:null}{item.research&&item.role==='assistant'?<button type="button" className="ai-center__research" onClick={onOpenResearch}><FlaskConical/>Mở Trung tâm nghiên cứu</button>:null}{item.role==='assistant'&&index===messages.length-1&&!item.research?<div className="ai-center__followups"><button type="button" disabled={busy} onClick={()=>continueWith('Tóm tắt câu trả lời ngay trước thành 5 ý phải nhớ.')}>5 ý phải nhớ</button><button type="button" disabled={busy} onClick={()=>continueWith('Giải thích lại câu trả lời ngay trước đơn giản hơn, dùng một ví dụ dễ nhớ.')}>Giải thích dễ hơn</button><button type="button" disabled={busy} onClick={()=>continueWith('Dựa trên nội dung ngay trước, tạo 5 câu trắc nghiệm có đáp án và giải thích ngắn để tôi tự kiểm tra.')}>Tạo 5 câu</button></div>:null}</article>)}
      {busy&&<div className="ai-center__thinking"><LoaderCircle/>Gemini đang xử lý theo ngữ cảnh…</div>}
    </div>
    {status&&<div className="ai-center__status" role="status">{status}</div>}
    <form className="ai-center__composer" onSubmit={submit}><textarea value={query} onChange={event=>setQuery(event.target.value)} placeholder="Hỏi bất kỳ điều gì bạn đang học…" maxLength={2200} rows={2}/><button type="submit" disabled={busy||!clean(query)} aria-label="Gửi câu hỏi cho Gemini"><Send/></button></form>
  </section>;
}
