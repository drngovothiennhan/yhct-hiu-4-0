import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,BookOpenCheck,CheckCircle2,FolderOpen,RefreshCcw,ShieldCheck} from 'lucide-react';
import {syncQuizBank,type TrustedQuizSyncResult} from '../../services/quizWorkspaceService';
import AnswerReviewQueue from './AnswerReviewQueue';
import './quiz-import.css';

export default function LearningContentManagerPanel(){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[last,setLast]=useState<TrustedQuizSyncResult|null>(null),autoStarted=useRef(false);
  const update=async()=>{
    if(busy)return;setBusy(true);setMessage('Đang quét toàn bộ tài liệu trong “Thêm thủ công”, chuẩn hóa đáp án tô đỏ và đồng bộ chủ đề cho người học…');setLast(null);
    try{
      const result=await syncQuizBank(10);setLast(result);
      if(result.ok===false){setMessage('Drive ngân hàng đề thi chưa sẵn sàng. Kiểm tra kết nối hệ thống rồi bấm Cập nhật lại.');return}
      const processed=result.processed||[],qualified=processed.filter(x=>x.ok),skipped=processed.filter(x=>!x.ok&&x.status!=='error'),errors=processed.filter(x=>x.status==='error'),questions=qualified.reduce((sum,x)=>sum+Number(x.inserted||0)+Number(x.updated||0),0);
      setMessage(processed.length===0?'Đã đồng bộ chủ đề. Không còn tài liệu mới cần chuyển đổi.':`Cập nhật xong · ${processed.length} tài liệu đã quét · ${questions} câu đã đưa vào ngân hàng người dùng${skipped.length?` · ${skipped.length} tài liệu chưa nhận diện đủ 4 lựa chọn/đáp án đỏ`:''}${errors.length?` · ${errors.length} lỗi cần thử lại`:''}.`);
    }catch(error){setMessage((error as Error).message||'Không thể cập nhật ngân hàng đề thi.')}finally{setBusy(false)}
  };
  useEffect(()=>{if(autoStarted.current)return;autoStarted.current=true;void update()},[]);
  const qualified=(last?.processed||[]).filter(x=>x.ok).length,skipped=(last?.processed||[]).filter(x=>!x.ok&&x.status!=='error').length,errors=(last?.processed||[]).filter(x=>x.status==='error').length;
  const subjects=Array.isArray(last?.subjects)?last.subjects:[];
  return <section className="panel quiz-import publish-center-v2 quiz-bank-manager" aria-label="Ngân hàng đề thi">
    <div className="qi-heading qi-heading--compact"><div><span className="qi-kicker"><ShieldCheck/>QUẢN LÝ HỌC TẬP</span><h2>Ngân hàng đề thi</h2></div><BookOpenCheck/></div>
    <div className="quiz-bank-update-card quiz-bank-canonical">
      <div className="quiz-bank-update-main"><FolderOpen/><div><b>Thêm thủ công → tự chuyển đổi → dùng ngay</b><small>Hệ thống quét toàn bộ cây thư mục. Thư mục môn cấp 1 là chủ đề người học nhìn thấy; tài liệu trong các thư mục con vẫn được đưa về đúng chủ đề. Hỗ trợ DOCX và Google Docs bằng cách chuẩn hóa về DOCX nội bộ trước khi nhận diện.</small></div><button type="button" className="qi-primary-convert quiz-bank-update-button" disabled={busy} onClick={()=>void update()}><RefreshCcw className={busy?'spin':''}/>{busy?'Đang cập nhật…':'Cập nhật lại'}</button></div>
      <div className="quiz-bank-rule"><CheckCircle2/><span><b>Định dạng đáp án được tự chuẩn hóa</b><small>Mỗi câu cần đủ A–D và đúng một phương án được tô đỏ. Các sắc đỏ phổ biến, chữ đỏ hoặc highlight đỏ được quy về một định dạng chung trước khi nhập; câu hợp lệ được đưa ngay vào ngân hàng người dùng.</small></span></div>
      {subjects.length>0&&<div className="quiz-bank-subjects"><b>Chủ đề đã đồng bộ cho Learning Hub</b><div>{subjects.map(subject=><span key={subject}>{subject}</span>)}</div></div>}
      {message&&<p className="qi-status" role="status">{message}</p>}
      {last&&<div className="quiz-bank-update-stats"><span><b>{qualified}</b> tệp đạt chuẩn</span><span><b>{skipped}</b> tệp bỏ qua</span><span><b>{errors}</b> lỗi</span><span><b>{Number(last.remaining||0)}</b> còn lại</span></div>}
      {errors>0&&<p className="warning"><AlertTriangle/> Có lỗi vận chuyển/đọc Drive. Bấm Cập nhật lại; tệp lỗi chưa được đánh dấu đã xử lý.</p>}
    </div>
    <details className="quiz-bank-secondary"><summary>Phản hồi đáp án từ người học</summary><AnswerReviewQueue/></details>
  </section>;
}
