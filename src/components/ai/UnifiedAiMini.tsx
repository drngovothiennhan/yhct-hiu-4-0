import {useEffect,useMemo,useRef,useState} from 'react';
import {Bot,CalendarDays,ExternalLink,Mic,MicOff,Navigation,RotateCcw,Send,Sparkles,Volume2,VolumeX,X} from 'lucide-react';
import type {Member} from '../../types';
import {checkDrlConversation} from '../../services/miniAiEngine';
import {fetchSchedules} from '../../services/scheduleService';
import {askXiaoZhiMini,type XiaoZhiSource} from '../../services/xiaozhiMiniService';
import '../../xiaozhi-mini.css';

type Message={id:string;role:'user'|'assistant';text:string;sources?:XiaoZhiSource[]};
type Point={x:number;y:number};
type OrbDrag={id:number;startX:number;startY:number;origin:Point;moved:boolean}|null;
const VOICE_KEY='yhct-xiaozhi-voice-v1',POS_KEY='yhct-xiaozhi-pos-v1',ORBIT_KEY='yhct-xiaozhi-orbit-v1';
const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const academicIntent=(value:string)=>/\b(pubmed|openalex|doi|systematic|meta[- ]?analysis|clinical trial)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|chẩn\s*đoán\s*lâm\s*sàng|điều\s*trị|kê\s*đơn|phương\s*tễ|huyệt\s*vị|dược\s*lý|bệnh\s*học/i.test(value);
const drlIntent=(value:string)=>/điểm\s*(rèn\s*luyện|hoạt\s*động)|rèn\s*luyện|drl/i.test(value);
const scheduleIntent=(value:string)=>/lịch\s*(clb|hoạt\s*động|họp|sự\s*kiện)|clb.*(khi|ngày|lúc)|hoạt\s*động.*(khi|ngày|lúc)/i.test(value);
const appIntent=(value:string)=>/(gia\s*viên|hiu\s*[-–]?\s*y\s*[-–]?\s*quán|game|đăng\s*bài|tường\s*cá\s*nhân|thông\s*báo|trung\s*tâm\s*nghiên\s*cứu|luyện\s*thi|cài\s*đặt|ai\s*mini)/i.test(value);
const readVoice=()=>{try{return localStorage.getItem(VOICE_KEY)!=='0'}catch{return true}};
const readOrbit=()=>{try{return localStorage.getItem(ORBIT_KEY)!=='0'}catch{return true}};
const readPos=():Point=>{try{const p=JSON.parse(localStorage.getItem(POS_KEY)||'null');if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))return{x:p.x,y:p.y}}catch{}return{x:0,y:0}};
const persistPos=(point:Point)=>{try{localStorage.setItem(POS_KEY,JSON.stringify(point))}catch{}};
const mobileMode=()=>window.matchMedia('(max-width: 760px)').matches;
const clampPosition=(point:Point):Point=>{
  const compact=mobileMode(),size=compact?49:58,baseLeft=compact?10:18,baseBottom=compact?76:18;
  const safeLeft=8,safeRight=8,safeTop=compact?72:10,safeBottom=compact?80:10;
  const defaultTop=window.innerHeight-baseBottom-size;
  const minX=safeLeft-baseLeft,maxX=Math.max(minX,window.innerWidth-safeRight-baseLeft-size);
  const minY=safeTop-defaultTop,maxY=baseBottom-safeBottom;
  return{x:Math.min(maxX,Math.max(minX,point.x)),y:Math.min(maxY,Math.max(minY,point.y))};
};
const appHelp=(text:string)=>{
  if(/hiu\s*[-–]?\s*y\s*[-–]?\s*quán/i.test(text))return'HIU - Y - Quán nằm trong khu Game cùng Gia Viên Dược Thảo. Bạn kích hoạt tên và giới tính nhân vật, tiếp nhận 1–2 khách mỗi giờ, đọc Vọng–Văn–Vấn–Thiết rồi chọn thể bệnh. Chẩn đúng được +1 tín dụng vào ví Gia Viên.';
  if(/gia\s*viên|game/i.test(text))return'Gia Viên Dược Thảo có cảnh quan cố định; trên điện thoại chỉ khối 9 ô trồng có thể vuốt/kéo và thu gọn. Nút chuyển game phía trên cho phép sang HIU - Y - Quán. Tín dụng của hai game dùng chung.';
  if(/đăng\s*bài/i.test(text))return'Đăng nhập thành viên, chọn nút Đăng bài ở thanh điều hướng. Nội dung học thuật vẫn đi qua quy trình của Bảng tin và các quyền kiểm duyệt hiện có.';
  if(/tường\s*cá\s*nhân/i.test(text))return'Tường cá nhân nằm ở mục Cá nhân. Trên điện thoại, nút Cá nhân ở thanh điều hướng dưới màn hình.';
  if(/trung\s*tâm\s*nghiên\s*cứu/i.test(text))return'Trung tâm nghiên cứu là nơi duy nhất dành cho A.I học thuật, tìm nguồn và hỗ trợ nghiên cứu. A.I Mini không trả lời nội dung chuyên môn học thuật.';
  if(/luyện\s*thi/i.test(text))return'Luyện thi ĐGNL nằm trong mục Thêm chức năng trên mobile và thanh điều hướng bên trái trên desktop.';
  if(/cài\s*đặt|ai\s*mini/i.test(text))return'A.I Mini có thể kéo icon đến vị trí thuận tiện, tự di chuyển chậm trong vùng an toàn và có thể tắt chuyển động. Giọng nữ mặc định cũng có thể tắt trong cửa sổ A.I.';
  return'A.I Mini là trợ lý hệ thống và thông tin: hỗ trợ điểm hoạt động, lịch CLB, cách dùng mạng xã hội và tra cứu thông tin công khai bên ngoài. Nội dung học thuật được chuyển sang Trung tâm nghiên cứu.';
};
function formatDrl(result:Awaited<ReturnType<typeof checkDrlConversation>>){if(!result)return'';if(result.mode==='mine')return result.items.length?`${result.semesterTitle||'Học kỳ hiện tại'}: ${result.total} điểm. ${result.items.slice(0,4).map(x=>`${x.label} ${x.points>=0?'+':''}${x.points}`).join(' · ')}`:`${result.semesterTitle||'Học kỳ hiện tại'}: chưa có hoạt động được công bố.`;const top=result.candidates?.[0];return top?`${top.full_name} · ${top.student_code_masked} · ${top.semester_title}: ${top.total_points} điểm.`:'Không tìm thấy kết quả điểm phù hợp.'}
const forSpeech=(text:string)=>text.replace(/https?:\/\/\S+/g,'').replace(/[*#_`>]/g,'').replace(/\s+/g,' ').trim();

export default function UnifiedAiMini({member,onLogin}:{member:Member|null;onLogin:()=>void}){
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[voiceOn,setVoiceOn]=useState(readVoice),[orbitOn,setOrbitOn]=useState(readOrbit),[listening,setListening]=useState(false),[message,setMessage]=useState(''),[messages,setMessages]=useState<Message[]>([]),[position,setPosition]=useState<Point>(readPos);
  const drag=useRef<OrbDrag>(null),recognition=useRef<any>(null),velocity=useRef<Point>({x:25,y:-18}),lastFrame=useRef<number|null>(null),nextTurn=useRef(0),suppressClick=useRef(false);
  const greeting=useMemo(()=>`Xin chào ${member?.herbalAlias||member?.fullName||'bạn'}. Tôi là A.I Mini XiaoZhi của HIU YHCT 4.0.`,[member?.herbalAlias,member?.fullName]);

  useEffect(()=>{
    const onResize=()=>setPosition(current=>clampPosition(current));
    window.addEventListener('resize',onResize);onResize();
    return()=>window.removeEventListener('resize',onResize);
  },[]);
  useEffect(()=>()=>{try{window.speechSynthesis?.cancel();recognition.current?.stop?.()}catch{}},[]);
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
  const speak=(text:string)=>{if(!voiceOn||!('speechSynthesis'in window))return;const value=forSpeech(text);if(!value)return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(value);utterance.lang='vi-VN';utterance.rate=.98;utterance.pitch=1.04;const voices=window.speechSynthesis.getVoices(),preferred=voices.find(v=>v.lang.toLowerCase().startsWith('vi')&&/female|hoai|linh|an|my|mai|google/i.test(v.name))||voices.find(v=>v.lang.toLowerCase().startsWith('vi'));if(preferred)utterance.voice=preferred;window.speechSynthesis.speak(utterance)};
  const addAssistant=(text:string,sources:XiaoZhiSource[]=[])=>{const next:Message={id:crypto.randomUUID(),role:'assistant',text,sources};setMessages(xs=>[...xs,next].slice(-8));speak(text)};

  const runQuery=async(raw:string)=>{const text=clean(raw);if(!text||busy)return;if(!member){onLogin();return}setBusy(true);setMessage('');const userMessage:Message={id:crypto.randomUUID(),role:'user',text};setMessages(xs=>[...xs,userMessage].slice(-8));setQuery('');try{
    if(appIntent(text)){addAssistant(appHelp(text));return}
    if(academicIntent(text)){addAssistant('Nội dung này thuộc phần học thuật/chuyên môn. A.I Mini không xử lý nhóm này. Hãy mở Trung tâm nghiên cứu để dùng A.I nghiên cứu có nguồn.');return}
    if(drlIntent(text)){const drl=await checkDrlConversation(text,member);const answer=formatDrl(drl)||'Tôi chưa tìm thấy dữ liệu điểm phù hợp trong tài khoản.';addAssistant(answer);return}
    if(scheduleIntent(text)){const items=await fetchSchedules(),now=Date.now(),upcoming=items.filter(x=>Date.parse(x.startsAt)>=now-3600000).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,5);const answer=upcoming.length?`Lịch CLB sắp tới: ${upcoming.map((x,i)=>`${i+1}. ${x.title}, ${new Date(x.startsAt).toLocaleString('vi-VN')}${x.location?`, tại ${x.location}`:''}`).join(' · ')}`:'Hiện tôi chưa thấy lịch CLB sắp tới được công bố.';addAssistant(answer);return}
    const reply=await askXiaoZhiMini(text,`Người dùng: ${member.fullName}. Chỉ sử dụng thông tin này để xưng hô. Không suy diễn dữ liệu cá nhân khác.`);addAssistant(reply.answer,reply.sources);setMessage(`${reply.provider}${reply.degraded?' · fallback':''}${reply.latencyMs?` · ${Math.round(reply.latencyMs)} ms`:''}`)
  }catch(e){const error=(e as Error).message||'A.I Mini chưa thể xử lý yêu cầu.';setMessage(error);addAssistant(error)}finally{setBusy(false)}};

  const startListening=()=>{if(listening){recognition.current?.stop?.();return}const SpeechRecognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SpeechRecognition){setMessage('Trình duyệt này chưa hỗ trợ nhập giọng nói. Bạn vẫn có thể gõ câu hỏi.');return}const rec=new SpeechRecognition();recognition.current=rec;rec.lang='vi-VN';rec.interimResults=false;rec.continuous=false;rec.onstart=()=>setListening(true);rec.onend=()=>setListening(false);rec.onerror=()=>{setListening(false);setMessage('Không nhận được giọng nói. Hãy thử lại hoặc gõ câu hỏi.')};rec.onresult=(event:any)=>{const text=clean(event.results?.[0]?.[0]?.transcript||'');if(text){setQuery(text);void runQuery(text)}};rec.start()};
  const openResearch=()=>{window.history.pushState(null,'','/research');window.dispatchEvent(new PopStateEvent('popstate'));setOpen(false)};
  const orbPointerDown=(event:React.PointerEvent<HTMLButtonElement>)=>{drag.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,origin:position,moved:false};suppressClick.current=false;event.currentTarget.setPointerCapture(event.pointerId)};
  const orbPointerMove=(event:React.PointerEvent<HTMLButtonElement>)=>{const state=drag.current;if(!state||state.id!==event.pointerId)return;const dx=event.clientX-state.startX,dy=event.clientY-state.startY;if(Math.hypot(dx,dy)>5)state.moved=true;setPosition(clampPosition({x:state.origin.x+dx,y:state.origin.y+dy}))};
  const orbPointerEnd=(event:React.PointerEvent<HTMLButtonElement>)=>{const state=drag.current;if(!state||state.id!==event.pointerId)return;drag.current=null;suppressClick.current=state.moved;try{event.currentTarget.releasePointerCapture(event.pointerId)}catch{}setPosition(current=>{const next=clampPosition(current);persistPos(next);return next})};
  const orbClick=()=>{if(suppressClick.current){suppressClick.current=false;return}setOpen(value=>!value)};

  return <div className={`xz-mini ${open?'is-open':''} ${orbitOn?'is-roaming':''}`}>
    {open&&<section className="xz-panel" role="dialog" aria-label="A.I Mini XiaoZhi">
      <header className="xz-header"><div className="xz-title"><span className="xz-avatar"><Bot/></span><div><b>A.I Mini · XiaoZhi</b><small>Voice · Tools · Web Search ngoài hệ thống</small></div></div><div className="xz-header-actions"><button onClick={()=>setOpen(false)} aria-label="Đóng"><X/></button></div></header>
      <div className="xz-greeting"><Sparkles/><span>{greeting}</span></div>
      <div className="xz-chips"><button onClick={()=>void runQuery('Điểm rèn luyện của tôi hiện tại')}><Navigation/>Điểm của tôi</button><button onClick={()=>void runQuery('Lịch CLB sắp tới')}><CalendarDays/>Lịch CLB</button><button onClick={()=>void runQuery('Tin tức nổi bật mới nhất hôm nay là gì?')}><ExternalLink/>Tin mới</button><button onClick={()=>void runQuery('HIU - Y - Quán chơi thế nào?')}><Sparkles/>Game mới</button></div>
      <div className="xz-conversation" aria-live="polite">{messages.length===0?<div className="xz-empty"><Bot/><p>Hỏi về điểm hoạt động, lịch CLB, cách dùng HIU YHCT 4.0 hoặc thông tin công khai bên ngoài. Câu hỏi cần dữ liệu mới sẽ dùng web search có nguồn. Nội dung học thuật được chuyển riêng sang Trung tâm nghiên cứu.</p></div>:messages.map(item=><article key={item.id} className={`xz-msg ${item.role}`}><p>{item.text}</p>{item.sources?.length?<div className="xz-sources">{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink/>{source.title}</a>)}</div>:null}</article>)}{busy&&<div className="xz-thinking"><i/><i/><i/><span>Đang tìm thông tin…</span></div>}</div>
      {message&&<div className="xz-status">{message}</div>}
      <form className="xz-compose" onSubmit={e=>{e.preventDefault();void runQuery(query)}}><button type="button" className={listening?'active':''} onClick={startListening} aria-label={listening?'Dừng nghe':'Hỏi bằng giọng nói'}>{listening?<MicOff/>:<Mic/>}</button><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={listening?'Đang nghe…':'Hỏi A.I Mini hoặc tìm thông tin ngoài hệ thống…'} maxLength={1600}/><button type="submit" disabled={busy||!clean(query)} aria-label="Gửi"><Send/></button></form>
      <footer className="xz-footer"><button className={voiceOn?'active':''} onClick={()=>persistVoice(!voiceOn)}>{voiceOn?<Volume2/>:<VolumeX/>}{voiceOn?'Giọng nữ: bật':'Giọng nói: tắt'}</button><button className={orbitOn?'active':''} onClick={()=>persistOrbit(!orbitOn)}><Sparkles/>{orbitOn?'Tự di chuyển: bật':'Tự di chuyển: tắt'}</button><button onClick={resetPosition}><RotateCcw/>Về góc trái</button><button onClick={openResearch}>Học thuật → Nghiên cứu</button></footer>
    </section>}
    <button className="xz-orb" style={{transform:`translate3d(${position.x}px,${position.y}px,0)`}} onPointerDown={orbPointerDown} onPointerMove={orbPointerMove} onPointerUp={orbPointerEnd} onPointerCancel={orbPointerEnd} onClick={orbClick} aria-label={open?'Đóng A.I Mini':'Mở hoặc kéo A.I Mini'} title="Chạm để mở · giữ và kéo để di chuyển"><span><Bot/></span><i className={listening?'listening':''}/><b>A.I</b></button>
  </div>;
}
