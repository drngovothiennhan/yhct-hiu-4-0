import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {Bell,BookOpen,CalendarDays,Compass,FlaskConical,Gamepad2,GraduationCap,Home,LogIn,LogOut,Menu,Plus,Settings,ShieldCheck,Star,UserRound,X} from 'lucide-react';
import {BRANDING,canManageLearningContent,roleAtLeast,type AcademicPost,type Member} from './types';
import {initialPosts} from './data/mockData';
import SystemBrandMark from './components/branding/SystemBrandMark';
import TcmCartoonDecor from './components/branding/TcmCartoonDecor';
import ViewportModeToggle,{applyViewportMode,readViewportMode,type ViewportMode} from './components/system/ViewportModeToggle';
import AppSettingsDialog from './components/system/AppSettingsDialog';
import ModuleBoundary from './modules/ModuleBoundary';
import {MODULES,moduleFromPath,modulePath,normalizeModulePath,type ModuleId} from './modules/moduleContract';
import {logoutFast,readCachedMember,restoreMember,supabase,watchAuthSession} from './services/authService';
import {loginOptimized} from './services/authRuntimeService';
import {fetchAcademicFeed} from './services/dataService';
import {applyTheme,fetchSystemTheme,readTheme,saveSystemTheme,watchSystemTheme,type ThemeName} from './theme';
import {applyDeviceCapabilityProfile} from './services/deviceCapability';
import {initPwaInstallCapture} from './services/pwaInstallService';
import {recordModuleVisit} from './services/studentJourneyService';
import {FiveElementsIcon} from './components/icons/YhctIcons';
import './social-v5.css';
import './module-isolation.css';

const StudentHome=lazy(()=>import('./components/home/StudentHome'));
const AcademicFeed=lazy(()=>import('./components/feed/AcademicFeed'));
const ResearchCenter=lazy(()=>import('./components/research/ResearchCenter'));
const ProfileCenter=lazy(()=>import('./components/profile/ProfileCenter'));
const HerbGardenGame=lazy(()=>import('./components/game/HerbGardenGame'));
const HerbGardenSocialHub=lazy(()=>import('./components/game/HerbGardenSocialHub'));
const NotificationsCenter=lazy(()=>import('./components/notifications/NotificationsCenter'));
const ScheduleCenter=lazy(()=>import('./components/schedule/ScheduleCenter'));
const DrlCenter=lazy(()=>import('./components/drl/DrlCenter'));
const ExamCenter=lazy(()=>import('./components/exam/ExamCenter'));
const AdminControlCenter=lazy(()=>import('./components/admin/AdminControlCenter'));
const LearningContentManagerPanel=lazy(()=>import('./components/admin/LearningContentManagerPanel'));
const AdminThemeControl=lazy(()=>import('./components/admin/AdminThemeControl'));
const AdminOpsAssistant=lazy(()=>import('./components/admin/AdminOpsAssistant'));
const SystemAdminCenter=lazy(()=>import('./components/admin/SystemAdminCenter'));
const UnifiedAiMini=lazy(()=>import('./components/ai/UnifiedAiMini'));

const LazyFallback=()=> <section className="panel lazy-module-loading" role="status">Đang tải module độc lập…</section>;
function tabFromLocation():ModuleId{return typeof window==='undefined'?'feed':moduleFromPath(window.location.pathname)}
function replaceRoute(tab:ModuleId){const desired=modulePath(tab);if(normalizeModulePath(window.location.pathname)!==desired)window.history.replaceState(null,'',desired)}

