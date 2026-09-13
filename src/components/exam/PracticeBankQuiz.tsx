import {useEffect,useRef,useState} from 'react';
import {Bot,CheckCircle2,ChevronDown,CircleHelp,FileQuestion,Globe2,GraduationCap,LoaderCircle,RotateCcw,Send,Sparkles} from 'lucide-react';
import {getPracticeQuizConfig,getPracticeQuizPage,submitPracticeQuiz,type PracticeQuizConfig,type PracticeQuizQuestion,type PracticeQuizResult} from '../../services/practiceQuizService';
import {requestPracticeAnswerReview} from '../../services/dailyPracticeService';
import {generateStudyGeminiQuiz,type StudyAiSource} from '../../services/studyAiService';
import {readCachedMember} from '../../services/authService';
import {recordReview} from '../../services/adaptiveReview';
import QuestionReasoningGuide from './QuestionReasoningGuide';
import '../../practice-bank-quiz.css';
import '../../practice-answer-review.css';

const HIU_QUESTION_COUNTS=[10,20,30,50] as const;
const AI_QUESTION_COUNTS=[5,10,20] as const;
const AI_PENDING_KEY='yhct-ai-center-pending-query-v1';
export type QuizSource='hiu'|'ai';
type PracticeBankQuizProps={preferredSource?:QuizSource;onSourceChange?:(source:QuizSource)=>void};
type AiQuizQuestion={id:string;subject:string;topic:string;stem:string;options:string[];sourceFileName:string;generationMethod:'ai_generated';aiGenerated:true;aiCorrectIndex:number;aiExplanation:string};
type ActiveQuestion=PracticeQuizQuestion|AiQuizQuestion;
const isAiQuestion=(question:ActiveQuestion):question is AiQuizQuestion=>'aiGenerated' in question&&question.aiGenerated===true;

