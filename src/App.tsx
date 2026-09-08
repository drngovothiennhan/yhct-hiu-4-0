import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Bell,BookOpen,CalendarDays,Compass,FlaskConical,Gamepad2,GraduationCap,Home,LogIn,LogOut,Medal,Menu,MessageCircle,Plus,ShieldCheck,Star,UserRound,X} from 'lucide-react';
import {BRANDING,roleAtLeast,type AcademicPost,type Member} from './types';
import {initialPosts} from './data/mockData';
import AcademicFeed from './components/feed/AcademicFeed';
import ExamCenter from './components/exam/ExamCenter';
import AdminControlCenter from './components/admin/AdminControlCenter';
import SystemAdminCenter from './components/admin/SystemAdminCenter';
import AdminThemeControl from './components/admin/AdminThemeControl';
import AdminOpsAssistant from './components/admin/AdminOpsAssistant';
import ScheduleCenter from './components/schedule/ScheduleCenter';
import ResearchCenter from './components/research/ResearchCenter';
import ProfileCenter from './components/profile/ProfileCenter';
import DrlCenter from './components/drl/DrlCenter';
import NotificationsCenter from './components/notifications/NotificationsCenter';
import PersonalCopilotWidget from './components/ai/PersonalCopilotWidget';
import AiMiniFeedbackDock from './components/ai/AiMiniFeedbackDock';
import SystemBrandMark from './components/branding/SystemBrandMark';
import TcmCartoonDecor from './components/branding/TcmCartoonDecor';
import ViewportModeToggle,{applyViewportMode,readViewportMode,type ViewportMode} from './components/system/ViewportModeToggle';
import {logoutFast,restoreMember,supabase} from './services/authService';
import {loginOptimized} from './services/authRuntimeService';
import {fetchAcademicFeed} from './services/dataService';
import {applyTheme,readTheme,type ThemeName} from './theme';
import {applyDeviceCapabilityProfile} from './services/deviceCapability';
import {FiveElementsIcon} from './components/icons/YhctIcons';

const HerbGardenGame=lazy(()=>import('./components/game/HerbGardenGame'));
const MessagesCenter=lazy(()=>import('./components/messages/MessagesCenter'));
type Tab='feed'|'research'|'profile'|'schedule'|'exam'|'drl'|'notifications'|'garden'|'messages'|'admin'|'acc';
const TITLES:Record<Tab,string>={feed:'Bảng tin học thuật',research:'Khám phá học thuật',profile:'Hồ sơ học thuật',schedule:'Lịch hoạt động',exam:'Luyện thi Đánh giá Năng lực',drl:'Điểm hoạt động / Rèn luyện',notifications:'Thông báo',garden:'Gia Viên Dược Thảo',messages:'Tin nhắn',admin:'Điều hành thành viên',acc:'Admin Control Center'};
const TAB_PATHS:Record<Tab,string>={feed:'/',research:'/research',profile:'/profile',schedule:'/schedule',exam:'/exam',drl:'/drl',notifications:'/notifications',garden:'/garden',messages:'/messages',admin:'/admin',acc:'/acc'};
const PATH_TABS=new Map<string,Tab>(Object.entries(TAB_PATHS).map(([tab,path])=>[path,tab as Tab]));
const MEMBER_ONLY=new Set<Tab>(['profile','notifications','garden','messages']);
const LazyFallback=()=> <section className="panel lazy-module-loading" role="status">Đang tải module…</section>;

function normalizePath(pathname:string){
  const value=pathname.replace(/\/+$/,'')||'/';
  return value.startsWith('/')?value:`/${value}`;
}
function tabFromLocation():Tab{
  if(typeof window==='undefined')return'feed';
  if(window.location.pathname==='/profile')return'profile';
  return PATH_TABS.get(normalizePath(window.location.pathname))||'feed';
}
function replaceRoute(tab:Tab){
  const desired=TAB_PATHS[tab];
  if(normalizePath(window.location.pathname)!==desired)window.history.replaceState(null,'',desired);
}

