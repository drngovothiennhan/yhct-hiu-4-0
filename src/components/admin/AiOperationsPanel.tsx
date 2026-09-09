import {useEffect,useMemo,useState} from 'react';
import {Activity,BrainCircuit,Cloud,Database,RefreshCw,Search,ShieldCheck,WifiOff} from 'lucide-react';
import {activeAiProviders,candidateZeroCostProviders,fetchAiHealth,type AiHealth} from '../../modules/ai';

export default function AiOperationsPanel(){
  const [health,setHealth]=useState<AiHealth|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const active=useMemo(()=>activeAiProviders(),[]),candidates=useMemo(()=>candidateZeroCostProviders(),[]);
  const load=async()=>{setBusy(true);setError('');try{setHealth(await fetchAiHealth())}catch(e){setHealth(null);setError((e as Error).message||'Không đọc được trạng thái A.I.')}finally{setBusy(false)}};
  useEffect(()=>{void load()},[]);
  const ai=health?.ai;
  return <section className="panel admin-v6-block ai-operations-panel">
    <div className="between"><div className="row panel-title"><BrainCircuit/><div><h3>A.I Operations</h3><p>Một Gateway · một Provider Registry · một lớp RAG · nhiều Copilot chuyên biệt.</p></div></div><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw/>{busy?'Đang kiểm tra…':'Làm mới'}</button></div>
    {error&&<div className="warning" role="status"><WifiOff/> {error}</div>}
    <div className="health-kpis">
      <span><b>{active.length}</b><small>provider đang áp dụng</small></span>
      <span><b>{candidates.length}</b><small>adapter 0đ đề xuất</small></span>
      <span><b>{ai?.cloudReady?'READY':'LOCAL'}</b><small>cloud runtime</small></span>
      <span><b>{ai?.centralRagReady?'READY':'FALLBACK'}</b><small>Central RAG</small></span>
      <span><b>{ai?.model||'—'}</b><small>model cloud</small></span>
    </div>
    <div className="admin-v6-grid">
      <article className="admin-v6-block"><div className="row"><Cloud/><h4>Runtime & Copilot</h4></div><p className="muted">Gateway chung phục vụ A.I Mini, Research A.I và Exam Tutor; cloud lỗi phải chuyển fallback theo ngữ cảnh thay vì hiển thị lỗi kỹ thuật cho người học.</p><div className="keys"><span className="badge">Structured output {ai?.structuredOutputs?'✓':'—'}</span><span className="badge">Function calling {ai?.functionCalling?'✓':'—'}</span><span className="badge">RBAC {ai?.roleBoundTools?'✓':'—'}</span></div></article>
      <article className="admin-v6-block"><div className="row"><Database/><h4>Knowledge & Evidence</h4></div><p className="muted">Central RAG + Drive RAG + OpenAlex + PubMed + ClinicalTrials.gov; citation whitelist và read-only tools giữ nguyên.</p><div className="keys"><span className="badge">Evidence {ai?.evidenceBacked?'✓':'—'}</span><span className="badge">Read-only {ai?.readOnlyTools?'✓':'—'}</span><span className="badge">Nguồn {ai?.evidenceSources?.length||0}</span></div></article>
    </div>
    <details><summary><Search/> 5 nguồn tìm kiếm 0đ có thể tích hợp tiếp</summary><div className="data-list compact">{candidates.map(x=><article key={x.id}><div><b>{x.label}</b><small>{x.capabilities.join(' · ')}</small><p className="muted">{x.note}</p></div><span className="badge">0đ cài đặt</span></article>)}</div></details>
    <p className="muted"><ShieldCheck/> Panel chỉ hiển thị readiness và capability; không đọc hoặc hiển thị API secret.</p>
  </section>;
}
