import {useEffect,useRef,useState} from 'react';
import {readReviewCards,saveReviewCard,scheduleReview,type ReviewCard} from '../../services/adaptiveReview';
export default function AdaptiveReview({identity}:{identity:string|null}){
 const [cards,setCards]=useState<ReviewCard[]>(()=>readReviewCards(identity)),[revealed,setRevealed]=useState(false),[notice,setNotice]=useState('');
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const refresh=()=>{setCards(readReviewCards(identity));setRevealed(false);setNow(Date.now())};refresh();window.addEventListener('yhct:review',refresh);window.addEventListener('storage',refresh);const timer=setInterval(()=>setNow(Date.now()),30000);return()=>{clearInterval(timer);window.removeEventListener('yhct:review',refresh);window.removeEventListener('storage',refresh)}},[identity]);
 const due=cards.filter(c=>c.due<=now).sort((a,b)=>a.due-b.due),card=due[0];
 const lastRated=useRef('');
 const rate=(correct:boolean)=>{if(!card||!revealed)return;const turn=`${card.id}:${card.lastAttempt}`;if(lastRated.current===turn)return;lastRated.current=turn;const ok=saveReviewCard(identity,scheduleReview(card,correct,crypto.randomUUID()));if(!ok)lastRated.current='';setNotice(ok?(correct?'Đã lên lịch ôn tiếp.':'Sẽ nhắc ôn lại sau 10 phút.'):'Không lưu được lịch ôn trên thiết bị. Vui lòng kiểm tra dung lượng.');};
 return <section className="panel adaptive-review"><h2>Ôn tập ngắt quãng</h2><p>{due.length} thẻ đến hạn · {cards.length} thẻ từ bài đã làm. Lịch ôn lưu riêng trên thiết bị này; không thay đổi điểm thi.</p>{card?<article key={card.id}><small>{card.topic}</small><h3>{card.stem}</h3>{revealed?<><p style={{whiteSpace:'pre-wrap'}}>{card.answer}</p><small>Nguồn: {card.source||'Ngân hàng nội bộ; cần đối chiếu giáo trình.'}</small><div className="row"><button onClick={()=>rate(false)}>Cần ôn lại</button><button onClick={()=>rate(true)}>Đã nhớ</button></div></>:<button onClick={()=>setRevealed(true)}>Xem giải thích</button>}</article>:<p>{cards.length?'Bạn đã hoàn thành các thẻ đến hạn.':'Làm bài luyện tập để tạo thẻ ôn từ câu hỏi và giải thích hiện có.'}</p>}{notice&&<p role="status">{notice}</p>}</section>;
}
