import {useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {readReviewCards,saveReviewCard,scheduleReview,type ReviewCard} from '../../services/adaptiveReview';
import {getPracticeQuizConfig} from '../../services/practiceQuizService';
import QuestionReasoningGuide from './QuestionReasoningGuide';

const REVIEW_COUNTS=[5,10,20] as const;
export default function AdaptiveReview({identity}:{identity:string|null}){
 const [cards,setCards]=useState<ReviewCard[]>(()=>readReviewCards(identity)),[revealed,setRevealed]=useState(false),[notice,setNotice]=useState('');
 const [now,setNow]=useState(Date.now()),[subject,setSubject]=useState(''),[count,setCount]=useState<number>(10);
 const [bankSubjects,setBankSubjects]=useState<string[]>([]);
 useEffect(()=>{const refresh=()=>{setCards(readReviewCards(identity));setRevealed(false);setNow(Date.now())};refresh();window.addEventListener('yhct:review',refresh);window.addEventListener('storage',refresh);const timer=setInterval(()=>setNow(Date.now()),30000);return()=>{clearInterval(timer);window.removeEventListener('yhct:review',refresh);window.removeEventListener('storage',refresh)}},[identity]);
 useEffect(()=>{let alive=true;void getPracticeQuizConfig().then(config=>{if(alive)setBankSubjects(config.subjects||[])}).catch(()=>{});return()=>{alive=false}},[identity]);
 const subjects=useMemo(()=>[...new Set([...bankSubjects,...cards.map(card=>card.subject||'').filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'vi')),[bankSubjects,cards]);
 const due=useMemo(()=>cards.filter(card=>card.due<=now&&(!subject||card.subject===subject)).sort((a,b)=>a.due-b.due),[cards,now,subject]);
 const sessionCards=due.slice(0,count),card=sessionCards[0];
 const lastRated=useRef('');
 const rate=(correct:boolean)=>{if(!card||!revealed)return;const turn=`${card.id}:${card.lastAttempt}`;if(lastRated.current===turn)return;lastRated.current=turn;const ok=saveReviewCard(identity,scheduleReview(card,correct,crypto.randomUUID()));if(!ok)lastRated.current='';setNotice(ok?(correct?'Đã lên lịch ôn tiếp.':'Sẽ nhắc ôn lại sau 10 phút.'):'Không lưu được lịch ôn trên thiết bị. Vui lòng kiểm tra dung lượng.');};
 return <section className="panel adaptive-review"><h2>Ôn tập ngắt quãng</h2><p>{due.length} thẻ đến hạn · {cards.length} thẻ từ bài đã làm. Chọn nội dung theo ngân hàng HIU và số thẻ muốn ôn; lịch ôn lưu riêng trên thiết bị này, không thay đổi điểm thi.</p>
 <div className="adaptive-review__controls">
   <label><span>Nội dung</span><div><select value={subject} onChange={event=>{setSubject(event.target.value);setRevealed(false)}}><option value="">Tất cả nội dung</option>{subjects.map(item=><option key={item} value={item}>{item}</option>)}</select><ChevronDown/></div></label>
   <label><span>Số thẻ</span><div><select value={count} onChange={event=>setCount(Number(event.target.value))}>{REVIEW_COUNTS.map(value=><option key={value} value={value}>{value} thẻ</option>)}</select><ChevronDown/></div></label>
 </div>
 {card?<article key={card.id}><small>{card.subject?`${card.subject} · `:''}{card.topic}</small><h3>{card.stem}</h3><QuestionReasoningGuide questionId={card.id} subject={card.subject||subject||'Ôn tập HIU'} topic={card.topic} stem={card.stem} sourceLabel="Ngân hàng HIU đã duyệt"/>{revealed?<><p style={{whiteSpace:'pre-wrap'}}>{card.answer}</p><small>Nguồn: {card.source||'Ngân hàng HIU đã duyệt'}</small><div className="row"><button onClick={()=>rate(false)}>Cần ôn lại</button><button onClick={()=>rate(true)}>Đã nhớ</button></div></>:<button onClick={()=>setRevealed(true)}>Xem giải thích</button>}</article>:<p>{cards.length?(subject?'Chưa có thẻ đến hạn cho nội dung đã chọn. Hãy làm quiz của nội dung này để tạo thêm thẻ.':'Bạn đã hoàn thành các thẻ đến hạn.'):'Làm bài luyện tập để tạo thẻ ôn từ câu hỏi và giải thích hiện có.'}</p>}
 {sessionCards.length>0&&<small>Phiên hiện tại tối đa {Math.min(count,due.length)} thẻ · còn {due.length} thẻ đến hạn trong bộ lọc.</small>}{notice&&<p role="status">{notice}</p>}</section>;
}
