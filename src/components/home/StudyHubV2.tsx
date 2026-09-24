import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {ArrowRight,BookOpen,Brain,FlaskConical,GraduationCap,Sparkles,Target} from 'lucide-react';
import type {Member} from '../../types';
import type {ModuleId} from '../../modules/moduleContract';
import {readReviewCards,type ReviewCard} from '../../services/adaptiveReview';
import {getPracticeQuizConfig} from '../../services/practiceQuizService';
import {readStudentJourney,saveStudentPreferences,subscribeStudentJourney} from '../../services/studentJourneyService';
import {askStudyGemini} from '../../services/studyAiService';
import {routeStudyOsRequest} from '../../v2/study-os/intentRouter';
import './study-hub-v2.css';

const RESEARCH_PENDING_KEY='yhct-research-pending-query-v1';
const AI_PENDING_KEY='yhct-ai-center-pending-query-v1';
const LEARNING_PENDING_TAB_KEY='yhct-learning-hub-pending-tab-v1';
const DAILY_HISTORY_PREFIX='yhct-study-os-daily-v1:';

type Props={member:Member|null;onNavigate:(module:ModuleId)=>void;onLogin:()=>void};
type QuickAction={label:string;seed:string;icon:'learn'|'quiz'|'research'};
type DailyContent={date:string;headline:string;guidance:string;actions:QuickAction[]};
type DailyHistory={date:string;headline:string;guidance:string;labels:string[]};
type LearningTab='quick'|'bank'|'adaptive'|'exam';

const DAILY_VARIANTS=[
  ['Hôm nay mình học gọn mà chắc nhé?','Chọn một mục tiêu nhỏ, hoàn thành rồi mới mở rộng.',['Ôn phần dễ quên','Kiểm tra 10 câu','Tra cứu nguồn học thuật']],
  ['Bạn muốn tiến bộ ở phần nào trước?','Ưu tiên phần còn yếu và dành vài phút kiểm tra lại ngay.',['Củng cố điểm yếu','Làm một bộ quiz ngắn','Kiểm tra nguồn đáng tin']],
  ['Một phiên học tập trung bắt đầu từ đâu?','Chọn đúng việc cần làm, học ngắn nhưng có kiểm tra lại.',['Ôn mục cần nhớ','Thử 20 câu nhanh','Mở tra cứu học thuật']],
  ['Hôm nay hãy biến một điểm yếu thành điểm chắc.','Bắt đầu bằng nội dung khó nhất rồi kiểm tra bằng câu hỏi ngắn.',['Ôn phần hay sai','Tự kiểm tra kiến thức','Tìm nguồn học thuật']],
  ['Bạn có thể hoàn thành một mục tiêu nào ngay hôm nay?','Giữ phiên học đơn giản: học, tự kiểm tra, rồi tra cứu khi cần.',['Học phần đang yếu','Làm quiz củng cố','Đối chiếu nguồn học thuật']],
  ['Hôm nay ưu tiên hiểu sâu hay nhớ chắc?','Chọn một hướng và hoàn thành trọn vẹn trước khi chuyển nội dung.',['Ôn để nhớ chắc','Làm câu hỏi kiểm tra','Khám phá nguồn mới']],
  ['Một bước nhỏ hôm nay sẽ giúp buổi học nhẹ hơn.','Bắt đầu bằng phần cần nhất thay vì mở quá nhiều nội dung cùng lúc.',['Ôn đúng trọng tâm','Làm bộ câu hỏi ngắn','Tra cứu nguồn mới']],
  ['Bạn muốn kết thúc buổi học với điều gì đã thật sự nhớ?','Đặt một mục tiêu rõ, học tập trung và kiểm tra lại ngay sau đó.',['Ôn kiến thức trọng tâm','Kiểm tra bằng quiz','Đọc nguồn học thuật']],
  ['Hôm nay mình chọn một việc học quan trọng nhất nhé?','Ít mục tiêu hơn, nhưng hoàn thành và nhớ chắc hơn.',['Ôn phần quan trọng','Làm 10 câu củng cố','Kiểm tra tài liệu học thuật']],
  ['Bạn muốn dành phiên học này cho phần nào?','Dùng thời gian có giới hạn để tạo một kết quả học tập rõ ràng.',['Ôn phần chưa vững','Làm quiz theo mục tiêu','Tìm nguồn đáng tin']],
  ['Hôm nay hãy học theo mục tiêu, không theo số trang.','Chọn một kết quả cần đạt rồi để hệ thống đưa bạn đến đúng công cụ.',['Ôn một chủ điểm','Kiểm tra mức nhớ','Tra cứu học thuật']],
  ['Bạn đã sẵn sàng làm chắc thêm một phần kiến thức?','Bắt đầu ngắn, kiểm tra ngay và chỉ mở rộng khi đã nắm phần cốt lõi.',['Ôn phần cần củng cố','Làm câu hỏi nhanh','Đối chiếu nguồn tin cậy']]
] as const;