export default function App(){
  const [tab,setTab]=useState<ModuleId>(()=>tabFromLocation()),[member,setMember]=useState<Member|null>(()=>readCachedMember()),[authResolved,setAuthResolved]=useState(false),[posts,setPosts]=useState<AcademicPost[]>(initialPosts),[theme,setTheme]=useState<ThemeName>(()=>readTheme()),[viewportMode,setViewportMode]=useState<ViewportMode>(()=>readViewportMode()),[authOpen,setAuthOpen]=useState(false),[moreOpen,setMoreOpen]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[composeNonce,setComposeNonce]=useState(0),[student,setStudent]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[authPhase,setAuthPhase]=useState(''),[err,setErr]=useState('');
  const loginGuard=useRef(false),canAdmin=roleAtLeast(member?.role,'mod'),canAcc=roleAtLeast(member?.role,'admin'),canLearning=canManageLearningContent(member),learningOnly=canLearning&&!canAdmin;
  const reload=async()=>{try{setPosts(await fetchAcademicFeed())}catch{}};

  useEffect(()=>{const dispose=initPwaInstallCapture();return dispose},[]);
  useEffect(()=>{const cap=applyDeviceCapabilityProfile();return cap.dispose},[]);
  useEffect(()=>{applyTheme(theme)},[theme]);
  useEffect(()=>{let live=true;const sync=async()=>{try{const next=await fetchSystemTheme();if(live)setTheme(next)}catch{}};const stop=watchSystemTheme(next=>{if(live)setTheme(next)});void sync();const interval=window.setInterval(()=>void sync(),300000),onFocus=()=>void sync(),onVisible=()=>{if(document.visibilityState==='visible')void sync()};window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onVisible);return()=>{live=false;stop();window.clearInterval(interval);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible)}},[]);
  useEffect(()=>{applyViewportMode(viewportMode)},[viewportMode]);
  useEffect(()=>{let live=true;const stop=watchAuthSession(next=>{if(!live)return;setMember(next);setAuthResolved(true)});void(async()=>{try{const restored=await restoreMember();if(live)setMember(restored)}finally{if(live)setAuthResolved(true)}})();void reload();return()=>{live=false;stop()}},[]);
  useEffect(()=>{if(normalizeModulePath(window.location.pathname)==='/messages')window.history.replaceState(null,'','/profile?inbox=1');const onPop=()=>setTab(tabFromLocation());window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop)},[]);
  useEffect(()=>{if(!authResolved)return;const definition=MODULES[tab];let fallback:ModuleId|null=null;if(definition.memberOnly&&!member)fallback='feed';else if(definition.minRole&&!roleAtLeast(member?.role,definition.minRole)&&!(tab==='admin'&&canLearning))fallback='feed';if(fallback){setTab(fallback);replaceRoute(fallback)}},[authResolved,tab,member,canLearning]);
  useEffect(()=>{if(!moreOpen&&!settingsOpen)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before}},[moreOpen,settingsOpen]);
  useEffect(()=>{recordModuleVisit(tab,member?.id)},[tab,member?.id]);
  useEffect(()=>{if(!member)return;let sent=0;const report=(type:string,message:string)=>{if(sent++>=4)return;void supabase.rpc('record_client_diagnostic_v1',{p_event_type:type,p_message:message.slice(0,1800),p_metadata:{tab,moduleScope:MODULES[tab].featureScope,viewportMode,performanceTier:document.documentElement.dataset.performanceTier||'unknown'}}).then(()=>{})};const onError=(e:ErrorEvent)=>report('error',e.message||'window error'),onRejection=(e:PromiseRejectionEvent)=>report('unhandledrejection',String((e.reason as {message?:string})?.message||e.reason||'promise rejection'));window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection)}},[member,tab,viewportMode]);

  const login=async()=>{if(loginGuard.current)return;loginGuard.current=true;setBusy(true);setErr('');setAuthPhase('Đang kết nối máy chủ xác thực…');try{const m=await loginOptimized(student.trim(),password);setMember(m);setAuthResolved(true);setAuthPhase('Đăng nhập thành công');setAuthOpen(false);setPassword('');void reload()}catch(e){setErr((e as Error).message||'Không thể đăng nhập');setAuthPhase('')}finally{loginGuard.current=false;setBusy(false)}};
  const logout=()=>{setMember(null);setTab('feed');setMoreOpen(false);replaceRoute('feed');logoutFast()};
  const go=(next:ModuleId)=>{setTab(next);setMoreOpen(false);const desired=modulePath(next);if(normalizeModulePath(window.location.pathname)!==desired)window.history.pushState(null,'',desired);window.scrollTo({top:0,behavior:'smooth'})};
  const requestMemberAction=(action:()=>void)=>{if(!member){setAuthOpen(true);return}action()};
  const requestCompose=()=>requestMemberAction(()=>{go('feed');setComposeNonce(x=>x+1)}),requestProfile=()=>requestMemberAction(()=>go('profile')),requestNotifications=()=>requestMemberAction(()=>go('notifications'));
  const changeTheme=(next:ThemeName)=>{if(!canAcc)return;void saveSystemTheme(next).then(setTheme).catch(()=>{void fetchSystemTheme().then(setTheme).catch(()=>{})})};
  const changeViewport=(next:ViewportMode)=>{setViewportMode(next);setMoreOpen(false)};
  const openSettings=()=>{setMoreOpen(false);setSettingsOpen(true)};
  const adminLabel=learningOnly?'Quản lý Học tập':MODULES.admin.label,activeTitle=tab==='admin'&&learningOnly?'Quản lý Học tập':MODULES[tab].title;

  const moduleContent=<ModuleBoundary moduleId={tab}><Suspense fallback={<LazyFallback/>}>
    {tab==='feed'&&<><StudentHome member={member} onNavigate={go} onLogin={()=>setAuthOpen(true)}/><AcademicFeed posts={posts} setPosts={setPosts} member={member} reload={reload} composeNonce={composeNonce}/></>}
    {tab==='research'&&<ResearchCenter member={member} onLogin={()=>setAuthOpen(true)}/>} 
    {tab==='profile'&&member&&<ProfileCenter member={member}/>} 
    {tab==='garden'&&member&&<><HerbGardenGame member={member}/><HerbGardenSocialHub member={member}/></>} 
    {tab==='notifications'&&member&&<NotificationsCenter member={member}/>} 
    {tab==='schedule'&&<ScheduleCenter member={member}/>} 
    {tab==='drl'&&<DrlCenter member={member}/>} 
    {tab==='exam'&&<ExamCenter/>}
    {tab==='admin'&&canAdmin&&<AdminControlCenter currentMember={member} onUpdate={m=>{if(member?.id===m.id)setMember(m)}}/>}
    {tab==='admin'&&learningOnly&&<LearningContentManagerPanel/>}
    {tab==='acc'&&canAcc&&<><AdminThemeControl theme={theme} onChange={changeTheme}/><AdminOpsAssistant/><SystemAdminCenter/></>}
  </Suspense></ModuleBoundary>;

  return <div className={`app viewport-mode-${viewportMode}`} data-active-module={tab}>
    <aside><div className="brand"><div className="brand-logo brand-logo--system"><SystemBrandMark variant="taiji" label="Biểu trưng hệ thống YHCT HIU 4.0"/></div><div><b>{BRANDING.platformName}</b><small>{BRANDING.owner} · {BRANDING.faculty}</small></div></div>
      <nav><button className={tab==='feed'?'active':''} onClick={()=>go('feed')}><BookOpen/>{MODULES.feed.label}</button><button className={tab==='research'?'active':''} onClick={()=>go('research')}><FlaskConical/>{MODULES.research.label}</button>{member&&<><button className={tab==='profile'?'active':''} onClick={()=>go('profile')}><UserRound/>{MODULES.profile.label}</button><button className={tab==='garden'?'active':''} onClick={()=>go('garden')}><Gamepad2/>{MODULES.garden.label}</button><button className={tab==='notifications'?'active':''} onClick={()=>go('notifications')}><Bell/>{MODULES.notifications.label}</button></>}<button className={tab==='schedule'?'active':''} onClick={()=>go('schedule')}><CalendarDays/>{MODULES.schedule.label}</button><button className={tab==='drl'?'active':''} onClick={()=>go('drl')}><FiveElementsIcon/>{MODULES.drl.label}</button><button className={tab==='exam'?'active':''} onClick={()=>go('exam')}><GraduationCap/>{MODULES.exam.label}</button>{(canAdmin||canLearning)&&<button className={tab==='admin'?'active':''} onClick={()=>go('admin')}><ShieldCheck/>{adminLabel}</button>}{canAcc&&<button className={`acc-nav ${tab==='acc'?'active':''}`} onClick={()=>go('acc')}><Star/>{MODULES.acc.label}</button>}</nav>
      <footer>{member?<><b>{member.herbalAlias||member.fullName}</b><small>{member.fullName} · {member.title}</small><button onClick={logout}><LogOut/>Đăng xuất</button></>:<button onClick={()=>setAuthOpen(true)}><LogIn/>Đăng nhập thành viên</button>}<button onClick={openSettings}><Settings/>Cài đặt</button><ViewportModeToggle mode={viewportMode} onChange={changeViewport} className="viewport-toggle--sidebar"/></footer>
    </aside>
    <main><header className="top"><TcmCartoonDecor/><div className="top-title"><SystemBrandMark variant="taiji" size={40} className="mobile-top-mark" label="YHCT HIU 4.0"/><div><h1>{activeTitle}</h1><p>{BRANDING.subtitle}</p></div></div><div className="top-actions"><span className="badge">FINAL 4.0 · STUDENT HUB</span><button className="mobile-more-button" onClick={()=>setMoreOpen(true)} aria-label="Mở thêm chức năng" title="Thêm"><Menu/></button><button className="mobile-account-button" onClick={member?logout:()=>setAuthOpen(true)} aria-label={member?'Đăng xuất':'Đăng nhập thành viên'} title={member?'Đăng xuất':'Đăng nhập thành viên'}>{member?<LogOut/>:<LogIn/>}</button></div></header>
      {moduleContent}
    </main>
    <nav className="mobile-bottom-nav" aria-label="Điều hướng chính trên điện thoại"><button className={tab==='feed'?'active':''} onClick={()=>go('feed')}><Home/><span>Trang chủ</span></button><button className={tab==='research'?'active':''} onClick={()=>go('research')}><Compass/><span>Khám phá</span></button><button className="mobile-compose" onClick={requestCompose}><span className="compose-disc"><Plus/></span><span>Đăng bài</span></button><button className={tab==='notifications'?'active':''} onClick={requestNotifications}><Bell/><span>Thông báo</span></button><button className={tab==='profile'?'active':''} onClick={requestProfile}><UserRound/><span>Cá nhân</span></button></nav>
    {moreOpen&&<div className="mobile-more-backdrop" onMouseDown={()=>setMoreOpen(false)}><section className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="Thêm chức năng" onMouseDown={e=>e.stopPropagation()}><header><div><b>Thêm chức năng</b><small>Các module học tập, hoạt động và game của HIU YHCT.</small></div><button onClick={()=>setMoreOpen(false)} aria-label="Đóng"><X/></button></header><div className="mobile-more-grid">{member&&<button onClick={()=>go('garden')}><Gamepad2/><span><b>Gia Viên Dược Thảo</b><small>Vườn dược liệu và HIU-Y-Quán</small></span></button>}<button onClick={()=>go('schedule')}><CalendarDays/><span><b>Lịch hoạt động</b><small>Lịch CLB và phân công</small></span></button><button onClick={()=>go('drl')}><FiveElementsIcon/><span><b>Điểm hoạt động</b><small>Điểm rèn luyện và minh chứng</small></span></button><button onClick={()=>go('exam')}><GraduationCap/><span><b>Luyện thi ĐGNL</b><small>Ngân hàng câu hỏi YHCT</small></span></button>{(canAdmin||canLearning)&&<button onClick={()=>go('admin')}><ShieldCheck/><span><b>{adminLabel}</b><small>{learningOnly?'Tài liệu, quiz và duyệt nội dung Học tập':'Phân quyền và kiểm duyệt; không chỉnh theme'}</small></span></button>}{canAcc&&<button onClick={()=>go('acc')}><Star/><span><b>ACC Hệ thống</b><small>Vận hành hệ thống và giao diện</small></span></button>}<button onClick={openSettings}><Settings/><span><b>Cài đặt</b><small>Cài PWA và chế độ hiển thị</small></span></button></div><div className="mobile-ui-choice"><div><b>Chế độ hiển thị</b><small>{viewportMode==='mobile'?'Đang dùng bố cục Mobile tối ưu thao tác chạm.':'Đang dùng bố cục Desktop.'}</small></div><ViewportModeToggle mode={viewportMode} onChange={changeViewport} className="viewport-toggle--sheet"/></div>{member?<button className="mobile-session-action" onClick={logout}><LogOut/>Đăng xuất</button>:<button className="mobile-session-action" onClick={()=>{setMoreOpen(false);setAuthOpen(true)}}><LogIn/>Đăng nhập thành viên</button>}</section></div>}
    <AppSettingsDialog open={settingsOpen} onClose={()=>setSettingsOpen(false)} viewportMode={viewportMode} onViewportChange={setViewportMode}/>
    <Suspense fallback={null}><UnifiedAiMini member={member} onLogin={()=>setAuthOpen(true)}/></Suspense>
    {authOpen&&<div className="modal"><form className="auth" onSubmit={e=>{e.preventDefault();void login()}}><button type="button" className="close" disabled={busy} onClick={()=>setAuthOpen(false)}>×</button><SystemBrandMark variant="five" size={108} className="auth-brand-mark" label="Biểu trưng đăng nhập YHCT HIU 4.0"/><h2>Đăng nhập thành viên</h2><p>Khách được xem nội dung công khai. Thành viên đăng nhập để đăng bài, tương tác, lưu tiến độ và sử dụng A.I học thuật.</p><input value={student} onChange={e=>setStudent(e.target.value)} placeholder="MSSV" inputMode="numeric" autoComplete="username" disabled={busy}/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Mật khẩu (mặc định MSSV)" autoComplete="current-password" disabled={busy}/>{authPhase&&<div className="auth-phase" role="status">{authPhase}</div>}{err&&<div className="error" role="alert">{err}</div>}<button type="submit" disabled={busy||!student.trim()||!password}>{busy?<><span className="auth-submit-spinner" aria-hidden="true"/>Đang xác thực…</>:'Đăng nhập'}</button></form></div>}
  </div>;
}