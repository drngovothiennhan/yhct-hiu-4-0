import {useEffect,useRef,useState} from 'react';
import {BookOpenCheck,Database,FileCheck2} from 'lucide-react';
import {readCachedMember} from '../../services/authService';
import {recordReview} from '../../services/adaptiveReview';
import {answerDailyPractice,getDailyPracticeConfig,getTodayDailyPractice,type DailyPracticeAnswer,type DailyPracticeConfig,type DailyPracticeSession} from '../../services/dailyPracticeService';
import '../../daily-drive-practice.css';



export default function DailyDrivePractice(){
  const member=readCachedMember(),answerLock=useRef(false);
  const [config,setConfig]=useState<DailyPracticeConfig|null>(null),[session,setSession]=useState<DailyPracticeSession|null>(null),[idx,setIdx]=useState(0),[feedback,setFeedback]=useState<Record<string,DailyPracticeAnswer>>({}),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const current=session?.questions?.[idx],answers=session?.answers||{},selected=current?answers[current.id]:undefined,answeredCount=Object.keys(answers).length,total=session?.questionCount||session?.questions.length||0;
  const progress=total?Math.round(answeredCount/total*100):0;
  const currentFeedback=current?feedback[current.id]:undefined;
  const openToday=async(count?:number)=>{setBusy(true);setMsg('');try{const next=await getTodayDailyPractice(count||config?.defaultCount||10);setSession(next);setIdx(0);if(!next.ready)setMsg('Ngân hàng Drive chưa có câu hỏi đã xác minh. Vui lòng quay lại sau khi tài liệu được cập nhật.')}catch(e){setMsg((e as Error).message)}finally{answerLock.current=false;setBusy(false)}};
  useEffect(()=>{let alive=true;void getDailyPracticeConfig().then(async next=>{if(!alive)return;setConfig(next);if(next.hasTodaySession){const s=await getTodayDailyPractice(next.defaultCount||10);if(alive)setSession(s)}}).catch(e=>{if(alive)setMsg((e as Error).message)});return()=>{alive=false}},[]);
  useEffect(()=>{if(!session?.sessionId||!current||selected===undefined||feedback[current.id]||busy)return;let alive=true;void answerDailyPractice(session.sessionId,current.id,selected).then(r=>{if(alive)setFeedback(x=>({...x,[current.id]:r}))}).catch(()=>{});return()=>{alive=false}},[session?.sessionId,current?.id,selected]);

  const choose=async(optionIndex:number)=>{if(!session?.sessionId||!current||selected!==undefined||busy||answerLock.current)return;answerLock.current=true;setBusy(true);setMsg('');try{const r=await answerDailyPractice(session.sessionId,current.id,optionIndex);if(!r.accepted)throw new Error("Chưa ghi nhận đáp án. Hãy thử lại.");recordReview(member?.id||null,{...current,id:"practice:"+current.id},current.options[r.correctIndex]+" — "+r.explanation,r.sourceFileName,r.correct,session.sessionId+":"+current.id);const nextAnswers={...answers,[current.id]:r.selectedIndex};setFeedback(x=>({...x,[current.id]:r}));setSession(s=>s?{...s,answers:nextAnswers,status:Object.keys(nextAnswers).length>=(s.questionCount||s.questions.length)?'completed':s.status}:s)}catch(e){setMsg((e as Error).message)}finally{answerLock.current=false;setBusy(false)}};
  return <section className="daily-drive panel" aria-label="Luyện tập hằng ngày từ Google Drive">
    <header className="daily-drive__head"><div><span className="daily-drive__kicker"><BookOpenCheck/> DAILY PRACTICE · DRIVE</span><h2>Luyện 10 câu mỗi ngày</h2><p>DOCX được chuẩn hóa thành ngân hàng câu hỏi có nguồn; bộ hôm nay ưu tiên câu chưa gặp hoặc từng làm sai.</p></div></header>
    <div className="daily-drive__stats"><span><Database/><small>Sẵn sàng</small><b>{config?.eligibleCount??'…'} câu</b></span><span><FileCheck2/><small>Nguồn đọc</small><b>Tài liệu đã xác minh</b></span></div>
    {msg&&<div className="daily-drive__message" role="status">{msg}</div>}


    {!session?<div className="daily-drive__start"><div><b>{config?.ready?'Bộ luyện hôm nay đã sẵn sàng':'Chưa có câu đã xác minh'}</b><span>{config?.ready?`Hệ thống sẽ cố định tối đa ${config.defaultCount||10} câu theo tài khoản và ngày, không đổi khi tải lại.`:'Tài liệu đang chờ cập nhật. Các câu đã xác minh sẽ xuất hiện tại đây.'}</span></div><button disabled={busy||!config?.ready} onClick={()=>void openToday()}><BookOpenCheck/>Bắt đầu bộ hôm nay</button></div>:session.ready&&current?<div className="daily-drive__practice">
      <div className="daily-drive__progress"><span><b>Câu {idx+1}/{total}</b><small>{current.subject} · {current.topic}</small></span><div><i style={{width:`${progress}%`}}/></div><em>{answeredCount}/{total} đã làm</em></div>
      <article className="daily-drive__question"><header><span>{current.generationMethod==='parsed'?'Từ tài liệu gốc':'A.I tạo · đã duyệt'}</span><small>Nguồn: {current.sourceFileName}</small></header><h3>{current.stem}</h3><div className="daily-drive__options">{current.options.map((option,i)=><button key={`${current.id}-${i}`} disabled={busy||selected!==undefined} className={`${selected===i?'selected':''}${currentFeedback&&i===currentFeedback.correctIndex?' correct':''}${currentFeedback&&selected===i&&!currentFeedback.correct?' wrong':''}`} onClick={()=>void choose(i)}><b>{String.fromCharCode(65+i)}</b><span>{option}</span></button>)}</div>{currentFeedback&&<div className={`daily-drive__feedback ${currentFeedback.correct?'ok':'bad'}`}><b>{currentFeedback.correct?'Chính xác':'Chưa chính xác'} · đáp án {String.fromCharCode(65+currentFeedback.correctIndex)}</b><p>{currentFeedback.explanation}</p><small>Đối chiếu: {currentFeedback.sourceFileName}</small></div>}</article>
      <div className="daily-drive__nav"><button disabled={idx===0||busy} onClick={()=>setIdx(x=>x-1)}>← Trước</button><span>{session.status==='completed'?'Đã hoàn tất bộ hôm nay':'Mỗi câu chỉ ghi nhận lần trả lời đầu tiên'}</span><button disabled={idx>=total-1||busy} onClick={()=>setIdx(x=>x+1)}>Tiếp →</button></div>
    </div>:<div className="daily-drive__start"><b>Chưa có bộ luyện khả dụng.</b></div>}

  </section>;
}
