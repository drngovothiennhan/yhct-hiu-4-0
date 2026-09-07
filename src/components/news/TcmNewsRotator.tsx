import { useEffect,useMemo,useRef,useState } from 'react';
import { ChevronLeft,ChevronRight,ExternalLink,RefreshCw } from 'lucide-react';
import { supabase } from '../../services/authService';
import { HerbIcon } from '../icons/YhctIcons';

type News={id:string;title:string;canonical_url:string;publisher:string;publisher_domain:string;published_at?:string|null;summary:string;tags:string[];trust_score:number;ai_provider:string};
type Swipe={pointerId:number;startX:number;startY:number;moved:boolean};

const PAGE_SIZE=2;
const ROTATE_MS=8000;
const REFRESH_MS=5*60*1000;
const SWIPE_THRESHOLD=44;

function shortDate(value?:string|null){if(!value)return'Chưa rõ ngày';const d=new Date(value);return Number.isNaN(d.getTime())?'Chưa rõ ngày':d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})}
function desktopViewport(){return typeof document!=='undefined'&&document.documentElement.dataset.viewportMode==='desktop'}

export default function TcmNewsRotator(){
  const [items,setItems]=useState<News[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[page,setPage]=useState(0),[paused,setPaused]=useState(false);
  const swipeRef=useRef<Swipe|null>(null),suppressClickRef=useRef(false);

  const load=async()=>{setBusy(true);setMsg('');try{const {data,error}=await supabase.rpc('tcm_news_feed_v1',{p_limit:20});if(error)throw error;setItems(((data||[]) as News[]).slice(0,20));setPage(0)}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  useEffect(()=>{void load();const id=window.setInterval(()=>void load(),REFRESH_MS);return()=>window.clearInterval(id)},[]);

  const pageCount=Math.max(1,Math.ceil(items.length/PAGE_SIZE));
  useEffect(()=>{setPage(current=>Math.min(current,pageCount-1))},[pageCount]);
  useEffect(()=>{if(paused||items.length<=PAGE_SIZE)return;const id=window.setInterval(()=>{if(document.visibilityState==='visible')setPage(current=>(current+1)%pageCount)},ROTATE_MS);return()=>window.clearInterval(id)},[paused,items.length,pageCount]);

  const visibleItems=useMemo(()=>{
    if(!items.length)return[] as News[];
    const start=page*PAGE_SIZE;
    if(items.length===1)return[items[0]];
    return [items[start%items.length],items[(start+1)%items.length]];
  },[items,page]);

  const move=(delta:number)=>setPage(current=>(current+delta+pageCount)%pageCount);
  const onStagePointerDown=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(pageCount<=1||!desktopViewport()||(e.pointerType!=='touch'&&e.pointerType!=='pen'))return;
    swipeRef.current={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false};
    setPaused(true);
    try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}
  };
  const onStagePointerMove=(e:React.PointerEvent<HTMLDivElement>)=>{
    const s=swipeRef.current;if(!s||s.pointerId!==e.pointerId)return;
    const dx=e.clientX-s.startX,dy=e.clientY-s.startY;
    if(!s.moved&&Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.1)s.moved=true;
    if(s.moved)e.preventDefault();
  };
  const finishStagePointer=(e:React.PointerEvent<HTMLDivElement>,cancelled=false)=>{
    const s=swipeRef.current;if(!s||s.pointerId!==e.pointerId)return;
    const dx=e.clientX-s.startX,dy=e.clientY-s.startY;
    swipeRef.current=null;
    try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}
    if(!cancelled&&s.moved&&Math.abs(dx)>=SWIPE_THRESHOLD&&Math.abs(dx)>Math.abs(dy)){
      suppressClickRef.current=true;
      move(dx<0?1:-1);
      window.setTimeout(()=>{suppressClickRef.current=false},250);
    }
    setPaused(false);
  };
  const onStageClickCapture=(e:React.MouseEvent<HTMLDivElement>)=>{if(!suppressClickRef.current)return;suppressClickRef.current=false;e.preventDefault();e.stopPropagation()};

  return <section className="news-rotator" aria-label="Điểm tin Y học cổ truyền tự động">
    <div className="news-rotator-heading">
      <div className="row panel-title"><HerbIcon/><div><h2>Tin tức Y học cổ truyền</h2><p>Tự cập nhật · 2 tin/lượt · hỗ trợ chạm/vuốt trên PC cảm ứng.</p></div></div>
      <button className="secondary news-rotator-refresh" disabled={busy} onClick={()=>void load()} aria-label="Làm mới tin"><RefreshCw/></button>
    </div>
    {msg&&<div className="error" role="alert">{msg}</div>}
    {visibleItems.length===0?<div className="news-rotator-empty"><HerbIcon/><span>{busy?'Đang tải tin…':'Chưa có tin đã công bố.'}</span></div>:
      <div className="news-rotator-stage" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={()=>setPaused(false)} onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={e=>finishStagePointer(e)} onPointerCancel={e=>finishStagePointer(e,true)} onClickCapture={onStageClickCapture}>
        <div className="news-rotator-pair" aria-live="polite">
          {visibleItems.map((n,index)=><a className="news-rotator-card" key={`${page}-${index}-${n.id}`} href={n.canonical_url} target="_blank" rel="noreferrer noopener">
            <div className="news-rotator-meta"><span>{n.publisher||n.publisher_domain||'Nguồn tổng hợp'}</span><time dateTime={n.published_at||undefined}>{shortDate(n.published_at)}</time></div>
            <p className="news-rotator-text"><strong>{n.title}</strong>{n.summary?` — ${n.summary}`:' — Tóm tắt đang được cập nhật.'}</p>
            <span className="news-rotator-open">Đọc nguồn <ExternalLink/></span>
          </a>)}
        </div>
        {pageCount>1&&<div className="news-rotator-controls">
          <button className="secondary" onClick={()=>move(-1)} aria-label="Xem 2 tin trước"><ChevronLeft/></button>
          <span>{page+1}/{pageCount}</span>
          <button className="secondary" onClick={()=>move(1)} aria-label="Xem 2 tin tiếp"><ChevronRight/></button>
        </div>}
      </div>}
  </section>;
}
