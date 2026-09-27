import {useEffect,useMemo,useState} from 'react';
import {BookOpen,CheckCircle2,LoaderCircle,Sparkles} from 'lucide-react';
import {getTodayDailyReview,submitTodayDailyReview,type DailyReview,type DailyReviewResult} from '../../services/dailyStudyReviewService';
import './daily-study-review.css';

type Props={memberId:string|null};
const sourceUrl=(fileId:string)=>`https://drive.google.com/open?id=${encodeURIComponent(fileId)}`;

export default function DailyStudyReview({memberId}:Props){
  const [review,setReview]=useState<DailyReview|null>(null);
  const [selected,setSelected]=useState<Record<string,number>>({});
  const [result,setResult]=useState<DailyReviewResult|null>(null);
  const [loading,setLoading]=useState(Boolean(memberId));
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    let alive=true;
    setReview(null);setSelected({});setResult(null);setError('');
    if(!memberId){setLoading(false);return()=>{alive=false}};
    setLoading(true);
    void getTodayDailyReview().then(value=>{if(alive)setReview(value)}).catch(reason=>{if(alive)setError(reason instanceof Error?reason.message:'Không thể tải dữ liệu ôn tập.')}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[memberId]);

  const questions=review?.questions||[];
  const completedCount=useMemo(()=>questions.filter(question=>question.status==='answered').length,[questions]);
  const alreadyDone=Boolean(review?.status==='completed');

  const submit=async()=>{
    if(submitting||questions.length<3||questions.some(question=>question.status==='pending'&&selected[question.id]===undefined))return;
    setSubmitting(true);setError('');
    try{
      const pending=questions.filter(question=>question.status==='pending');
      if(pending.length){
        const next=await submitTodayDailyReview(pending.map(question=>({questionId:question.id,selectedIndex:selected[question.id]})));
        setResult(next);
      }
      const refreshed=await getTodayDailyReview();setReview(refreshed);
    }catch(reason){setError(reason instanceof Error?reason.message:'Không nộp được bài ôn tập. Hãy thử lại.')}finally{setSubmitting(false)}
  };

  return <section className="study-os-v2__daily-review" aria-label="Ôn tập hôm nay">
    <header className="study-os-v2__daily-review-head">
      <div className="study-os-v2__daily-review-icon"><Sparkles aria-hidden="true"/></div>
      <div><span>ÔN TẬP HÔM NAY</span><h3>Kiểm tra nhanh nội dung đã học</h3><p>Chỉ dùng câu nguồn đã được duyệt trong Study OS. Không có dữ liệu nguồn thì không tạo câu hỏi.</p></div>
      {review?.hasQuiz&&<b>{completedCount}/{questions.length} câu</b>}
    </header>

    {loading&&<p className="study-os-v2__daily-review-state" role="status"><LoaderCircle className="is-spinning"/> Đang tải bài ôn hôm nay…</p>}
    {!loading&&!memberId&&<p className="study-os-v2__daily-review-state">Đăng nhập thành viên để xem bài ôn được tạo từ nội dung bạn đã học.</p>}
    {!loading&&memberId&&!review?.hasQuiz&&!error&&<p className="study-os-v2__daily-review-state">{review?.hasEligibleSource?'Bài ôn hôm nay chưa có đủ câu hỏi vượt qua kiểm tra nguồn. Hệ thống sẽ không hiển thị câu chưa được xác thực.':'Chưa có lượt ôn nội dung nguồn được duyệt trong 30 ngày gần đây. Khi có dữ liệu học thật, Study OS mới tạo bài ôn.'}</p>}
    {error&&<p className="study-os-v2__daily-review-error" role="alert">{error}</p>}

    {!loading&&questions.length>0&&<div className="study-os-v2__daily-review-list">
      {questions.map((question,index)=>{
        const answer=question.status==='answered'?question.isCorrect:selected[question.id]===Number(question.options.findIndex(option=>option===question.correctAnswer));
        const selectedIndex=question.status==='answered'?Number(question.userAnswer?.selectedIndex):selected[question.id];
        return <article className="study-os-v2__daily-question" key={question.id}>
          <div className="study-os-v2__daily-question-title"><b>Câu {index+1}</b><p>{question.stem}</p></div>
          <fieldset disabled={question.status==='answered'||submitting}>
            <legend className="sr-only">Chọn đáp án cho câu {index+1}</legend>
            {question.options.map((option,optionIndex)=><label key={`${question.id}-${optionIndex}`} className={selectedIndex===optionIndex?'is-selected':''}>
              <input type="radio" name={`daily-review-${question.id}`} value={optionIndex} checked={selectedIndex===optionIndex} onChange={()=>setSelected(current=>({...current,[question.id]:optionIndex}))}/>
              <span>{option}</span>
            </label>)}
          </fieldset>
          {question.status==='answered'&&<div className={`study-os-v2__daily-feedback ${answer?'is-correct':'is-incorrect'}`}>
            <b>{answer?'Đúng':'Chưa đúng'} · Đáp án: {question.correctAnswer}</b>
            {question.explanation&&<p>{question.explanation}</p>}
            {question.evidenceQuote&&<blockquote>Đoạn nguồn: “{question.evidenceQuote}”</blockquote>}
          </div>}
          <a className="study-os-v2__daily-source" href={sourceUrl(question.sourceFileId)} target="_blank" rel="noopener noreferrer"><BookOpen aria-hidden="true"/> Xem lại bài học gốc <span>· {question.sourceTitle}</span></a>
        </article>;
      })}
      {!alreadyDone&&<div className="study-os-v2__daily-submit-row"><p>{questions.length-completedCount} câu còn lại</p><button type="button" onClick={()=>void submit()} disabled={submitting||questions.some(question=>question.status==='pending'&&selected[question.id]===undefined)}>{submitting?<><LoaderCircle className="is-spinning"/> Đang chấm…</>:<><CheckCircle2/> Nộp và xem đáp án</>}</button></div>}
      {alreadyDone&&<p className="study-os-v2__daily-complete" role="status">Đã hoàn thành bài ôn hôm nay{result?` · ${result.correctCount}/${result.total} câu đúng`:''}.</p>}
    </div>}
  </section>;
}
