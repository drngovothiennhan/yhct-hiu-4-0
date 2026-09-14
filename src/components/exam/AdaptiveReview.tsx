import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {readReviewCards,saveReviewCard,scheduleReview,type ReviewCard} from '../../services/adaptiveReview';
import {getPracticeQuizConfig} from '../../services/practiceQuizService';
import QuestionReasoningGuide from './QuestionReasoningGuide';

const REVIEW_COUNTS=[5,10,20] as const;
export default function AdaptiveReview({identity}:{identity:string|null}){
 const [cards,setCards]=useState<ReviewCard[]>(()=>readReviewCards(identity)),[revealed,setRevealed]=useState(false),[notice,setNotice]=useState('');
 const [now,setNow]=useState(Date.now()),[subject,setSubject]=useState(''),[count,setCount]=useState<number>(10);
 const [bankSubjects,setBankSubjects]=useState<string[]>([]),[bankReady,setBankReady]=useState(false);
 useEffect(()=>{const refresh=()=>{setCards(readReviewCards(identity));setRevealed(false);setNow(Date.now())};refresh();window.addEventListener('yhct:review',refresh);window.addEventListener('storage',refresh);const timer=setInterval(()=>setNow(Date.now()),30000);return()=>{clearInterval(timer);window.removeEventListener('yhct:review',refresh);window.removeEventListener('storage',refresh)}},[identity]);
 useEffect(()=>{let alive=true;setBankReady(false);void getPracticeQuizConfig().then(config=>{if(!alive)return;const next=[...new Set(config.subjects||[])].sort((a,b)=>a.localeCompare(b,'vi'));setBankSubjects(next);setSubject(current=>current&& !next.includes(current)?'':current);setBankReady(true)}).catch(()=>{if(alive){setBankSubjects([]);setBankReady(true)}});return()=>{alive=false}},[identity]);
 const subjects=bankSubjects;
 const validCards=useMemo(()=>{const allowed=new Set(bankSubjects);return cards.filter(card=>Boolean(card.subject&&allowed.has(card.subject)))},[cards,bankSubjects]);
 const due=useMemo(()=>validCards.filter(card=>card.due<=now&&(!subject||card.subject===subject)).sort((a,b)=>a.due-b.due),[validCards,now,subject]);
 const sessionCards=due.slice(0,count),card=sessionCards[0];
 const lastRated=useRef('');
 const rate=(correct:boolean)=>{if(!card||!revealed)return;const turn=`${card.id}:${card.lastAttempt}`;if(lastRated.current===turn)return;lastRated.current=turn;const ok=saveReviewCard(identity,scheduleReview(card,correct,crypto.randomUUID()));if(!ok)lastRated.current='';setNotice(ok?(correct?'Đã lên lịch ôn tiếp.':'Sẽ nhắc ôn lại sau 10 phút.'):'Không lưu được lịch ôn trên thiết bị. Vui lòng kiểm tra dung lượng.');};
 return <section className="panel adaptive-review"><h2>Ôn tập ngắt quãng</h2><p>{due.length} thẻ đến hạn · {validCards.length} thẻ thuộc các thư mục HIU hiện hành. Chọn thư mục và số thẻ muốn ôn; lịch ôn lưu riêng trên thiết bị này, không thay đổi điểm thi.</p>
 <div className="adaptive-review__controls">
   <label><span>Nội dung</span><div><select value={subject} disabled={!bankReady} onChange={event=>{setSubject(event.target.value);setRevealed(false)}}><option value="">Tất cả nội dung</option>{subjects.map(item=><option key={item} value={item}>{item}</option>)}</select><ChevronDown/></div></label>
   <label><span>Số thẻ</span><div><select value={count} onChange={event=>setCount(Number(event.target.value))}>{REVIEW_COUNTS.map(value=><option key={value} value={value}>{value} thẻ</option>)}</select><ChevronDown/></div></label>
 </div>
 {card?<article key={card.id}><small>{card.subject}</small><h3>{card.stem}</h3><QuestionReasoningGuide questionId={card.id} subject={card.subject||subject||'Ôn tập HIU'} topic={card.topic} stem={card.stem} sourceLabel="Ngân hàng HIU đã duyệt"/>{revealed?<><p style={{whiteSpace:'pre-wrap'}}>{card.answer}</p><small>Nguồn: {card.source||'Ngân hàng HIU đã duyệt'}</small><div className="row"><button onClick={()=>rate(false)}>Cần ôn lại</button><button onClick={()=>rate(true)}>Đã nhớ</button></div></>:<button onClick={()=>setRevealed(true)}>Xem giải thích</button>}</article>:<p>{!bankReady?'Đang đồng bộ danh sách thư mục HIU…':validCards.length?(subject?'Chưa có thẻ đến hạn cho thư mục đã chọn. Hãy làm quiz của thư mục này để tạo thêm thẻ.':'Bạn đã hoàn thành các thẻ đến hạn.'):'Chưa có thẻ ôn thuộc các thư mục HIU hiện hành. Hãy làm bài luyện tập để tạo thẻ mới.'}</p>}
 {sessionCards.length>0&&<small>Phiên hiện tại tối đa {Math.min(count,due.length)} thẻ · còn {due.length} thẻ đến hạn trong bộ lọc.</small>}{notice&&<p role="status">{notice}</p>}</section>;
}