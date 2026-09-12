import {useEffect,useMemo,useState} from 'react';
import {BookOpen,Brain,CalendarDays,ChevronRight,Download,Flame,Gamepad2,GraduationCap,LogIn,Share2,Sparkles,Target,Trophy} from 'lucide-react';
import type {Member} from '../../types';
import type {ModuleId} from '../../modules/moduleContract';
import {fetchSchedules} from '../../services/scheduleService';
import {getPwaInstallStatus,requestPwaInstall,subscribePwaInstall,type PwaInstallStatus} from '../../services/pwaInstallService';
import {readStudentJourney,saveStudentPreferences,subscribeStudentJourney,type StudentPreferences,type StudentYear,type StudyGoal} from '../../services/studentJourneyService';
import '../../student-home.css';
import {getPerformancePreference,setPerformancePreference,type PerformancePreference} from '../../services/deviceCapability';

type Props={member:Member|null;onNavigate:(module:ModuleId)=>void;onLogin:()=>void};
type NextSchedule={title:string;startsAt:string;location?:string};
const SUBJECTS=['Lý luận cơ bản YHCT','Dược liệu & Phương tễ','Châm cứu - Dưỡng sinh','Nội - Ngoại - Phụ - Nhi YHCT','Giải phẫu & Sinh lý','Nghiên cứu khoa học'];
const GOALS:Array<{value:StudyGoal;label:string}>=[{value:'daily',label:'Học đều mỗi ngày'},{value:'exam',label:'Ôn thi hiệu quả'},{value:'research',label:'Nghiên cứu khoa học'},{value:'clinical',label:'Tư duy lâm sàng'}];
const DAY_TARGET=5;
const greeting=()=>{const hour=new Date().getHours();return hour<11?'Chào buổi sáng':hour<14?'Chào buổi trưa':hour<18?'Chào buổi chiều':'Chào buổi tối'};
const goalLabel=(goal?:StudyGoal)=>GOALS.find(item=>item.value===goal)?.label||'Học đều mỗi ngày';
const todayLabel=()=>new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit'}).format(new Date());

