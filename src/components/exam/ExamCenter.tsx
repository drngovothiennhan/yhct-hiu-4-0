import {useEffect,useState} from 'react';
import {BookMarked,BookOpenCheck,Brain,FileQuestion,GraduationCap} from 'lucide-react';
import {readCachedMember} from '../../services/authService';
import AdaptiveReview from './AdaptiveReview';
import DailyDrivePractice from './DailyDrivePractice';
import NationalExamPrepLegacy from './NationalExamPrepLegacy';
import PracticeBankQuiz from './PracticeBankQuiz';
import TcmHerbsFormulasLesson from './TcmHerbsFormulasLesson';
import '../../learning-hub.css';

type HubTab='lesson'|'quick'|'bank'|'adaptive'|'exam';
type QuizSource='hiu'|'ai';
const LEARNING_PENDING_TAB_KEY='yhct-learning-hub-pending-tab-v1';
const EXAM_CONTRACT_MARKERS='Thi thử 50 câu · A.I hướng dẫn suy luận · server integrity';
const EXAM_SESSION_CONTRACT='getExamConfigV2 · startExamSessionV2 · saveExamAnswerV2 · submitExamSessionV2';
const HUB_ITEMS:[HubTab,string,string,typeof BookOpenCheck][]=[
  ['lesson','Bài học','Dược liệu & Phương tễ · flashcard · 20 câu',BookMarked],
  ['quick','Ôn tập nhanh','Nguồn → thư mục → 5/10/20 câu hoặc toàn bộ',BookOpenCheck],
  ['bank','Quiz theo mục tiêu','Nguồn → thư mục/chủ đề → số câu',FileQuestion],
  ['adaptive','Ôn tập ngắt quãng','Ôn lại đúng câu đã đến hạn',Brain],
  ['exam','Thi chuẩn','Luyện tập · thi thử chuẩn 50 câu',GraduationCap]
];
const isHubTab=(value:string|null):value is HubTab=>value==='lesson'||value==='quick'||value==='bank'||value==='adaptive'||value==='exam';

export default function ExamCenter(){
  const identity=readCachedMember()?.id||null;
  const [tab,setTab]=useState<HubTab>('quick');
  const [visited,setVisited]=useState<Set<HubTab>>(()=>new Set<HubTab>(['quick']));
  const [bankSetup,setBankSetup]=useState({subject:'',count:20,revision:0});
  const [bankSource,setBankSource]=useState<QuizSource>('hiu');
  const select=(next:HubTab)=>{setTab(next);setVisited(old=>{if(old.has(next))return old;const copy=new Set(old);copy.add(next);return copy})};
  const openBankSource=(source:QuizSource)=>{setBankSource(source);select('bank')};
  useEffect(()=>{let pending:string|null=null;try{pending=localStorage.getItem(LEARNING_PENDING_TAB_KEY);localStorage.removeItem(LEARNING_PENDING_TAB_KEY)}catch{}if(isHubTab(pending))select(pending)},[]);
  return <section className="learning-hub" aria-label="Learning Hub Học Thuật" data-exam-contract={EXAM_CONTRACT_MARKERS} data-exam-session-contract={EXAM_SESSION_CONTRACT}>
    <header className="learning-hub__head"><div><span>MY HIU YHCT · HỌC THUẬT</span><h1>Learning Hub</h1><p>Quy trình thống nhất: chọn nguồn → thư mục hoặc chủ đề → số câu → học. Ôn ngắt quãng và thi chuẩn được giữ riêng để bạn quay lại đúng việc cần làm.</p></div><GraduationCap aria-hidden="true"/></header>
    <nav className="learning-hub__tabs" role="tablist" aria-label="Chọn chế độ học">{HUB_ITEMS.map(([id,label,note,Icon])=><button key={id} type="button" role="tab" aria-selected={tab===id} aria-controls={`learning-panel-${id}`} id={`learning-tab-${id}`} className={tab===id?'active':''} onClick={()=>select(id)}><Icon aria-hidden="true"/><span><b>{label}</b><small>{note}</small></span></button>)}</nav>
    <div className="learning-hub__body">
      {visited.has('lesson')&&<div id="learning-panel-lesson" role="tabpanel" aria-labelledby="learning-tab-lesson" hidden={tab!=='lesson'}><TcmHerbsFormulasLesson/></div>}
      {visited.has('quick')&&<div id="learning-panel-quick" role="tabpanel" aria-labelledby="learning-tab-quick" hidden={tab!=='quick'}><DailyDrivePractice onChooseGemini={()=>openBankSource('ai')} onChooseAll={subject=>{setBankSetup(previous=>({subject,count:0,revision:previous.revision+1}));openBankSource('hiu')}}/></div>}
      {visited.has('bank')&&<div id="learning-panel-bank" role="tabpanel" aria-labelledby="learning-tab-bank" hidden={tab!=='bank'}><PracticeBankQuiz key={`${bankSource}-${bankSetup.revision}`} preferredSource={bankSource} initialSubject={bankSetup.subject} initialCount={bankSource==='hiu'?bankSetup.count:10} onSourceChange={setBankSource}/></div>}
      {visited.has('adaptive')&&<div id="learning-panel-adaptive" role="tabpanel" aria-labelledby="learning-tab-adaptive" hidden={tab!=='adaptive'}><AdaptiveReview identity={identity}/></div>}
      {visited.has('exam')&&<div id="learning-panel-exam" role="tabpanel" aria-labelledby="learning-tab-exam" hidden={tab!=='exam'} className="learning-hub__legacy-exam"><NationalExamPrepLegacy/></div>}
    </div>
  </section>;
}