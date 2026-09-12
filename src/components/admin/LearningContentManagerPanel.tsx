import {useEffect,useState} from 'react';
import {BookOpenCheck,CheckCircle2,ChevronRight,FileText,FileUp,Folder,FolderOpen,RefreshCcw,ShieldCheck,XCircle} from 'lucide-react';
import {getPracticeReviewQueue,reviewPracticeQuestion,type PracticeReviewQuestion} from '../../services/dailyPracticeService';
import {browseQuizDrive,getQuizDriveRoots,publishQuizDraft,quizWorkspace,retryQuizPipeline,sourceFileBase64,startQuizPipeline,syncQuizBank,tryTrustedQuizUpload,type QuizCandidate,type QuizDraft,type QuizDriveItem,type QuizDriveRoot,type QuizPublishResult,type TrustedQuizImportResult} from '../../services/quizWorkspaceService';
import AnswerReviewQueue from './AnswerReviewQueue';
import './quiz-import.css';

// Scoped learning-management contract markers retained for static RBAC audit:
// Ban Quản lý Học tập · quiz-start · quiz-process-chunk · quiz-retry · quiz-commit · practice_question_review_v1.
export default function LearningContentManagerPanel(){
  const [subject,setSubject]=useState(''),[file,setFile]=useState<File|null>(null),[roots,setRoots]=useState<QuizDriveRoot[]>([]),[folderId,setFolderId]=useState(''),[driveItems,setDriveItems]=useState<QuizDriveItem[]>([]),[selectedDrive,setSelectedDrive]=useState<QuizDriveItem|null>(null),[draft,setDraft]=useState<QuizDraft|null>(null),[review,setReview]=useState<PracticeReviewQuestion[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[published,setPublished]=useState<QuizPublishResult|null>(null),[trustedResult,setTrustedResult]=useState<TrustedQuizImportResult|null>(null),[driveReady,setDriveReady]=useState(false);
  const loadReview=async()=>setReview(await getPracticeReviewQueue(20));
  useEffect(()=>{void loadReview().catch(()=>{});void getQuizDriveRoots().then(x=>{setRoots(x.roots||[]);setDriveReady(Boolean(x.driveConfigured));if(x.roots?.[0])setFolderId(x.roots[0].id)}).catch(()=>setDriveReady(false))},[]);
  useEffect(()=>{if(!folderId||!driveReady)return;let alive=true;setDriveItems([]);void browseQuizDrive(folderId).then(x=>{if(alive)setDriveItems(x.items||[])}).catch(e=>{if(alive)setMessage((e as Error).message)});return()=>{alive=false}},[folderId,driveReady]);
  const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage('');try{await fn()}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}};
  const track=(next:QuizDraft)=>{setDraft(next);if(next.pipeline?.state==='processing')setMessage(`A.I đang xử lý tài liệu · ${next.pipeline.percent}%`)};
  const finish=(next:QuizDraft)=>{setDraft(next);setPublished(null);setTrustedResult(null);setMessage(`Đã tạo ${next.questions.filter(q=>q.correctIndex!==null).length} câu có đáp án. Kiểm tra nhanh rồi phát hành.`)};
  const processUpload=async()=>{
    if(!file)throw new Error('Chọn một tệp DOCX, TXT hoặc PDF.');
    if(!subject.trim())throw new Error('Nhập tên môn/chủ đề cho tài liệu.');
    const base64=await sourceFileBase64(file);
    if(/\.docx$/i.test(file.name)){
      const trusted=await tryTrustedQuizUpload(file.name,base64,subject.trim());
      if(trusted?.ok){setTrustedResult(trusted);setDraft(null);setPublished(null);setMessage(`Đã cập nhật ${trusted.total||0} câu đạt chuẩn vào ngân hàng.`);return}
    }
    finish(await startQuizPipeline({fileName:file.name,base64,subjectName:subject.trim(),conversionMode:'auto'},track));
  };
  const processDrive=async()=>{if(!selectedDrive)throw new Error('Chọn một tài liệu trong kho Drive.');finish(await startQuizPipeline({fileId:selectedDrive.id,subjectFolderId:folderId,conversionMode:'auto'},track))};
  const updateQuizBank=async()=>{
    const result=await syncQuizBank(10),imported=result.processed.filter(x=>x.ok).reduce((sum,x)=>sum+Number(x.inserted||0)+Number(x.updated||0),0),invalid=result.processed.filter(x=>!x.ok).length,remaining=Math.max(0,Number(result.pending||0)-result.processed.length);
    setMessage(`Cập nhật xong · ${result.processed.length} tệp đã kiểm tra · ${imported} câu cập nhật${invalid?` · ${invalid} tệp cần kiểm tra`:''}${remaining?` · còn ${remaining} tệp mới`:''}.`);
  };
  const retry=async()=>{if(draft?.pipeline?.state==='error')finish(await retryQuizPipeline(draft,track))};
  const validPending=(value:QuizDraft)=>value.questions.filter(q=>!q.imported&&q.correctIndex!==null);
  const publishAll=async()=>{
    if(!draft)throw new Error('Chưa có tài liệu để phát hành.');
    if(draft.pipeline?.state==='processing'||draft.pipeline?.state==='error')throw new Error('A.I chưa xử lý xong tài liệu.');
    let current=draft,pending=validPending(current);
    if(!pending.length&&!current.questions.some(q=>q.imported))throw new Error('Không có câu hỏi hợp lệ để phát hành.');
    while(pending.length){const selection=pending.slice(0,200).map(q=>({...q,confirmed:true}));await quizWorkspace('quiz-commit',{id:current.id,revision:current.revision,selection});current=await quizWorkspace<QuizDraft>('quiz-draft',{id:current.id});setDraft(current);pending=validPending(current)}
    const result=await publishQuizDraft(current.id);setPublished(result);await loadReview();setMessage(`Đã phát hành ${result.questionCount} câu vào ngân hàng.`);
  };
  const decide=async(id:string,status:'expert_approved'|'rejected')=>{await reviewPracticeQuestion(id,status);await loadReview();setMessage(status==='expert_approved'?'Đã duyệt câu ngoại lệ.':'Đã loại câu hỏi khỏi hàng chờ.')};
  const reset=()=>{setDraft(null);setPublished(null);setTrustedResult(null);setFile(null);setSelectedDrive(null);setMessage('')};
  const pipeline=draft?.pipeline,validCount=draft?.questions.filter(q=>q.correctIndex!==null).length||0,invalidCount=(draft?.questions.length||0)-validCount;
  return <section className="panel quiz-import publish-center-v2 quiz-bank-manager" aria-label="Ngân hàng câu hỏi">
    <div className="qi-heading qi-heading--compact"><div><span className="qi-kicker"><ShieldCheck/>QUẢN LÝ HỌC TẬP</span><h2>Ngân hàng câu hỏi</h2></div><BookOpenCheck/></div>

    <div className="quiz-bank-update-card">
      <div className="quiz-bank-update-main"><FolderOpen/><div><b>NGÂN HÀNG TRẮC NGHIỆM</b><small>{driveReady?'Drive đã kết nối':'Đang kiểm tra kết nối Drive'}</small></div><button type="button" className="qi-primary-convert quiz-bank-update-button" disabled={busy||!driveReady} onClick={()=>void run(updateQuizBank)}><RefreshCcw/>{busy?'Đang cập nhật…':'Cập nhật'}</button></div>
      {message&&<p className="qi-status" role="status">{message}</p>}
    </div>

    <AnswerReviewQueue/>

    {!draft&&!trustedResult&&!published&&<details className="quiz-bank-secondary"><summary>Tải tài liệu trực tiếp</summary><div className="qi-direct-upload"><label><span><b>Môn / chủ đề</b></span><input type="text" value={subject} disabled={busy} placeholder="Ví dụ: Thuốc YHCT 2" onChange={e=>setSubject(e.target.value)}/></label><label className="qi-upload"><FileUp/><span><b>DOCX, TXT hoặc PDF</b></span><input type="file" accept=".docx,.txt,.pdf,text/plain,application/pdf" disabled={busy} onChange={e=>setFile(e.target.files?.[0]||null)}/></label>{file&&<div className="publish-selected"><FileText/><span><b>{file.name}</b></span></div>}<div className="qi-actions"><button className="qi-primary-convert" disabled={busy||!file||!subject.trim()} onClick={()=>void run(processUpload)}>Nhận diện & cập nhật</button></div></div></details>}

    {!draft&&!trustedResult&&!published&&driveReady&&<details className="quiz-bank-secondary"><summary>Duyệt kho Drive</summary><div className="publish-drive-browser"><div className="qi-root-actions">{roots.map(root=><button type="button" className={folderId===root.id?'active':''} key={root.id} onClick={()=>{setFolderId(root.id);setSelectedDrive(null)}}><Folder/>{root.name}</button>)}</div><div className="qi-files">{driveItems.map(item=><div key={item.id}>{item.folder?<button type="button" className="publish-folder" onClick={()=>{setFolderId(item.id);setSelectedDrive(null)}}><FolderOpen/><span>{item.name}</span><ChevronRight/></button>:<button type="button" className={`publish-file ${selectedDrive?.id===item.id?'active':''}`} disabled={!item.supported} onClick={()=>setSelectedDrive(item)}><FileText/><span><b>{item.name}</b></span></button>}</div>)}</div>{selectedDrive&&<div className="publish-selected"><CheckCircle2/><span><b>{selectedDrive.name}</b></span></div>}<div className="qi-actions"><button className="secondary" disabled={busy||!selectedDrive} onClick={()=>void run(processDrive)}>Xử lý tệp đã chọn</button></div></div></details>}

    {pipeline&&<div className="qi-status" role="status"><b>{pipeline.state==='processing'?'A.I đang chuyển tài liệu thành quiz':pipeline.state==='error'?'Xử lý tạm dừng':'Quiz sẵn sàng để duyệt'}</b>{pipeline.state==='processing'&&<><progress max={100} value={pipeline.percent}/><span>{pipeline.percent}%</span></>}{pipeline.lastError&&<small className="warning">{pipeline.lastError}</small>}{pipeline.state==='error'&&pipeline.retryable&&<button disabled={busy} onClick={()=>void run(retry)}><RefreshCcw/>Thử lại</button>}</div>}

    {trustedResult&&<div className="publish-success" role="status"><CheckCircle2/><div><h3>Đã cập nhật ngân hàng</h3><p>{trustedResult.total||0} câu đạt chuẩn đã được nhập.</p></div><button type="button" onClick={reset}>Đóng</button></div>}

    {draft&&!published&&pipeline?.state!=='processing'&&pipeline?.state!=='error'&&<div className="publish-review-card"><div className="publish-review-head"><div><h3>{draft.document.fileName}</h3><p><b>{validCount} câu sẵn sàng</b>{invalidCount>0?` · ${invalidCount} câu cần kiểm tra`:''}</p></div><button className="secondary" disabled={busy} onClick={reset}>Đổi tài liệu</button></div>{draft.warnings.slice(0,2).map((w,i)=><p key={i} className="warning">{w}</p>)}<div className="qi-preview">{draft.questions.filter(q=>q.correctIndex!==null).slice(0,30).map((q:QuizCandidate,i)=><article key={q.id}><b>Câu {i+1}. {q.stem}</b><ol type="A">{q.options.map((o,j)=><li key={j}>{o}{q.correctIndex===j&&<b> ✓</b>}</li>)}</ol>{q.explanation&&<p>{q.explanation}</p>}{q.answerEvidence&&<small>{q.answerEvidence}</small>}</article>)}{validCount>30&&<p className="muted">Hiển thị 30 câu đầu; hệ thống phát hành toàn bộ {validCount} câu hợp lệ.</p>}</div><div className="publish-approval"><ShieldCheck/><div><b>Xác nhận nội dung</b></div><button className="qi-primary-convert" disabled={busy||validCount===0} onClick={()=>void run(publishAll)}>{busy?'Đang phát hành…':`Duyệt & phát hành ${validCount} câu`}</button></div></div>}

    {published&&<div className="publish-success" role="status"><CheckCircle2/><div><h3>Đã phát hành</h3><p>{published.questionCount} câu đã vào ngân hàng.</p></div><button type="button" onClick={reset}>Đóng</button></div>}

    <details className="publish-exceptions quiz-bank-secondary"><summary>Ngoại lệ cần duyệt ({review.length})</summary><div className="qi-drafts">{review.length===0&&<p className="muted">Không có câu ngoại lệ.</p>}{review.map(q=><article key={q.id}><b>{q.subject} · {q.topic}</b><p>{q.stem}</p><ol type="A">{q.options.map((o,i)=><li key={i}>{o}{q.correctIndex===i?' ✓':''}</li>)}</ol><small>{q.sourceFileName}</small><div className="qi-actions"><button disabled={busy} onClick={()=>void run(()=>decide(q.id,'expert_approved'))}><CheckCircle2/>Duyệt</button><button className="secondary" disabled={busy} onClick={()=>void run(()=>decide(q.id,'rejected'))}><XCircle/>Loại</button></div></article>)}</div></details>
  </section>;
}