export default function StudentHome({member,onNavigate,onLogin}:Props){
  const identity=member?.id||null,[journey,setJourney]=useState(()=>readStudentJourney(identity)),[editing,setEditing]=useState(()=>!readStudentJourney(identity).preferences),[year,setYear]=useState<StudentYear>(()=>readStudentJourney(identity).preferences?.year||1),[focus,setFocus]=useState(()=>readStudentJourney(identity).preferences?.focus||SUBJECTS[0]),[goal,setGoal]=useState<StudyGoal>(()=>readStudentJourney(identity).preferences?.goal||'daily'),[dailyMinutes,setDailyMinutes]=useState<StudentPreferences['dailyMinutes']>(()=>readStudentJourney(identity).preferences?.dailyMinutes||20),[nextSchedule,setNextSchedule]=useState<NextSchedule|null>(null),[installStatus,setInstallStatus]=useState<PwaInstallStatus>(()=>getPwaInstallStatus()),[ask,setAsk]=useState(''),[notice,setNotice]=useState('');
  const [performance,setPerformance]=useState<PerformancePreference>(getPerformancePreference);
  const profile=journey.preferences;
  const name=member?.herbalAlias||member?.fullName?.split(/\s+/).filter(Boolean).slice(-2).join(' ')||'bạn';
  const dailyProgress=Math.min(DAY_TARGET,journey.todayQuestions),dailyPercent=Math.round(dailyProgress/DAY_TARGET*100);
  const continueLabel=profile?.focus||'Khám phá kiến thức YHCT';
  const statusLine=useMemo(()=>profile?`SV năm ${profile.year} · ${goalLabel(profile.goal)} · ${profile.dailyMinutes} phút/ngày`:'Thiết lập 30 giây để cá nhân hóa lộ trình học.',[profile]);
  const dayLabel=useMemo(()=>todayLabel(),[]);
  const dailySuggestion=useMemo(()=>{
    if(!profile)return'Thiết lập lộ trình để nhận gợi ý học phù hợp hôm nay.';
    const remaining=Math.max(0,DAY_TARGET-dailyProgress);
    const untilSchedule=nextSchedule?Date.parse(nextSchedule.startsAt)-Date.now():Number.POSITIVE_INFINITY;
    if(nextSchedule&&untilSchedule>=-3600000&&untilSchedule<=24*60*60*1000)return`Có ${nextSchedule.title} sắp tới · dành ${Math.min(profile.dailyMinutes,20)} phút xem lại ${profile.focus} trước lịch.`;
    if(remaining>0)return`Hoàn thành ${remaining} câu ôn nhanh còn lại, sau đó dành ${profile.dailyMinutes} phút cho ${profile.focus}.`;
    return`Đã đạt mục tiêu ${DAY_TARGET} câu hôm nay · tiếp tục ${profile.dailyMinutes} phút với ${profile.focus}.`;
  },[profile,dailyProgress,nextSchedule]);

  useEffect(()=>{const next=readStudentJourney(identity);setJourney(next);setYear(next.preferences?.year||1);setFocus(next.preferences?.focus||SUBJECTS[0]);setGoal(next.preferences?.goal||'daily');setDailyMinutes(next.preferences?.dailyMinutes||20);setEditing(!next.preferences);return subscribeStudentJourney(identity,setJourney)},[identity]);
  useEffect(()=>subscribePwaInstall(()=>setInstallStatus(getPwaInstallStatus())),[]);
  useEffect(()=>{let alive=true;void fetchSchedules().then(items=>{if(!alive)return;const now=Date.now(),upcoming=items.filter(item=>Date.parse(item.startsAt)>=now-3600000).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))[0];setNextSchedule(upcoming?{title:upcoming.title,startsAt:upcoming.startsAt,location:upcoming.location}:null)}).catch(()=>{if(alive)setNextSchedule(null)});return()=>{alive=false}},[member?.id]);

  const saveOnboarding=()=>{const preferences:StudentPreferences={year,focus,goal,dailyMinutes};setJourney(saveStudentPreferences(preferences,identity));setEditing(false);setNotice('Đã cá nhân hóa My HIU YHCT.');window.setTimeout(()=>setNotice(''),2200)};
  const openAi=()=>{if(!member){onLogin();return}const query=ask.trim()||`Giúp tôi ôn nhanh chủ đề ${continueLabel}. Hãy nêu 3 ý cốt lõi và 3 câu tự kiểm tra.`;window.dispatchEvent(new CustomEvent('yhct:ai:open',{detail:{query,context:'student-home'}}));setAsk('')};
  const shareApp=async()=>{const data={title:'HIU YHCT 4.0',text:'Ứng dụng all-in-one học thuật Y học cổ truyền dành cho sinh viên HIU.',url:window.location.origin};try{const nav=navigator as Navigator&{share?:(value:ShareData)=>Promise<void>};if(nav.share)await nav.share(data);else{await navigator.clipboard.writeText(data.url);setNotice('Đã sao chép liên kết HIU YHCT 4.0.')}}catch{setNotice('Chưa thể chia sẻ trên trình duyệt này.')}window.setTimeout(()=>setNotice(''),2200)};
  const install=async()=>{const result=await requestPwaInstall();setInstallStatus(getPwaInstallStatus());if(result.status==='unavailable')setNotice('Mở menu trình duyệt và chọn “Thêm vào màn hình chính/Cài ứng dụng”.');else if(result.status==='installed')setNotice('Ứng dụng đã được cài trên thiết bị.');window.setTimeout(()=>setNotice(''),3200)};

  return <section className="student-home" aria-label="My HIU YHCT">
    <div className="student-home-hero">
      <div><span className="student-home-eyebrow"><Sparkles/> MY HIU YHCT</span><h2>{greeting()}, {name} 👋</h2><p>{statusLine}</p></div>
      <div className="student-home-stats"><span><Flame/><b>{journey.streak}</b><small>ngày liên tiếp</small></span><span><Trophy/><b>{journey.xp}</b><small>XP học tập</small></span><button onClick={()=>setEditing(true)}>{profile?'Chỉnh lộ trình':'Cá nhân hóa'}</button></div>
    </div>

    <div className="student-daily-context" aria-label="Bối cảnh học hôm nay">
      <div className="student-daily-date"><CalendarDays/><span><small>HÔM NAY</small><b>{dayLabel}</b></span></div>
      <div className="student-daily-suggestion"><Sparkles/><span><small>GỢI Ý HỌC</small><b>{dailySuggestion}</b>{nextSchedule&&<em>{new Date(nextSchedule.startsAt).toLocaleString('vi-VN')}{nextSchedule.location?` · ${nextSchedule.location}`:''}</em>}</span></div>
      <button className="student-link-btn" onClick={()=>onNavigate('schedule')}>Xem lịch <ChevronRight/></button>
    </div>

    {editing&&<div className="student-onboarding" role="region" aria-label="Cá nhân hóa lộ trình"><div className="student-onboarding-head"><div><b>Lộ trình học của bạn</b><small>4 lựa chọn · lưu trên thiết bị · có thể đổi bất cứ lúc nào</small></div>{profile&&<button className="student-link-btn" onClick={()=>setEditing(false)}>Đóng</button>}</div><div className="student-onboarding-grid"><label>Năm học<select value={year} onChange={e=>setYear(Number(e.target.value) as StudentYear)}>{[1,2,3,4,5,6].map(value=><option key={value} value={value}>Năm {value}</option>)}</select></label><label>Môn/chủ đề ưu tiên<select value={focus} onChange={e=>setFocus(e.target.value)}>{SUBJECTS.map(value=><option key={value}>{value}</option>)}</select></label><label>Mục tiêu<select value={goal} onChange={e=>setGoal(e.target.value as StudyGoal)}>{GOALS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Thời gian/ngày<select value={dailyMinutes} onChange={e=>setDailyMinutes(Number(e.target.value) as StudentPreferences['dailyMinutes'])}>{[10,20,30,45].map(value=><option key={value} value={value}>{value} phút</option>)}</select></label></div><button className="student-primary" onClick={saveOnboarding}><Target/> Bắt đầu lộ trình của tôi</button></div>}

    <div className="student-today-grid">
      <article className="student-action-card student-action-primary"><div className="student-action-icon"><BookOpen/></div><div><small>HỌC TIẾP</small><b>{continueLabel}</b><p>{profile?`Mục tiêu hôm nay: ${profile.dailyMinutes} phút tập trung.`:'Chọn lộ trình để Home ưu tiên đúng môn bạn đang học.'}</p></div><button onClick={()=>onNavigate('research')}>Mở học liệu <ChevronRight/></button></article>
      <article className="student-action-card"><div className="student-action-icon"><GraduationCap/></div><div><small>ÔN NHANH HÔM NAY</small><b>{dailyProgress}/{DAY_TARGET} câu</b><div className="student-progress" aria-label={`${dailyPercent}%`}><i style={{width:`${dailyPercent}%`}}/></div><p>Hoàn thành 5 câu để duy trì nhịp học mỗi ngày.</p></div><button onClick={()=>onNavigate('exam')}>Luyện ngay <ChevronRight/></button></article>
    </div>

    <div className="student-ai-strip"><div className="student-ai-copy"><span><Brain/></span><div><b>HIU YHCT AI</b><small>Một trợ lý xuyên suốt: học tập · y văn · luyện thi · lịch · cách dùng ứng dụng</small></div></div><div className="student-ai-ask"><input value={ask} onChange={e=>setAsk(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')openAi()}} placeholder={`Hỏi nhanh về ${continueLabel}…`} maxLength={500}/><button onClick={openAi}>{member?<><Sparkles/> Hỏi AI</>:<><LogIn/> Đăng nhập để hỏi</>}</button></div></div>

    <div className="student-performance"><label htmlFor="performance-mode">Hiệu ứng giao diện</label> <select id="performance-mode" value={performance} onChange={e=>{const value=e.target.value as PerformancePreference;setPerformance(value);setPerformancePreference(value)}}><option value="auto">Tự động theo thiết bị</option><option value="low">Chế độ nhẹ</option></select></div>
    <div className="student-shortcuts">
      <button onClick={()=>onNavigate('research')}><Brain/><span><b>Nghiên cứu</b><small>AI có nguồn & học liệu</small></span></button>
      <button onClick={()=>member?onNavigate('garden'):onLogin()}><Gamepad2/><span><b>Game YHCT</b><small>Gia Viên & HIU-Y-Quán</small></span></button>
      <button onClick={()=>onNavigate('exam')}><GraduationCap/><span><b>Luyện thi</b><small>Học từ điểm yếu</small></span></button>
      <button onClick={()=>void shareApp()}><Share2/><span><b>Chia sẻ</b><small>Gửi cho bạn cùng lớp</small></span></button>
      {installStatus!=='installed'&&<button onClick={()=>void install()}><Download/><span><b>Cài ứng dụng</b><small>Mở nhanh như app điện thoại</small></span></button>}
    </div>
    {notice&&<div className="student-home-notice" role="status">{notice}</div>}
    <div className="student-community-heading"><div><Sparkles/><span><b>Cộng đồng học thuật</b><small>Bài viết, ca lâm sàng và nội dung mới từ HIU YHCT</small></span></div></div>
  </section>;
}