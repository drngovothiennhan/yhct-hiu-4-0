import {useEffect,useMemo,useState} from 'react';
import {BrainCircuit,Cloud,Copy,Database,RefreshCw,Search,ShieldCheck,TimerReset,WifiOff} from 'lucide-react';
import {activeAiProviders,candidateZeroCostProviders,fetchAiHealth,type AiHealth} from '../../modules/ai';

export default function AiOperationsPanel(){
  const [health,setHealth]=useState<AiHealth|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[autoRefresh,setAutoRefresh]=useState(true),[lastChecked,setLastChecked]=useState<Date|null>(null),[copied,setCopied]=useState(false);
  const active=useMemo(()=>activeAiProviders(),[]),candidates=useMemo(()=>candidateZeroCostProviders(),[]);
  const load=async()=>{setBusy(true);setError('');try{setHealth(await fetchAiHealth());setLastChecked(new Date())}catch(e){setHealth(null);setError((e as Error).message||'Không đọc được trạng thái A.I.')}finally{setBusy(false)}};
  useEffect(()=>{void load()},[]);
  useEffect(()=>{if(!autoRefresh)return;const id=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(id)},[autoRefresh]);
  const ai=health?.ai;
  const copyStatus=async()=>{const payload={checkedAt:lastChecked?.toISOString()||null,ok:health?.ok||false,mode:ai?.mode||'unknown',cloudReady:Boolean(ai?.cloudReady),centralRagReady:Boolean(ai?.centralRagReady),model:ai?.model||null,evidenceSources:ai?.evidenceSources||[],providers:active.map(x=>({id:x.id,label:x.label,kind:x.kind,state:x.state,capabilities:x.capabilities}))};try{await navigator.clipboard.writeText(JSON.stringify(payload,null,2));setCopied(true);window.setTimeout(()=>setCopied(false),1600)}catch{setError('Không sao chép được trạng thái A.I trên trình duyệt này.')}};
  return <section className="panel admin-v6-block ai-operations-panel" data-ai-ops-surface="acc">
    <div className="between"><div className="row panel-title"><BrainCircuit/><div><h3>A.I Operations</h3><p>ACC quản trị tập trung: Gateway · Provider Registry · RAG · Copilot · readiness.</p></div></div><div className="schedule-actions"><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw/>{busy?'Đang kiểm tra…':'Làm mới'}</button><button className="secondary" disabled={!health} onClick={()=>void copyStatus()}><Copy/>{copied?'Đã sao chép':'Sao chép trạng thái'}</button></div></div>
    <label className="checkline ai-ops-autorefresh"><input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)}/><TimerReset/> Tự làm mới mỗi 60 giây{lastChecked?` · lần cuối ${lastChecked.toLocaleTimeString('vi-VN')}`:''}</label>
    {error&&<div className="warning" role="status"><WifiOff/> {error}</div>}
    <div className="health-kpis">
      <span><b>{active.length}</b><small>provider đang áp dụng</small></span>
      <span><b>{candidates.length}</b><small>adapter 0đ đề xuất</small></span>
      <span><b>{ai?.cloudReady?'READY':'LOCAL'}</b><small>cloud runtime</small></span>
      <span><b>{ai?.centralRagReady?'READY':'FALLBACK'}</b><small>Central RAG</small></span>
      <span><b>{ai?.model||'—'}</b><small>model cloud</small></span>
    </div>
    <div className="admin-v6-grid">
      <article className="admin-v6-block"><div className="row"><Cloud/><h4>Runtime & Copilot</h4></div><p className="muted">A.I Mini, Research A.I và Exam Tutor đi qua Gateway chung. Khi cloud lỗi, hệ thống phải chuyển fallback theo ngữ cảnh thay vì đẩy lỗi kỹ thuật ra người học.</p><div className="keys"><span className="badge">Structured output {ai?.structuredOutputs?'✓':'—'}</span><span className="badge">Function calling {ai?.functionCalling?'✓':'—'}</span><span className="badge">RBAC {ai?.roleBoundTools?'✓':'—'}</span><span className="badge">Citation whitelist {ai?.citationWhitelist?'✓':'—'}</span></div></article>
      <article className="admin-v6-block"><div className="row"><Database/><h4>Knowledge & Evidence</h4></div><p className="muted">Central RAG + Drive RAG + OpenAlex + PubMed + ClinicalTrials.gov; read-only tools và evidence-backed answers được theo dõi tại đây.</p><div className="keys"><span className="badge">Evidence {ai?.evidenceBacked?'✓':'—'}</span><span className="badge">Read-only {ai?.readOnlyTools?'✓':'—'}</span><span className="badge">Nguồn {ai?.evidenceSources?.length||0}</span><span className="badge">Offline fallback {ai?.offlineFallback?'✓':'—'}</span></div></article>
    </div>
    <details open><summary><Search/> Provider đang hoạt động ({active.length})</summary><div className="data-list compact">{active.map(x=><article key={x.id}><div><b>{x.label}</b><small>{x.kind} · {x.capabilities.join(' · ')}</small><p className="muted">{x.note}</p></div><span className="badge">{x.networkRequired?'online':'local'} · active</span></article>)}</div></details>
    <details><summary><Search/> 5 nguồn tìm kiếm 0đ có thể tích hợp tiếp</summary><div className="data-list compact">{candidates.map(x=><article key={x.id}><div><b>{x.label}</b><small>{x.capabilities.join(' · ')}</small><p className="muted">{x.note}</p></div><span className="badge">0đ cài đặt</span></article>)}</div></details>
    <p className="muted"><ShieldCheck/> Panel chỉ hiển thị readiness/capability và snapshot vận hành không chứa secret; API key vẫn chỉ nằm server-side.</p>
  </section>;
}