export default function App(){
  const [tab,setTab]=useState<Tab>(()=>tabFromLocation()),[member,setMember]=useState<Member|null>(null),[authResolved,setAuthResolved]=useState(false),[posts,setPosts]=useState<AcademicPost[]>(initialPosts),[theme,setTheme]=useState<ThemeName>(()=>readTheme()),[viewportMode,setViewportMode]=useState<ViewportMode>(()=>readViewportMode()),[authOpen,setAuthOpen]=useState(false),[moreOpen,setMoreOpen]=useState(false),[composeNonce,setComposeNonce]=useState(0),[student,setStudent]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[authPhase,setAuthPhase]=useState(''),[err,setErr]=useState('');
  const loginGuard=useRef(false),canAdmin=roleAtLeast(member?.role,'mod'),canAcc=roleAtLeast(member?.role,'admin');
  const reload=async()=>{try{setPosts(await fetchAcademicFeed())}catch{}};
  useEffect(()=>{const cap=applyDeviceCapabilityProfile();return cap.dispose},[]);
  useEffect(()=>{applyTheme(canAcc?theme:'duoc-ngoc',canAcc)},[theme,canAcc]);
  useEffect(()=>{applyViewportMode(viewportMode)},[viewportMode]);
  useEffect(()=>{
    let live=true;
    void(async()=>{try{const restored=await restoreMember();if(live&&restored)setMember(restored)}finally{if(live)setAuthResolved(true)}})();
    void reload();
    return()=>{live=false};
  },[]);
  useEffect(()=>{const onPop=()=>setTab(tabFromLocation());window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[]);
  useEffect(()=>{
    if(!authResolved)return;
    let fallback:Tab|null=null;
    if(MEMBER_ONLY.has(tab)&&!member)fallback='feed';
    else if(tab==='admin'&&!canAdmin)fallback='feed';
    else if(tab==='acc'&&!canAcc)fallback='feed';
    if(fallback){setTab(fallback);replaceRoute(fallback)}
  },[authResolved,tab,member,canAdmin,canAcc]);
  useEffect(()=>{if(!moreOpen)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before}},[moreOpen]);
  useEffect(()=>{if(!member)return;let sent=0;const report=(type:string,message:string)=>{if(sent++>=4)return;void supabase.rpc('record_client_diagnostic_v1',{p_event_type:type,p_message:message.slice(0,1800),p_metadata:{tab,viewportMode,performanceTier:document.documentElement.dataset.performanceTier||'unknown'}}).then(()=>{})};const onError=(e:ErrorEvent)=>report('error',e.message||'window error'),onRejection=(e:PromiseRejectionEvent)=>report('unhandledrejection',String((e.reason as {message?:string})?.message||e.reason||'promise rejection'));window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection)}},[member,tab,viewportMode]);

  const login=async()=>{if(loginGuard.current)return;loginGuard.current=true;setBusy(true);setErr('');setAuthPhase('Đang kết nối máy chủ xác thực…');try{const m=await loginOptimized(student.trim(),password);setMember(m);setAuthResolved(true);setAuthPhase('Đăng nhập thành công');setAuthOpen(false);setPassword('');void reload()}catch(e){setErr((e as Error).message||'Không thể đăng nhập');setAuthPhase('')}finally{loginGuard.current=false;setBusy(false)}};
  const logout=()=>{setMember(null);setTab('feed');setMoreOpen(false);replaceRoute('feed');logoutFast()};
  const go=(next:Tab)=>{setTab(next);setMoreOpen(false);const desired=TAB_PATHS[next];if(normalizePath(window.location.pathname)!==desired)window.history.pushState(null,'',desired);window.scrollTo({top:0,behavior:'smooth'})};
  const requestMemberAction=(action:()=>void)=>{if(!member){setAuthOpen(true);return}action()};
  const requestCompose=()=>requestMemberAction(()=>{go('feed');setComposeNonce(x=>x+1)}),requestProfile=()=>requestMemberAction(()=>go('profile')),requestNotifications=()=>requestMemberAction(()=>go('notifications'));
  const changeViewport=(next:ViewportMode)=>{setViewportMode(next);setMoreOpen(false)};

  return <div className={`app viewport-mode-${viewportMode}`}>
    <aside>
      <div className="brand"><div className="brand-logo brand-logo--system"><SystemBrandMark variant="taiji" label="Biểu trưng hệ thống YHCT HIU 4.0"/></div><div><b>{BRANDING.platformName}</b><small>{BRANDING.owner} · {BRANDING.faculty}</small></div></div>
      <nav><button className={tab==='feed'?'active':''} onClick={()=>go('feed')}><BookOpen/>Bảng tin học thuật</button><button className={tab==='research'?'active':''} onClick={()=>go('research')}><FlaskConical/>Trung tâm nghiên cứu</button>{member&&<><button className={tab==='messages'?'active':''} onClick={()=>go('messages')}><MessageCircle/>Tin nhắn</button><button className={tab==='garden'?'active':''} onClick={()=>go('garden')}><Gamepad2/>Gia Viên Dược Thảo</button><button className={tab==='profile'?'active':''} onClick={()=>go('profile')}><Medal/>Hồ sơ học thuật</button><button className={tab==='notifications'?'active':''} onClick={()=>go('notifications')}><Bell/>Thông báo</button></>}<button className={tab==='schedule'?'active':''} onClick={()=>go('schedule')}><CalendarDays/>Lịch hoạt động</button><button className={tab==='drl'?'active':''} onClick={()=>go('drl')}><FiveElementsIcon/>Điểm hoạt động</button><button className={tab==='exam'?'active':''} onClick={()=>go('exam')}><GraduationCap/>Luyện thi ĐGNL</button>{canAdmin&&<button className={tab==='admin'?'active':''} onClick={()=>go('admin')}><ShieldCheck/>Điều hành</button>}{canAcc&&<button className={`acc-nav ${tab==='acc'?'active':''}`} onClick={()=>go('acc')}><Star/>ACC Hệ thống</button>}</nav>
      <footer>{member?<><b>{member.fullName}</b><small>{member.title}</small><button onClick={logout}><LogOut/>Đăng xuất</button></>:<button onClick={()=>setAuthOpen(true)}><LogIn/>Đăng nhập thành viên</button>}<ViewportModeToggle mode={viewportMode} onChange={changeViewport} className="viewport-toggle--sidebar"/></footer>
    </aside>
    <main>
      <header className="top"><TcmCartoonDecor/><div className="top-title"><SystemBrandMark variant="taiji" size={40} className="mobile-top-mark" label="YHCT HIU 4.0"/><div><h1>{TITLES[tab]}</h1><p>{BRANDING.subtitle}</p></div></div><div className="top-actions"><span className="badge">FINAL 4.0 · RESPONSIVE</span><button className="mobile-more-button" onClick={()=>setMoreOpen(true)} aria-label="Mở thêm chức năng" title="Thêm"><Menu/></button><button className="mobile-account-button" onClick={member?logout:()=>setAuthOpen(true)} aria-label={member?'Đăng xuất':'Đăng nhập thành viên'} title={member?'Đăng xuất':'Đăng nhập thành viên'}>{member?<LogOut/>:<LogIn/>}</button></div></header>
      {tab==='feed'&&<AcademicFeed posts={posts} setPosts={setPosts} member={member} reload={reload} composeNonce={composeNonce}/>} {tab==='research'&&<ResearchCenter member={member}/>} {tab==='profile'&&member&&<ProfileCenter member={member}/>} {tab==='notifications'&&member&&<NotificationsCenter member={member}/>} {tab==='schedule'&&<ScheduleCenter member={member}/>} {tab==='drl'&&<DrlCenter member={member}/>} {tab==='exam'&&<ExamCenter/>}
      {tab==='messages'&&member&&<Suspense fallback={<LazyFallback/>}><MessagesCenter member={member}/></Suspense>}{tab==='garden'&&member&&<Suspense fallback={<LazyFallback/>}><HerbGardenGame member={member}/></Suspense>}
      {tab==='admin'&&canAdmin&&<>{canAcc&&<AdminThemeControl theme={theme} onChange={setTheme}/>}<AdminControlCenter currentMember={member} onUpdate={m=>{if(member?.id===m.id)setMember(m)}}/></>}
      {tab==='acc'&&canAcc&&<><AdminThemeControl theme={theme} onChange={setTheme}/><AdminOpsAssistant/><SystemAdminCenter/></>}
    </main>
    <nav className="mobile-bottom-nav" aria-label="Điều hướng chính trên điện thoại"><button className={tab==='feed'?'active':''} onClick={()=>go('feed')}><Home/><span>Trang chủ</span></button><button className={tab==='research'?'active':''} onClick={()=>go('research')}><Compass/><span>Khám phá</span></button><button className="mobile-compose" onClick={requestCompose}><span className="compose-disc"><Plus/></span><span>Đăng bài</span></button><button className={tab==='notifications'?'active':''} onClick={requestNotifications}><Bell/><span>Thông báo</span></button><button className={tab==='profile'?'active':''} onClick={requestProfile}><UserRound/><span>Cá nhân</span></button></nav>
    {moreOpen&&<div className="mobile-more-backdrop" onMouseDown={()=>setMoreOpen(false)}><section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Thêm chức năng" onMouseDown={e=>e.stopPropagation()}><header><div><b>Thêm chức năng</b><small>Các khu vực ít dùng hơn được gom lại để thanh điều hướng luôn dễ bấm.</small></div><button onClick={()=>setMoreOpen(false)} aria-label="Đóng"><X/></button></header><div className="mobile-more-grid">{member&&<><button onClick={()=>go('messages')}><MessageCircle/><span><b>Tin nhắn</b><small>Trao đổi thành viên & quản trị</small></span></button><button onClick={()=>go('garden')}><Gamepad2/><span><b>Gia Viên Dược Thảo</b><small>Game học dược liệu 3 ngày</small></span></button></>}<button onClick={()=>go('schedule')}><CalendarDays/><span><b>Lịch hoạt động</b><small>Lịch CLB và phân công</small></span></button><button onClick={()=>go('drl')}><FiveElementsIcon/><span><b>Điểm hoạt động</b><small>Điểm rèn luyện và minh chứng</small></span></button><button onClick={()=>go('exam')}><GraduationCap/><span><b>Luyện thi ĐGNL</b><small>Ngân hàng câu hỏi YHCT</small></span></button>{canAdmin&&<button onClick={()=>go('admin')}><ShieldCheck/><span><b>Điều hành</b><small>Quản trị thành viên</small></span></button>}{canAcc&&<button onClick={()=>go('acc')}><Star/><span><b>ACC Hệ thống</b><small>Vận hành và chẩn đoán</small></span></button>}</div><div className="mobile-ui-choice"><div><b>Chế độ hiển thị</b><small>{viewportMode==='mobile'?'Đang dùng bố cục Mobile tối ưu thao tác chạm.':'Đang dùng bố cục Desktop.'}</small></div><ViewportModeToggle mode={viewportMode} onChange={changeViewport} className="viewport-toggle--sheet"/></div>{member?<button className="mobile-session-action" onClick={logout}><LogOut/>Đăng xuất</button>:<button className="mobile-session-action" onClick={()=>{setMoreOpen(false);setAuthOpen(true)}}><LogIn/>Đăng nhập thành viên</button>}</section></div>}
    <AiMiniFeedbackDock member={member} onLogin={()=>setAuthOpen(true)}/><PersonalCopilotWidget member={member}/>
    {authOpen&&<div className="modal"><form className="auth" onSubmit={e=>{e.preventDefault();void login()}}><button type="button" className="close" disabled={busy} onClick={()=>setAuthOpen(false)}>×</button><SystemBrandMark variant="five" size={108} className="auth-brand-mark" label="Biểu trưng đăng nhập YHCT HIU 4.0"/><h2>Đăng nhập thành viên</h2><p>Khách được xem nội dung công khai. Thành viên đăng nhập để đăng bài và tương tác.</p><input value={student} onChange={e=>setStudent(e.target.value)} placeholder="MSSV" inputMode="numeric" autoComplete="username" disabled={busy}/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Mật khẩu (mặc định MSSV)" autoComplete="current-password" disabled={busy}/>{authPhase&&<div className="auth-phase" role="status">{authPhase}</div>}{err&&<div className="error" role="alert">{err}</div>}<button type="submit" disabled={busy||!student.trim()||!password}>{busy?<><span className="auth-submit-spinner" aria-hidden="true"/>Đang xác thực…</>:'Đăng nhập'}</button></form></div>}
  </div>;
}
