import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {ArrowRight,BookOpen,Brain,FlaskConical,GraduationCap,Sparkles,Target} from 'lucide-react';
import type {Member} from '../../types';
import type {ModuleId} from '../../modules/moduleContract';
import {readStudentJourney} from '../../services/studentJourneyService';
import {askStudyGemini} from '../../services/studyAiService';
import {routeStudyOsRequest} from '../../v2/study-os/intentRouter';
import './study-hub-v2.css';

const RESEARCH_PENDING_KEY='yhct-research-pending-query-v1';
const AI_PENDING_KEY='yhct-ai-center-pending-query-v1';
const DAILY_HISTORY_PREFIX='yhct-study-os-daily-v1:';

type Props={member:Member|null;onNavigate:(module:ModuleId)=>void;onLogin:()=>void};
type QuickAction={label:string;seed:string;icon:'learn'|'quiz'|'research'};
type DailyContent={date:string;headline:string;guidance:string;actions:QuickAction[]};
type DailyHistory={date:string;headline:string;guidance:string;labels:string[]};

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

export default function StudyHubV2({member,onNavigate,onLogin}:Props){
  const [query,setQuery]=useState('');
  const journey=useMemo(()=>readStudentJourney(member?.id||null),[member?.id]);
  const name=member?.herbalAlias||member?.fullName?.split(/\s+/).filter(Boolean).slice(-2).join(' ')||'bạn';
  const focus=journey.preferences?.focus||'kiến thức YHCT';
  const dailyMinutes=journey.preferences?.dailyMinutes||20;
  const dateKey=localDateKey(),memberId=member?.id||null;
  const [daily,setDaily]=useState<DailyContent>(()=>fallbackDaily(dateKey,focus,dailyMinutes,[]));

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

  const execute=(raw:string)=>{
    const plan=routeStudyOsRequest(raw);
    if(!plan.query)return;
    if(plan.destination==='research'){
      try{localStorage.setItem(RESEARCH_PENDING_KEY,plan.query)}catch{}
      onNavigate('research');
      return;
    }
    if(plan.destination==='exam'){
      onNavigate('exam');
      return;
    }
    if(!member){onLogin();return}
    try{localStorage.setItem(AI_PENDING_KEY,plan.query)}catch{}
    onNavigate('ai');
  };

  const submit=(event:FormEvent)=>{event.preventDefault();execute(query)};
  const useQuickAction=(item:QuickAction)=>{
    if(item.icon==='research'){setQuery(item.seed);return}
    execute(item.seed);
  };

  return <section className="study-os-v2" aria-label="HIU YHCT AI Study OS">
    <header className="study-os-v2__hero">
      <div className="study-os-v2__eyebrow"><Sparkles/> MY HIU YHCT · AI STUDY OS</div>
      <h2>Chào {name}. {daily.headline}</h2>
      <p>{daily.guidance}</p>
      <form className="study-os-v2__command" onSubmit={submit}>
        <label className="sr-only" htmlFor="study-os-command">Yêu cầu học tập hoặc nghiên cứu</label>
        <textarea id="study-os-command" rows={2} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Ví dụ: Tôi có 30 phút, giúp tôi ôn Sinh lý nội tiết…"/>
        <button type="submit" disabled={!query.trim()}><Sparkles/> Bắt đầu <ArrowRight/></button>
      </form>
      <div className="study-os-v2__quick" aria-label="Gợi ý nhanh">
        {daily.actions.map(item=><button key={`${daily.date}-${item.icon}`} onClick={()=>useQuickAction(item)}>{item.icon==='quiz'?<GraduationCap/>:item.icon==='research'?<FlaskConical/>:<Brain/>}<span>{item.label}</span></button>)}
      </div>
    </header>

    <div className="study-os-v2__grid">
      <article className="study-os-v2__card study-os-v2__card--focus">
        <div className="study-os-v2__card-icon"><Target/></div>
        <div><small>HỌC TIẾP</small><h3>{focus}</h3><p>Mục tiêu cá nhân hiện tại: {dailyMinutes} phút tập trung.</p></div>
        <button onClick={()=>execute(`Giúp tôi học tiếp ${focus} trong ${dailyMinutes} phút`)}>Học cùng AI <ArrowRight/></button>
      </article>

      <article className="study-os-v2__card">
        <div className="study-os-v2__card-icon"><GraduationCap/></div>
        <div><small>QUIZ & ÔN LUYỆN</small><h3>{journey.todayQuestions||0} câu hôm nay</h3><p>Chọn nội dung, số lượng câu và bắt đầu luyện từ ngân hàng đã duyệt.</p></div>
        <button onClick={()=>onNavigate('exam')}>Mở Learning Hub <ArrowRight/></button>
      </article>

      <article className="study-os-v2__card">
        <div className="study-os-v2__card-icon"><FlaskConical/></div>
        <div><small>NGHIÊN CỨU</small><h3>Research A.I có nguồn</h3><p>Tìm bằng chứng, đọc nguồn và dùng tài liệu nội bộ khi bạn chủ động lựa chọn.</p></div>
        <button onClick={()=>onNavigate('research')}>Mở Research <ArrowRight/></button>
      </article>
    </div>

    <section className="study-os-v2__assistant">
      <div><BookOpen/><span><b>AI học tập HIU YHCT</b><small>Gemini phụ trách hỏi đáp theo ngữ cảnh; trợ lý nổi chỉ giữ vai trò tác vụ và điều hướng hệ thống.</small></span></div>
      <button onClick={()=>execute(`Giúp tôi lập kế hoạch học ${focus} hôm nay`)}>{member?'Mở AI học tập':'Đăng nhập để dùng'} <ArrowRight/></button>
    </section>
  </section>;
}