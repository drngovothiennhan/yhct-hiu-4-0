import {useEffect,useMemo,useState} from 'react';
import {BookOpen,Database,ExternalLink,FileText,FolderOpen,HardDrive,Lightbulb,LockKeyhole,Search,Sparkles,UploadCloud} from 'lucide-react';
import type {Member} from '../../types';
import {extractiveSummary,ingestLocalFiles,listPublicDriveFolder,loadPersistedRagDocuments,persistRagDocuments,retrieveLocalRag,type RagDocument,type ResearchWork} from '../../services/researchService';
import {searchResearchEvidence} from '../../services/researchEvidenceService';
import {consumeGuestSearchQuota,formatQuotaCountdown,GUEST_SEARCH_LIMIT,readGuestSearchQuota,suggestResearchTopics} from '../../services/researchLocalAi';
import DocumentLibrary from './DocumentLibrary';
import ResearchAiMini from './ResearchAiMini';
import ResearchProposalBuilder from './ResearchProposalBuilder';

const RESEARCH_PENDING_KEY='yhct-research-pending-query-v1';
const dedupeDocs=(docs:RagDocument[])=>[...new Map(docs.map(d=>[d.id,d])).values()];
const providerClass=(provider:string)=>provider.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const pendingResearchQuery=()=>{try{const value=String(localStorage.getItem(RESEARCH_PENDING_KEY)||'').replace(/\s+/g,' ').trim().slice(0,2200);if(value)localStorage.removeItem(RESEARCH_PENDING_KEY);return value}catch{return ''}};

type Props={member:Member|null;onLogin?:()=>void};

