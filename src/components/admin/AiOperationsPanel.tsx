import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,BrainCircuit,CheckCircle2,Cloud,Copy,Database,ExternalLink,KeyRound,RefreshCw,Search,ShieldCheck,TimerReset,WifiOff,X} from 'lucide-react';
import {activeAiProviders,checkGeminiProvider,fetchAiHealth,type AiHealth,type GeminiProviderCheck} from '../../modules/ai';

const AI_STUDIO_KEY_URL='https://aistudio.google.com/apikey';
const VERCEL_ENV_URL='https://vercel.com/hiu-yhct/yhct-hiu-final4-stage/settings/environment-variables';

export default function AiOperationsPanel(){
  const [health,setHealth]=useState<AiHealth|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[autoRefresh,setAutoRefresh]=useState(true),[lastChecked,setLastChecked]=useState<Date|null>(null),[copied,setCopied]=useState(false);
  const [setupOpen,setSetupOpen]=useState(false),[probeBusy,setProbeBusy]=useState(false),[probe,setProbe]=useState<GeminiProviderCheck|null>(null),[probeError,setProbeError]=useState('');
  const active=useMemo(()=>activeAiProviders(),[]);
  const load=async()=>{setBusy(true);setError('');try{setHealth(await fetchAiHealth());setLastChecked(new Date())}catch(e){setHealth(null);setError((e as Error).message||'Không đọc được trạng thái A.I.')}finally{setBusy(false)}};
  useEffect(()=>{void load()},[]);
  useEffect(()=>{if(!autoRefresh)return;const id=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(id)},[autoRefresh]);
  useEffect(()=>{if(!setupOpen)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setSetupOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[setupOpen]);
  const ai=health?.ai;
  const copyStatus=async()=>{const payload={checkedAt:lastChecked?.toISOString()||null,ok:health?.ok||false,mode:ai?.mode||'unknown',cloudConfigured:Boolean(ai?.cloudReady),providersConfigured:ai?.providers||{},providerStatus:ai?.providerStatus||{},academicProviderPriority:ai?.academicProviderPriority||null,centralRagStatus:ai?.centralRagStatus||{ready:Boolean(ai?.centralRagReady),reason:'unknown'},model:ai?.model||null,geminiModels:ai?.geminiModels||null,geminiLastProbe:probe?{ok:probe.ok,liveness:probe.liveness,checkedAt:probe.checkedAt,models:probe.models.map(x=>({model:x.model,ok:x.ok,status:x.status}))}:null,privateContextToGemini:Boolean(ai?.privateContextToGemini),evidenceSources:ai?.evidenceSources||[],architectureRegistry:active.map(x=>({id:x.id,label:x.label,kind:x.kind,state:x.state,capabilities:x.capabilities}))};try{await navigator.clipboard.writeText(JSON.stringify(payload,null,2));setCopied(true);window.setTimeout(()=>setCopied(false),1600)}catch{setError('Không sao chép được trạng thái A.I trên trình duyệt này.')}};
  const runGeminiCheck=async()=>{setProbeBusy(true);setProbeError('');try{const result=await checkGeminiProvider();setProbe(result);await load()}catch(e){setProbe(null);setProbeError((e as Error).message||'Không kiểm tra được Gemini.')}finally{setProbeBusy(false)}};
  const geminiModelLabel=ai?.geminiModels?.research||ai?.geminiModel||ai?.model||'—';
  const openAiConfig=ai?.providerStatus?.openai?.configured??Boolean(ai?.providers?.openai),geminiConfig=ai?.providerStatus?.gemini?.configured??Boolean(ai?.providers?.gemini);
  return <section className="panel admin-v6-block ai-operations-panel" data-ai-ops-surface="acc">
    <div className="between"><div className="row panel-title"><BrainCircuit/><div><h3>A.I Operations</h3><p>ACC theo dõi tập trung: cấu hình · provider/model · live probe · privacy gate · contract. Cấu hình không được xem là bằng chứng liveness.</p></div></div><div className="schedule-actions"><button className="secondary" onClick={()=>setSetupOpen(true)}><KeyRound/>Cấu hình Gemini</button><button className="secondary" disabled={probeBusy} onClick={()=>void runGeminiCheck()}><ShieldCheck/>{probeBusy?'Đang live probe…':'Live probe Gemini'}</button><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw/>{busy?'Đang kiểm tra…':'Làm mới snapshot'}</button><button className="secondary" disabled={!health} onClick={()=>void copyStatus()}><Copy/>{copied?'Đã sao chép':'Sao chép trạng thái'}</button></div></div>
    <label className="checkline ai-ops-autorefresh"><input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)}/><TimerReset/> Tự làm mới snapshot cấu hình mỗi 60 giây{lastChecked?` · lần cuối ${lastChecked.toLocaleTimeString('vi-VN')}`:''}</label>
    {error&&<div className="warning" role="status"><WifiOff/> {error}</div>}
    {probeError&&<div className="warning" role="status"><AlertTriangle/> {probeError}</div>}
    {probe&&<div className={probe.ok?'success':'warning'} role="status">{probe.ok?<CheckCircle2/>:<AlertTriangle/>} Gemini live probe: {probe.ok?'model phản hồi':'probe thất bại'} · {probe.models.map(item=>`${item.model} ${item.ok?'✓':`HTTP ${item.status||'ERR'}`}`).join(' · ')}</div>}
    <div className="health-kpis">
      <span><b>{active.length}</b><small>capability lõi</small></span>
      <span><b>{openAiConfig?'CONFIG':'OFF'}</b><small>OpenAI cấu hình</small></span>
      <span><b>{geminiConfig?'CONFIG':'OFF'}</b><small>Gemini cấu hình</small></span>
      <span><b>{ai?.centralRagReady?'READY':'FALLBACK'}</b><small>Central RAG · {ai?.centralRagStatus?.reason||'snapshot'}</small></span>
      <span><b>{geminiModelLabel}</b><small>Gemini ưu tiên</small></span>
    </div>
    <div className="admin-v6-grid">
      <article className="admin-v6-block"><div className="row"><Cloud/><h4>Runtime & Provider Router</h4></div><p className="muted">Gemini là provider chính; OpenAI là fallback/capability. Snapshot GET chỉ xác nhận cấu hình. Liveness chỉ được khẳng định khi có live probe hoặc telemetry runtime.</p><div className="keys"><span className="badge">Ưu tiên {ai?.academicProviderPriority||'gemini-first'}</span><span className="badge">Gemini probe {probe?.liveness||'not_probed'}</span><span className="badge">Structured output {ai?.structuredOutputs?'✓':'—'}</span><span className="badge">Function calling {ai?.functionCalling?'✓':'—'}</span><span className="badge">RBAC {ai?.roleBoundTools?'✓':'—'}</span><span className="badge">Nội bộ → Gemini {ai?.internalContextOptIn?'Theo lựa chọn':'Tắt'}</span></div></article>
      <article className="admin-v6-block"><div className="row"><Database/><h4>Knowledge & Evidence</h4></div><p className="muted">Central RAG + Drive RAG + OpenAlex + PubMed + ClinicalTrials.gov; trạng thái RAG có lý do fail-soft riêng, không suy diễn provider live.</p><div className="keys"><span className="badge">Evidence {ai?.evidenceBacked?'✓':'—'}</span><span className="badge">Read-only {ai?.readOnlyTools?'✓':'—'}</span><span className="badge">Nguồn {ai?.evidenceSources?.length||0}</span><span className="badge">Offline fallback {ai?.offlineFallback?'✓':'—'}</span></div></article>
    </div>
    <details open><summary><Search/> Capability kiến trúc đang bật ({active.length})</summary><div className="data-list compact">{active.map(x=><article key={x.id}><div><b>{x.label}</b><small>{x.kind} · {x.capabilities.join(' · ')}</small><p className="muted">{x.note}</p></div><span className="badge">{x.networkRequired?'online':'local'} · core</span></article>)}</div></details>
    <p className="muted"><ShieldCheck/> `CONFIG` chỉ nghĩa là server có cấu hình cần thiết; không đồng nghĩa provider đang live. Panel không hiển thị secret, prompt hay nội dung tài liệu.</p>
    {setupOpen&&<div role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSetupOpen(false)}} style={{position:'fixed',inset:0,zIndex:10000,display:'grid',placeItems:'center',padding:16,background:'rgba(0,0,0,.56)'}}>
      <section role="dialog" aria-modal="true" aria-labelledby="gemini-setup-title" style={{width:'min(720px,100%)',maxHeight:'88vh',overflow:'auto',borderRadius:18,padding:20,background:'var(--panel,#111827)',border:'1px solid rgba(148,163,184,.25)',boxShadow:'0 24px 70px rgba(0,0,0,.35)'}}>
        <div className="between"><div className="row panel-title"><KeyRound/><div><h3 id="gemini-setup-title">Cấu hình Gemini an toàn</h3><p>Key chỉ lưu ở Vercel server-side, không lưu trong trình duyệt hay mã nguồn.</p></div></div><button className="secondary" aria-label="Đóng" onClick={()=>setSetupOpen(false)}><X/></button></div>
        <div className="admin-v6-grid" style={{marginTop:14}}>
          <article className="admin-v6-block"><h4>1. Lấy Gemini API key</h4><p className="muted">Mở Google AI Studio, tạo hoặc chọn API key. Không dán key vào app HIU YHCT.</p><a className="secondary" href={AI_STUDIO_KEY_URL} target="_blank" rel="noreferrer"><ExternalLink/> Mở Google AI Studio</a></article>
          <article className="admin-v6-block"><h4>2. Gắn key vào Vercel</h4><p className="muted">Trong Environment Variables của project production, đặt GEMINI_API_KEY. Không commit key vào GitHub.</p><a className="secondary" href={VERCEL_ENV_URL} target="_blank" rel="noreferrer"><ExternalLink/> Mở Vercel Environment Variables</a></article>
        </div>
        <article className="admin-v6-block" style={{marginTop:14}}><h4>Biến môi trường chuẩn</h4><div className="data-list compact"><article><div><b>GEMINI_API_KEY</b><small>Secret key từ Google AI Studio</small></div><span className="badge">encrypted/server</span></article><article><div><b>ENABLE_GEMINI_AI</b><small>true</small></div><span className="badge">required</span></article><article><div><b>AI_ACADEMIC_PROVIDER</b><small>gemini</small></div><span className="badge">Gemini-first</span></article><article><div><b>GEMINI_MODEL</b><small>gemini-3.5-flash-lite</small></div><span className="badge">fast</span></article><article><div><b>GEMINI_RESEARCH_MODEL</b><small>gemini-3.8-flash</small></div><span className="badge">research</span></article></div></article>
        <div className="schedule-actions" style={{marginTop:14}}><button className="secondary" disabled={probeBusy} onClick={()=>void runGeminiCheck()}><ShieldCheck/>{probeBusy?'Đang kiểm tra key/model…':'Live probe key & model'}</button><button className="secondary" onClick={()=>setSetupOpen(false)}>Đóng</button></div>
        {probe&&<p className="muted" style={{marginTop:10}}>Lần probe: {new Date(probe.checkedAt).toLocaleString('vi-VN')} · {probe.models.map(item=>`${item.displayName||item.model}: ${item.ok?'OK':item.error||'lỗi'}`).join(' · ')}</p>}
        {probeError&&<p className="warning" style={{marginTop:10}}><AlertTriangle/> {probeError}</p>}
      </section>
    </div>}
  </section>;
}
