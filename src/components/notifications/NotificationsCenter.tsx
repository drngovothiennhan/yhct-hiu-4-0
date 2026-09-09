import { useEffect,useMemo,useState } from 'react';
import { Bell,CheckCheck,RefreshCw } from 'lucide-react';
import type { Member } from '../../types';
import { supabase } from '../../services/authService';

const VISIBLE_NOTIFICATION_LIMIT=5;

type NotificationRow={
  id:string;
  kind:string;
  title:string;
  body:string;
  post_id?:string|null;
  read_at?:string|null;
  created_at:string;
};

export default function NotificationsCenter({member}:{member:Member}){
  const [items,setItems]=useState<NotificationRow[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const unread=useMemo(()=>items.filter(x=>!x.read_at).length,[items]);
  const load=async()=>{setBusy(true);setMsg('');try{const {data,error}=await supabase.from('notifications').select('id,kind,title,body,post_id,read_at,created_at').eq('member_id',member.id).order('created_at',{ascending:false}).limit(VISIBLE_NOTIFICATION_LIMIT);if(error)throw error;setItems((data||[]) as NotificationRow[])}catch(e){setMsg((e as Error).message||'Không thể tải thông báo')}finally{setBusy(false)}};
  useEffect(()=>{void load()},[member.id]);
  const markOne=async(id:string)=>{const now=new Date().toISOString();setItems(xs=>xs.map(x=>x.id===id?{...x,read_at:now}:x));const {error}=await supabase.from('notifications').update({read_at:now}).eq('member_id',member.id).eq('id',id);if(error){setMsg(error.message);void load()}};
  const markAll=async()=>{if(!unread)return;setBusy(true);setMsg('');try{const now=new Date().toISOString();const {error}=await supabase.from('notifications').update({read_at:now}).eq('member_id',member.id).is('read_at',null);if(error)throw error;setItems(xs=>xs.map(x=>({...x,read_at:x.read_at||now})))}catch(e){setMsg((e as Error).message||'Không thể cập nhật thông báo')}finally{setBusy(false)}};
  return <section className="notifications-center">
    <div className="between notifications-heading"><div className="row panel-title"><Bell/><div><h2>Thông báo</h2><p>{unread?`${unread} thông báo chưa đọc trong 5 thông báo mới nhất`:'Bạn đã xem hết 5 thông báo mới nhất.'}</p></div></div><div className="row"><button className="secondary" disabled={busy} onClick={()=>void load()} aria-label="Làm mới thông báo"><RefreshCw/>Làm mới</button><button className="secondary" disabled={busy||!unread} onClick={()=>void markAll()}><CheckCheck/>Đã đọc tất cả</button></div></div>
    <p className="muted notifications-retention-note">Chỉ hiển thị 5 thông báo mới nhất. Thông báo cũ hơn vẫn được lưu nhưng được ẩn khỏi trang.</p>
    {msg&&<div className="error" role="alert">{msg}</div>}
    <div className="notifications-list" aria-live="polite">
      {items.length===0&&!busy&&<div className="panel empty-state"><Bell/><h3>Chưa có thông báo</h3><p>Khi có tương tác học thuật mới, thông báo sẽ xuất hiện tại đây.</p></div>}
      {items.map(n=><article key={n.id} className={`notification-card ${n.read_at?'':'unread'}`} onClick={()=>{if(!n.read_at)void markOne(n.id)}}><div className="notification-dot" aria-hidden="true"/><div><div className="notification-meta"><span>{n.kind.replace(/_/g,' ')}</span><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString('vi-VN')}</time></div><h3>{n.title}</h3><p>{n.body}</p></div></article>)}
      {busy&&<div className="panel empty-state" role="status">Đang tải thông báo…</div>}
    </div>
  </section>;
}
