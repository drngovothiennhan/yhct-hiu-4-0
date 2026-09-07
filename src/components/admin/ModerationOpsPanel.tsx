import { useEffect,useState } from 'react';
import { CheckCircle2,RefreshCw,ScrollText,ShieldCheck,XCircle } from 'lucide-react';
import type { Member } from '../../types';
import { roleAtLeast } from '../../types';
import { supabase } from '../../services/authService';

type AcademicQueueRow={id:string;title:string;author_name:string;student_code?:string|null;post_type?:string|null;specialty?:string|null;visibility?:string|null;citations:unknown[];created_at:string;moderation_status:'pending'|'approved'|'rejected'|'quarantined'};
type AuditRow={id:string;action:string;entity_type?:string|null;entity_id?:string|null;severity:string;metadata:Record<string,unknown>;created_at:string};
type SemesterRow={id:string;code:string;title:string;lock_at?:string|null;locked_at?:string|null;is_locked:boolean};

export default function ModerationOpsPanel({member}:{member:Member|null}){
  const allowed=roleAtLeast(member?.role,'mod');
  const [academic,setAcademic]=useState<AcademicQueueRow[]>([]),[logs,setLogs]=useState<AuditRow[]>([]),[semesters,setSemesters]=useState<SemesterRow[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');

  const load=async()=>{
    if(!allowed)return;
    setBusy(true);setMsg('');
    try{
      const [academicResult,logResult,semesterResult]=await Promise.all([
        supabase.rpc('academic_moderation_queue_v1',{p_limit:40}),
        supabase.rpc('moderation_recent_logs_v1',{p_limit:60}),
        supabase.rpc('drl_semester_list_v1')
      ]);
      for(const result of [academicResult,logResult,semesterResult])if(result.error)throw result.error;
      setAcademic(Array.isArray(academicResult.data)?academicResult.data as AcademicQueueRow[]:[]);
      setLogs(Array.isArray(logResult.data)?logResult.data as AuditRow[]:[]);
      setSemesters(Array.isArray(semesterResult.data)?semesterResult.data as SemesterRow[]:[]);
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };
  useEffect(()=>{void load()},[allowed]);

  const reviewAcademic=async(item:AcademicQueueRow,action:'approve'|'reject')=>{
    setBusy(true);setMsg('');
    try{
      const {error}=await supabase.rpc('moderate_academic_post_v1',{p_post_id:item.id,p_action:action});
      if(error)throw error;
      setMsg(action==='approve'?`Đã duyệt “${item.title}”. Bài được đưa lên Newsfeed theo thời điểm duyệt.`:`Đã từ chối “${item.title}”.`);
      await load();
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  if(!allowed)return null;
  return <section className="moderation-ops">
    <div className="between moderation-ops-heading"><div className="row panel-title"><ShieldCheck/><div><h3>Hàng đợi kiểm duyệt học thuật</h3><p>Bài người dùng thật · Mod/Super Mod/Admin · tin RSS tự động không đi vào hàng đợi này.</p></div></div><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw/>Làm mới</button></div>
    {msg&&<div className="ai-note" role="status">{msg}</div>}
    <section className="moderation-card"><h4>Bài học thuật chờ duyệt ({academic.length})</h4><div className="news-review-list academic-review-list">{academic.slice(0,20).map(item=><article key={item.id}><div><b>{item.title}</b><small>{item.author_name}{item.student_code?` · ${item.student_code}`:''} · {item.post_type||'academic'} · {item.specialty||'general'} · {Array.isArray(item.citations)?item.citations.length:0} nguồn</small></div><div className="schedule-actions"><button disabled={busy} onClick={()=>void reviewAcademic(item,'approve')}><CheckCircle2/>Duyệt</button><button className="danger-btn" disabled={busy} onClick={()=>void reviewAcademic(item,'reject')}><XCircle/>Từ chối</button></div></article>)}{academic.length===0&&<p className="muted">Không có bài học thuật chờ duyệt.</p>}</div></section>
    <div className="moderation-grid">
      <section className="moderation-card"><h4>Nguyên tắc phân phối</h4><div className="data-list compact"><article><div><b>User/Mod post</b><small>Luôn `pending` khi tạo hoặc chỉnh sửa.</small></div><span className="badge">Có duyệt</span></article><article><div><b>RSS/YHCT news</b><small>Tự động `published`, hiển thị ở dải tin riêng.</small></div><span className="badge">Tách queue</span></article></div></section>
      <section className="moderation-card"><h4>Học kỳ DRL</h4><div className="data-list compact">{semesters.slice(0,8).map(s=><article key={s.id}><div><b>{s.title}</b><small>{s.code}</small></div><span className="badge">{s.is_locked?'Đã khóa':'Đang mở'}</span></article>)}</div></section>
    </div>
    <section className="moderation-card moderation-log-card"><div className="row"><ScrollText/><h4>Log rà soát gần đây</h4></div><div className="log-list">{logs.slice(0,24).map(row=><article key={row.id} className={`log-${row.severity}`}><div><b>{row.action}</b><small>{new Date(row.created_at).toLocaleString('vi-VN')} · {row.entity_type||'system'} {row.entity_id||''}</small></div><span>{row.severity}</span></article>)}</div></section>
  </section>;
}
