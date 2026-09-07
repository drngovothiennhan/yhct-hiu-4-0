import { useEffect,useState } from 'react';
import { CheckCircle2,RefreshCw,ScrollText,ShieldCheck,XCircle } from 'lucide-react';
import type { Member } from '../../types';
import { roleAtLeast } from '../../types';
import { supabase } from '../../services/authService';

type NewsRow={id:string;title:string;publisher?:string|null;published_at?:string|null;status:'pending'|'published'|'rejected';trust_score:number;is_pinned:boolean};
type AuditRow={id:string;action:string;entity_type?:string|null;entity_id?:string|null;severity:string;metadata:Record<string,unknown>;created_at:string};
type SemesterRow={id:string;code:string;title:string;lock_at?:string|null;locked_at?:string|null;is_locked:boolean};

export default function ModerationOpsPanel({member}:{member:Member|null}){
  const allowed=roleAtLeast(member?.role,'super_mod');
  const [news,setNews]=useState<NewsRow[]>([]),[logs,setLogs]=useState<AuditRow[]>([]),[semesters,setSemesters]=useState<SemesterRow[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');

  const load=async()=>{
    if(!allowed)return;
    setBusy(true);setMsg('');
    try{
      const [newsResult,logResult,semesterResult]=await Promise.all([
        supabase.rpc('tcm_news_admin_list_v1',{p_limit:30}),
        supabase.rpc('moderation_recent_logs_v1',{p_limit:60}),
        supabase.rpc('drl_semester_list_v1')
      ]);
      for(const result of [newsResult,logResult,semesterResult])if(result.error)throw result.error;
      setNews(Array.isArray(newsResult.data)?newsResult.data as NewsRow[]:[]);
      setLogs(Array.isArray(logResult.data)?logResult.data as AuditRow[]:[]);
      setSemesters(Array.isArray(semesterResult.data)?semesterResult.data as SemesterRow[]:[]);
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };
  useEffect(()=>{void load()},[allowed]);

  const review=async(item:NewsRow,status:'published'|'rejected')=>{
    setBusy(true);setMsg('');
    try{const {error}=await supabase.rpc('tcm_news_review_v1',{p_id:item.id,p_status:status});if(error)throw error;setMsg(status==='published'?'Đã duyệt tin.':'Đã từ chối tin.');await load()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  if(!allowed)return null;
  return <section className="moderation-ops">
    <div className="between moderation-ops-heading"><div className="row panel-title"><ShieldCheck/><div><h3>Kiểm duyệt Super Mod</h3><p>Duyệt tin · log kiểm duyệt giới hạn · trạng thái học kỳ DRL.</p></div></div><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw/>Làm mới</button></div>
    {msg&&<div className="ai-note" role="status">{msg}</div>}
    <div className="moderation-grid">
      <section className="moderation-card"><h4>Tin YHCT chờ duyệt</h4><div className="news-review-list">{news.filter(x=>x.status==='pending').slice(0,8).map(item=><article key={item.id}><div><b>{item.title}</b><small>{item.publisher||'Nguồn tổng hợp'} · tin cậy {Math.round(Number(item.trust_score||0)*100)}%</small></div><div className="schedule-actions"><button disabled={busy} onClick={()=>void review(item,'published')}><CheckCircle2/>Duyệt</button><button className="danger-btn" disabled={busy} onClick={()=>void review(item,'rejected')}><XCircle/>Từ chối</button></div></article>)}{news.every(x=>x.status!=='pending')&&<p className="muted">Không có tin chờ duyệt.</p>}</div></section>
      <section className="moderation-card"><h4>Học kỳ DRL</h4><div className="data-list compact">{semesters.slice(0,8).map(s=><article key={s.id}><div><b>{s.title}</b><small>{s.code}</small></div><span className="badge">{s.is_locked?'Đã khóa':'Đang mở'}</span></article>)}</div></section>
    </div>
    <section className="moderation-card moderation-log-card"><div className="row"><ScrollText/><h4>Log rà soát gần đây</h4></div><div className="log-list">{logs.slice(0,24).map(row=><article key={row.id} className={`log-${row.severity}`}><div><b>{row.action}</b><small>{new Date(row.created_at).toLocaleString('vi-VN')} · {row.entity_type||'system'} {row.entity_id||''}</small></div><span>{row.severity}</span></article>)}</div></section>
  </section>;
}
