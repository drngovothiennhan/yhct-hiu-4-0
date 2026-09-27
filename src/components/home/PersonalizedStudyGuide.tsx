import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BookOpen,Clock3,LoaderCircle,RotateCcw,Sparkles} from 'lucide-react';
import {getStudyPersonalization,type StudyPersonalization} from '../../services/studyPersonalizationService';
import {buildStudySummaryText} from '../../services/studyPersonalizationSummary';
import './personalized-study-guide.css';

type Props={memberId:string|null;onOpenLesson:(sectionId?:string)=>void;onOpenReview:()=>void;onLogin:()=>void};
const sourceUrl=(fileId:string)=>`https://drive.google.com/open?id=${encodeURIComponent(fileId)}`;
const localDate=(value:string)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'chưa xác định':new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium',timeZone:'Asia/Ho_Chi_Minh'}).format(date);
};
export default function PersonalizedStudyGuide({memberId,onOpenLesson,onOpenReview,onLogin}:Props){
  const [data,setData]=useState<StudyPersonalization|null>(null);
  const [loading,setLoading]=useState(Boolean(memberId));
  const [error,setError]=useState('');
  useEffect(()=>{
    let alive=true,generation=0;
    setData(null);setError('');
    if(!memberId){setLoading(false);return()=>{alive=false}};
    const load=()=>{
      const current=++generation;
      setError('');
      setLoading(true);
      void getStudyPersonalization().then(value=>{if(alive&&current===generation)setData(value)}).catch(reason=>{if(alive&&current===generation)setError(reason instanceof Error?reason.message:'Không thể tải dữ liệu cá nhân hóa.')}).finally(()=>{if(alive&&current===generation)setLoading(false)});
    };
    load();
    window.addEventListener('yhct:review',load);
    window.addEventListener('yhct:learning-cloud-restored',load);
    return()=>{alive=false;window.removeEventListener('yhct:review',load);window.removeEventListener('yhct:learning-cloud-restored',load)};
  },[memberId]);
  const summary=useMemo(()=>data?buildStudySummaryText(data):null,[data]);
  const recommendation=data?.recommendation;

  return <section className="study-personalization" aria-labelledby="study-personalization-title">
    <header className="study-personalization__head">
      <div className="study-personalization__icon"><Sparkles aria-hidden="true"/></div>
      <div><span>HỌC TẬP CÁ NHÂN HÓA</span><h3 id="study-personalization-title">Hôm nay nên ôn gì?</h3><p>Gợi ý tính từ tiến độ bài học và kết quả quiz đã lưu trong tài khoản của bạn.</p></div>
      {data?.generatedFor&&<small>{localDate(`${data.generatedFor}T12:00:00+07:00`)}</small>}
    </header>
    {loading&&<p className="study-personalization__state" role="status"><LoaderCircle className="is-spinning"/> Đang đọc tiến độ học tập…</p>}
    {!loading&&!memberId&&<p className="study-personalization__state">Đăng nhập thành viên để cá nhân hóa gợi ý theo tiến độ của bạn. <button type="button" onClick={onLogin}>Đăng nhập</button></p>}
    {error&&<p className="study-personalization__error" role="alert">{error}</p>}
    {!loading&&memberId&&!error&&data&&<>
      {summary?<div className="study-personalization__summary" aria-live="polite">{summary.map((line,index)=><p key={index}>{line}</p>)}</div>:<p className="study-personalization__state">Chưa có đủ kết quả quiz để xác định chủ đề cần ôn. Khi bạn hoàn thành quiz hoặc lưu tiến độ bài học, gợi ý sẽ dựa trên dữ liệu đó.</p>}
      {recommendation&&<div className="study-personalization__next">
        <div><span>GỢI Ý TIẾP THEO</span><b>{recommendation.label}</b>
          {recommendation.kind==='resume_lesson'&&<small><Clock3 aria-hidden="true"/> Đã học {Math.floor((recommendation.activeSeconds||0)/60)} phút · tiếp tục từ {recommendation.progressPct||0}%</small>}
          {recommendation.kind==='review_weak_topic'&&<small>{recommendation.subject} · {recommendation.topic} · {Math.round(recommendation.accuracyPct||0)}% chính xác</small>}
          {recommendation.kind==='standard_lesson'&&<small>Lộ trình mặc định hiện chỉ có bài học này trong Study OS.</small>}
          {recommendation.kind==='curriculum_missing'&&<small>Bạn đã hoàn thành bài học hiện có. Chưa có nội dung tiếp theo được khai báo trong lộ trình.</small>}
        </div>
        {recommendation.kind==='resume_lesson'&&<button type="button" onClick={()=>onOpenLesson(recommendation.sectionId)}><RotateCcw aria-hidden="true"/> Tiếp tục</button>}
        {recommendation.kind==='standard_lesson'&&<button type="button" onClick={()=>onOpenLesson('overview')}><BookOpen aria-hidden="true"/> Bắt đầu bài học</button>}
        {recommendation.kind==='review_weak_topic'&&recommendation.sourceFileId&&<a href={sourceUrl(recommendation.sourceFileId)} target="_blank" rel="noopener noreferrer"><BookOpen aria-hidden="true"/> Mở bài nguồn <ArrowRight aria-hidden="true"/></a>}
        {recommendation.kind==='review_weak_topic'&&!recommendation.sourceFileId&&<button type="button" onClick={onOpenReview}><BookOpen aria-hidden="true"/> Mở quiz <ArrowRight aria-hidden="true"/></button>}
        {recommendation.kind==='curriculum_missing'&&<button type="button" onClick={onOpenReview}><BookOpen aria-hidden="true"/> Ôn bằng quiz <ArrowRight aria-hidden="true"/></button>}
      </div>}
    </>}
  </section>;
}
