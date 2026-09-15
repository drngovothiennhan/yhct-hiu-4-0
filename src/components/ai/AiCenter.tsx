import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {BookOpen,ExternalLink,FileSearch,FlaskConical,GraduationCap,Lightbulb,LoaderCircle,RotateCcw,Send,Square} from 'lucide-react';
import type {Member} from '../../types';
import {askStudyGemini,type StudyAiSource} from '../../services/studyAiService';
import {findRelatedLearningResources,type LearningResourceHit} from '../../services/learningResourceService';
import {readStudentJourney,recordAiUse} from '../../services/studentJourneyService';
import '../../ai-center.css';

type Message={id:string;role:'user'|'assistant';text:string;sources?:StudyAiSource[];suggestions?:string[];research?:boolean;researchQuery?:string};
const RESEARCH_PENDING_KEY='yhct-research-pending-query-v1';
const AI_PENDING_KEY='yhct-ai-center-pending-query-v1';
const prompts=[
  {label:'Hiểu bài',text:'Dựa trên chủ đề hoặc câu hỏi gần nhất của tôi, giải thích phần đang học như một giảng viên YHCT bậc đại học: nêu ý cốt lõi trước, sau đó điểm dễ nhầm. Nếu chưa có chủ đề đủ rõ, hãy hỏi tôi đúng 1 câu để xác định chủ đề.',icon:'learn'},
  {label:'Ôn 10 phút',text:'Dựa đúng chủ đề gần nhất trong cuộc trò chuyện, lập phiên ôn 10 phút và chia thời gian đủ đúng 10 phút. Nếu chưa xác định được chủ đề, hãy hỏi tôi muốn ôn môn hoặc phần nào.',icon:'review'},
  {label:'Tự kiểm tra',text:'Dựa đúng chủ đề gần nhất trong cuộc trò chuyện, tạo 5 câu trắc nghiệm bậc đại học có đáp án và giải thích ngắn. Nếu chưa có chủ đề rõ, hãy hỏi tôi chọn chủ đề trước.',icon:'quiz'},
  {label:'So sánh',text:'Dựa trên hai khái niệm gần nhất mà tôi đang hỏi, so sánh theo tiêu chí ngắn gọn và chỉ ra điểm sinh viên thường nhầm. Nếu chưa đủ hai đối tượng, hỏi tôi cần so sánh hai gì.',icon:'compare'}
] as const;
const fallbackFollowups=[
  ['Chốt 5 ý cốt lõi theo cách khác','Cho một ví dụ dễ nhớ','Kiểm tra tôi bằng 3 câu','Nêu điểm dễ nhầm tiếp theo'],
  ['Giải thích bằng chuỗi nguyên nhân','So sánh với khái niệm gần nhất','Tóm tắt thành sơ đồ nhớ','Hỏi tôi một câu kiểm tra'],
  ['Đổi góc giải thích ngắn gọn','Chỉ ra ranh giới khái niệm','Tạo một tình huống học tập','Mở rộng một mức sâu hơn']
] as const;
const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const contextOf=(messages:Message[])=>messages.slice(-12).map(item=>`${item.role==='user'?'NGƯỜI DÙNG':'GEMINI STUDY'}: ${clean(item.text).slice(0,item.role==='user'?1100:800)}`).join('\n').slice(-6500);
const resourceTypeLabel=(type:string)=>type==='quiz_source'?'Bộ trắc nghiệm':type==='reference'?'Tài liệu tham khảo':'Tài liệu học';