const cleanText=(value:unknown,max:number)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const localDateKey=()=>{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),get=(type:string)=>parts.find(part=>part.type===type)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`};
const historyKey=(memberId:string|null)=>DAILY_HISTORY_PREFIX+(memberId||'guest');
const readHistory=(memberId:string|null):DailyHistory[]=>{try{const raw=JSON.parse(localStorage.getItem(historyKey(memberId))||'[]');return Array.isArray(raw)?raw.filter(item=>item&&typeof item.date==='string'&&Array.isArray(item.labels)).slice(-14):[]}catch{return[]}};
const saveHistory=(memberId:string|null,item:DailyHistory)=>{try{const next=[...readHistory(memberId).filter(entry=>entry.date!==item.date),item].slice(-14);localStorage.setItem(historyKey(memberId),JSON.stringify(next))}catch{}};
const actionsFromLabels=(labels:string[],focus:string,dailyMinutes:number):QuickAction[]=>[
  {label:labels[0],seed:`Giúp tôi ôn ${focus} trong ${dailyMinutes} phút, ưu tiên phần tôi còn yếu`,icon:'learn'},
  {label:labels[1],seed:`Làm 20 câu trắc nghiệm ôn tập ${focus}`,icon:'quiz'},
  {label:labels[2],seed:`Tìm bằng chứng nghiên cứu gần đây về ${focus}`,icon:'research'}
];
const signature=(headline:string,guidance:string,labels:string[])=>[headline,guidance,...labels].map(value=>value.toLocaleLowerCase('vi')).join('|');
const fallbackDaily=(date:string,focus:string,dailyMinutes:number,history:DailyHistory[]):DailyContent=>{
  const numeric=Number(date.replace(/-/g,''))||0,used=new Set(history.map(item=>signature(item.headline,item.guidance,item.labels)));
  let picked=DAILY_VARIANTS[numeric%DAILY_VARIANTS.length];
  for(let offset=0;offset<DAILY_VARIANTS.length;offset++){
    const candidate=DAILY_VARIANTS[(numeric+offset)%DAILY_VARIANTS.length],candidateLabels=[...candidate[2]];
    if(!used.has(signature(candidate[0],candidate[1],candidateLabels))){picked=candidate;break}
  }
  const labels=[...picked[2]];
  return{date,headline:picked[0],guidance:picked[1],actions:actionsFromLabels(labels,focus,dailyMinutes)};
};
const parseDailyAi=(answer:string,date:string,focus:string,dailyMinutes:number,history:DailyHistory[]):DailyContent|null=>{
  try{
    const start=answer.indexOf('{'),end=answer.lastIndexOf('}');if(start<0||end<=start)return null;
    const raw=JSON.parse(answer.slice(start,end+1)) as Record<string,unknown>;
    const headline=cleanText(raw.headline,90),guidance=cleanText(raw.guidance,130),labels=[cleanText(raw.a,44),cleanText(raw.b,44),cleanText(raw.c,44)];
    if(!headline||!guidance||labels.some(label=>label.length<4)||new Set(labels.map(label=>label.toLocaleLowerCase('vi'))).size!==3)return null;
    const currentSignature=signature(headline,guidance,labels);
    if(history.some(item=>signature(item.headline,item.guidance,item.labels)===currentSignature))return null;
    return{date,headline,guidance,actions:actionsFromLabels(labels,focus,dailyMinutes)};
  }catch{return null}
};
const reviewSnapshot=(cards:ReviewCard[],subjects:string[],fallback:string)=>{
  const allowed=new Set(subjects),valid=cards.filter(card=>Boolean(card.subject&&allowed.has(card.subject))),now=Date.now();
  const dueCount=valid.filter(card=>card.due<=now).length;
  const weakCount=new Map<string,number>();
  valid.filter(card=>card.streak===0).forEach(card=>{const key=card.subject||'';if(key)weakCount.set(key,(weakCount.get(key)||0)+1)});
  const weakFolder=[...weakCount.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'vi'))[0]?.[0]||fallback;
  return{dueCount,weakFolder,total:valid.length};
};

export default function StudyHubV2({member,onNavigate,onLogin}:Props){
  const memberId=member?.id||null;
  const [query,setQuery]=useState('');
  const [journey,setJourney]=useState(()=>readStudentJourney(memberId));
  const [reviewCards,setReviewCards]=useState<ReviewCard[]>(()=>readReviewCards(memberId));
  const [activeSubjects,setActiveSubjects]=useState<string[]>([]);
  const [missionEditing,setMissionEditing]=useState(false);
  const name=member?.fullName?.trim()||member?.herbalAlias?.trim()||'bạn';
  const focus=journey.preferences?.focus||'kiến thức YHCT';
  const dailyMinutes=journey.preferences?.dailyMinutes||20;
  const dateKey=localDateKey();
  const [daily,setDaily]=useState<DailyContent>(()=>fallbackDaily(dateKey,focus,dailyMinutes,[]));
  const review=useMemo(()=>reviewSnapshot(reviewCards,activeSubjects,focus),[reviewCards,activeSubjects,focus]);
  const missionOptions=useMemo(()=>[...new Set([focus,...activeSubjects].map(item=>cleanText(item,80)).filter(Boolean))].sort((a,b)=>a===focus?-1:b===focus?1:a.localeCompare(b,'vi')),[activeSubjects,focus]);
  const canChangeMission=Boolean(journey.preferences&&missionOptions.length>1);

  useEffect(()=>{setJourney(readStudentJourney(memberId));return subscribeStudentJourney(memberId,setJourney)},[memberId]);
  useEffect(()=>{const refresh=()=>setReviewCards(readReviewCards(memberId));refresh();window.addEventListener('yhct:review',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('yhct:review',refresh);window.removeEventListener('storage',refresh)}},[memberId]);
  useEffect(()=>{let alive=true;void getPracticeQuizConfig().then(config=>{if(alive)setActiveSubjects([...new Set(config.subjects||[])])}).catch(()=>{if(alive)setActiveSubjects([])});return()=>{alive=false}},[memberId]);

  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    const load=async()=>{
      const history=readHistory(memberId),cached=history.find(item=>item.date===dateKey);
      if(cached){if(alive)setDaily({date:dateKey,headline:cached.headline,guidance:cached.guidance,actions:actionsFromLabels(cached.labels,focus,dailyMinutes)});return}
      const fallback=fallbackDaily(dateKey,focus,dailyMinutes,history);
      if(alive)setDaily(fallback);
      if(!memberId){saveHistory(memberId,{date:dateKey,headline:fallback.headline,guidance:fallback.guidance,labels:fallback.actions.map(item=>item.label)});return}
      try{
        const reply=await askStudyGemini([
          'Tạo nội dung mở đầu thật ngắn cho trang học tập hôm nay.',
          `Trọng tâm người học: ${focus}. Thời lượng dự kiến: ${dailyMinutes} phút.`,
          'Trả duy nhất JSON một dòng với đúng 5 khóa: headline, guidance, a, b, c.',
          'headline là câu hỏi hoặc động lực ngắn và không chứa từ Chào; guidance là một câu hướng dẫn học ngắn.',
          'a là nhãn gợi ý ôn phần còn yếu; b là nhãn gợi ý làm trắc nghiệm; c là nhãn gợi ý tra cứu học thuật.',
          'Ba nhãn phải khác nhau, tự nhiên, dưới 44 ký tự. Không markdown, không giải thích ngoài JSON.'
        ].join(' '),'','Trang chủ AI Study OS',controller.signal);
        const generated=parseDailyAi(reply.answer,dateKey,focus,dailyMinutes,history),finalContent=generated||fallback;
        if(!alive)return;setDaily(finalContent);saveHistory(memberId,{date:dateKey,headline:finalContent.headline,guidance:finalContent.guidance,labels:finalContent.actions.map(item=>item.label)});
      }catch{if(alive)saveHistory(memberId,{date:dateKey,headline:fallback.headline,guidance:fallback.guidance,labels:fallback.actions.map(item=>item.label)})}
    };
    void load();return()=>{alive=false;controller.abort()};
  },[dateKey,memberId,focus,dailyMinutes]);

  const openLearning=(tab:LearningTab='quick')=>{try{localStorage.setItem(LEARNING_PENDING_TAB_KEY,tab)}catch{}onNavigate('exam')};
  const execute=(raw:string)=>{
    const plan=routeStudyOsRequest(raw);
    if(!plan.query)return;
    if(plan.destination==='research'){
      try{localStorage.setItem(RESEARCH_PENDING_KEY,plan.query)}catch{}
      onNavigate('research');
      return;
    }
    if(plan.destination==='exam'){
      openLearning('bank');
      return;
    }
    if(!member){onLogin();return}
    try{localStorage.setItem(AI_PENDING_KEY,plan.query)}catch{}
    onNavigate('ai');
  };

  const submit=(event:FormEvent)=>{event.preventDefault();execute(query)};
  const useQuickAction=(item:QuickAction)=>execute(item.seed);
  const changeMissionFocus=(next:string)=>{
    const value=cleanText(next,80);
    if(!value||!journey.preferences)return;
    if(value!==focus)saveStudentPreferences({...journey.preferences,focus:value},memberId);
    setMissionEditing(false);
  };

  return <section className="study-os-v2" aria-label="HIU YHCT AI Study OS">
    <header className="study-os-v2__hero">
      <div className="study-os-v2__eyebrow"><Sparkles/> MY HIU YHCT · AI STUDY OS</div>
      <div className="study-os-v2__focus-layout">
        <div className="study-os-v2__focus-main">
          <h2>Chào {name}. {daily.headline}</h2>
          <p>{daily.guidance}</p>
          <form className="study-os-v2__command" onSubmit={submit}>
            <label className="sr-only" htmlFor="study-os-command">Yêu cầu học tập hoặc nghiên cứu</label>
            <textarea id="study-os-command" rows={2} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Ví dụ: Tôi có 30 phút, giúp tôi ôn Sinh lý nội tiết…"/>
            <button type="submit" disabled={!query.trim()}><Sparkles/> Bắt đầu <ArrowRight/></button>
          </form>
          <div className="study-os-v2__quick" aria-label="Gợi ý học tập hôm nay">
            {daily.actions.map(item=><button key={`${daily.date}-${item.icon}`} onClick={()=>useQuickAction(item)}>{item.icon==='quiz'?<GraduationCap/>:item.icon==='research'?<FlaskConical/>:<Brain/>}<span>{item.label}</span></button>)}
          </div>
        </div>
        <aside className="study-os-v2__mission" aria-label="Mục tiêu học hôm nay">
          <div className="study-os-v2__mission-head"><span><Target/> DAILY MISSION</span>{canChangeMission&&<button type="button" className="study-os-v2__mission-change" aria-expanded={missionEditing} onClick={()=>setMissionEditing(value=>!value)}>Thay đổi</button>}</div>
          {missionEditing&&canChangeMission?<label className="study-os-v2__mission-picker"><span>Trọng tâm học tập</span><select value={focus} onChange={event=>changeMissionFocus(event.target.value)} autoFocus>{missionOptions.map(subject=><option key={subject} value={subject}>{subject}</option>)}</select></label>:<strong>{focus}</strong>}
          <p>{dailyMinutes} phút tập trung · {journey.todayQuestions} câu đã luyện hôm nay</p>
          <button type="button" className="study-os-v2__mission-start" onClick={()=>execute(`Giúp tôi học ${focus} trong ${dailyMinutes} phút, ưu tiên nội dung quan trọng nhất`)}>Bắt đầu phiên học <ArrowRight/></button>
        </aside>
      </div>
    </header>

    <section className="study-os-v2__continue" aria-label="Tiếp tục học">
      <header>
        <div><span>TIẾP TỤC HỌC</span><h3>Quay lại đúng phần cần làm</h3><p>Tiến độ, điểm cần củng cố và lịch ôn được gom tại một chỗ.</p></div>
        <button onClick={()=>openLearning('quick')}>Learning Hub <ArrowRight/></button>
      </header>
      <div className="study-os-v2__continue-grid">
        <button onClick={()=>execute(`Giúp tôi tiếp tục học ${focus} trong ${dailyMinutes} phút`)}><Brain/><span><small>TRỌNG TÂM</small><b>{focus}</b><em>{dailyMinutes} phút theo mục tiêu</em></span><ArrowRight/></button>
        <button onClick={()=>openLearning('adaptive')}><BookOpen/><span><small>ÔN NGẮT QUÃNG</small><b>{review.dueCount} thẻ đến hạn</b><em>Cần củng cố: {review.weakFolder}</em></span><ArrowRight/></button>
        <button onClick={()=>openLearning('bank')}><GraduationCap/><span><small>TIẾN ĐỘ HÔM NAY</small><b>{journey.todayQuestions} câu đã luyện</b><em>Mở quiz theo thư mục hoặc chủ đề</em></span><ArrowRight/></button>
      </div>
    </section>
  </section>;
}
