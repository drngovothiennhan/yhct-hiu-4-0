import {useEffect,useState} from 'react';
import {Bell,CheckCheck,RefreshCw} from 'lucide-react';
import type {Member} from '../../types';
import {fetchRecentNotifications,markAllNotificationsRead,markNotificationRead,VISIBLE_NOTIFICATION_LIMIT,type NotificationRow} from '../../services/notificationService';

type Props={
  member:Member;
  unreadCount:number|null;
  onUnreadRefresh:()=>Promise<number|null>;
};

export default function NotificationsCenter({member,unreadCount,onUnreadRefresh}:Props){
  const [items,setItems]=useState<NotificationRow[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const load=async()=>{
    setBusy(true);setMsg('');
    try{
      const [next]=await Promise.all([fetchRecentNotifications(member.id),onUnreadRefresh()]);
      setItems(next);
    }catch(e){setMsg((e as Error).message||'Không thể tải thông báo')}
    finally{setBusy(false)}
  };
  useEffect(()=>{void load()},[member.id]);

  const markOne=async(id:string)=>{
    setBusy(true);setMsg('');
    try{
      const changed=await markNotificationRead(id);
      if(!changed)throw new Error('Thông báo không còn khả dụng');
      const now=new Date().toISOString();
      setItems(xs=>xs.map(x=>x.id===id?{...x,read_at:x.read_at||now}:x));
      await onUnreadRefresh();
    }catch(e){setMsg((e as Error).message||'Không thể cập nhật thông báo');await onUnreadRefresh()}
    finally{setBusy(false)}
  };

  const markAll=async()=>{
    if(unreadCount===0)return;
    setBusy(true);setMsg('');
    try{
      await markAllNotificationsRead();
      const now=new Date().toISOString();
      setItems(xs=>xs.map(x=>({...x,read_at:x.read_at||now})));
      await onUnreadRefresh();
    }catch(e){setMsg((e as Error).message||'Không thể cập nhật thông báo');await onUnreadRefresh()}
    finally{setBusy(false)}
  };

  const statusText=unreadCount===null
    ?'Đang đồng bộ số thông báo chưa đọc…'
    :unreadCount>0
      ?`${unreadCount} thông báo chưa đọc.`
      :'Bạn đã đọc tất cả thông báo.';

  return <section className="notifications-center">
    <div className="between notifications-heading"><div className="row panel-title"><Bell/><div><h2>Thông báo</h2><p>{statusText}</p></div></div><div className="row"><button className="secondary" disabled={busy} onClick={()=>void load()} aria-label="Làm mới thông báo"><RefreshCw/>Làm mới</button><button className="secondary" disabled={busy||unreadCount===0} onClick={()=>void markAll()}><CheckCheck/>Đã đọc tất cả</button></div></div>
    <p className="muted notifications-retention-note">Hiển thị {VISIBLE_NOTIFICATION_LIMIT} thông báo mới nhất. Số chưa đọc được tính trên toàn bộ thông báo của bạn, kể cả các mục cũ đang ẩn khỏi danh sách này.</p>
    {msg&&<div className="error" role="alert">{msg}</div>}
    <div className="notifications-list" aria-live="polite">
      {items.length===0&&!busy&&<div className="panel empty-state"><Bell/><h3>Chưa có thông báo</h3><p>Khi có tương tác học thuật mới, thông báo sẽ xuất hiện tại đây.</p></div>}
      {items.map(n=><article key={n.id} className={`notification-card ${n.read_at?'':'unread'}`} onClick={()=>{if(!busy&&!n.read_at)void markOne(n.id)}}><div className="notification-dot" aria-hidden="true"/><div><div className="notification-meta"><span>{n.kind.replace(/_/g,' ')}</span><time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString('vi-VN')}</time></div><h3>{n.title}</h3><p>{n.body}</p></div></article>)}
      {busy&&<div className="panel empty-state" role="status">Đang đồng bộ thông báo…</div>}
    </div>
  </section>;
}
