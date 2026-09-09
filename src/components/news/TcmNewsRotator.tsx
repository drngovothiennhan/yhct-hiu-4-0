import {useEffect,useState} from 'react';
import {ExternalLink,RefreshCw} from 'lucide-react';
import {supabase} from '../../services/authService';
import {cacheGet,cachePut} from '../../services/offlineCache';
import {HerbIcon} from '../icons/YhctIcons';

type News={id:string;title:string;canonical_url:string;publisher:string;publisher_domain:string;published_at?:string|null;summary:string;tags:string[];trust_score:number;ai_provider:string};

const MAX_NEWS=3;
const REFRESH_MS=5*60*1000;
const NEWS_CACHE_KEY='tcm-news-feed-top3-ai-v2';
const NEWS_CACHE_TTL=10*60*1000;

function shortDate(value?:string|null){if(!value)return'Chưa rõ ngày';const d=new Date(value);return Number.isNaN(d.getTime())?'Chưa rõ ngày':d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'})}
function normalizeNews(value:News[]){
  const seen=new Set<string>();
  return value.filter(item=>Boolean(item?.id&&item.ai_provider?.trim())).filter(item=>{
    const key=(item.canonical_url||item.id).trim().toLowerCase();
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).slice(0,MAX_NEWS);
}

export default function TcmNewsRotator(){
  const [items,setItems]=useState<News[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const load=async()=>{
    setBusy(true);setMsg('');
    try{
      const {data,error}=await supabase.rpc('tcm_news_feed_v1',{p_limit:MAX_NEWS});
      if(error)throw error;
      const next=normalizeNews((data||[]) as News[]);
      setItems(next);void cachePut(NEWS_CACHE_KEY,next,NEWS_CACHE_TTL);
    }catch(error){
      const cached=await cacheGet<News[]>(NEWS_CACHE_KEY,{allowStale:true});
      const next=normalizeNews(cached||[]);
      if(next.length){setItems(next);setMsg('Mạng/API tạm thời gián đoạn · đang hiển thị 3 tin A.I đã lưu gần nhất.')}else setMsg(error instanceof Error?error.message:'Không thể tải tin YHCT.');
    }finally{setBusy(false)}
  };

  useEffect(()=>{void load();const id=window.setInterval(()=>void load(),REFRESH_MS);return()=>window.clearInterval(id)},[]);

  return <section className="news-rotator" aria-label="Ba tin Y học cổ truyền mới nhất do A.I hệ thống tổng hợp">
    <div className="news-rotator-heading">
      <div className="row panel-title"><HerbIcon/><div><h2>Tin tức Y học cổ truyền</h2><p>3 tin A.I mới nhất · mỗi tin chỉ xuất hiện một lần; tin cũ được ẩn và lưu trữ định kỳ trước khi dọn.</p></div></div>
      <button className="secondary news-rotator-refresh" disabled={busy} onClick={()=>void load()} aria-label="Làm mới 3 tin A.I mới nhất"><RefreshCw/></button>
    </div>
    {msg&&<div className={msg.includes('đã lưu')?'ai-note':'error'} role="status">{msg}</div>}
    {items.length===0?<div className="news-rotator-empty"><HerbIcon/><span>{busy?'Đang tải 3 tin A.I mới nhất…':'Chưa có tin A.I đã công bố.'}</span></div>:
      <div className="news-rotator-top3" data-ai-news-count={items.length}>
        {items.map(n=><a className="news-rotator-card" key={n.id} href={n.canonical_url} target="_blank" rel="noreferrer noopener">
          <div className="news-rotator-meta"><span>{n.publisher||n.publisher_domain||'Nguồn tổng hợp'}</span><time dateTime={n.published_at||undefined}>{shortDate(n.published_at)}</time></div>
          <p className="news-rotator-text"><strong>{n.title}</strong>{n.summary?` — ${n.summary}`:' — Tóm tắt đang được cập nhật.'}</p>
          <span className="news-rotator-open">Đọc nguồn <ExternalLink/></span>
        </a>)}
      </div>}
  </section>;
}