export default function AiCenter({member,onOpenResearch}:{member:Member;onOpenResearch:()=>void}){
  const [messages,setMessages]=useState<Message[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  const [resourceHits,setResourceHits]=useState<LearningResourceHit[]>([]),[resourceBusy,setResourceBusy]=useState(false),[freshSession,setFreshSession]=useState(false);
  const request=useRef<AbortController|null>(null),turn=useRef(0);
  const displayName=useMemo(()=>member.herbalAlias||member.fullName,[member.herbalAlias,member.fullName]);
  const journey=useMemo(()=>readStudentJourney(member.id),[member.id]);
  const studyFocus=journey.preferences?.focus||'';
  const studyPageContext=useMemo(()=>{
    const preferences=journey.preferences;
    return [
      `route=${location.pathname}${location.search}`,
      !freshSession&&preferences?.focus?`study_focus=${clean(preferences.focus).slice(0,180)}`:'',
      !freshSession&&preferences?.goal?`study_goal=${preferences.goal}`:'',
      !freshSession&&preferences?.year?`study_year=${preferences.year}`:'',
      !freshSession&&preferences?.dailyMinutes?`daily_minutes=${preferences.dailyMinutes}`:'',
      !freshSession&&journey.lastModule?`last_module=${journey.lastModule}`:''
    ].filter(Boolean).join(' | ').slice(0,600);
  },[freshSession,journey]);
  const stop=()=>{turn.current++;request.current?.abort();request.current=null;setBusy(false);setStatus('Đã dừng yêu cầu.')};
  const reset=()=>{stop();setFreshSession(true);setMessages([]);setResourceHits([]);setQuery('');setStatus('');try{localStorage.removeItem(AI_PENDING_KEY)}catch{}};
  const send=async(value=query)=>{
    const text=clean(value);if(!text||busy)return;
    const id=++turn.current,controller=new AbortController();request.current=controller;setBusy(true);setStatus('');setQuery('');setResourceHits([]);
    const user:Message={id:crypto.randomUUID(),role:'user',text};setMessages(current=>[...current,user]);
    try{
      const reply=await askStudyGemini(text,contextOf(messages),studyPageContext,controller.signal);if(id!==turn.current)return;
      if(reply.route==='research'){
        setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',text:reply.answer,research:true,researchQuery:text}]);
      }else{
        setMessages(current=>[...current,{id:crypto.randomUUID(),role:'assistant',text:reply.answer,sources:reply.sources,suggestions:reply.suggestions}]);
      }
      recordAiUse(member.id);
    }catch(error){if(controller.signal.aborted||id!==turn.current)return;setStatus((error as Error).message||'Gemini Study chưa thể xử lý yêu cầu lúc này.')}
    finally{if(id===turn.current){request.current=null;setBusy(false)}}
  };
  useEffect(()=>{let seed='';try{seed=clean(localStorage.getItem(AI_PENDING_KEY)||'');if(seed)localStorage.removeItem(AI_PENDING_KEY)}catch{}if(seed)setQuery(seed);if(seed)void send(seed)},[]);
  const openResearch=(seed:string)=>{try{localStorage.setItem(RESEARCH_PENDING_KEY,seed)}catch{}onOpenResearch()};
  const submit=(event:FormEvent)=>{event.preventDefault();void send()};
  const continueWith=(instruction:string)=>void send(instruction);
  const latestUserSeed=()=>messages.slice().reverse().find(item=>item.role==='user')?.text||(!freshSession?studyFocus:'');
  const findResources=async()=>{
    if(resourceBusy)return;
    const seed=latestUserSeed();if(!seed){setStatus('Hãy hỏi một chủ đề trước khi tìm tài liệu liên quan.');return}
    setResourceBusy(true);setStatus('');
    try{
      const hits=await findRelatedLearningResources(seed,6);setResourceHits(hits);
      if(!hits.length)setStatus('Chưa có tài liệu đã phát hành khớp chủ đề này. Bạn vẫn có thể dùng Research để tra cứu nguồn công khai.');
    }catch{setStatus('Chưa thể đọc danh mục tài liệu đã phát hành lúc này.')}
    finally{setResourceBusy(false)}
  };
  return <section className="ai-center" aria-label="AI Study OS HIU YHCT">
    <header className="ai-center__header"><div><small>AI STUDY OS · GEMINI</small><h2>Giảng viên & cố vấn YHCT hệ đại học</h2><p>Gemini ưu tiên câu hỏi hiện tại, giữ mạch gần nhất và thay đổi cách giải thích cùng gợi ý học tiếp theo đúng ngữ cảnh.</p></div><div><button type="button" onClick={reset}><RotateCcw/>Mới</button>{busy&&<button type="button" className="danger" onClick={stop}><Square/>Dừng</button>}</div></header>
    <div className="ai-center__suggestions" aria-label="Công cụ học nhanh">{prompts.map(prompt=><button type="button" key={prompt.label} disabled={busy} onClick={()=>void send(prompt.text)}>{prompt.icon==='quiz'?<GraduationCap/>:prompt.icon==='learn'?<Lightbulb/>:<BookOpen/>}<span>{prompt.label}</span></button>)}<button type="button" className="research" onClick={onOpenResearch}><FlaskConical/><span>Research</span></button></div>
    <div className="ai-center__conversation" aria-live="polite">
      {messages.length===0?<div className="ai-center__empty"><span className="ai-center__empty-icon"><Lightbulb/></span><h3>Chào {displayName}</h3><p>Hỏi đúng phần bạn đang học. Gemini Study sẽ giữ mạch các lượt gần nhất, nhưng câu hỏi hiện tại luôn được ưu tiên cao nhất.</p><small>{!freshSession&&studyFocus?`Đang ưu tiên: ${studyFocus}. `:''}Nếu ngữ cảnh chưa đủ rõ, trợ lý sẽ hỏi lại thay vì tự đoán môn học, kỳ thi hoặc mục tiêu của bạn.</small></div>:messages.map((item,index)=>{const isLatest=item.role==='assistant'&&index===messages.length-1&&!item.research,userTurns=messages.slice(0,index+1).filter(message=>message.role==='user').length,actions=item.suggestions?.length?item.suggestions:fallbackFollowups[userTurns%fallbackFollowups.length];return <article key={item.id} className={`ai-center__message ${item.role}`}><div>{item.text}</div>{item.sources?.length?<div className="ai-center__sources">{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink/>{source.title}</a>)}</div>:null}{item.research&&item.role==='assistant'?<button type="button" className="ai-center__research" onClick={()=>openResearch(item.researchQuery||'')}><FlaskConical/>Mở Trung tâm nghiên cứu</button>:null}{isLatest?<><div className="ai-center__followups" aria-label="Gợi ý học tiếp theo">{actions.slice(0,4).map(action=><button type="button" key={action} disabled={busy} onClick={()=>continueWith(action)}>{action}</button>)}<button type="button" disabled={busy||resourceBusy} onClick={()=>void findResources()}><FileSearch/>{resourceBusy?'Đang tìm…':'Tài liệu liên quan'}</button></div>{resourceHits.length?<div className="ai-center__resources" aria-label="Tài liệu học tập liên quan"><b>Tài liệu đã phát hành trong HIU YHCT</b>{resourceHits.map(resource=><div key={resource.resourceKey}><FileSearch/><span><strong>{resource.title}</strong><small>{resourceTypeLabel(resource.resourceType)}</small></span></div>)}<small>Chỉ hiển thị metadata an toàn. Gemini không nhận nội dung hoặc đường dẫn Drive từ thao tác này.</small></div>:null}</>:null}</article>})}
      {busy&&<div className="ai-center__thinking"><LoaderCircle/>Gemini đang xử lý theo ngữ cảnh gần nhất…</div>}
    </div>
    {status&&<div className="ai-center__status" role="status">{status}</div>}
    <form className="ai-center__composer" onSubmit={submit}><textarea value={query} onChange={event=>setQuery(event.target.value)} placeholder="Hỏi phần YHCT hoặc môn học bạn đang cần…" maxLength={2200} rows={2}/><button type="submit" disabled={busy||!clean(query)} aria-label="Gửi câu hỏi cho Gemini"><Send/></button></form>
  </section>;
}