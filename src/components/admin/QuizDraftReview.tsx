import {useCallback,useEffect,useState} from 'react';
import {Sparkles} from 'lucide-react';
import {commitQuizDraft,continueQuizPipeline,getQuizDraft,listQuizDrafts,type QuizCandidate,type QuizDraft,type QuizDraftSummary} from '../../services/quizWorkspaceService';

/** Bản nháp trắc nghiệm do hệ thống tự nhận diện/AI tạo. Chỉ vào ngân hàng sau khi quản lý xác nhận từng câu. */
export default function QuizDraftReview(){
  const [drafts,setDrafts]=useState<QuizDraftSummary[]>([]),[open,setOpen]=useState<QuizDraft|null>(null),[picked,setPicked]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const refresh=useCallback(async()=>{try{setDrafts((await listQuizDrafts()).filter(d=>Number(d.pending)>0||d.pipelineState==='processing'||d.pipelineState==='error'))}catch{setDrafts([])}},[]);
  useEffect(()=>{void refresh()},[refresh]);
  const load=async(id:string)=>{setBusy(true);setMsg('');try{let draft=await getQuizDraft(id);if(draft.pipeline?.state==='processing'){setMsg('Đang tạo tiếp các phần còn lại…');draft=await continueQuizPipeline(draft,d=>setOpen(d))}setOpen(draft);setPicked({})}catch(error){setMsg((error as Error).message||'Không mở được bản nháp.')}finally{setBusy(false)}};
  const pending=(open?.questions||[]).filter(q=>!q.imported&&Number.isInteger(q.correctIndex)&&(q.correctIndex as number)>=0&&(q.correctIndex as number)<=3);
  const chosen=pending.filter(q=>picked[q.id]);
  const commit=async()=>{if(!open||!chosen.length)return;setBusy(true);setMsg('');try{const res=await commitQuizDraft(open,chosen.slice(0,200).map(q=>({id:q.id,confirmed:true as const})));setMsg(`Đã nhập ${Number(res.inserted||0)+Number(res.updated||0)} câu vào ngân hàng.`);setOpen(await getQuizDraft(open.id));setPicked({});void refresh()}catch(error){setMsg((error as Error).message||'Không nhập được.')}finally{setBusy(false)}};
  if(!drafts.length&&!open)return null;
  return <details className="quiz-bank-secondary quiz-draft-review" open={drafts.length>0}>
    <summary><Sparkles/> Bản nháp chờ duyệt ({drafts.length})</summary>
    <p><small>Hệ thống tự nhận diện tài liệu chưa có đáp án tô đỏ và tạo câu trắc nghiệm nháp kèm dẫn chứng. Câu chỉ vào ngân hàng sau khi bạn đối chiếu và tích chọn.</small></p>
    {!open&&<div className="qi-drafts">{drafts.map(d=><div key={d.id}><b>{d.fileName||d.id.slice(0,8)}</b> <small>{d.subject} · {d.pending}/{d.total} câu chờ{d.pipelineState==='processing'?' · đang tạo dở':''}</small> <button type="button" disabled={busy} onClick={()=>void load(d.id)}>Mở</button></div>)}</div>}
    {open&&<div className="qi-preview">
      <button type="button" onClick={()=>{setOpen(null);void refresh()}}>← Danh sách</button>
      <h3>{open.document.fileName} · {open.document.subjectHint}</h3>
      {pending.length>0&&<div className="qi-actions"><button type="button" onClick={()=>setPicked(Object.fromEntries(pending.map(q=>[q.id,true])))}>Chọn tất cả sau khi đã đối chiếu</button><button type="button" onClick={()=>setPicked({})}>Bỏ chọn</button></div>}
      {pending.slice(0,200).map((q:QuizCandidate)=><article key={q.id}>
        <label><input type="checkbox" checked={Boolean(picked[q.id])} onChange={e=>setPicked(p=>({...p,[q.id]:e.target.checked}))}/> <b>{q.stem}</b></label>
        <ol type="A">{q.options.map((o,i)=><li key={i}>{o}{i===q.correctIndex?' ✓':''}</li>)}</ol>
        {q.explanation&&<small>Giải thích: {q.explanation}</small>}
        {q.answerEvidence&&<small>Dẫn chứng: {q.answerEvidence}</small>}
        {q.issues?.length>0&&<p className="warning">{q.issues.join(' · ')}</p>}
      </article>)}
      {pending.length===0&&<p className="qi-status">Không còn câu chờ duyệt trong bản nháp này.</p>}
      <button type="button" className="qi-primary-convert" disabled={busy||!chosen.length} onClick={()=>void commit()}>Nhập {chosen.length} câu đã chọn vào ngân hàng</button>
    </div>}
    {msg&&<p className="qi-status" role="status">{msg}</p>}
  </details>;
}
