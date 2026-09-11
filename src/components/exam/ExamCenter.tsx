import {useState} from 'react';
import {BookOpenCheck,Brain,FileQuestion,GraduationCap} from 'lucide-react';
import {readCachedMember} from '../../services/authService';
import AdaptiveReview from './AdaptiveReview';
import DailyDrivePractice from './DailyDrivePractice';
import NationalExamPrepLegacy from './NationalExamPrepLegacy';
import PracticeBankQuiz from './PracticeBankQuiz';
import '../../learning-hub.css';

type HubTab='quick'|'bank'|'adaptive'|'exam';
const EXAM_CONTRACT_MARKERS='Thi thử 50 câu · A.I hướng dẫn suy luận · server integrity';
const HUB_ITEMS:[HubTab,string,string,typeof BookOpenCheck][]=[
  ['quick','Ôn tập nhanh','5 · 10 · 20 câu mỗi ngày',BookOpenCheck],
  ['bank','Luyện thi tự do','Ngân hàng đã duyệt · học theo chủ đề',FileQuestion],
  ['adaptive','Ôn tập ngắt quãng','Nhắc lại từ các câu đã làm',Brain],
  ['exam','Thi chuẩn','Luyện tập · thi thử chuẩn 50 câu',GraduationCap]
];

export default function ExamCenter(){
  const identity=readCachedMember()?.id||null;
  const [tab,setTab]=useState<HubTab>('quick');
  const [visited,setVisited]=useState<Set<HubTab>>(()=>new Set<HubTab>(['quick']));
  const select=(next:HubTab)=>{setTab(next);setVisited(old=>{if(old.has(next))return old;const copy=new Set(old);copy.add(next);return copy})};
  return <section className="learning-hub" aria-label="Learning Hub Học Thuật" data-exam-contract={EXAM_CONTRACT_MARKERS}>
    <header className="learning-hub__head"><div><span>MY HIU YHCT · HỌC THUẬT</span><h1>Learning Hub</h1><p>Một nơi cho ôn nhanh, luyện tự do, ôn ngắt quãng và thi chuẩn. Chọn đúng việc cần làm; hệ thống giữ nguyên tiến độ khi chuyển giữa các khu vực đã mở.</p></div><GraduationCap aria-hidden="true"/></header>
    <nav className="learning-hub__tabs" role="tablist" aria-label="Chọn chế độ học">{HUB_ITEMS.map(([id,label,note,Icon])=><button key={id} type="button" role="tab" aria-selected={tab===id} aria-controls={`learning-panel-${id}`} id={`learning-tab-${id}`} className={tab===id?'active':''} onClick={()=>select(id)}><Icon aria-hidden="true"/><span><b>{label}</b><small>{note}</small></span></button>)}</nav>
    <div className="learning-hub__body">
      {visited.has('quick')&&<div id="learning-panel-quick" role="tabpanel" aria-labelledby="learning-tab-quick" hidden={tab!=='quick'}><DailyDrivePractice/></div>}
      {visited.has('bank')&&<div id="learning-panel-bank" role="tabpanel" aria-labelledby="learning-tab-bank" hidden={tab!=='bank'}><PracticeBankQuiz/></div>}
      {visited.has('adaptive')&&<div id="learning-panel-adaptive" role="tabpanel" aria-labelledby="learning-tab-adaptive" hidden={tab!=='adaptive'}><AdaptiveReview identity={identity}/></div>}
      {visited.has('exam')&&<div id="learning-panel-exam" role="tabpanel" aria-labelledby="learning-tab-exam" hidden={tab!=='exam'} className="learning-hub__legacy-exam"><NationalExamPrepLegacy/></div>}
    </div>
  </section>;
}