export default function PracticeBankQuiz({preferredSource='hiu',onSourceChange}:PracticeBankQuizProps){
  const identity=readCachedMember()?.id||null;
  const [config,setConfig]=useState<PracticeQuizConfig|null>(null),[sourceMode,setSourceMode]=useState<QuizSource>(preferredSource),[subject,setSubject]=useState(''),[aiTopic,setAiTopic]=useState(''),[count,setCount]=useState<number>(preferredSource==='ai'?10:20),[questions,setQuestions]=useState<ActiveQuestion[]>([]),[answers,setAnswers]=useState<Record<string,number>>({}),[result,setResult]=useState<PracticeQuizResult|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reviewRequested,setReviewRequested]=useState<Set<string>>(()=>new Set()),[aiSources,setAiSources]=useState<StudyAiSource[]>([]);
  const seed=useRef(crypto.randomUUID());
  const guest=config?.authenticated===false;
  useEffect(()=>{let alive=true;void getPracticeQuizConfig().then(x=>{if(alive)setConfig(x)}).catch(e=>{if(alive)setMessage((e as Error).message)});return()=>{alive=false}},[]);

  const clearAttempt=()=>{seed.current=crypto.randomUUID();setQuestions([]);setAnswers({});setResult(null);setReviewRequested(new Set());setMessage('');setAiSources([])};
  const chooseSource=(next:QuizSource)=>{if(busy||questions.length)return;setSourceMode(next);onSourceChange?.(next);setMessage('');setAiSources([]);if(next==='ai'){setCount(current=>AI_QUESTION_COUNTS.includes(current as 5|10|20)?current:10);setAiTopic(current=>current||subject)}else setCount(current=>HIU_QUESTION_COUNTS.includes(current as 10|20|30|50)?current:20)};
  const startHiu=async()=>{seed.current=crypto.randomUUID();setAnswers({});setResult(null);setReviewRequested(new Set());setAiSources([]);const page=await getPracticeQuizPage(subject,0,seed.current,count);setQuestions(page.questions);if(!page.questions.length)setMessage('Chưa có câu HIU đã duyệt phù hợp với nội dung này.');else if(page.questions.length<count)setMessage('Đã tải toàn bộ câu HIU hiện có cho nội dung đã chọn.')};
  const startAi=async()=>{const topic=aiTopic.replace(/\s+/g,' ').trim();if(topic.length<2)throw new Error('Hãy nhập chủ đề muốn A.I tạo đề.');setAnswers({});setResult(null);setReviewRequested(new Set());setAiSources([]);const quiz=await generateStudyGeminiQuiz(topic,count);const generation=crypto.randomUUID();setQuestions(quiz.questions.map((question,index)=>({id:`ai:${generation}:${index}`,subject:quiz.topic,topic:'A.I tạo · nguồn web',stem:question.stem,options:question.options,sourceFileName:'A.I · nguồn web',generationMethod:'ai_generated',aiGenerated:true,aiCorrectIndex:question.correctIndex,aiExplanation:question.explanation})));setAiSources(quiz.sources);if(quiz.questions.length<count)setMessage(`A.I đã tạo ${quiz.questions.length} câu hợp lệ có nguồn web cho chủ đề này.`)};
  const start=async()=>{if(busy)return;setBusy(true);setMessage('');try{if(sourceMode==='ai')await startAi();else await startHiu()}catch(e){setQuestions([]);setMessage((e as Error).message)}finally{setBusy(false)}};
  const captureReviewCards=(review:PracticeQuizResult['review'])=>{
    for(const item of review){const question=questions.find(q=>q.id===item.id);if(!question)continue;const answer=question.options[item.correctIndex]||'';recordReview(identity,{id:question.id,subject:question.subject,topic:question.topic,stem:question.stem},`${answer}${item.explanation?` — ${item.explanation}`:''}`,sourceMode==='ai'?'A.I có nguồn web':'Ngân hàng HIU đã duyệt',item.correct,`free:${seed.current}:${question.id}`)}
  };
  const submit=async()=>{if(busy||!questions.length)return;setBusy(true);setMessage('');try{
    if(sourceMode==='hiu'){const next=await submitPracticeQuiz(questions as PracticeQuizQuestion[],answers);setResult(next);captureReviewCards(next.review);return}
    let correctCount=0;const review=questions.map(question=>{const aiQuestion=question as AiQuizQuestion,selectedIndex=Number.isInteger(answers[question.id])?answers[question.id]:null,correct=selectedIndex===aiQuestion.aiCorrectIndex;if(correct)correctCount++;return{id:question.id,subject:question.subject,topic:question.topic,selectedIndex,correctIndex:aiQuestion.aiCorrectIndex,correct,explanation:aiQuestion.aiExplanation,sourceFileName:'A.I · nguồn web',evidenceText:'Đề A.I tạo từ các nguồn web được liệt kê trong phiên này.'}});const next={score:Math.round(correctCount/questions.length*100),correctCount,total:questions.length,review,submittedAt:new Date().toISOString()};setResult(next);captureReviewCards(review);
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}};
  const requestReview=async(questionId:string)=>{if(reviewRequested.has(questionId))return;try{await requestPracticeAnswerReview(questionId,'Sinh viên yêu cầu Ban Quản lý Học tập kiểm tra lại đáp án sau khi hoàn thành quiz.');setReviewRequested(current=>new Set(current).add(questionId));setMessage('Đã gửi yêu cầu kiểm tra đáp án. Câu hỏi vẫn giữ nguyên cho đến khi Ban Quản lý Học tập xác minh.')}catch(e){setMessage((e as Error).message)}};
  const reset=()=>clearAttempt();
  const openStudyAi=()=>{const focus=subject||'các môn trong ngân hàng đề HIU';try{localStorage.setItem(AI_PENDING_KEY,`Giúp tôi ôn tập ${focus}. Hãy giải thích trọng tâm dễ nhớ rồi kiểm tra nhanh kiến thức của tôi.`)}catch{}window.history.pushState(null,'','/ai');window.dispatchEvent(new PopStateEvent('popstate'))};
  const reviewById=new Map(result?.review.map(x=>[x.id,x])||[]),counts=sourceMode==='ai'?AI_QUESTION_COUNTS:HIU_QUESTION_COUNTS;
  const startDisabled=busy||Boolean(guest)||(sourceMode==='hiu'&&!config?.ready)||(sourceMode==='ai'&&aiTopic.trim().length<2);
  return <section className="panel practice-bank" aria-label="Quiz học tập HIU và A.I">
    <header className="practice-bank__head"><div><span><FileQuestion/> QUIZ HỌC TẬP</span><h2>Chọn nguồn → nội dung → số câu → bắt đầu</h2><p>Chọn Đề HIU đã duyệt hoặc nhấn Đề Gemini để hệ thống A.I soạn một đề mới theo chủ đề của bạn.</p></div>{guest&&<b>Đăng nhập để làm quiz</b>}</header>

    {questions.length===0&&<div className="practice-bank__source-switch" role="group" aria-label="Chọn nguồn đề">
      <button type="button" aria-pressed={sourceMode==='hiu'} className={sourceMode==='hiu'?'active':''} disabled={guest||busy} onClick={()=>chooseSource('hiu')}><GraduationCap/><span><b>Đề HIU</b><small>Ngân hàng đã duyệt</small></span></button>
      <button type="button" aria-pressed={sourceMode==='ai'} className={sourceMode==='ai'?'active ai':'ai'} disabled={guest||busy} onClick={()=>chooseSource('ai')}><Bot/><span><b>Đề Gemini <em className="practice-bank__ai-label">A.I</em></b><small>Gemini ưu tiên · tự chuyển nguồn khi cần</small></span></button>
    </div>}

    <div className="practice-bank__controls">
      {sourceMode==='hiu'?<label><span>Nội dung ôn tập</span><div><select value={subject} disabled={guest||busy||questions.length>0} onChange={e=>setSubject(e.target.value)}><option value="">Tất cả nội dung HIU</option>{config?.subjects.map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown/></div></label>:<label className="practice-bank__topic"><span>Chủ đề Gemini tạo đề</span><div><input value={aiTopic} disabled={guest||busy||questions.length>0} onChange={e=>setAiTopic(e.target.value)} placeholder="Ví dụ: Sinh lý nội tiết, Bát cương, Châm cứu..." maxLength={220}/><Sparkles/></div></label>}
      <label><span>Số lượng câu</span><div><select value={count} disabled={guest||busy||questions.length>0} onChange={e=>setCount(Number(e.target.value))}>{counts.map(x=><option key={x} value={x}>{x} câu</option>)}</select><ChevronDown/></div></label>
      {questions.length===0?<button className="primary" disabled={startDisabled} onClick={()=>void start()}>{busy?<LoaderCircle className="spin"/>:sourceMode==='ai'?<Sparkles/>:<FileQuestion/>}{guest?'Cần đăng nhập':busy&&sourceMode==='ai'?'A.I đang tìm nguồn...':sourceMode==='ai'?'Gemini tạo đề':'Bắt đầu đề HIU'}</button>:<button className="secondary" disabled={busy} onClick={reset}><RotateCcw/>Chọn lại</button>}
    </div>

    {!guest&&questions.length===0&&sourceMode==='hiu'&&<button type="button" className="practice-bank__ai-study" onClick={openStudyAi}><Sparkles/><span><b>Học cùng Gemini</b><small>{subject?`Ôn trọng tâm ${subject}`:'Chọn môn hoặc để AI gợi ý trọng tâm'}</small></span></button>}
    {sourceMode==='ai'&&questions.length===0&&!message&&<div className="practice-bank__ai-note"><Globe2/><span><b>Đề Gemini · <em className="practice-bank__ai-label">A.I</em></b><small>Gemini là mô hình ưu tiên; gateway tự dùng A.I web dự phòng khi nhà cung cấp chính hết quota. Đề tạm thời không ghi vào ngân hàng HIU.</small></span></div>}
    {guest&&!message&&<div className="practice-bank__message" role="status">Đăng nhập thành viên để chọn nguồn đề và bắt đầu quiz.</div>}
    {message&&<div className="practice-bank__message" role="status">{message}</div>}

    {!!aiSources.length&&<div className="practice-bank__ai-sources"><span><Globe2/> Nguồn web A.I tham khảo</span><div>{aiSources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title||'Nguồn web'}</a>)}</div></div>}

    {questions.length>0&&<><div className="practice-bank__summary"><span><b>{questions.length}</b> câu trong lượt này</span><span><b>{Object.keys(answers).length}</b> câu đã chọn</span><span>{sourceMode==='ai'?<><b className="practice-bank__ai-label">A.I</b>nguồn web</>:<><b>HIU</b>{subject||'Tổng hợp'}</>}</span></div><div className="practice-bank__questions">{questions.map((q,index)=>{const review=reviewById.get(q.id),requested=reviewRequested.has(q.id),aiQuestion=isAiQuestion(q);return <article key={q.id} className={review?review.correct?'is-correct':'is-wrong':''}><header><b>Câu {index+1}</b><small>{aiQuestion?<><em className="practice-bank__ai-label">A.I</em> {q.subject}</>:<>{q.subject} · {q.topic}</>}</small></header><h3>{q.stem}</h3><div className="practice-bank__options">{q.options.map((option,i)=><label key={`${q.id}-${i}`} className={`${answers[q.id]===i?'selected':''}${review&&review.correctIndex===i?' correct':''}`}><input type="radio" name={`quiz-${q.id}`} disabled={busy||!!result} checked={answers[q.id]===i} onChange={()=>setAnswers(a=>({...a,[q.id]:i}))}/><b>{String.fromCharCode(65+i)}</b><span>{option}</span></label>)}</div><QuestionReasoningGuide questionId={q.id} subject={q.subject} topic={q.topic} stem={q.stem} options={q.options} selectedIndex={answers[q.id]??null} sourceLabel={aiQuestion?'A.I có nguồn web':'Ngân hàng HIU đã duyệt'}/>{review&&<div className="practice-bank__review"><CheckCircle2/><div><b>{review.correct?'Chính xác':`Đáp án đúng: ${String.fromCharCode(65+review.correctIndex)}`}</b><p>{review.explanation}</p><small>{aiQuestion?'A.I có nguồn web':'Ngân hàng HIU đã duyệt'}{review.evidenceText?` · ${review.evidenceText}`:''}</small>{!aiQuestion&&<button type="button" className="practice-bank__review-request" disabled={requested} onClick={()=>void requestReview(q.id)}><CircleHelp/>{requested?'Đã gửi yêu cầu kiểm tra':'Yêu cầu kiểm tra đáp án'}</button>}</div></div>}</article>})}</div>{!result&&<div className="practice-bank__actions"><button className="primary" disabled={busy||!Object.keys(answers).length} onClick={()=>void submit()}><Send/>Nộp bài ({questions.length} câu)</button></div>}{result&&<div className="practice-bank__result"><CheckCircle2/><div><b>{result.score}/100 · đúng {result.correctCount}/{result.total}</b><p>{sourceMode==='ai'?'Đáp án và giải thích của đề A.I chỉ thuộc phiên này; xem các nguồn web đã tham khảo ở phía trên.':'Đã chấm server-side. Nếu nghi ngờ đáp án, dùng “Yêu cầu kiểm tra đáp án” ngay dưới câu tương ứng.'}</p></div><button onClick={reset}><RotateCcw/>Làm lượt mới</button></div>}</>}
  </section>;
}
