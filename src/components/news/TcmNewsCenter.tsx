import { useEffect,useState } from 'react';
import { ExternalLink,RefreshCw,ShieldCheck } from 'lucide-react';
import type { Member } from '../../types';
import { roleAtLeast } from '../../types';
import { supabase } from '../../services/authService';
import { HerbIcon } from '../icons/YhctIcons';

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

const FALLBACK_IMAGE='/logo-clb-yhct-hiu.jpg';

export default function TcmNewsCenter({member,compact=false}:{member:Member|null;compact?:boolean}){
  const [items,setItems]=useState<News[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const canReview=roleAtLeast(member?.role,'mod');

  const load=async()=>{
    setBusy(true);setMsg('');
    try{
      const {data,error}=await supabase.rpc('tcm_news_feed_v1',{p_limit:10});
      if(error)throw error;
      setItems(((data||[]) as News[]).slice(0,10));
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  useEffect(()=>{void load()},[]);

  return <section className={compact?'news-center news-center-compact':'news-center'}>
    <div className="between news-heading">
      <div className="row panel-title"><HerbIcon/><div><h2>Tin tức Y học cổ truyền</h2><p>10 tin mới nhất · nguồn và thời gian minh bạch.</p></div></div>
      {!compact&&<button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw/>Làm mới</button>}
    </div>
    {msg&&<div className="error" role="alert">{msg}</div>}
    {items.length===0?<section className="panel empty-state"><HerbIcon/><h3>Chưa có tin đã qua ngưỡng tin cậy</h3><p>Pipeline giữ nội dung chưa đủ điểm tin cậy trong hàng chờ thay vì tự động công bố.</p></section>:
      <div className="news-grid" aria-label="10 tin Y học cổ truyền mới nhất">
        {items.map(n=><article className="news-card" key={n.id}>
          <div className="news-media">
            <img src={n.image_url||FALLBACK_IMAGE} alt={n.image_url?n.title:'Ảnh nhận diện Y học cổ truyền'} loading="lazy" decoding="async" onError={e=>{const img=e.currentTarget;if(img.dataset.fallback==='1')return;img.dataset.fallback='1';img.src=FALLBACK_IMAGE}}/>
          </div>
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
