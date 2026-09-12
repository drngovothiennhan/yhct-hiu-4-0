import {FormEvent,useMemo,useRef,useState} from 'react';
import {ExternalLink,FlaskConical,LoaderCircle,RotateCcw,Send,Square} from 'lucide-react';
import type {Member} from '../../types';
import {askXiaoZhiMini,type XiaoZhiSource} from '../../services/xiaozhiMiniService';
import {recordAiUse} from '../../services/studentJourneyService';
import '../../ai-center.css';

type Message={id:string;role:'user'|'assistant';text:string;sources?:XiaoZhiSource[];research?:boolean};
const prompts=['Giải thích phần tôi đang học','Tạo cách nhớ nhanh','So sánh hai khái niệm','Gợi ý 20 câu ôn tập'];
const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const contextOf=(messages:Message[])=>messages.slice(-8).map(item=>`${item.role==='user'?'NGƯỜI DÙNG':'TRỢ LÝ'}: ${clean(item.text).slice(0,900)}`).join('\n').slice(0,7000);

export default function AiCenter({member,onOpenResearch}:{member:Member;onOpenResearch:()=>void}){
  const [messages,setMessages]=useState<Message[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  const request=useRef<AbortController|null>(null),turn=useRef(0);
  const displayName=useMemo(()=>member.herbalAlias||member.fullName,[member.herbalAlias,member.fullName]);
  const stop=()=>{turn.current++;request.current?.abort();request.current=null;setBusy(false);setStatus('Đã dừng yêu cầu.')};
  const reset=()=>{stop();setMessages([]);setQuery('');setStatus('')};
  const send=async(value=query)=>{
    const text=clean(value);if(!text||busy)return;
    const id=++turn.current,controller=new AbortController();request.current=controller;setBusy(true);setStatus('');setQuery('');
    const user:Message={id:crypto.randomUUID(),role:'user',text};const next=[...messages,user];setMessages(next);
    try{
      const reply=await askXiaoZhiMini(text,contextOf(messages),controller.signal);if(id!==turn.current)return;
      setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',text:reply.answer,sources:reply.sources,research:reply.route==='research'}]);recordAiUse(member.id);
    }catch(error){if(controller.signal.aborted||id!==turn.current)return;setStatus((error as Error).message||'Không thể xử lý yêu cầu lúc này.')}
    finally{if(id===turn.current){request.current=null;setBusy(false)}}
  };
  const submit=(event:FormEvent)=>{event.preventDefault();void send()};
  return <section className="ai-center" aria-label="Trợ lý A.I HIU YHCT">
    <header className="ai-center__header"><div><small>TRỢ LÝ A.I</small><h2>Hỏi, học và làm việc trong một cuộc trò chuyện</h2></div><div><button type="button" onClick={reset}><RotateCcw/>Hội thoại mới</button>{busy&&<button type="button" className="danger" onClick={stop}><Square/>Dừng</button>}</div></header>
    <div className="ai-center__suggestions" aria-label="Gợi ý nhanh">{prompts.map(prompt=><button type="button" key={prompt} disabled={busy} onClick={()=>void send(prompt)}>{prompt}</button>)}</div>
    <div className="ai-center__conversation" aria-live="polite">
      {messages.length===0?<div className="ai-center__empty"><p>Chào {displayName}. Nhập câu hỏi hoặc yêu cầu bên dưới.</p></div>:messages.map(item=><article key={item.id} className={`ai-center__message ${item.role}`}><div>{item.text}</div>{item.sources?.length?<div className="ai-center__sources">{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink/>{source.title}</a>)}</div>:null}{item.research&&item.role==='assistant'?<button type="button" className="ai-center__research" onClick={onOpenResearch}><FlaskConical/>Mở Trung tâm nghiên cứu</button>:null}</article>)}
      {busy&&<div className="ai-center__thinking"><LoaderCircle/>Đang xử lý…</div>}
    </div>
    {status&&<div className="ai-center__status" role="status">{status}</div>}
    <form className="ai-center__composer" onSubmit={submit}><textarea value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nhập câu hỏi hoặc yêu cầu…" maxLength={2000} rows={2}/><button type="submit" disabled={busy||!clean(query)} aria-label="Gửi"><Send/></button></form>
  </section>;
}
