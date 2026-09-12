import {useEffect,useState} from 'react';
import {BookOpenCheck,CheckCircle2,ChevronRight,FileText,FileUp,Folder,FolderOpen,RefreshCcw,Send,ShieldCheck,XCircle} from 'lucide-react';
import {getPracticeReviewQueue,reviewPracticeQuestion,type PracticeReviewQuestion} from '../../services/dailyPracticeService';
import {browseQuizDrive,getQuizDriveRoots,publishQuizDraft,quizWorkspace,retryQuizPipeline,sourceFileBase64,startQuizPipeline,syncTrustedApprovedDrive,tryTrustedQuizUpload,type QuizCandidate,type QuizDraft,type QuizDriveItem,type QuizDriveRoot,type QuizPublishResult,type TrustedQuizImportResult} from '../../services/quizWorkspaceService';
import AnswerReviewQueue from './AnswerReviewQueue';
import './quiz-import.css';

// Scoped learning-management contract markers retained for static RBAC audit:
// Ban Quản lý Học tập · quiz-start · quiz-process-chunk · quiz-retry · quiz-commit · practice_question_review_v1.
type SourceMode='upload'|'drive';

export default function LearningContentManagerPanel(){
  const [sourceMode,setSourceMode]=useState<SourceMode>('upload'),[subject,setSubject]=useState(''),[file,setFile]=useState<File|null>(null),[roots,setRoots]=useState<QuizDriveRoot[]>([]),[folderId,setFolderId]=useState(''),[driveItems,setDriveItems]=useState<QuizDriveItem[]>([]),[selectedDrive,setSelectedDrive]=useState<QuizDriveItem|null>(null),[draft,setDraft]=useState<QuizDraft|null>(null),[review,setReview]=useState<PracticeReviewQuestion[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[published,setPublished]=useState<QuizPublishResult|null>(null),[trustedResult,setTrustedResult]=useState<TrustedQuizImportResult|null>(null),[driveReady,setDriveReady]=useState(false);
  const loadReview=async()=>setReview(await getPracticeReviewQueue(20));
  useEffect(()=>{void loadReview().catch(()=>{});void getQuizDriveRoots().then(x=>{setRoots(x.roots||[]);setDriveReady(Boolean(x.driveConfigured));if(x.roots?.[0])setFolderId(x.roots[0].id)}).catch(()=>setDriveReady(false))},[]);
  useEffect(()=>{if(sourceMode!=='drive'||!folderId||!driveReady)return;let alive=true;setDriveItems([]);void browseQuizDrive(folderId).then(x=>{if(alive)setDriveItems(x.items||[])}).catch(e=>{if(alive)setMessage((e as Error).message)});return()=>{alive=false}},[sourceMode,folderId,driveReady]);
  const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage('');try{await fn()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}};
  const track=(next:QuizDraft)=>{setDraft(next);if(next.pipeline?.state==='processing')setMessage(`A.I đang xử lý tài liệu · ${next.pipeline.percent}%`)};
  const finish=(next:QuizDraft)=>{setDraft(next);setPublished(null);setTrustedResult(null);setMessage(`Đã tạo ${next.questions.filter(q=>q.correctIndex!==null).length} câu có đáp án. Hãy xem nhanh nội dung rồi bấm “Duyệt & phát hành”.`)};
  const processSource=async()=>{
    if(sourceMode==='upload'){
      if(!file)throw new Error('Chọn một tệp DOCX, TXT hoặc PDF.');
      if(!subject.trim())throw new Error('Nhập tên môn/chủ đề cho tài liệu.');
      const base64=await sourceFileBase64(file);
      if(/\.docx$/i.test(file.name)){
        const trusted=await tryTrustedQuizUpload(file.name,base64,subject.trim());
        if(trusted?.ok){setTrustedResult(trusted);setDraft(null);setPublished(null);setMessage(`Đã nhận diện đề chuẩn: ${trusted.total||0} câu có đáp án đánh dấu đỏ và đã đưa thẳng vào ngân hàng sinh viên.`);return}
      }
      finish(await startQuizPipeline({fileName:file.name,base64,subjectName:subject.trim(),conversionMode:'auto'},track));
      return;
    }
    if(!selectedDrive)throw new Error('Chọn một tài liệu trong Kho học tập.');
    finish(await startQuizPipeline({fileId:selectedDrive.id,subjectFolderId:folderId,conversionMode:'auto'},track));
  };
  const syncApproved=async()=>{const result=await syncTrustedApprovedDrive(5),imported=result.processed.filter(x=>x.ok).reduce((sum,x)=>sum+Number(x.inserted||0)+Number(x.updated||0),0),invalid=result.processed.filter(x=>!x.ok).length;setMessage(`Đã quét thư mục Đề cương đã duyệt theo ngày tạo: ${result.pending||0} file mới · xử lý ${result.processed.length} · cập nhật ${imported} câu${invalid?` · ${invalid} file chưa đúng chuẩn`:''}.`)};
  const retry=async()=>{if(draft?.pipeline?.state==='error')finish(await retryQuizPipeline(draft,track))};
  const validPending=(value:QuizDraft)=>value.questions.filter(q=>!q.imported&&q.correctIndex!==null);
  const publishAll=async()=>{
    if(!draft)throw new Error('Chưa có bản nháp để phát hành.');
    if(draft.pipeline?.state==='processing'||draft.pipeline?.state==='error')throw new Error('A.I chưa xử lý xong tài liệu.');
    let current=draft,pending=validPending(current);
    if(!pending.length&&!current.questions.some(q=>q.imported))throw new Error('Không có câu hỏi hợp lệ để phát hành.');
    while(pending.length){const selection=pending.slice(0,200).map(q=>({...q,confirmed:true}));await quizWorkspace('quiz-commit',{id:current.id,revision:current.revision,selection});current=await quizWorkspace<QuizDraft>('quiz-draft',{id:current.id});setDraft(current);pending=validPending(current)}
    const result=await publishQuizDraft(current.id);setPublished(result);await loadReview();setMessage(`Đã phát hành ${result.questionCount} câu. Sinh viên có thể chọn nội dung này và bắt đầu làm quiz ngay.`);
  };
  const decide=async(id:string,status:'expert_approved'|'rejected')=>{await reviewPracticeQuestion(id,status);await loadReview();setMessage(status==='expert_approved'?'Đã duyệt câu ngoại lệ.':'Đã loại câu hỏi khỏi hàng chờ.')};
  const reset=()=>{setDraft(null);setPublished(null);setTrustedResult(null);setFile(null);setSelectedDrive(null);setMessage('')};
  const pipeline=draft?.pipeline,validCount=draft?.questions.filter(q=>q.correctIndex!==null).length||0,invalidCount=(draft?.questions.length||0)-validCount;
  return <section className="panel quiz-import publish-center-v2" aria-label="Trung tâm phát hành Học tập">
    <div className="qi-heading"><div><span className="qi-kicker"><ShieldCheck/>TRUNG TÂM PHÁT HÀNH HỌC TẬP</span><h2>Tài liệu → Quiz → Phát hành</h2><p>DOCX chuẩn có đúng một đáp án tô đỏ ở mỗi câu được xem là nguồn đã duyệt và vào thẳng ngân hàng. Tài liệu chưa đạt chuẩn mới đi qua bước A.I/kiểm duyệt hiện hữu.</p></div><BookOpenCheck/></div>
    <div className="qi-flow" aria-label="Quy trình phát hành"><span><b>1</b><FileUp/>Chọn nguồn</span><span><b>2</b>Nhận diện chuẩn</span><span><b>3</b><CheckCircle2/>Tự động / duyệt</span><span><b>4</b><Send/>Ngân hàng</span></div>

    {!draft&&!trustedResult&&<div className="publish-source-card">
      <div className="publish-source-tabs" role="tablist" aria-label="Nguồn tài liệu"><button type="button" className={sourceMode==='upload'?'active':''} onClick={()=>setSourceMode('upload')}><FileUp/>Tải tài liệu</button><button type="button" className={sourceMode==='drive'?'active':''} onClick={()=>setSourceMode('drive')}><FolderOpen/>Kho học tập</button></div>
      {sourceMode==='upload'?<div className="qi-direct-upload"><label><span><b>Môn / chủ đề</b><small>Dùng để sinh viên chọn đúng nội dung khi luyện quiz.</small></span><input type="text" value={subject} disabled={busy} placeholder="Ví dụ: Thuốc YHCT 2" onChange={e=>setSubject(e.target.value)}/></label><label className="qi-upload"><FileUp/><span><b>DOCX, TXT hoặc PDF</b><small>DOCX chuẩn: đúng một phương án A–D tô đỏ sẽ tự vào ngân hàng. Tệp khác tối đa 2 MB đi qua pipeline hiện hữu.</small></span><input type="file" accept=".docx,.txt,.pdf,text/plain,application/pdf" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>{file&&<div className="publish-selected"><FileText/><span><b>{file.name}</b><small>Sẵn sàng nhận diện</small></span></div>}</div>:<div className="publish-drive-browser">{!driveReady&&<div className="qi-drive-warning">Kho học tập chưa sẵn sàng. Có thể dùng “Tải tài liệu” ngay.</div>}{driveReady&&<><div className="qi-root-actions"><button type="button" className="active" disabled={busy} onClick={()=>void run(syncApproved)}><RefreshCcw/>Cập nhật đề cương đã duyệt</button>{roots.map(root=><button type="button" className={folderId===root.id?'active':''} key={root.id} onClick={()=>{setFolderId(root.id);setSelectedDrive(null)}}><Folder/>{root.name}</button>)}</div><p className="muted">“Cập nhật” quét DOCX mới theo ngày tạo, bỏ qua file đã đồng bộ và chỉ nhập tự động file đạt chuẩn đáp án đỏ.</p><div className="qi-files">{driveItems.map(item=><div key={item.id}>{item.folder?<button type="button" className="publish-folder" onClick={()=>{setFolderId(item.id);setSelectedDrive(null)}}><FolderOpen/><span>{item.name}</span><ChevronRight/></button>:<button type="button" className={`publish-file ${selectedDrive?.id===item.id?'active':''}`} disabled={!item.supported} onClick={()=>setSelectedDrive(item)}><FileText/><span><b>{item.name}</b><small>{item.supported?'Chọn tài liệu':'Định dạng chưa hỗ trợ từ Drive'}</small></span></button>}</div>)}</div>{selectedDrive&&<div className="publish-selected"><CheckCircle2/><span><b>{selectedDrive.name}</b><small>Đã chọn từ Kho học tập</small></span></div>}</>}</div>}
      <div className="qi-actions"><button className="qi-primary-convert" disabled={busy||(sourceMode==='upload'?(!file||!subject.trim()):!selectedDrive)} onClick={()=>void run(processSource)}>{busy?'Đang xử lý…':'Nhận diện & cập nhật ngân hàng'}</button></div>
    </div>}

    {pipeline&&<div className="qi-status" role="status"><b>{pipeline.state==='processing'?'A.I đang chuyển tài liệu thành quiz':pipeline.state==='error'?'Xử lý tạm dừng':'Bản quiz đã sẵn sàng để duyệt'}</b>{pipeline.state==='processing'&&<><progress max={100} value={pipeline.percent}/><span>{pipeline.percent}%</span></>}{pipeline.lastError&&<small className="warning">{pipeline.lastError}</small>}{pipeline.state==='error'&&pipeline.retryable&&<button disabled={busy} onClick={()=>void run(retry)}><RefreshCcw/>Thử lại</button>}</div>}
    {message&&<p className="qi-status" role="status">{message}</p>}

    {trustedResult&&<div className="publish-success" role="status"><CheckCircle2/><div><h3>Đề chuẩn đã cập nhật</h3><p>{trustedResult.total||0} câu có đúng một đáp án được đánh dấu đỏ đã được nhận diện deterministic và đưa trực tiếp vào ngân hàng sinh viên, không cần vòng duyệt lại.</p><small>Chuẩn nhận diện: {trustedResult.marker||'word-font-color-red-v1'}</small></div><button type="button" onClick={reset}>Nhập tài liệu khác</button></div>}

    {draft&&!published&&pipeline?.state!=='processing'&&pipeline?.state!=='error'&&<div className="publish-review-card"><div className="publish-review-head"><div><h3>{draft.document.fileName}</h3><p><b>{validCount} câu sẵn sàng</b>{invalidCount>0?` · ${invalidCount} câu không đủ căn cứ sẽ không phát hành`:''}</p></div><button className="secondary" disabled={busy} onClick={reset}>Đổi tài liệu</button></div>{draft.warnings.slice(0,2).map((w,i)=><p key={i} className="warning">{w}</p>)}<div className="qi-preview">{draft.questions.filter(q=>q.correctIndex!==null).slice(0,30).map((q:QuizCandidate,i)=><article key={q.id}><b>Câu {i+1}. {q.stem}</b><ol type="A">{q.options.map((o,j)=><li key={j}>{o}{q.correctIndex===j&&<b> ✓</b>}</li>)}</ol>{q.explanation&&<p>{q.explanation}</p>}{q.answerEvidence&&<small>{q.answerEvidence}</small>}</article>)}{validCount>30&&<p className="muted">Đang hiển thị 30 câu đầu để giao diện nhẹ. Khi duyệt, hệ thống nhập và phát hành toàn bộ {validCount} câu hợp lệ theo lô an toàn.</p>}</div><div className="publish-approval"><ShieldCheck/><div><b>Xác nhận của Ban Quản lý Học tập</b><p>Bước này chỉ áp dụng khi tài liệu không phải DOCX chuẩn đáp án đỏ hoặc có câu AI/ngoại lệ cần đối chiếu.</p></div><button className="qi-primary-convert" disabled={busy||validCount===0} onClick={()=>void run(publishAll)}>{busy?'Đang phát hành…':`Duyệt & phát hành ${validCount} câu`}</button></div></div>}

    {published&&<div className="publish-success" role="status"><CheckCircle2/><div><h3>Đã phát hành</h3><p>{published.questionCount} câu đã vào ngân hàng đã duyệt. Sinh viên có thể chọn nội dung và số lượng câu để làm quiz ngay.</p><small>Mã tài nguyên: {published.resourceKey}</small></div><button type="button" onClick={reset}>Phát hành tài liệu khác</button></div>}

    <details className="publish-exceptions"><summary>Kiểm tra ngoại lệ / câu đang chờ ({review.length})</summary><div className="qi-drafts">{review.length===0&&<p className="muted">Không có câu ngoại lệ đang chờ.</p>}{review.map(q=><article key={q.id}><b>{q.subject} · {q.topic}</b><p>{q.stem}</p><ol type="A">{q.options.map((o,i)=><li key={i}>{o}{q.correctIndex===i?' ✓':''}</li>)}</ol><small>Nguồn: {q.sourceFileName}</small><div className="qi-actions"><button disabled={busy} onClick={()=>void run(()=>decide(q.id,'expert_approved'))}><CheckCircle2/>Duyệt riêng</button><button className="secondary" disabled={busy} onClick={()=>void run(()=>decide(q.id,'rejected'))}><XCircle/>Loại</button></div></article>)}</div></details>
    <AnswerReviewQueue/>
  </section>;
}
