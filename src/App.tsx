import { useEffect,useRef,useState } from 'react';
import { BookOpen,CalendarDays,FlaskConical,GraduationCap,LogIn,LogOut,Medal,Newspaper,ShieldCheck,Star } from 'lucide-react';
import { BRANDING,roleAtLeast,type AcademicPost,type Member } from './types';
import { initialPosts } from './data/mockData';
import AcademicFeed from './components/feed/AcademicFeed';
import ExamCenter from './components/exam/ExamCenter';
import AdminControlCenter from './components/admin/AdminControlCenter';
import SystemAdminCenter from './components/admin/SystemAdminCenter';
import ScheduleCenter from './components/schedule/ScheduleCenter';
import ResearchCenter from './components/research/ResearchCenter';
import ProfileCenter from './components/profile/ProfileCenter';
import DrlCenter from './components/drl/DrlCenter';
import TcmNewsCenter from './components/news/TcmNewsCenter';
import PersonalCopilotWidget from './components/ai/PersonalCopilotWidget';
import { loginFast,logoutFast,restoreMember,supabase } from './services/authService';
import { fetchAcademicFeed } from './services/dataService';
import { applyTheme,readTheme,type ThemeName } from './theme';
import { FiveElementsIcon } from './components/icons/YhctIcons';

type Tab='feed'|'research'|'profile'|'schedule'|'exam'|'drl'|'news'|'admin'|'acc';
const TITLES:Record<Tab,string>={feed:'Bảng tin học thuật',research:'Trung tâm nghiên cứu',profile:'Hồ sơ học thuật',schedule:'Lịch hoạt động',exam:'Luyện thi Đánh giá Năng lực',drl:'Điểm hoạt động / Rèn luyện',news:'Tin tức Y học cổ truyền',admin:'Điều hành thành viên',acc:'Admin Control Center'};

