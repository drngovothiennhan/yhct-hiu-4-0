import { useEffect,useRef,useState,type KeyboardEvent as ReactKeyboardEvent,type MouseEvent as ReactMouseEvent,type PointerEvent as ReactPointerEvent } from 'react';
import { ExternalLink,RefreshCw,ShieldCheck } from 'lucide-react';
import type { Member } from '../../types';
import { roleAtLeast } from '../../types';
import { supabase } from '../../services/authService';
import { HerbIcon } from '../icons/YhctIcons';
import SystemBrandMark,{type SystemBrandVariant} from '../branding/SystemBrandMark';

type News={
  id:string;
  title:string;
  canonical_url:string;
  publisher:string;
  publisher_domain:string;
  published_at?:string|null;
  summary:string;
  tags:string[];
  trust_score:number;
  ai_provider:string;
  image_url?:string|null;
};
type DragState={pointerId:number;startX:number;startLeft:number;moved:boolean};

const DEFAULT_NEWS_MARKS:SystemBrandVariant[]=['herb','decoction','mortar','acupuncture','five','taiji'];
function fallbackVariant(seed:string){
  let hash=0;
  for(let i=0;i<seed.length;i++)hash=(hash*31+seed.charCodeAt(i))>>>0;
  return DEFAULT_NEWS_MARKS[hash%DEFAULT_NEWS_MARKS.length];
}

function NewsVisual({item}:{item:News}){
  const [failed,setFailed]=useState(!item.image_url);
  useEffect(()=>setFailed(!item.image_url),[item.image_url]);
  return <div className={`news-media ${failed?'is-fallback':''}`}>
    {!failed&&item.image_url&&<img src={item.image_url} alt={item.title} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>} 
    {failed&&<div className="news-media-default"><SystemBrandMark variant={fallbackVariant(`${item.id}:${item.title}`)} size="clamp(54px,20vw,78px)" label="Biểu trưng Y học cổ truyền mặc định"/></div>}
  </div>;
}

export default function TcmNewsCenter({member,compact=false}:{member:Member|null;compact?:boolean}){
  const [items,setItems]=useState<News[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const canReview=roleAtLeast(member?.role,'mod');
  const dragRef=useRef<DragState|null>(null),suppressClickUntil=useRef(0);

  const load=async()=>{
    setBusy(true);setMsg('');
    try{
      const {data,error}=await supabase.rpc('tcm_news_feed_v1',{p_limit:10});
      if(error)throw error;
      setItems(((data||[]) as News[]).slice(0,10));
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  useEffect(()=>{void load()},[]);

  const onRailPointerDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
    if(!compact||(e.pointerType==='mouse'&&e.button!==0))return;
    const rail=e.currentTarget;
    dragRef.current={pointerId:e.pointerId,startX:e.clientX,startLeft:rail.scrollLeft,moved:false};
    rail.classList.add('is-dragging');
    try{rail.setPointerCapture(e.pointerId)}catch{}
  };
  const onRailPointerMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
    const drag=dragRef.current;if(!compact||!drag||drag.pointerId!==e.pointerId)return;
    const dx=e.clientX-drag.startX;
    if(!drag.moved&&Math.abs(dx)>5)drag.moved=true;
    if(!drag.moved)return;
    e.currentTarget.scrollLeft=drag.startLeft-dx;
    if(e.cancelable)e.preventDefault();
  };
  const finishRailDrag=(e:ReactPointerEvent<HTMLDivElement>)=>{
    const drag=dragRef.current;if(!drag||drag.pointerId!==e.pointerId)return;
    dragRef.current=null;e.currentTarget.classList.remove('is-dragging');
    if(drag.moved)suppressClickUntil.current=performance.now()+350;
    try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}
  };
  const onRailClickCapture=(e:ReactMouseEvent<HTMLDivElement>)=>{if(performance.now()<suppressClickUntil.current){e.preventDefault();e.stopPropagation()}};
  const onRailKeyDown=(e:ReactKeyboardEvent<HTMLDivElement>)=>{if(!compact||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'))return;e.preventDefault();e.currentTarget.scrollBy({left:e.key==='ArrowRight'?280:-280,behavior:'smooth'})};

  return <section className={compact?'news-center news-center-compact':'news-center'}>
    <div className="between news-heading">
      <div className="row panel-title"><HerbIcon/><div><h2>Tin tức Y học cổ truyền</h2><p>10 tin mới nhất · nguồn và thời gian minh bạch.</p></div></div>
      {compact&&<span className="news-swipe-hint" aria-hidden="true">Vuốt để xem thêm →</span>}
      {!compact&&<button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw/>Làm mới</button>}
    </div>
    {msg&&<div className="error" role="alert">{msg}</div>}
    {items.length===0?<section className="panel empty-state"><HerbIcon/><h3>Chưa có tin đã qua ngưỡng tin cậy</h3><p>Pipeline giữ nội dung chưa đủ điểm tin cậy trong hàng chờ thay vì tự động công bố.</p></section>:
      <div className="news-grid" tabIndex={compact?0:undefined} role={compact?'region':undefined} aria-label="10 tin Y học cổ truyền mới nhất. Vuốt ngang hoặc dùng phím mũi tên để xem thêm." onPointerDown={onRailPointerDown} onPointerMove={onRailPointerMove} onPointerUp={finishRailDrag} onPointerCancel={finishRailDrag} onClickCapture={onRailClickCapture} onKeyDown={onRailKeyDown}>
        {items.map(n=><article className="news-card" key={n.id}>
          <NewsVisual item={n}/>
          <div className="news-meta"><span>{n.publisher||n.publisher_domain||'Nguồn tổng hợp'}</span><time dateTime={n.published_at||undefined}>{n.published_at?new Date(n.published_at).toLocaleString('vi-VN'):'Chưa rõ thời gian'}</time></div>
          <h3 className="news-title-clamp">{n.title}</h3>
          <p className="news-summary-clamp">{n.summary}</p>
          {!compact&&<div className="tags">{(n.tags||[]).slice(0,4).map(t=><span key={t}>#{t}</span>)}</div>}
          <footer><span className="trust">Tin cậy {Math.round(Number(n.trust_score||0)*100)}%</span><a href={n.canonical_url} target="_blank" rel="noreferrer noopener">Đọc nguồn <ExternalLink/></a></footer>
        </article>)}
      </div>}
    {canReview&&!compact&&<div className="ai-note"><ShieldCheck/> Tài khoản quản trị có quyền duyệt nguồn; pipeline chỉ tự công bố nội dung vượt ngưỡng tin cậy.</div>}
  </section>;
}
