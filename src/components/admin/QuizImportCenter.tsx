import {useEffect,useRef,useState} from 'react';
import {Bot,CheckCircle2,Cloud,FileUp,FolderOpen,RefreshCcw,Sparkles} from 'lucide-react';
import {readCachedMember} from '../../services/authService';
import {
 continueQuizPipeline,
 quizWorkspace,
 retryQuizPipeline,
 sourceFileBase64,
 startQuizPipeline,
 type QuizDraft,
 type QuizDraftSummary,
 type QuizDriveItem
} from '../../services/quizWorkspaceService';
import {getPracticeReviewQueue,reviewPracticeQuestion,type PracticeReviewQuestion} from '../../services/dailyPracticeService';
import './quiz-import.css';
import DriveCredentialGuide from './DriveCredentialGuide';

type Listing={folder:QuizDriveItem;items:QuizDriveItem[];nextPageToken:string|null};
type ConversionMode='auto'|'generate'|'extract';

export default function QuizImportCenter(){
 const admin=readCachedMember()?.role==='admin';
 const [roots,setRoots]=useState<QuizDriveItem[]>([]);
 const [trail,setTrail]=useState<QuizDriveItem[]>([]);
 const [items,setItems]=useState<QuizDriveItem[]>([]);
 const [pageToken,setPageToken]=useState<string|null>(null);
 const [category,setCategory]=useState<QuizDriveItem|null>(null);
 const [selected,setSelected]=useState<Record<string,QuizDriveItem>>({});
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [draft,setDraft]=useState<QuizDraft|null>(null);
 const [drafts,setDrafts]=useState<QuizDraftSummary[]>([]);
 const [checked,setChecked]=useState<Set<string>>(new Set());
 const [page,setPage]=useState(0);
 const [reports,setReports]=useState<string[]>([]);
 const [review,setReview]=useState<PracticeReviewQuestion[]>([]);
 const [conversionMode,setConversionMode]=useState<ConversionMode>('auto');
 const [driveConfigured,setDriveConfigured]=useState<boolean|null>(null);
 const [manualSubject,setManualSubject]=useState('');
 const [pendingUpload,setPendingUpload]=useState<File|null>(null);
 const stop=useRef(false),lock=useRef(false),alive=useRef(true);
 const folder=trail[trail.length-1];

 const refresh=async()=>{
  const [d,q]=await Promise.all([quizWorkspace<{drafts:QuizDraftSummary[]}>('quiz-drafts'),getPracticeReviewQueue(20)]);
  if(alive.current){setDrafts(d.drafts);setReview(q)}
 };
 useEffect(()=>{
  alive.current=true;
  if(admin){
   void quizWorkspace<{roots:QuizDriveItem[];driveConfigured?:boolean;credentialMode?:string}>('quiz-roots').then(x=>{
    if(!alive.current)return;setRoots(x.roots);setDriveConfigured(x.driveConfigured!==false);
    if(x.driveConfigured===false)setMessage('Google Drive chưa có credential server-side. Bạn vẫn có thể tải DOCX/TXT trực tiếp và nhập tên chủ đề bên dưới.');
   }).catch(e=>{if(alive.current){setDriveConfigured(false);setMessage(e.message)}});
   void refresh().catch(e=>{if(alive.current)setMessage(e.message)});
  }
  return()=>{alive.current=false;stop.current=true};
 },[admin]);

 const run=async(fn:()=>Promise<void>)=>{
  if(lock.current)return;lock.current=true;stop.current=false;setBusy(true);setMessage('');
  try{await fn()}catch(e){setMessage((e as Error).message)}finally{lock.current=false;if(alive.current)setBusy(false)}
 };
 const display=(d:QuizDraft)=>{setDraft({...d,questions:d.questions.map(q=>q.imported&&q.importedSnapshot?{...q,...q.importedSnapshot}:q)});setPage(0);setChecked(new Set())};
 const trackPipeline=(d:QuizDraft,prefix='Đang chuyển đổi')=>{
  setDraft(d);
  if(d.pipeline?.state==='processing')setMessage(`${prefix}: ${d.pipeline.completedChunks}/${d.pipeline.totalChunks} phần · ${d.pipeline.percent}%`);
 };
 const finishPipeline=async(d:QuizDraft,label='Đã tạo bản nháp')=>{
  display(d);await refresh();setMessage(`${label}: ${d.total} câu; ${d.needsReview} câu cần đối chiếu. Chưa có câu nào được tự động nhập.`);
 };

 const browse=async(item:QuizDriveItem,nextTrail:QuizDriveItem[],token?:string)=>{
  const r:Listing=await quizWorkspace<Listing>('quiz-browse',{folderId:item.id,pageToken:token});
  setTrail([...nextTrail.slice(0,-1),r.folder]);setItems(old=>token?[...old,...r.items]:r.items);setPageToken(r.nextPageToken);
  if(!token){setSelected({});setCategory(item)}
 };
 const previewFile=async(fileId:string)=>{
  const d=await startQuizPipeline({fileId,conversionMode},next=>trackPipeline(next,'Đang xử lý tệp Drive'));
  await finishPipeline(d,'Đã chuyển đổi tệp Drive');
 };
 const upload=async(file:File)=>{
  const subjectName=category?.name||manualSubject.trim();if(!subjectName)throw new Error('Chọn thư mục kiến thức hoặc nhập tên chủ đề trước khi tải tài liệu.');
  const d=await startQuizPipeline({fileName:file.name,base64:await sourceFileBase64(file),subjectFolderId:category?.id,subjectName,conversionMode},next=>trackPipeline(next,`Đang xử lý ${file.name}`));
  await finishPipeline(d,'Đã chuyển đổi tài liệu');
 };
 const collect=async(entries:QuizDriveItem[])=>{
  const files:QuizDriveItem[]=[],seen=new Set<string>(),queue=[...entries];
  while(queue.length&&!stop.current){
   const item=queue.shift()!;if(seen.has(item.id))continue;seen.add(item.id);
   if(item.folder){let token:string|null=null;do{const r:Listing=await quizWorkspace<Listing>('quiz-browse',{folderId:item.id,pageToken:token});queue.push(...r.items.filter(x=>x.folder||x.supported));token=r.nextPageToken;if(stop.current)break}while(token)}else files.push(item);
   if(files.length>500)throw new Error('Đã tìm hơn 500 tệp; hãy chọn thư mục nhỏ hơn. Chưa nhập tài liệu nào.');
  }
  return files;
 };
 const sync=async()=>{
  const files=await collect(Object.values(selected));setReports([]);let completed=0;
  for(const file of files){
   if(stop.current)break;
   setMessage(`Đang chuyển đổi ${completed+1}/${files.length}: ${file.name}`);
   try{
    const d=await startQuizPipeline({fileId:file.id,conversionMode},next=>trackPipeline(next,`Tệp ${completed+1}/${files.length} · ${file.name}`));
    const structurallyReady=d.questions.filter(q=>!q.imported&&!q.issues.length).length,pending=d.questions.filter(q=>!q.imported).length;
    setReports(rows=>[...rows,`${file.name}: ${d.total} câu đã tạo bản nháp; ${structurallyReady} câu đủ cấu trúc; ${pending} câu chờ admin mở, đối chiếu và xác nhận trước khi nhập.`]);
   }catch(e){setReports(rows=>[...rows,`${file.name}: ${(e as Error).message} Bản nháp đã được giữ để tiếp tục/thử lại.`])}
   completed++;
  }
  await refresh();setMessage(`${stop.current?'Đã dừng':'Đã xử lý'} ${completed}/${files.length} tệp. Tất cả kết quả chỉ ở trạng thái bản nháp; không tự động nhập câu hỏi.`);
 };
 const openHistoryDraft=async(summary:QuizDraftSummary)=>{
  let current=await quizWorkspace<QuizDraft>('quiz-draft',{id:summary.id});
  display(current);
  if(current.pipeline?.state==='processing'){
   current=await continueQuizPipeline(current,next=>trackPipeline(next,`Tiếp tục ${summary.fileName}`));
   await finishPipeline(current,'Đã tiếp tục và hoàn tất bản nháp');
  }else if(current.pipeline?.state==='error'&&current.pipeline.retryable!==false){
   current=await retryQuizPipeline(current,next=>trackPipeline(next,`Thử lại ${summary.fileName}`));
   await finishPipeline(current,'Đã thử lại và hoàn tất bản nháp');
  }
 };
 const commit=async()=>{
  if(!draft)return;
  if(draft.pipeline?.state==='processing'||draft.pipeline?.state==='error')throw new Error('Hoàn tất pipeline trước khi nhập câu hỏi.');
  const selection=draft.questions.filter(q=>checked.has(q.id)&&!q.imported).map(q=>({...q,confirmed:true}));
  if(!selection.length)throw new Error('Chọn câu đã đối chiếu trước khi nhập.');
  await quizWorkspace('quiz-commit',{id:draft.id,revision:draft.revision,selection});display(await quizWorkspace<QuizDraft>('quiz-draft',{id:draft.id}));await refresh();setMessage(`Đã cập nhật ${selection.length} câu đã được admin đối chiếu vào ngân hàng dùng chung.`);
 };
 const change=(id:string,patch:Record<string,unknown>)=>setDraft(d=>d?{...d,questions:d.questions.map(q=>q.id===id?{...q,...patch}:q)}:d);

 if(!admin)return null;
 const pipeline=draft?.pipeline,pipelineBlocked=pipeline?.state==='processing'||pipeline?.state==='error';
 return <section className="panel quiz-import" aria-label="Tài liệu thành ngân hàng trắc nghiệm">
  <div className="qi-heading"><div><span className="qi-kicker"><Sparkles/>ACC · Gemini Quiz Designer</span><h2>Tài liệu → Ngân hàng trắc nghiệm</h2><p>Chọn thư mục Drive hoặc tải DOCX/TXT trực tiếp tại ACC. Hệ thống nhận diện câu có sẵn hoặc giao Gemini thiết kế câu hỏi chỉ từ nội dung nguồn. Mọi câu chỉ được nhập sau khi admin mở bản nháp, đối chiếu và chủ động xác nhận.</p></div><Bot/></div>
  <div className="qi-flow" aria-label="Quy trình chuyển đổi"><span><b>1</b><FolderOpen/>Chọn nguồn</span><span><b>2</b><Bot/>Chia phần & xử lý</span><span><b>3</b><CheckCircle2/>Xem & đối chiếu</span><span><b>4</b><CheckCircle2/>Cập nhật ngân hàng</span></div>
  <label className="qi-conversion"><span><b>Cách chuyển đổi</b><small>Không tự suy đoán đáp án và không bổ sung kiến thức ngoài tài liệu.</small></span><select disabled={busy} value={conversionMode} onChange={e=>setConversionMode(e.target.value as ConversionMode)}><option value="auto">Tự động — trích xuất nếu có, nếu không thì Gemini thiết kế</option><option value="generate">Gemini thiết kế trắc nghiệm từ tài liệu</option><option value="extract">Chỉ trích xuất câu trắc nghiệm có sẵn</option></select></label>
  <div className="qi-actions qi-root-actions">{roots.map(root=><button key={root.id} disabled={busy||driveConfigured===false} title={driveConfigured===false?'Drive server-side chưa cấu hình credential':'Mở kho Drive'} onClick={()=>void run(()=>browse(root,[root]))}><Cloud/>{root.name}</button>)}<button className="secondary" disabled={busy} onClick={()=>void run(refresh)}>Làm mới bản nháp</button></div>
  {driveConfigured===false&&<div className="qi-drive-warning" role="alert"><b>Drive tạm chưa khả dụng</b><span>Thiếu credential Google Drive phía server. Chức năng tải DOCX/TXT trực tiếp vẫn hoạt động và không cần Drive.</span></div>}
  <DriveCredentialGuide visible={driveConfigured===false}/>
  {pipeline&&<div className="qi-status" role="status"><b>Pipeline v{pipeline.version} · {pipeline.state==='processing'?'Đang xử lý':pipeline.state==='error'?'Tạm dừng':pipeline.state==='needs_review'?'Chờ đối chiếu':'Sẵn sàng'}</b><progress max={100} value={pipeline.percent}/><span>{pipeline.percent}% · {pipeline.completedChunks}/{pipeline.totalChunks||pipeline.completedChunks} phần · lần chạy {pipeline.attempt}</span>{pipeline.lastError&&<small className="warning">{pipeline.lastError}</small>}{pipeline.state==='error'&&pipeline.retryable&&<button disabled={busy} onClick={()=>void run(async()=>{const next=await retryQuizPipeline(draft!,d=>trackPipeline(d,'Đang thử lại'));await finishPipeline(next,'Đã thử lại và hoàn tất bản nháp')})}><RefreshCcw/>Thử lại từ phần bị lỗi</button>}</div>}
  {message&&<p className="qi-status" role="status">{message}</p>}

  {folder&&<><nav aria-label="Thư mục kiến thức">{trail.map((x,i)=><button key={x.id} disabled={busy} onClick={()=>void run(()=>browse(x,trail.slice(0,i+1)))}>{x.name} /</button>)}</nav><a href={folder.webViewLink} target="_blank" rel="noreferrer">Mở thư mục này trên Google Drive ↗</a>
   <div className="qi-files">{items.map(item=><div key={item.id}><label><input type="checkbox" disabled={busy||(!item.folder&&!item.supported)} checked={!!selected[item.id]} onChange={e=>setSelected(old=>{const next={...old};if(e.target.checked)next[item.id]=item;else delete next[item.id];return next})}/><span>{item.folder?'📁':'📄'} {item.name}</span></label>{item.folder?<button disabled={busy} onClick={()=>void run(()=>browse(item,[...trail,item]))}>Mở</button>:item.supported?<button disabled={busy} onClick={()=>void run(()=>previewFile(item.id))}>Xem trước</button>:<small>Chưa hỗ trợ định dạng này</small>}</div>)}</div>
   {pageToken&&<button disabled={busy} onClick={()=>void run(()=>browse(folder,trail,pageToken))}>Tải thêm tệp</button>}
   <div className="qi-actions"><button disabled={busy||!Object.keys(selected).length} onClick={()=>void run(sync)}>Tự chuyển đổi {Object.keys(selected).length} mục đã chọn</button><button className="secondary" disabled={busy} onClick={()=>setSelected(Object.fromEntries(items.filter(x=>x.folder||x.supported).map(x=>[x.id,x])))}>Chọn các mục đang hiển thị</button></div>
  </>}
  {!folder&&<div className="qi-empty"><FolderOpen/><b>{driveConfigured===false?'Drive chưa được cấu hình':'Chọn một kho Drive ở trên'}</b><p>{driveConfigured===false?'Bạn vẫn có thể tải DOCX/TXT trực tiếp ở khối bên dưới; Drive sẽ tự mở lại khi credential server-side được cấu hình.':'Admin có thể duyệt thư mục, chọn cả thư mục hoặc từng tệp, sau đó hệ thống tự xử lý theo chế độ đã chọn.'}</p></div>}

  <div className="qi-direct-upload"><label><span><b>Chủ đề cho tài liệu tải lên</b><small>{category?`Đang lấy từ Drive: ${category.name}`:'Nhập tên chủ đề để upload độc lập với Drive.'}</small></span><input type="text" disabled={busy} value={category?.name||manualSubject} placeholder="Ví dụ: Sinh lý học, Châm cứu học…" onChange={e=>{setCategory(null);setManualSubject(e.target.value)}}/></label><label className="qi-upload"><FileUp/><span><b>Tải tài liệu trực tiếp tại ACC</b><small>DOCX hoặc TXT UTF-8 · tối đa 2 MB · pipeline chia phần, có thể tiếp tục sau lỗi mạng</small></span><input key={pendingUpload?.name||'empty'} type="file" accept=".docx,.txt,text/plain" disabled={busy||!(category||manualSubject.trim())} onChange={e=>setPendingUpload(e.target.files?.[0]||null)}/></label><div className="qi-actions"><button className="qi-primary-convert" disabled={busy||!pendingUpload||!(category||manualSubject.trim())} onClick={()=>void run(async()=>{const file=pendingUpload;if(!file)return;await upload(file);setPendingUpload(null)})}><Sparkles/>Tự chuyển đổi</button>{pendingUpload&&<small>Đã chọn: {pendingUpload.name}</small>}</div><small>Tệp tải lên chỉ được đọc để tạo bản nháp; không ghi đè tài liệu Drive.</small></div>
  {busy&&<button onClick={()=>{stop.current=true;setMessage('Sẽ dừng sau tệp đang xử lý. Các bản nháp và tiến độ đã tạo vẫn được giữ.')}}>Dừng sau tệp hiện tại</button>}
  {reports.length>0&&<details open><summary>Kết quả đối soát từng tệp</summary><ul>{reports.map((x,i)=><li key={i}>{x}</li>)}</ul></details>}

  <details open><summary>Bản nháp và lịch sử nhập ({drafts.length} gần nhất)</summary><div className="qi-drafts">{drafts.map(d=>{const resumable=d.pipelineState==='processing'||d.pipelineState==='error';return <button key={d.id} disabled={busy} onClick={()=>void run(()=>openHistoryDraft(d))}>{resumable?<RefreshCcw/>:<FolderOpen/>}{d.fileName} · {d.subject} · {d.total} câu / {d.pending} chưa nhập{d.pipelineState?` · ${d.pipelineProgress??0}% ${d.pipelineState==='error'?'thử lại':d.pipelineState==='processing'?'tiếp tục':d.pipelineState}`:''}</button>})}</div></details>

  {draft&&<div className="qi-preview"><h3>{draft.document.fileName}</h3><p>{draft.total} câu · {draft.questions.filter(q=>q.imported).length} đã nhập · {draft.questions.filter(q=>!q.imported).length} chưa nhập</p>{draft.warnings.map((w,i)=><p key={i} className="warning">{w}</p>)}<details><summary>Nguyên văn để đối soát — không cắt nội dung</summary><pre>{draft.sourceText}</pre></details>
   {draft.questions.slice(page*10,page*10+10).map((q,i)=><article key={q.id}><label><input type="checkbox" disabled={busy||pipelineBlocked||q.imported} checked={checked.has(q.id)} onChange={e=>setChecked(old=>{const next=new Set(old);if(e.target.checked&&next.size<200)next.add(q.id);else next.delete(q.id);return next})}/>{page*10+i+1}. {q.imported?'Đã nhập':'Tôi đã đối chiếu câu này'}</label><b>{q.stem}</b>{q.issues.length>0&&<p className="warning">{q.issues.join(' · ')}</p>}<ol type="A">{q.options.map((o,j)=><li key={j}>{o||'(Trống)'}</li>)}</ol>
    <label>Đáp án<select disabled={busy||pipelineBlocked||q.imported} value={q.correctIndex??''} onChange={e=>change(q.id,{correctIndex:e.target.value===''?null:Number(e.target.value)})}><option value="">Chưa xác định</option>{['A','B','C','D'].map((x,j)=><option key={x} value={j}>{x}</option>)}</select></label><small>{q.answerEvidence}</small>
    {!q.imported&&<details><summary>Chỉnh sửa nội dung</summary><label>Câu hỏi<textarea disabled={busy||pipelineBlocked} value={q.stem} onChange={e=>change(q.id,{stem:e.target.value})}/></label>{q.options.map((o,j)=><label key={j}>Lựa chọn {String.fromCharCode(65+j)}<textarea disabled={busy||pipelineBlocked} value={o} onChange={e=>change(q.id,{options:q.options.map((x,k)=>k===j?e.target.value:x)})}/></label>)}<label>Giải thích<textarea disabled={busy||pipelineBlocked} value={q.explanation} onChange={e=>change(q.id,{explanation:e.target.value})}/></label></details>}
   </article>)}
   <div className="qi-actions"><button disabled={busy||page===0} onClick={()=>setPage(x=>x-1)}>Trang trước</button><span>{page+1}/{Math.max(1,Math.ceil(draft.questions.length/10))}</span><button disabled={busy||(page+1)*10>=draft.questions.length} onClick={()=>setPage(x=>x+1)}>Trang tiếp</button><button disabled={busy||pipelineBlocked||!checked.size} onClick={()=>void run(commit)}>Cập nhật vào ngân hàng ({checked.size} câu)</button></div>
  </div>}

  {review.length>0&&<details><summary>Câu AI cũ chờ duyệt ({review.length} câu)</summary>{review.map(q=><article key={q.id}><b>{q.stem}</b><ol type="A">{q.options.map((o,i)=><li key={i}>{o}{i===q.correctIndex?' ✓':''}</li>)}</ol><p>{q.explanation}</p><small>{q.sourceFileName}</small><div className="qi-actions"><button disabled={busy} onClick={()=>void run(async()=>{await reviewPracticeQuestion(q.id,'expert_approved');await refresh()})}>Duyệt</button><button disabled={busy} onClick={()=>void run(async()=>{await reviewPracticeQuestion(q.id,'rejected');await refresh()})}>Loại</button></div></article>)}</details>}
 </section>;
}
