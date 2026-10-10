import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import {approveAiDrafts} from '../../services/quizWorkspaceService';

/** Quản trị viên xác nhận hàng loạt bản nháp AI (claude-draft) đang chờ duyệt. Chỉ chạy sau khi bấm và xác nhận. */
export default function AiDraftApproval(){
  const [busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const run=async()=>{
    if(!window.confirm('Xác nhận duyệt TẤT CẢ bản nháp AI đang chờ (tiền tố claude-draft)? Sau khi duyệt, các câu sẽ hiển thị cho học viên.'))return;
    setBusy(true);setMsg('');
    try{const res=await approveAiDrafts();setMsg(`Đã duyệt ${res.approved} câu bản nháp AI.`)}
    catch(error){setMsg((error as Error).message||'Không duyệt được bản nháp AI.')}
    finally{setBusy(false)}
  };
  return <section className="quiz-bank-secondary ai-draft-approval">
    <p><small><Sparkles/> Bản nháp AI do Claude soạn (250 câu, 10 môn) đang chờ quản trị viên xác nhận.</small></p>
    <button type="button" disabled={busy} onClick={()=>void run()}>Duyệt toàn bộ bản nháp AI</button>
    {msg&&<p className="qi-status" role="status">{msg}</p>}
  </section>;
}
