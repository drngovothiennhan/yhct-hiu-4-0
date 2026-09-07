import { useEffect,useRef,useState } from 'react';
import { ChevronLeft,ChevronRight,ExternalLink,RefreshCw } from 'lucide-react';
import { supabase } from '../../services/authService';
import { cacheGet,cachePut } from '../../services/offlineCache';
import { HerbIcon } from '../icons/YhctIcons';

type News={id:string;title:string;canonical_url:string;publisher:string;publisher_domain:string;published_at?:string|null;summary:string;tags:string[];trust_score:number;ai_provider:string};
type DragState={startX:number;startScrollLeft:number;moved:boolean};

const ROTATE_MS=8000;
const REFRESH_MS=5*60*1000;
const NEWS_CACHE_KEY='tcm-news-feed-v1';
const NEWS_CACHE_TTL=10*60*1000;

function shortDate(value?:string|null){if(!value)return'Chưa rõ ngày';const d=new Date(value);return Number.isNaN(d.getTime())?'Chưa rõ ngày':d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})}
function desktopViewport(){return typeof document!=='undefined'&&document.documentElement.dataset.viewportMode==='desktop'}

export default function TcmNewsRotator(){
  const [items,setItems]=useState<News[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[paused,setPaused]=useState(false),[dragging,setDragging]=useState(false),[page,setPage]=useState(0);
  const trackRef=useRef<HTMLDivElement|null>(null),dragRef=useRef<DragState|null>(null),suppressClickRef=useRef(false);

  const load=async()=>{
    setBusy(true);setMsg('');
    try{
      const {data,error}=await supabase.rpc('tcm_news_feed_v1',{p_limit:20});
      if(error)throw error;
      const next=((data||[]) as News[]).slice(0,20);
      setItems(next);setPage(0);void cachePut(NEWS_CACHE_KEY,next,NEWS_CACHE_TTL);
      requestAnimationFrame(()=>trackRef.current?.scrollTo({left:0,behavior:'auto'}));
    }catch(error){
      const cached=await cacheGet<News[]>(NEWS_CACHE_KEY,{allowStale:true});
      if(cached?.length){setItems(cached);setMsg('Mạng/API tạm thời gián đoạn · đang hiển thị bản tin đã lưu gần nhất.')}else setMsg(error instanceof Error?error.message:'Không thể tải tin YHCT.');
    }finally{setBusy(false)}
  };

  useEffect(()=>{void load();const id=window.setInterval(()=>void load(),REFRESH_MS);return()=>window.clearInterval(id)},[]);

  const getStep=()=>trackRef.current?.clientWidth||0;
  const scrollByPage=(direction:number,behavior:ScrollBehavior='smooth')=>{
    const track=trackRef.current;if(!track)return;
    const step=getStep();if(!step)return;
    const max=Math.max(0,track.scrollWidth-track.clientWidth);
    const next=direction>0&&track.scrollLeft>=max-4?0:direction<0&&track.scrollLeft<=4?max:Math.max(0,Math.min(max,track.scrollLeft+direction*step));
    track.scrollTo({left:next,behavior});
  };

  useEffect(()=>{
    const track=trackRef.current;if(!track)return;
    const onWheel=(event:WheelEvent)=>{
      if(!desktopViewport())return;
      const dominant=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX;
      if(!dominant)return;
      const max=Math.max(0,track.scrollWidth-track.clientWidth);
      const canConsume=dominant>0?track.scrollLeft<max-1:track.scrollLeft>1;
      if(!canConsume)return;
      event.preventDefault();
      track.scrollLeft+=dominant;
    };
    track.addEventListener('wheel',onWheel,{passive:false});
    return()=>track.removeEventListener('wheel',onWheel);
  },[items.length]);

  useEffect(()=>{
    if(paused||dragging||items.length<=2)return;
    const id=window.setInterval(()=>{if(document.visibilityState==='visible')scrollByPage(1)},ROTATE_MS);
    return()=>window.clearInterval(id);
  },[paused,dragging,items.length]);

  const onScroll=()=>{
    const track=trackRef.current;if(!track||!track.clientWidth)return;
    const pages=Math.max(1,Math.ceil(track.scrollWidth/track.clientWidth));
    setPage(Math.min(pages-1,Math.max(0,Math.round(track.scrollLeft/track.clientWidth))));
  };

  const onMouseDown=(event:React.MouseEvent<HTMLDivElement>)=>{
    if(event.button!==0||!desktopViewport()||!trackRef.current)return;
    dragRef.current={startX:event.clientX,startScrollLeft:trackRef.current.scrollLeft,moved:false};
    setDragging(true);setPaused(true);
  };
  const onMouseMove=(event:React.MouseEvent<HTMLDivElement>)=>{
    const drag=dragRef.current,track=trackRef.current;if(!drag||!track)return;
    const dx=event.clientX-drag.startX;
    if(!drag.moved&&Math.abs(dx)>5)drag.moved=true;
    if(!drag.moved)return;
    event.preventDefault();
    track.scrollLeft=drag.startScrollLeft-dx;
  };
  const finishMouseDrag=()=>{
    const drag=dragRef.current;if(!drag)return;
    dragRef.current=null;setDragging(false);setPaused(false);
    if(drag.moved){suppressClickRef.current=true;window.setTimeout(()=>{suppressClickRef.current=false},220)}
  };
  const onClickCapture=(event:React.MouseEvent<HTMLDivElement>)=>{
    if(!suppressClickRef.current)return;
    suppressClickRef.current=false;event.preventDefault();event.stopPropagation();
  };

  const pageCount=Math.max(1,Math.ceil(items.length/(desktopViewport()?2:1)));

  return <section className="news-rotator" aria-label="Điểm tin Y học cổ truyền tự động">
    <div className="news-rotator-heading">
      <div className="row panel-title"><HerbIcon/><div><h2>Tin tức Y học cổ truyền</h2><p>Tự cập nhật · lăn chuột, kéo-thả hoặc dùng nút mũi tên trên PC.</p></div></div>
      <button className="secondary news-rotator-refresh" disabled={busy} onClick={()=>void load()} aria-label="Làm mới tin"><RefreshCw/></button>
    </div>
    {msg&&<div className={msg.includes('đã lưu')?'ai-note':'error'} role="status">{msg}</div>}
    {items.length===0?<div className="news-rotator-empty"><HerbIcon/><span>{busy?'Đang tải tin…':'Chưa có tin đã công bố.'}</span></div>:
      <div className="news-rotator-stage" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>{setPaused(false);finishMouseDrag()}} onFocusCapture={()=>setPaused(true)} onBlurCapture={()=>setPaused(false)}>
        <button className="news-rotator-nav news-rotator-prev" onClick={()=>scrollByPage(-1)} aria-label="Xem tin trước"><ChevronLeft/></button>
        <div ref={trackRef} className={`news-rotator-track${dragging?' is-dragging':''}`} onScroll={onScroll} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={finishMouseDrag} onClickCapture={onClickCapture}>
          {items.map(n=><a className="news-rotator-card" key={n.id} href={n.canonical_url} target="_blank" rel="noreferrer noopener" draggable={false}>
            <div className="news-rotator-meta"><span>{n.publisher||n.publisher_domain||'Nguồn tổng hợp'}</span><time dateTime={n.published_at||undefined}>{shortDate(n.published_at)}</time></div>
            <p className="news-rotator-text"><strong>{n.title}</strong>{n.summary?` — ${n.summary}`:' — Tóm tắt đang được cập nhật.'}</p>
            <span className="news-rotator-open">Đọc nguồn <ExternalLink/></span>
          </a>)}
        </div>
        <button className="news-rotator-nav news-rotator-next" onClick={()=>scrollByPage(1)} aria-label="Xem tin tiếp"><ChevronRight/></button>
        {pageCount>1&&<div className="news-rotator-position" aria-live="polite">{Math.min(page+1,pageCount)}/{pageCount}</div>}
      </div>}
  </section>;
}
