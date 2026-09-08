import {useEffect,useMemo,useState} from 'react';
import {CheckCheck,MessageCircle,RefreshCw,Search,Send,UserRound} from 'lucide-react';
import type {Member,SystemRole} from '../../types';
import {supabase} from '../../services/authService';

type Recipient={id:string;full_name:string;position_title:string;role:SystemRole};
type MessageRow={id:string;direction:'sent'|'received';counterpart_id:string;counterpart_name:string;counterpart_title:string;body:string;kind:string;metadata:Record<string,unknown>;read_at?:string|null;created_at:string};

export default function MessagesCenter({member}:{member:Member}){
  const [items,setItems]=useState<MessageRow[]>([]),[recipients,setRecipients]=useState<Recipient[]>([]),[selected,setSelected]=useState<Recipient|null>(null),[q,setQ]=useState(''),[text,setText]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const load=async()=>{const {data,error}=await supabase.rpc('messages_inbox_v1',{p_limit:120});if(error)throw error;setItems((Array.isArray(data)?data:[]) as MessageRow[])};
  const search=async(term=q)=>{const {data,error}=await supabase.rpc('message_recipients_v1',{p_query:term,p_limit:30});if(error)throw error;setRecipients((Array.isArray(data)?data:[]) as Recipient[])};
  const refresh=async()=>{setBusy(true);setMsg('');try{await Promise.all([load(),search()])}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  useEffect(()=>{void refresh();const channel=supabase.channel(`member-messages:${member.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'member_messages'},()=>void load().catch(()=>{})).subscribe();return()=>{void supabase.removeChannel(channel)}},[member.id]);
  useEffect(()=>{const t=window.setTimeout(()=>{void search(q).catch(e=>setMsg((e as Error).message))},220);return()=>window.clearTimeout(t)},[q]);
  const send=async()=>{if(!selected||!text.trim()||busy)return;setBusy(true);setMsg('');try{const {error}=await supabase.rpc('messages_send_v1',{p_recipient_id:selected.id,p_body:text.trim()});if(error)throw error;setText('');setMsg('Tin nhắn đã được gửi.');await load()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  const mark=async(row:MessageRow)=>{if(row.direction!=='received'||row.read_at)return;setItems(xs=>xs.map(x=>x.id===row.id?{...x,read_at:new Date().toISOString()}:x));const {error}=await supabase.rpc('messages_mark_read_v1',{p_message_id:row.id});if(error)void load().catch(()=>{})};
  const conversation=useMemo(()=>selected?items.filter(x=>x.counterpart_id===selected.id).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)):[],[items,selected]);
  const unread=items.filter(x=>x.direction==='received'&&!x.read_at).length;
  return <section className="messages-page">
    <div className="between messages-heading"><div className="row panel-title"><MessageCircle/><div><h2>Tin nhắn thành viên</h2><p>{unread?`${unread} tin chưa đọc`:'Trao đổi học thuật và liên hệ quản trị trong hệ thống.'}</p></div></div><button className="secondary" disabled={busy} onClick={()=>void refresh()}><RefreshCw/>Làm mới</button></div>
    {msg&&<div className="ai-note" role="status">{msg}</div>}
    <div className="messages-layout">
      <aside className="message-directory panel"><div className="searchbox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm thành viên / MSSV"/></div><div className="recipient-list">{recipients.map(r=><button key={r.id} className={selected?.id===r.id?'active':''} onClick={()=>setSelected(r)}><UserRound/><span><b>{r.full_name}</b><small>{r.position_title}</small></span></button>)}</div></aside>
      <section className="conversation panel">{!selected?<div className="empty-state"><MessageCircle/><h3>Chọn người để trao đổi</h3><p>Tin nhắn chỉ hiển thị cho hai thành viên liên quan; thao tác gửi được kiểm quyền tại Supabase.</p></div>:<><header><div><b>{selected.full_name}</b><small>{selected.position_title}</small></div></header><div className="message-thread">{conversation.length===0&&<p className="muted">Chưa có tin nhắn trong cuộc trao đổi này.</p>}{conversation.map(x=><article key={x.id} className={x.direction==='sent'?'sent':'received'} onClick={()=>void mark(x)}><p>{x.body}</p><small>{new Date(x.created_at).toLocaleString('vi-VN')}{x.direction==='sent'&&x.read_at?<><CheckCheck/> Đã xem</>:''}</small></article>)}</div><div className="message-compose"><textarea maxLength={2000} value={text} onChange={e=>setText(e.target.value)} placeholder="Nhập tin nhắn…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}}/><button disabled={busy||!text.trim()} onClick={()=>void send()}><Send/>Gửi</button></div></>}</section>
    </div>
  </section>;
}
