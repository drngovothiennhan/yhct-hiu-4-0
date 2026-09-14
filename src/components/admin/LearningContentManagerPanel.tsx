import {useState} from 'react';
import {AlertTriangle,BookOpenCheck,CheckCircle2,FolderOpen,RefreshCcw,ShieldCheck} from 'lucide-react';
import {syncQuizBank,type TrustedQuizSyncResult} from '../../services/quizWorkspaceService';
import AnswerReviewQueue from './AnswerReviewQueue';
import './quiz-import.css';

export default function LearningContentManagerPanel(){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[last,setLast]=useState<TrustedQuizSyncResult|null>(null);
  const update=async()=>{
    if(busy)return;setBusy(true);setMessage('Đang quét DOCX mới trong “Thêm thủ công” và các thư mục môn bên trong…');setLast(null);
    try{
      const result=await syncQuizBank(10);setLast(result);
      if(result.ok===false){setMessage('Drive ngân hàng đề thi chưa sẵn sàng. Kiểm tra kết nối hệ thống rồi bấm Cập nhật lại.');return}
      const processed=result.processed||[],qualified=processed.filter(x=>x.ok),skipped=processed.filter(x=>!x.ok&&x.status!=='error'),errors=processed.filter(x=>x.status==='error'),questions=qualified.reduce((sum,x)=>sum+Number(x.inserted||0)+Number(x.updated||0),0);
      setMessage(processed.length===0?'Không có tệp DOCX mới cần cập nhật.':`Cập nhật xong · ${processed.length} tệp mới đã quét · ${questions} câu đã đưa vào ngân hàng người dùng${skipped.length?` · ${skipped.length} tệp không đúng chuẩn đáp án tô đỏ`:''}${errors.length?` · ${errors.length} lỗi cần thử lại`:''}.`);
    }catch(error){setMessage((error as Error).message||'Không thể cập nhật ngân hàng đề thi.')}finally{setBusy(false)}
  };
  const qualified=(last?.processed||[]).filter(x=>x.ok).length,skipped=(last?.processed||[]).filter(x=>!x.ok&&x.status!=='error').length,errors=(last?.processed||[]).filter(x=>x.status==='error').length;
  const subjects=Array.isArray(last?.subjects)?last.subjects:[];
  return <section className="panel quiz-import publish-center-v2 quiz-bank-manager" aria-label="Ngân hàng đề thi">
    <div className="qi-heading qi-heading--compact"><div><span className="qi-kicker"><ShieldCheck/>QUẢN LÝ HỌC TẬP</span><h2>Ngân hàng đề thi</h2></div><BookOpenCheck/></div>
    <div className="quiz-bank-update-card quiz-bank-canonical">
      <div className="quiz-bank-update-main"><FolderOpen/><div><b>Thêm thủ công → Cập nhật → dùng ngay</b><small>Quét DOCX mới đặt trực tiếp trong “Thêm thủ công” hoặc trong một thư mục môn ngay bên trong. Tên thư mục môn là nội dung người học nhìn thấy; tên tệp DOCX chỉ là dấu vết quản trị và không hiển thị cho thành viên.</small></div><button type="button" className="qi-primary-convert quiz-bank-update-button" disabled={busy} onClick={()=>void update()}><RefreshCcw className={busy?'spin':''}/>{busy?'Đang cập nhật…':'Cập nhật'}</button></div>
      <div className="quiz-bank-rule"><CheckCircle2/><span><b>Định dạng chuẩn bắt buộc</b><small>Mỗi câu có đủ A–D và đúng một phương án được tô đỏ trong Word. Câu đạt chuẩn được đưa ngay vào ngân hàng; câu không đạt bị bỏ qua, không chặn các câu/tệp hợp lệ khác.</small></span></div>
      {subjects.length>0&&<div className="quiz-bank-subjects"><b>Nội dung Drive đã nhận diện</b><div>{subjects.map(subject=><span key={subject}>{subject}</span>)}</div></div>}
      {message&&<p className="qi-status" role="status">{message}</p>}
      {last&&<div className="quiz-bank-update-stats"><span><b>{qualified}</b> tệp đạt chuẩn</span><span><b>{skipped}</b> tệp bỏ qua</span><span><b>{errors}</b> lỗi</span><span><b>{Number(last.remaining||0)}</b> còn lại</span></div>}
      {errors>0&&<p className="warning"><AlertTriangle/> Có lỗi vận chuyển/đọc Drive. Bấm Cập nhật lại; tệp lỗi chưa được đánh dấu đã xử lý.</p>}
    </div>
    <details className="quiz-bank-secondary"><summary>Phản hồi đáp án từ người học</summary><AnswerReviewQueue/></details>
  </section>;
}