export default function App(){
  const [tab,setTab]=useState<Tab>('feed'),[member,setMember]=useState<Member|null>(null),[posts,setPosts]=useState<AcademicPost[]>(initialPosts),[theme,setTheme]=useState<ThemeName>(()=>readTheme()),[authOpen,setAuthOpen]=useState(false),[student,setStudent]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[authPhase,setAuthPhase]=useState(''),[err,setErr]=useState('');
  const loginGuard=useRef(false),canAdmin=roleAtLeast(member?.role,'mod'),canAcc=roleAtLeast(member?.role,'admin');
  const reload=async()=>{try{setPosts(await fetchAcademicFeed())}catch{}};
  useEffect(()=>{applyTheme(theme)},[theme]);
  useEffect(()=>{void restoreMember().then(m=>m&&setMember(m));void reload()},[]);
  useEffect(()=>{if(tab==='profile'&&!member)setTab('feed');if(tab==='admin'&&!canAdmin)setTab('feed');if(tab==='acc'&&!canAcc)setTab('feed')},[tab,member,canAdmin,canAcc]);
  useEffect(()=>{if(!member)return;let sent=0;const report=(type:string,message:string)=>{if(sent++>=4)return;void supabase.rpc('record_client_diagnostic_v1',{p_event_type:type,p_message:message.slice(0,1800),p_metadata:{tab}}).then(()=>{})};const onError=(e:ErrorEvent)=>report('error',e.message||'window error'),onRejection=(e:PromiseRejectionEvent)=>report('unhandledrejection',String((e.reason as any)?.message||e.reason||'promise rejection'));window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection)}},[member,tab]);
  const login=async()=>{if(loginGuard.current)return;loginGuard.current=true;setBusy(true);setErr('');setAuthPhase('Đang kết nối máy chủ xác thực…');try{setAuthPhase('Đang xác thực MSSV…');const m=await loginFast(student.trim(),password);setMember(m);setAuthPhase('Đăng nhập thành công');setAuthOpen(false);setPassword('');await reload()}catch(e){setErr((e as Error).message||'Không thể đăng nhập');setAuthPhase('')}finally{loginGuard.current=false;setBusy(false)}};
  const logout=()=>{setMember(null);setTab('feed');logoutFast()};
  return <div className="app">
    <aside><div className="brand"><div className="brand-logo"><img src={BRANDING.logoUrl} alt="Logo CLB Y học Cổ truyền HIU"/></div><div><b>{BRANDING.platformName}</b><small>{BRANDING.owner} · {BRANDING.faculty}</small></div></div><nav><button className={tab==='feed'?'active':''} onClick={()=>setTab('feed')}><BookOpen/>Bảng tin học thuật</button><button className={tab==='research'?'active':''} onClick={()=>setTab('research')}><FlaskConical/>Trung tâm nghiên cứu</button>{member&&<button className={tab==='profile'?'active':''} onClick={()=>setTab('profile')}><Medal/>Hồ sơ học thuật</button>}<button className={tab==='schedule'?'active':''} onClick={()=>setTab('schedule')}><CalendarDays/>Lịch hoạt động</button><button className={tab==='drl'?'active':''} onClick={()=>setTab('drl')}><FiveElementsIcon/>Điểm hoạt động</button><button className={tab==='news'?'active':''} onClick={()=>setTab('news')}><Newspaper/>Tin tức YHCT</button><button className={tab==='exam'?'active':''} onClick={()=>setTab('exam')}><GraduationCap/>Luyện thi ĐGNL</button>{canAdmin&&<button className={tab==='admin'?'active':''} onClick={()=>setTab('admin')}><ShieldCheck/>Điều hành</button>}{canAcc&&<button className={`acc-nav ${tab==='acc'?'active':''}`} onClick={()=>setTab('acc')}><Star/>ACC Hệ thống</button>}</nav><footer>{member?<><b>{member.fullName}</b><small>{member.title}</small><button onClick={logout}><LogOut/>Đăng xuất</button></>:<button onClick={()=>setAuthOpen(true)}><LogIn/>Đăng nhập thành viên</button>}</footer></aside>
    <main><header className="top"><div><h1>{TITLES[tab]}</h1><p>{BRANDING.subtitle}</p></div><span className="badge">FINAL 4.0 · AUDIT RC</span><button className="mobile-account-button" onClick={member?logout:()=>setAuthOpen(true)} aria-label={member?'Đăng xuất':'Đăng nhập thành viên'} title={member?'Đăng xuất':'Đăng nhập thành viên'}>{member?<LogOut/>:<LogIn/>}</button></header>{tab==='feed'&&<AcademicFeed posts={posts} setPosts={setPosts} member={member} reload={reload}/>} {tab==='research'&&<ResearchCenter member={member}/>} {tab==='profile'&&member&&<ProfileCenter member={member}/>} {tab==='schedule'&&<ScheduleCenter member={member}/>} {tab==='drl'&&<DrlCenter member={member}/>} {tab==='news'&&<TcmNewsCenter member={member}/>} {tab==='exam'&&<ExamCenter/>} {tab==='admin'&&canAdmin&&<AdminControlCenter currentMember={member} theme={theme} onThemeChange={setTheme} onUpdate={m=>{if(member?.id===m.id)setMember(m)}}/>}{tab==='acc'&&canAcc&&<SystemAdminCenter/>}</main>
    <PersonalCopilotWidget/>
    {authOpen&&<div className="modal"><form className="auth" onSubmit={e=>{e.preventDefault();void login()}}><button type="button" className="close" disabled={busy} onClick={()=>setAuthOpen(false)}>×</button><img src={BRANDING.logoUrl} alt="Logo CLB Y học Cổ truyền HIU"/><h2>Đăng nhập thành viên</h2><p>Khách được xem nội dung công khai. Thành viên đăng nhập để đăng bài và tương tác.</p><input value={student} onChange={e=>setStudent(e.target.value)} placeholder="MSSV" inputMode="numeric" autoComplete="username" disabled={busy}/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Mật khẩu (mặc định MSSV)" autoComplete="current-password" disabled={busy}/>{authPhase&&<div className="auth-phase" role="status">{authPhase}</div>}{err&&<div className="error" role="alert">{err}</div>}<button type="submit" disabled={busy||!student.trim()||!password}>{busy?'Đang xác thực…':'Đăng nhập'}</button></form></div>}
  </div>
}
