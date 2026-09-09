import {useEffect,useMemo,useRef,useState} from 'react';
import {Bot,CalendarDays,ExternalLink,GripHorizontal,Mic,MicOff,Navigation,Send,Sparkles,Volume2,VolumeX,X} from 'lucide-react';
import type {Member} from '../../types';
import {checkDrlConversation} from '../../services/miniAiEngine';
import {fetchSchedules} from '../../services/scheduleService';
import {askXiaoZhiMini,type XiaoZhiSource} from '../../services/xiaozhiMiniService';
import '../../xiaozhi-mini.css';

type Message={id:string;role:'user'|'assistant';text:string;sources?:XiaoZhiSource[]};
type Point={x:number;y:number};
const VOICE_KEY='yhct-xiaozhi-voice-v1',POS_KEY='yhct-xiaozhi-pos-v1';
const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const academicIntent=(value:string)=>/\b(pubmed|openalex|doi|systematic|meta[- ]?analysis|clinical trial)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|chẩn\s*đoán\s*lâm\s*sàng|điều\s*trị|kê\s*đơn|phương\s*tễ|huyệt\s*vị|dược\s*lý|bệnh\s*học/i.test(value);
const drlIntent=(value:string)=>/điểm\s*(rèn\s*luyện|hoạt\s*động)|rèn\s*luyện|drl/i.test(value);
const scheduleIntent=(value:string)=>/lịch\s*(clb|hoạt\s*động|họp|sự\s*kiện)|clb.*(khi|ngày|lúc)|hoạt\s*động.*(khi|ngày|lúc)/i.test(value);
const appIntent=(value:string)=>/(gia\s*viên|hiu\s*[-–]?\s*y\s*[-–]?\s*quán|game|đăng\s*bài|tường\s*cá\s*nhân|thông\s*báo|trung\s*tâm\s*nghiên\s*cứu|luyện\s*thi|cài\s*đặt|ai\s*mini)/i.test(value);
const readVoice=()=>{try{return localStorage.getItem(VOICE_KEY)!=='0'}catch{return true}};
const readPos=():Point=>{try{const p=JSON.parse(localStorage.getItem(POS_KEY)||'null');if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))return{x:p.x,y:p.y}}catch{}return{x:0,y:0}};
const appHelp=(text:string)=>{
  if(/hiu\s*[-–]?\s*y\s*[-–]?\s*quán/i.test(text))return'HIU - Y - Quán nằm trong khu Game cùng Gia Viên Dược Thảo. Bạn kích hoạt tên và giới tính nhân vật, tiếp nhận 1–2 khách mỗi giờ, đọc Vọng–Văn–Vấn–Thiết rồi chọn thể bệnh. Chẩn đúng được +1 tín dụng vào ví Gia Viên.';
  if(/gia\s*viên|game/i.test(text))return'Gia Viên Dược Thảo là khu game trồng dược liệu. Bản mới dùng thế giới 2D có thể kéo để di chuyển; nút chuyển game ở phía trên cho phép sang HIU - Y - Quán. Tín dụng của hai game dùng chung.';
  if(/đăng\s*bài/i.test(text))return'Đăng nhập thành viên, chọn nút Đăng bài ở thanh điều hướng. Nội dung học thuật vẫn đi qua quy trình của Bảng tin và các quyền kiểm duyệt hiện có.';
  if(/tường\s*cá\s*nhân/i.test(text))return'Tường cá nhân nằm ở mục Cá nhân. Trên điện thoại, nút Cá nhân ở thanh điều hướng dưới màn hình.';
  if(/trung\s*tâm\s*nghiên\s*cứu/i.test(text))return'Trung tâm nghiên cứu là nơi duy nhất dành cho A.I học thuật, tìm nguồn và hỗ trợ nghiên cứu. A.I Mini không trả lời nội dung chuyên môn học thuật.';
  if(/luyện\s*thi/i.test(text))return'Luyện thi ĐGNL nằm trong mục Thêm chức năng trên mobile và thanh điều hướng bên trái trên desktop.';
  if(/cài\s*đặt/i.test(text))return'Mở Cài đặt từ menu hệ thống để đổi chế độ hiển thị và các tùy chọn ứng dụng. Riêng giọng A.I Mini có công tắc loa ngay trong cửa sổ A.I.';
  return'A.I Mini là trợ lý hệ thống và thông tin: hỗ trợ điểm hoạt động, lịch CLB, cách dùng mạng xã hội và tra cứu tin tức bên ngoài. Nội dung học thuật được chuyển sang Trung tâm nghiên cứu.';
};
function formatDrl(result:Awaited<ReturnType<typeof checkDrlConversation>>){if(!result)return'';if(result.mode==='mine')return result.items.length?`${result.semesterTitle||'Học kỳ hiện tại'}: ${result.total} điểm. ${result.items.slice(0,4).map(x=>`${x.label} ${x.points>=0?'+':''}${x.points}`).join(' · ')}`:`${result.semesterTitle||'Học kỳ hiện tại'}: chưa có hoạt động được công bố.`;const top=result.candidates?.[0];return top?`${top.full_name} · ${top.student_code_masked} · ${top.semester_title}: ${top.total_points} điểm.`:'Không tìm thấy kết quả điểm phù hợp.'}
const forSpeech=(text:string)=>text.replace(/https?:\/\/\S+/g,'').replace(/[*#_`>]/g,'').replace(/\s+/g,' ').trim();

export default function UnifiedAiMini({member,onLogin}:{member:Member|null;onLogin:()=>void}){
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[voiceOn,setVoiceOn]=useState(readVoice),[listening,setListening]=useState(false),[message,setMessage]=useState(''),[messages,setMessages]=useState<Message[]>([]),[position,setPosition]=useState<Point>(readPos);
  const drag=useRef<{id:number;startX:number;startY:number;origin:Point}|null>(null),recognition=useRef<any>(null);
  const greeting=useMemo(()=>`Xin chào ${member?.herbalAlias||member?.fullName||'bạn'}. Tôi là A.I Mini XiaoZhi của HIU YHCT 4.0.`,[member?.herbalAlias,member?.fullName]);

  useEffect(()=>()=>{try{window.speechSynthesis?.cancel();recognition.current?.stop?.()}catch{}},[]);
  const persistVoice=(next:boolean)=>{setVoiceOn(next);try{localStorage.setItem(VOICE_KEY,next?'1':'0')}catch{}if(!next)window.speechSynthesis?.cancel()};
  const speak=(text:string)=>{if(!voiceOn||!('speechSynthesis'in window))return;const value=forSpeech(text);if(!value)return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(value);utterance.lang='vi-VN';utterance.rate=.98;utterance.pitch=1.04;const voices=window.speechSynthesis.getVoices(),preferred=voices.find(v=>v.lang.toLowerCase().startsWith('vi')&&/female|hoai|linh|an|my|mai|google/i.test(v.name))||voices.find(v=>v.lang.toLowerCase().startsWith('vi'));if(preferred)utterance.voice=preferred;window.speechSynthesis.speak(utterance)};
  const addAssistant=(text:string,sources:XiaoZhiSource[]=[])=>{setMessages(xs=>[...xs,{id:crypto.randomUUID(),role:'assistant',text,sources}].slice(-8));speak(text)};

  const runQuery=async(raw:string)=>{const text=clean(raw);if(!text||busy)return;if(!member){onLogin();return}setBusy(true);setMessage('');setMessages(xs=>[...xs,{id:crypto.randomUUID(),role:'user',text}].slice(-8));setQuery('');try{
    if(appIntent(text)){addAssistant(appHelp(text));return}
    if(academicIntent(text)){addAssistant('Nội dung này thuộc phần học thuật/chuyên môn. A.I Mini không xử lý nhóm này. Hãy mở Trung tâm nghiên cứu để dùng A.I nghiên cứu có nguồn.');return}
    if(drlIntent(text)){const drl=await checkDrlConversation(text,member);const answer=formatDrl(drl)||'Tôi chưa tìm thấy dữ liệu điểm phù hợp trong tài khoản.';addAssistant(answer);return}
    if(scheduleIntent(text)){const items=await fetchSchedules(),now=Date.now(),upcoming=items.filter(x=>Date.parse(x.startsAt)>=now-3600000).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,5);const answer=upcoming.length?`Lịch CLB sắp tới: ${upcoming.map((x,i)=>`${i+1}. ${x.title}, ${new Date(x.startsAt).toLocaleString('vi-VN')}${x.location?`, tại ${x.location}`:''}`).join(' · ')}`:'Hiện tôi chưa thấy lịch CLB sắp tới được công bố.';addAssistant(answer);return}
    const reply=await askXiaoZhiMini(text,`Người dùng: ${member.fullName}. Chỉ sử dụng thông tin này để xưng hô. Không suy diễn dữ liệu cá nhân khác.`);addAssistant(reply.answer,reply.sources);setMessage(`${reply.provider}${reply.degraded?' · fallback':''}${reply.latencyMs?` · ${Math.round(reply.latencyMs)} ms`:''}`)
  }catch(e){const error=(e as Error).message||'A.I Mini chưa thể xử lý yêu cầu.';setMessage(error);addAssistant(error)}finally{setBusy(false)}};

  const startListening=()=>{if(listening){recognition.current?.stop?.();return}const SpeechRecognition=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SpeechRecognition){setMessage('Trình duyệt này chưa hỗ trợ nhập giọng nói. Bạn vẫn có thể gõ câu hỏi.');return}const rec=new SpeechRecognition();recognition.current=rec;rec.lang='vi-VN';rec.interimResults=false;rec.continuous=false;rec.onstart=()=>setListening(true);rec.onend=()=>setListening(false);rec.onerror=()=>{setListening(false);setMessage('Không nhận được giọng nói. Hãy thử lại hoặc gõ câu hỏi.')};rec.onresult=(event:any)=>{const text=clean(event.results?.[0]?.[0]?.transcript||'');if(text){setQuery(text);void runQuery(text)}};rec.start()};
  const openResearch=()=>{window.history.pushState(null,'','/research');window.dispatchEvent(new PopStateEvent('popstate'));setOpen(false)};
  const dragStart=(e:React.PointerEvent)=>{if(window.matchMedia('(max-width: 760px)').matches)return;drag.current={id:e.pointerId,startX:e.clientX,startY:e.clientY,origin:position};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)};
  const dragMove=(e:React.PointerEvent)=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;setPosition({x:d.origin.x+e.clientX-d.startX,y:d.origin.y+e.clientY-d.startY})};
  const dragEnd=(e:React.PointerEvent)=>{if(drag.current?.id!==e.pointerId)return;drag.current=null;try{(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)}catch{}setPosition(p=>{try{localStorage.setItem(POS_KEY,JSON.stringify(p))}catch{}return p})};

  return <div className={`xz-mini ${open?'is-open':''}`} style={{transform:`translate(${position.x}px,${position.y}px)`}}>
    {open&&<section className="xz-panel" role="dialog" aria-label="A.I Mini XiaoZhi">
      <header className="xz-header" onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd}><div className="xz-title"><span className="xz-avatar"><Bot/></span><div><b>A.I Mini · XiaoZhi</b><small>Voice · Tools · Web Search</small></div></div><div className="xz-header-actions"><GripHorizontal className="xz-grip"/><button onPointerDown={e=>e.stopPropagation()} onClick={()=>setOpen(false)} aria-label="Đóng"><X/></button></div></header>
      <div className="xz-greeting"><Sparkles/><span>{greeting}</span></div>
      <div className="xz-chips"><button onClick={()=>void runQuery('Điểm rèn luyện của tôi hiện tại')}><Navigation/>Điểm của tôi</button><button onClick={()=>void runQuery('Lịch CLB sắp tới')}><CalendarDays/>Lịch CLB</button><button onClick={()=>void runQuery('HIU - Y - Quán chơi thế nào?')}><Sparkles/>Game mới</button></div>
      <div className="xz-conversation" aria-live="polite">{messages.length===0?<div className="xz-empty"><Bot/><p>Hỏi về điểm hoạt động, lịch CLB, cách dùng HIU YHCT 4.0 hoặc tin tức bên ngoài. Nội dung học thuật được chuyển riêng sang Trung tâm nghiên cứu.</p></div>:messages.map(item=><article key={item.id} className={`xz-msg ${item.role}`}><p>{item.text}</p>{item.sources?.length?<div className="xz-sources">{item.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink/>{source.title}</a>)}</div>:null}</article>)}{busy&&<div className="xz-thinking"><i/><i/><i/><span>Đang tìm thông tin…</span></div>}</div>
      {message&&<div className="xz-status">{message}</div>}
      <form className="xz-compose" onSubmit={e=>{e.preventDefault();void runQuery(query)}}><button type="button" className={listening?'active':''} onClick={startListening} aria-label={listening?'Dừng nghe':'Hỏi bằng giọng nói'}>{listening?<MicOff/>:<Mic/>}</button><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={listening?'Đang nghe…':'Hỏi A.I Mini…'} maxLength={1600}/><button type="submit" disabled={busy||!clean(query)} aria-label="Gửi"><Send/></button></form>
      <footer className="xz-footer"><button className={voiceOn?'active':''} onClick={()=>persistVoice(!voiceOn)}>{voiceOn?<Volume2/>:<VolumeX/>}{voiceOn?'Giọng nữ: bật':'Giọng nói: tắt'}</button><button onClick={openResearch}>Học thuật → Trung tâm nghiên cứu</button></footer>
    </section>}
    <button className="xz-orb" onClick={()=>setOpen(x=>!x)} aria-label={open?'Đóng A.I Mini':'Mở A.I Mini'}><span><Bot/></span><i className={listening?'listening':''}/><b>A.I</b></button>
  </div>;
}
