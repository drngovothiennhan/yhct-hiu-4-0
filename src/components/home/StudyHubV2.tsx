import {useMemo,useState,type FormEvent} from 'react';
import {ArrowRight,BookOpen,Brain,FlaskConical,GraduationCap,Sparkles,Target} from 'lucide-react';
import type {Member} from '../../types';
import type {ModuleId} from '../../modules/moduleContract';
import {readStudentJourney} from '../../services/studentJourneyService';
import {routeStudyOsRequest} from '../../v2/study-os/intentRouter';
import './study-hub-v2.css';

const RESEARCH_PENDING_KEY='yhct-research-pending-query-v1';

type Props={member:Member|null;onNavigate:(module:ModuleId)=>void;onLogin:()=>void};

type QuickAction={label:string;seed:string;icon:'learn'|'quiz'|'research'};
const QUICK_ACTIONS:QuickAction[]=[
  {label:'Ôn phần tôi còn yếu',seed:'Ôn tập phần kiến thức tôi còn yếu hôm nay',icon:'learn'},
  {label:'Làm 20 câu trắc nghiệm',seed:'Làm 20 câu trắc nghiệm ôn tập',icon:'quiz'},
  {label:'Tìm bằng chứng nghiên cứu',seed:'Tìm bằng chứng nghiên cứu gần đây về ',icon:'research'}
];

export default function StudyHubV2({member,onNavigate,onLogin}:Props){
  const [query,setQuery]=useState('');
  const journey=useMemo(()=>readStudentJourney(member?.id||null),[member?.id]);
  const name=member?.herbalAlias||member?.fullName?.split(/\s+/).filter(Boolean).slice(-2).join(' ')||'bạn';
  const focus=journey.preferences?.focus||'kiến thức YHCT';
  const dailyMinutes=journey.preferences?.dailyMinutes||20;

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
    window.dispatchEvent(new CustomEvent('yhct:ai:open',{detail:{query:plan.query,context:`study-hub-v2:${plan.intent}`}}));
  };

  const submit=(event:FormEvent)=>{event.preventDefault();execute(query)};
  const useQuickAction=(item:QuickAction)=>{
    if(item.icon==='research'){setQuery(item.seed);return}
    execute(item.seed);
  };

  return <section className="study-os-v2" aria-label="HIU YHCT AI Study OS">
    <header className="study-os-v2__hero">
      <div className="study-os-v2__eyebrow"><Sparkles/> AI STUDY OS · CANARY</div>
      <h2>Chào {name}. Hôm nay bạn muốn học hoặc làm gì?</h2>
      <p>Một điểm vào cho học tập, ôn luyện và nghiên cứu. Hệ thống tự chuyển yêu cầu đến đúng năng lực hiện có.</p>
      <form className="study-os-v2__command" onSubmit={submit}>
        <label className="sr-only" htmlFor="study-os-command">Yêu cầu học tập hoặc nghiên cứu</label>
        <textarea id="study-os-command" rows={2} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Ví dụ: Tôi có 30 phút, giúp tôi ôn Sinh lý nội tiết…"/>
        <button type="submit" disabled={!query.trim()}><Sparkles/> Bắt đầu <ArrowRight/></button>
      </form>
      <div className="study-os-v2__quick" aria-label="Gợi ý nhanh">
        {QUICK_ACTIONS.map(item=><button key={item.label} onClick={()=>useQuickAction(item)}>{item.icon==='quiz'?<GraduationCap/>:item.icon==='research'?<FlaskConical/>:<Brain/>}<span>{item.label}</span></button>)}
      </div>
    </header>

    <div className="study-os-v2__grid">
      <article className="study-os-v2__card study-os-v2__card--focus">
        <div className="study-os-v2__card-icon"><Target/></div>
        <div><small>TIẾP TỤC HỌC</small><h3>{focus}</h3><p>Mục tiêu cá nhân hiện tại: {dailyMinutes} phút tập trung.</p></div>
        <button onClick={()=>execute(`Giúp tôi học tiếp ${focus} trong ${dailyMinutes} phút`)}>Học cùng trợ lý <ArrowRight/></button>
      </article>

      <article className="study-os-v2__card">
        <div className="study-os-v2__card-icon"><GraduationCap/></div>
        <div><small>ÔN LUYỆN</small><h3>{journey.todayQuestions||0} câu hôm nay</h3><p>Vào Learning Hub để làm quiz, ôn sai và tiếp tục lộ trình luyện tập.</p></div>
        <button onClick={()=>onNavigate('exam')}>Mở luyện tập <ArrowRight/></button>
      </article>

      <article className="study-os-v2__card">
        <div className="study-os-v2__card-icon"><FlaskConical/></div>
        <div><small>NGHIÊN CỨU</small><h3>Research A.I có nguồn</h3><p>PubMed, OpenAlex, ClinicalTrials và tài liệu nội bộ khi bạn chủ động cho phép.</p></div>
        <button onClick={()=>onNavigate('research')}>Mở Research <ArrowRight/></button>
      </article>
    </div>

    <section className="study-os-v2__assistant">
      <div><BookOpen/><span><b>Trợ lý riêng HIU YHCT</b><small>Hỏi kiến thức thường quy, học cùng A.I hoặc điều hướng ứng dụng trong một luồng thống nhất.</small></span></div>
      <button onClick={()=>execute(`Giúp tôi lập kế hoạch học ${focus} hôm nay`)}>{member?'Mở trợ lý':'Đăng nhập để dùng'} <ArrowRight/></button>
    </section>

    <footer className="study-os-v2__canary-note">Bản V2 đang chạy ở chế độ canary. Quiz, Research, xác thực và dữ liệu vẫn dùng các contract production hiện hữu.</footer>
  </section>;
}
