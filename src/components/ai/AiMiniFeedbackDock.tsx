import {useState} from 'react';
import {Bug,Lightbulb,MessageSquarePlus,Send,X} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';

type Kind='bug'|'suggestion'|'other';
export default function AiMiniFeedbackDock({member,onLogin}:{member:Member|null;onLogin:()=>void}){
  const [open,setOpen]=useState(false),[kind,setKind]=useState<Kind>('bug'),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const submit=async()=>{if(!member){onLogin();return}if(body.trim().length<4)return;setBusy(true);setMsg('');try{const context={path:window.location.pathname,viewport:document.documentElement.dataset.viewportMode||'',performanceTier:document.documentElement.dataset.performanceTier||'',userAgent:navigator.userAgent.slice(0,300)};const {error}=await supabase.rpc('feedback_submit_v1',{p_kind:kind,p_body:body.trim(),p_context:context});if(error)throw error;setBody('');setMsg('Đã chuyển tới hộp góp ý của Admin. Cảm ơn bạn.')}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  return <div className={`ai-feedback-dock ${open?'is-open':''}`}>
    {!open&&<button className="ai-feedback-trigger" onClick={()=>setOpen(true)} title="Báo lỗi / góp ý tại A.I Mini"><MessageSquarePlus/><span>A.I Mini · Góp ý</span></button>}
    {open&&<section className="ai-feedback-panel" role="dialog" aria-label="Báo lỗi và góp ý A.I Mini"><header><div><b>Báo lỗi · Góp ý</b><small>Thông tin được gửi vào hộp quản trị Admin.</small></div><button onClick={()=>setOpen(false)} aria-label="Đóng"><X/></button></header>{!member?<div className="feedback-login"><p>Đăng nhập thành viên để hệ thống xác thực người gửi và chống spam.</p><button onClick={onLogin}>Đăng nhập để gửi</button></div>:<><div className="feedback-kind"><button className={kind==='bug'?'active':''} onClick={()=>setKind('bug')}><Bug/>Báo lỗi</button><button className={kind==='suggestion'?'active':''} onClick={()=>setKind('suggestion')}><Lightbulb/>Góp ý</button><button className={kind==='other'?'active':''} onClick={()=>setKind('other')}><MessageSquarePlus/>Khác</button></div><textarea maxLength={3000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Mô tả ngắn gọn điều bạn gặp hoặc đề xuất…"/><button disabled={busy||body.trim().length<4} onClick={()=>void submit()}><Send/>{busy?'Đang gửi…':'Gửi Admin'}</button></>}{msg&&<div className="ai-note" role="status">{msg}</div>}</section>}
  </div>;
}
