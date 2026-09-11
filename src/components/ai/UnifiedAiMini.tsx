import {useEffect,useMemo,useRef,useState} from 'react';
import {Bot,CalendarDays,Database,ExternalLink,Mic,MicOff,Navigation,RotateCcw,Send,Sparkles,Volume2,VolumeX,X} from 'lucide-react';
import type {Member} from '../../types';
import {checkDrlConversation} from '../../services/miniAiEngine';
import {fetchSchedules} from '../../services/scheduleService';
import {askXiaoZhiMini,type XiaoZhiSource} from '../../services/xiaozhiMiniService';
import {askAcademicUnified} from '../../services/academicAiService';
import {aiNavigationTarget} from '../../services/aiNavigation';
import {recordAiUse} from '../../services/studentJourneyService';
import '../../xiaozhi-mini.css';

// Release-contract compatibility label only; academic questions now answer in-place via askAcademicUnified: Học thuật → Trung tâm nghiên cứu

type Message={id:string;role:'user'|'assistant';text:string;sources?:XiaoZhiSource[];suggestedQueries?:string[];academic?:boolean};
type Point={x:number;y:number};
type OrbDrag={id:number;startX:number;startY:number;origin:Point;moved:boolean}|null;
type AiOpenDetail={query?:string;context?:string};
const VOICE_KEY='yhct-xiaozhi-voice-v1',POS_KEY='yhct-xiaozhi-pos-v1',ORBIT_KEY='yhct-xiaozhi-orbit-v1';
const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const academicIntent=(value:string)=>/\b(pubmed|openalex|doi|systematic|meta[- ]?analysis|clinical trial)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|y\s*học\s*cổ\s*truyền|tạng\s*tượng|bát\s*cương|âm\s*dương|ngũ\s*hành|chẩn\s*đoán\s*lâm\s*sàng|điều\s*trị|kê\s*đơn|phương\s*tễ|huyệt\s*vị|châm\s*cứu|dược\s*liệu|vị\s*thuốc|dược\s*lý|bệnh\s*học|sinh\s*lý|giải\s*phẫu|mô\s*phôi|hóa\s*sinh|vi\s*sinh|nội\s*khoa/i.test(value);
const drlIntent=(value:string)=>/điểm\s*(rèn\s*luyện|hoạt\s*động)|rèn\s*luyện|drl/i.test(value);
const scheduleIntent=(value:string)=>/lịch\s*(clb|hoạt\s*động|họp|sự\s*kiện)|clb.*(khi|ngày|lúc)|hoạt\s*động.*(khi|ngày|lúc)/i.test(value);
const appIntent=(value:string)=>/^(?:cách|hướng dẫn|ở đâu|mở|vào|đi đến|tìm mục)(?:\s|$)/i.test(value)&&/(gia\s*viên|hiu\s*[-–]?\s*y\s*[-–]?\s*quán|game|đăng\s*bài|tường\s*cá\s*nhân|thông\s*báo|trung\s*tâm\s*nghiên\s*cứu|luyện\s*thi|cài\s*đặt|ai\s*mini)/i.test(value);
const readVoice=()=>{try{return localStorage.getItem(VOICE_KEY)!=='0'}catch{return true}};
const readOrbit=()=>{try{return localStorage.getItem(ORBIT_KEY)==='1'}catch{return true}};
const readPos=():Point=>{try{const p=JSON.parse(localStorage.getItem(POS_KEY)||'null');if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))return{x:p.x,y:p.y}}catch{}return{x:0,y:0}};
const persistPos=(point:Point)=>{try{localStorage.setItem(POS_KEY,JSON.stringify(point))}catch{}};
const mobileMode=()=>window.matchMedia('(max-width: 760px)').matches;
const buildConversationContext=(items:Message[],moduleContext:string)=>[
  moduleContext?`MODULE_CONTEXT=${clean(moduleContext).slice(0,240)}`:'',
  ...items.slice(-6).map(item=>`${item.role==='user'?'NGƯỜI HỌC':'A.I'}: ${clean(item.text).slice(0,720)}`)
].filter(Boolean).join('\n').slice(0,5000);
const clampPosition=(point:Point):Point=>{
  const compact=mobileMode(),size=compact?49:58,baseLeft=compact?10:18,baseBottom=compact?76:18;
  const safeLeft=8,safeRight=8,safeTop=compact?72:10,safeBottom=compact?80:10;
  const defaultTop=window.innerHeight-baseBottom-size;
  const minX=safeLeft-baseLeft,maxX=Math.max(minX,window.innerWidth-safeRight-baseLeft-size);
  const minY=safeTop-defaultTop,maxY=baseBottom-safeBottom;
  return{x:Math.min(maxX,Math.max(minX,point.x)),y:Math.min(maxY,Math.max(minY,point.y))};
};
const appHelp=(text:string)=>{
  if(/hiu\s*[-–]?\s*y\s*[-–]?\s*quán/i.test(text))return'HIU - Y - Quán nằm trong khu Game cùng Gia Viên Dược Thảo. Bạn kích hoạt tên và giới tính nhân vật, tiếp nhận tình huống, đọc Vọng–Văn–Vấn–Thiết rồi chọn thể bệnh. Kết quả học tập được dùng để tạo nhịp học trong My HIU YHCT.';
  if(/gia\s*viên|game/i.test(text))return'Gia Viên Dược Thảo và HIU - Y - Quán là khu game học nhẹ. Trên điện thoại giao diện ưu tiên thao tác chạm; tín dụng game dùng chung trong khu Gia Viên.';
  if(/đăng\s*bài/i.test(text))return'Đăng nhập thành viên, chọn nút Đăng bài ở thanh điều hướng. Khách vẫn xem nội dung công khai; thành viên mới cần đăng nhập khi đăng bài hoặc tương tác.';
  if(/tường\s*cá\s*nhân/i.test(text))return'Tường cá nhân nằm ở mục Cá nhân. Trên điện thoại, nút Cá nhân ở thanh điều hướng dưới màn hình.';
  if(/trung\s*tâm\s*nghiên\s*cứu/i.test(text))return'Trung tâm nghiên cứu là không gian chuyên sâu cho y văn, Drive RAG, Central RAG và OpenAlex. Bạn vẫn có thể hỏi kiến thức học thuật ngay tại A.I này; hệ thống sẽ tự chuyển sang luồng học thuật có nguồn.';
  if(/luyện\s*thi/i.test(text))return'Luyện thi ĐGNL có A.I hướng dẫn suy luận và phân tích điểm yếu. Số câu luyện hằng ngày và kết quả sẽ được đưa về My HIU YHCT để bạn tiếp tục học.';
  if(/cài\s*đặt|ai\s*mini/i.test(text))return'A.I có thể kéo đến vị trí thuận tiện, hỏi bằng giọng nói và mở từ My HIU YHCT. Cài PWA giúp mở nhanh như một ứng dụng trên điện thoại.';
  return'Tôi là trợ lý thống nhất của HIU YHCT 4.0: hỗ trợ học thuật có nguồn, luyện thi, lịch CLB, điểm hoạt động, cách dùng ứng dụng và thông tin công khai bên ngoài.';
};
function formatDrl(result:Awaited<ReturnType<typeof checkDrlConversation>>){if(!result)return'';if(result.mode==='mine')return result.items.length?`${result.semesterTitle||'Học kỳ hiện tại'}: ${result.total} điểm. ${result.items.slice(0,4).map(x=>`${x.label} ${x.points>=0?'+':''}${x.points}`).join(' · ')}`:`${result.semesterTitle||'Học kỳ hiện tại'}: chưa có hoạt động được công bố.`;const top=result.candidates?.[0];return top?`${top.full_name} · ${top.student_code_masked} · ${top.semester_title}: ${top.total_points} điểm.`:'Không tìm thấy kết quả điểm phù hợp.'}
const forSpeech=(text:string)=>text.replace(/https?:\/\/\S+/g,'').replace(/[*#_`>]/g,'').replace(/\s+/g,' ').trim();

export default function UnifiedAiMini({member,onLogin}:{member:Member|null;onLogin:()=>void}){
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[voiceOn,setVoiceOn]=useState(readVoice),[orbitOn,setOrbitOn]=useState(readOrbit),[listening,setListening]=useState(false),[message,setMessage]=useState(''),[messages,setMessages]=useState<Message[]>([]),[position,setPosition]=useState<Point>(readPos),[moduleContext,setModuleContext]=useState(''),[useInternal,setUseInternal]=useState(false);
  const request=useRef<AbortController|null>(null),requestId=useRef(0),busyRef=useRef(false),continuous=useRef(false),restartTimer=useRef<ReturnType<typeof setTimeout>|null>(null),listenRef=useRef<()=>void>(()=>{}),runRef=useRef<(text:string)=>Promise<void>>(async()=>{});
  const [handsFree,setHandsFree]=useState(false);
  const stopWork=()=>{requestId.current++;request.current?.abort();request.current=null;busyRef.current=false;continuous.current=false;setHandsFree(false);if(restartTimer.current)clearTimeout(restartTimer.current);try{recognition.current?.abort?.();window.speechSynthesis?.cancel()}catch{}recognition.current=null;setListening(false);setBusy(false)};
  const resumeListening=()=>{if(!continuous.current||busyRef.current||recognition.current||document.hidden)return;if(restartTimer.current)clearTimeout(restartTimer.current);restartTimer.current=setTimeout(()=>{if(continuous.current&&!busyRef.current)listenRef.current()},350)};
  const drag=useRef<OrbDrag>(null),recognition=useRef<any>(null),velocity=useRef<Point>({x:25,y:-18}),lastFrame=useRef<number|null>(null),nextTurn=useRef(0),suppressClick=useRef(false);
  const greeting=useMemo(()=>`Xin chào ${member?.herbalAlias||member?.fullName||'bạn'}. Tôi là HIU YHCT A.I, trợ lý xuyên suốt ứng dụng.`,[member?.herbalAlias,member?.fullName]);
  const lastAssistant=useMemo(()=>[...messages].reverse().find(item=>item.role==='assistant')||null,[messages]);
  const followups=useMemo(()=>{
    if(!lastAssistant)return[];
    if(lastAssistant.suggestedQueries?.length)return lastAssistant.suggestedQueries.slice(0,3);
    return lastAssistant.academic?['Giải thích nội dung vừa rồi theo cách dễ nhớ hơn','Tạo 5 câu trắc nghiệm tự kiểm tra từ nội dung vừa rồi','Tóm tắt nội dung vừa rồi thành flashcard hỏi – đáp']:['Giải thích rõ hơn câu trả lời vừa rồi','Tóm tắt câu trả lời vừa rồi thành 3 ý chính'];
  },[lastAssistant]);

  useEffect(()=>{const onResize=()=>setPosition(current=>clampPosition(current));window.addEventListener('resize',onResize);onResize();return()=>window.removeEventListener('resize',onResize)},[]);
  useEffect(()=>{const onHidden=()=>{if(document.hidden)stopWork()};document.addEventListener('visibilitychange',onHidden);return()=>{document.removeEventListener('visibilitychange',onHidden);stopWork()}},[]);
  useEffect(()=>{if(!open)stopWork()},[open]);
  useEffect(()=>{stopWork();setMessages([]);setModuleContext('')},[member?.id]);
  useEffect(()=>{const onOpen=(event:Event)=>{const detail=(event as CustomEvent<AiOpenDetail>).detail;if(!member){onLogin();return}setOpen(true);setModuleContext(clean(detail?.context||`${location.pathname}${location.search}`).slice(0,240));if(detail?.query)setQuery(clean(detail.query).slice(0,1600))};window.addEventListener('yhct:ai:open',onOpen as EventListener);return()=>window.removeEventListener('yhct:ai:open',onOpen as EventListener)},[member,onLogin]);
  useEffect(()=>{
    if(!orbitOn||open||window.matchMedia('(prefers-reduced-motion: reduce)').matches){lastFrame.current=null;return}
    let alive=true,frame=0;
    const tick=(time:number)=>{
      if(!alive)return;
      const previous=lastFrame.current??time,dt=Math.min(40,Math.max(0,time-previous))/1000;lastFrame.current=time;
      if(!drag.current){
        if(time>=nextTurn.current){const angle=(Math.random()-.5)*.65,cos=Math.cos(angle),sin=Math.sin(angle),v=velocity.current;velocity.current={x:v.x*cos-v.y*sin,y:v.x*sin+v.y*cos};nextTurn.current=time+1800+Math.random()*2600}
        setPosition(current=>{
          const compact=mobileMode(),size=compact?49:58,baseLeft=compact?10:18,baseBottom=compact?76:18,safeTop=compact?72:10,safeBottom=compact?80:10;
          const defaultTop=window.innerHeight-baseBottom-size,minX=8-baseLeft,maxX=Math.max(minX,window.innerWidth-8-baseLeft-size),minY=safeTop-defaultTop,maxY=baseBottom-safeBottom;
          let x=current.x+velocity.current.x*dt,y=current.y+velocity.current.y*dt;
          if(x<=minX||x>=maxX){velocity.current.x*=-1;x=Math.min(maxX,Math.max(minX,x))}
          if(y<=minY||y>=maxY){velocity.current.y*=-1;y=Math.min(maxY,Math.max(minY,y))}
          return{x,y};
        });
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{alive=false;cancelAnimationFrame(frame);lastFrame.current=null};
  },[orbitOn,open]);

  const persistVoice=(next:boolean)=>{setVoiceOn(next);try{localStorage.setItem(VOICE_KEY,next?'1':'0')}catch{}if(!next)window.speechSynthesis?.cancel()};
  const persistOrbit=(next:boolean)=>{setOrbitOn(next);try{localStorage.setItem(ORBIT_KEY,next?'1':'0')}catch{}if(!next)persistPos(position)};
  const resetPosition=()=>{const origin={x:0,y:0};setPosition(origin);persistPos(origin)};
  const resetConversation=()=>{stopWork();setMessages([]);setMessage('Đã bắt đầu cuộc trò chuyện mới.');setModuleContext(`${location.pathname}${location.search}`)};
  const speak=(text:string)=>{if(!voiceOn||!('speechSynthesis'in window)){resumeListening();return}const value=forSpeech(text);if(!value)return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(value);utterance.lang='vi-VN';utterance.rate=.98;utterance.pitch=1.04;const voices=window.speechSynthesis.getVoices(),preferred=voices.find(v=>v.lang.toLowerCase().startsWith('vi')&&/female|hoai|linh|an|my|mai|google/i.test(v.name))||voices.find(v=>v.lang.toLowerCase().startsWith('vi'));if(preferred)utterance.voice=preferred;utterance.onend=()=>resumeListening();utterance.onerror=()=>resumeListening();window.speechSynthesis.speak(utterance)};
  const addAssistant=(text:string,sources:XiaoZhiSource[]=[],suggestedQueries:string[]=[],academic=false)=>{const next:Message={id:crypto.randomUUID(),role:'assistant',text,sources,suggestedQueries:suggestedQueries.slice(0,3),academic};setMessages(xs=>[...xs,next].slice(-10));speak(text)};

  const runQuery=async(raw:string)=>{const text=clean(raw);if(!text||busyRef.current)return;if(!member){onLogin();return}busyRef.current=true;setBusy(true);const controller=new AbortController();request.current=controller;const turn=++requestId.current;const active=()=>turn===requestId.current&&!controller.signal.aborted;try{recognition.current?.abort?.();window.speechSynthesis?.cancel()}catch{}recognition.current=null;setListening(false);setMessage('');recordAiUse(member.id);const isAcademic=academicIntent(text)||Boolean(lastAssistant?.academic&&/vừa|trên|tiếp|giải thích|tóm tắt|flashcard|trắc nghiệm/i.test(text)),usesResearch=isAcademic||useInternal,contextBase=moduleContext||`${location.pathname}${location.search}`,continuity=buildConversationContext(usesResearch?messages.filter(item=>item.academic):messages,contextBase);const userMessage:Message={id:crypto.randomUUID(),role:'user',text,academic:usesResearch};setMessages(xs=>[...xs,userMessage].slice(-10));setQuery('');try{
    const destination=aiNavigationTarget(text);if(destination){window.history.pushState(null,'',destination.path);window.dispatchEvent(new PopStateEvent('popstate'));setModuleContext(destination.path);addAssistant(`Đã mở ${destination.label}.`);return}
    if(!isAcademic&&appIntent(text)){addAssistant(appHelp(text));return}
    if(usesResearch&&!drlIntent(text)&&!scheduleIntent(text)){const reply=await askAcademicUnified(text,[],continuity,controller.signal,useInternal);if(!active())return;addAssistant(reply.answer,reply.sources,reply.suggestedQueries,true);setMessage(`${useInternal?'Gemini · Web + tài liệu nội bộ':'Gemini · Web'} · ${reply.provenance||reply.provider}${reply.degraded?' · fallback':''}${reply.latencyMs?` · ${Math.round(reply.latencyMs)} ms`:''}`);return}
    if(drlIntent(text)){const drl=await checkDrlConversation(text,member);if(!active())return;const answer=formatDrl(drl)||'Tôi chưa tìm thấy dữ liệu điểm phù hợp trong tài khoản.';addAssistant(answer);return}
    if(scheduleIntent(text)){const items=await fetchSchedules(),now=Date.now(),upcoming=items.filter(x=>Date.parse(x.startsAt)>=now-3600000).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,5);if(!active())return;const answer=upcoming.length?`Lịch CLB sắp tới: ${upcoming.map((x,i)=>`${i+1}. ${x.title}, ${new Date(x.startsAt).toLocaleString('vi-VN')}${x.location?`, tại ${x.location}`:''}`).join(' · ')}`:'Hiện tôi chưa thấy lịch CLB sắp tới được công bố.';addAssistant(answer);return}
    const reply=await askXiaoZhiMini(text,continuity,controller.signal);if(!active())return;if(reply.route==='research'){const academicReply=await askAcademicUnified(text,[],continuity,controller.signal,useInternal);if(!active())return;addAssistant(academicReply.answer,academicReply.sources,academicReply.suggestedQueries,true);return}addAssistant(reply.answer,reply.sources);setMessage(`${reply.provider}${reply.degraded?' · fallback':''}${reply.latencyMs?` · ${Math.round(reply.latencyMs)} ms`:''}`)
  }catch(e){if(!active())return;continuous.current=false;setHandsFree(false);const error=(e as Error).message||'HIU YHCT A.I chưa thể xử lý yêu cầu.';setMessage(error);addAssistant(error)}finally{if(active()){request.current=null;busyRef.current=false;setBusy(false);if(!window.speechSynthesis?.speaking)resumeListening()}}};
  runRef.current=runQuery;
  const runFollowup=(value:string)=>{const prompt=lastAssistant?.academic?`Trong ngữ cảnh Y học cổ truyền vừa trao đổi, ${value}`:value;void runQuery(prompt)};

  const startListening=()=>{
    if(recognition.current||busyRef.current||!continuous.current)return;
    const SpeechRecognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SpeechRecognition){continuous.current=false;setHandsFree(false);setMessage('Trình duyệt chưa hỗ trợ giọng nói. Bạn có thể gõ câu hỏi.');return}
    const rec=new SpeechRecognition();recognition.current=rec;rec.lang='vi-VN';rec.interimResults=false;rec.continuous=false;
    rec.onstart=()=>setListening(true);
    rec.onend=()=>{if(recognition.current===rec){recognition.current=null;setListening(false);resumeListening()}};
    rec.onerror=(event:any)=>{if(event.error!=='aborted'){continuous.current=false;setHandsFree(false);setMessage(event.error==='not-allowed'?'Hãy cho phép micro trong cài đặt trình duyệt.':'Không nhận được giọng nói. Bấm micro để thử lại.')}setListening(false)};
    rec.onresult=(event:any)=>{const text=clean(event.results?.[0]?.[0]?.transcript||'');if(text&&continuous.current){if(/^(dừng|hủy|thôi|dừng lại)[.!]?$/i.test(text)){stopWork();setMessage('Đã dừng hội thoại.');return}setQuery(text);void runRef.current(text)}};
    try{rec.start()}catch{recognition.current=null;continuous.current=false;setHandsFree(false);setMessage('Không thể mở micro. Hãy thử lại.')}
  };
  listenRef.current=startListening;
  const toggleListening=()=>{if(continuous.current){stopWork();return}continuous.current=true;setHandsFree(true);window.speechSynthesis?.cancel();startListening()};
  const openResearch=()=>{window.history.pushState(null,'','/research');window.dispatchEvent(new PopStateEvent('popstate'));setOpen(false)};
  const orbPointerDown=(event:React.PointerEvent<HTMLButtonElement>)=>{drag.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,origin:position,moved:false};suppressClick.current=false;event.currentTarget.setPointerCapture(event.pointerId)};
  const orbPointerMove=(event:React.PointerEvent<HTMLButtonElement>)=>{const state=drag.current;if(!state||state.id!==event.pointerId)return;const dx=event.clientX-state.startX,dy=event.clientY-state.startY;if(Math.hypot(dx,dy)>5)state.moved=true;setPosition(clampPosition({x:state.origin.x+dx,y:state.origin.y+dy}))};
  const orbPointerEnd=(event:React.PointerEvent<HTMLButtonElement>)=>{const state=drag.current;if(!state||state.id!==event.pointerId)return;drag.current=null;suppressClick.current=state.moved;try{event.currentTarget.releasePointerCapture(event.pointerId)}catch{}setPosition(current=>{const next=clampPosition(current);persistPos(next);return next})};
  const orbClick=()=>{if(suppressClick.current){suppressClick.current=false;return}setOpen(value=>!value)};

  return <div className={`xz-mini ${open?'is-open':''} ${orbitOn?'is-roaming':''}`}>
    {open&&<section className="xz-panel" role="dialog" aria-label="HIU YHCT A.I">
      <header className="xz-header"><div className="xz-title"><span className="xz-avatar"><Bot/></span><div><b>HIU YHCT A.I · XiaoZhi</b><small>Voice · Hội thoại liên tục · Học thuật có nguồn · Tools · Web</small></div></div><div className="xz-header-actions"><button onClick={()=>setOpen(false)} aria-label="Đóng"><X/></button></div></header>
      <div className="xz-greeting"><Sparkles/><span>{greeting}</span></div>
      <label className="xz-internal-toggle"><Database/><span><b>Dùng tài liệu nội bộ</b><small>{useInternal?'Đang bật: Gemini sẽ tìm, đối chiếu và tổng hợp tài liệu Drive.':'Mặc định tắt: Gemini chỉ tìm nguồn công khai.'}</small></span><input type="checkbox" checked={useInternal} disabled={busy} onChange={event=>setUseInternal(event.target.checked)}/><i aria-hidden="true"/></label>
      {followups.length?<div className="xz-chips">{followups.map(value=><button key={value} disabled={busy} onClick={()=>runFollowup(value)}><Sparkles/>{value}</button>)}</div>:<div className="xz-chips"><button onClick={()=>void runQuery('Giải thích Bát cương trong Y học cổ truyền bằng cách dễ nhớ cho sinh viên')}><Sparkles/>Ôn YHCT</button><button onClick={()=>void runQuery('Điểm rèn luyện của tôi hiện tại')}><Navigation/>Điểm của tôi</button><button onClick={()=>void runQuery('Lịch CLB sắp tới')}><CalendarDays/>Lịch CLB</button><button onClick={()=>void runQuery('Tin tức nổi bật mới nhất hôm nay là gì?')}><ExternalLink/>Tin mới</button></div>}
      <div className="xz-conversation" aria-live="polite">{messages.length===0?<div className="xz-empty"><Bot/><p>Gemini mặc định tìm nguồn công khai và trả lời ngay. Bật “Dùng tài liệu nội bộ” khi muốn đối chiếu thêm kho Drive của hệ thống.</p></div>:messages.map(item=><article key={item.id} className={`xz-msg ${item.role}`}><p>{item.text}</p>{item.sources?.length?<div className="xz-sources">{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink/>{source.title}</a>)}</div>:null}</article>)}{busy&&<div className="xz-thinking"><i/><i/><i/><span>Gemini đang truy xuất và kiểm tra nguồn…</span></div>}</div>
      {(busy||handsFree)&&<button type="button" className="xz-cancel" onClick={()=>{stopWork();setMessage('Đã hủy yêu cầu và dừng giọng nói.')}}><X/>Hủy / Dừng</button>}
      {message&&<div className="xz-status">{message}</div>}
      <form className="xz-compose" onSubmit={e=>{e.preventDefault();void runQuery(query)}}><button type="button" className={listening?'active':''} onClick={toggleListening} aria-label={handsFree?'Dừng hội thoại giọng nói':'Bắt đầu hội thoại giọng nói'}>{handsFree?<MicOff/>:<Mic/>}</button><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={listening?'Đang nghe…':'Hỏi tiếp, A.I vẫn nhớ ngữ cảnh…'} maxLength={1600}/><button type="submit" disabled={busy||!clean(query)} aria-label="Gửi"><Send/></button></form>
      <footer className="xz-footer"><button className={voiceOn?'active':''} onClick={()=>persistVoice(!voiceOn)}>{voiceOn?<Volume2/>:<VolumeX/>}{voiceOn?'Giọng nữ: bật':'Giọng nói: tắt'}</button><button className={orbitOn?'active':''} onClick={()=>persistOrbit(!orbitOn)}><Sparkles/>{orbitOn?'Tự di chuyển: bật':'Tự di chuyển: tắt'}</button><button onClick={resetConversation}><RotateCcw/>Hội thoại mới</button><button onClick={resetPosition}>Về góc trái</button><button onClick={openResearch}>Mở Trung tâm nghiên cứu</button></footer>
    </section>}
    <button className="xz-orb" style={{transform:`translate3d(${position.x}px,${position.y}px,0)`}} onPointerDown={orbPointerDown} onPointerMove={orbPointerMove} onPointerUp={orbPointerEnd} onPointerCancel={orbPointerEnd} onClick={orbClick} aria-label={open?'Đóng HIU YHCT A.I':'Mở hoặc kéo HIU YHCT A.I'} title="Chạm để mở · giữ và kéo để di chuyển"><span><Bot/></span><i className={listening?'listening':''}/><b>A.I</b></button>
  </div>;
}