export default function ResearchCenter({member,onLogin}:Props){
  const [q,setQ]=useState(''),[works,setWorks]=useState<ResearchWork[]>([]),[evidenceQuery,setEvidenceQuery]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[docs,setDocs]=useState<RagDocument[]>([]),[hydrated,setHydrated]=useState(false),[ragQ,setRagQ]=useState(''),[summary,setSummary]=useState(''),[proposalOpen,setProposalOpen]=useState(false),[proposalTitle,setProposalTitle]=useState('');
  const [quota,setQuota]=useState(()=>readGuestSearchQuota()),[now,setNow]=useState(Date.now());
  const login=()=>{if(onLogin){onLogin();return}document.querySelector<HTMLButtonElement>('.mobile-account-button, aside footer button')?.click()};
  useEffect(()=>{document.documentElement.classList.add('research-route-active');return()=>document.documentElement.classList.remove('research-route-active')},[]);
  useEffect(()=>{const seed=pendingResearchQuery();if(seed){setQ(seed);setRagQ(seed)}},[]);
  useEffect(()=>{let alive=true;void loadPersistedRagDocuments().then(x=>{if(alive){setDocs(x);setHydrated(true)}});return()=>{alive=false}},[]);
  useEffect(()=>{if(hydrated)void persistRagDocuments(docs)},[docs,hydrated]);
  useEffect(()=>{if(member)return;const id=window.setInterval(()=>{const t=Date.now();setNow(t);setQuota(readGuestSearchQuota(t))},1000);return()=>window.clearInterval(id)},[member]);
  const ragResults=useMemo(()=>retrieveLocalRag(ragQ,docs,6),[ragQ,docs]);
  const topics=useMemo(()=>suggestResearchTopics(q,works,3),[q,works]);
  const openProposal=(title='')=>{if(!member){login();return}setProposalTitle(title);setProposalOpen(true)};
  const search=async()=>{
    const query=q.trim();if(!query||busy)return;
    if(!member){const current=readGuestSearchQuota();if(current.remaining<=0){setQuota(current);setErr(`Khách đã dùng đủ ${GUEST_SEARCH_LIMIT} lượt tra cứu. Đăng nhập thành viên để tiếp tục.`);return}setQuota(consumeGuestSearchQuota())}
    setBusy(true);setErr('');
    try{
      const result=await searchResearchEvidence(query,18);setWorks(result.works);setEvidenceQuery(query);
      if(!result.works.length)setErr('Chưa tìm thấy bằng chứng phù hợp. Hãy thử tên khoa học, từ khóa tiếng Anh hoặc câu hỏi cụ thể hơn.');
    }catch(error){setWorks([]);setEvidenceQuery(query);setErr((error as Error).message||'Nguồn bằng chứng công khai tạm thời chưa phản hồi.')}
    finally{setBusy(false)}
  };
  const importLocal=async(files:FileList|null)=>{if(!files)return;setBusy(true);try{const incoming=await ingestLocalFiles(Array.from(files));setDocs(x=>dedupeDocs([...x,...incoming]))}finally{setBusy(false)}};
  const importDrive=async()=>{setBusy(true);setErr('');try{const incoming=await listPublicDriveFolder();setDocs(x=>dedupeDocs([...x,...incoming]))}catch(e){setErr((e as Error).message)}finally{setBusy(false)}};
  const summarizeLocal=()=>{const text=ragResults.map(r=>r.document.text||r.snippet).join('\n');setSummary(extractiveSummary(text,6)||'Chưa có đủ lớp văn bản để trích xuất.')};
  const remaining=member?'∞':String(quota.remaining),countdown=formatQuotaCountdown(quota.msUntilReset-(Date.now()-now));
  const proposalQuotaLabel=!member?'':member.role==='admin'?'Research A.I + tạo đề cương Gemini không giới hạn':(['mod','super_mod','leader'].includes(member.role)?'Research A.I + 5 lượt tạo đề cương Gemini / 6 giờ':'Research A.I + 3 lượt tạo đề cương Gemini / 6 giờ');

  return <section className="research-center research-center-v2">
    <div className="research-hero"><div className="research-hero-copy"><span className="kicker">TRUNG TÂM NGHIÊN CỨU Y DƯỢC CỔ TRUYỀN HIU 4.0</span><h2>Research Center <Sparkles/></h2><p>Gemini Research là bộ não phân tích; PubMed/Europe PMC · OpenAlex · ClinicalTrials.gov là lớp bằng chứng; tài liệu nội bộ chỉ được dùng khi thành viên chủ động bật cho từng lượt.</p>{member?<span className="research-access-pill member"><Database/> Thành viên: {proposalQuotaLabel}</span>:<span className="research-access-pill guest"><LockKeyhole/> Khách: không dùng Gemini · còn {remaining}/{GUEST_SEARCH_LIMIT} lượt tra cứu công khai · reset {countdown}</span>}</div><div className="research-hero-stats"><div className="research-stat"><Database/><strong>{works.length}</strong><span>kết quả y văn</span></div><div className="research-stat"><HardDrive/><strong>{docs.length}</strong><span>tài liệu cục bộ</span></div></div></div>

    {member?<ResearchAiMini member={member} works={works} evidenceQuery={evidenceQuery} query={q} onOpenProposal={openProposal}/>:<section className="research-ai-guest-lock"><LockKeyhole/><div><b>Research A.I dành cho thành viên đã đăng nhập</b><p>Khách có thể tra cứu nguồn công khai nhưng không được gửi nội dung cho Gemini và không được tạo đề cương A.I.</p></div><button onClick={login}>Đăng nhập</button></section>}

    <div className="research-grid"><section className="research-card literature"><div className="research-card-head"><div><h3><BookOpen/> Bằng chứng công khai</h3><p className="muted">Một truy vấn tìm song song PubMed/Europe PMC, OpenAlex và ClinicalTrials.gov; Crossref chỉ bổ sung khi nguồn chính còn ít. Kết quả nguồn tồn tại độc lập với A.I để luôn có thể kiểm chứng.</p></div>{!member&&<div className="guest-quota-badge"><b>{quota.remaining}</b><span>lượt còn lại</span></div>}</div><div className="research-search"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ví dụ: Ngoc Linh ginseng clinical trial antioxidant" onKeyDown={e=>e.key==='Enter'&&void search()}/><button onClick={()=>void search()} disabled={busy||(!member&&quota.remaining<=0)}><Search/>{busy?'Đang tìm…':'Tìm bằng chứng'}</button></div>{err&&<div className="error" role="status">{err}</div>}
      {works.length>0&&<div className="research-topic-strip"><span><Lightbulb/> Câu hỏi có thể phát triển:</span>{topics.map(t=><button key={t.title} disabled={!member} title={member?'Mở đề cương Gemini':'Đăng nhập để tạo đề cương'} onClick={()=>openProposal(t.title)}>{t.title}</button>)}</div>}
      <div className="works-list">{works.map(w=><article key={`${w.provider}-${w.id}`}><div><span className={`provider ${providerClass(w.provider)}`}>{w.provider}</span>{w.year&&<small>{w.year}</small>}{typeof w.citedBy==='number'&&<small>{w.citedBy} trích dẫn</small>}</div><h4>{w.title}</h4><p>{w.authors.slice(0,5).join(', ')||'Không rõ tác giả'} · {w.source}</p>{w.abstract&&<p className="work-abstract">{w.abstract.slice(0,650)}{w.abstract.length>650?'…':''}</p>}<a href={w.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={15}/> Mở nguồn gốc</a></article>)}</div></section>

      <aside className="research-card rag"><h3><FolderOpen/> Kho tài liệu làm việc</h3><p className="muted">Lưu và tìm tài liệu cục bộ. Đây là tiện ích trích xuất, không giả làm A.I; Gemini chỉ đọc nguồn nội bộ khi bạn bật quyền ở Research A.I.</p>{member?.role==='admin'&&<button onClick={()=>void importDrive()} disabled={busy}><FolderOpen/> Đồng bộ kho Drive cấu hình</button>}<label className="local-upload"><UploadCloud/><span><b>Nhập thư mục/tệp cục bộ</b><small>TXT, MD, CSV, JSON, HTML · lập chỉ mục trên thiết bị</small></span><input type="file" multiple {...({webkitdirectory:''} as any)} onChange={e=>void importLocal(e.target.files)}/></label><div className="doc-list">{docs.slice(0,12).map(d=><div key={d.id}><FileText/><span><b>{d.name}</b><small>{d.source} · {d.mime||'unknown'}</small></span></div>)}</div><label>Tìm trong tài liệu<textarea value={ragQ} onChange={e=>{setRagQ(e.target.value);setSummary('')}} placeholder="Ví dụ: chứng Tâm tỳ lưỡng hư"/></label><div className="rag-results">{ragResults.map(r=><article key={r.document.id}><b>{r.document.name}</b><small>Độ phù hợp {Math.round(r.score*100)}%</small><p>{r.snippet}</p></article>)}</div><button className="secondary" disabled={!ragResults.length} onClick={summarizeLocal}><FileText/> Trích xuất ý chính (không A.I)</button>{summary&&<div className="rag-summary"><b>Trích xuất cục bộ</b><p>{summary}</p></div>}</aside></div>

    <DocumentLibrary memberId={member?.id} onLogin={login}/>

    {member&&proposalOpen&&<ResearchProposalBuilder member={member} works={works} initialTitle={proposalTitle||q} onClose={()=>setProposalOpen(false)}/>} 
  </section>;
}
