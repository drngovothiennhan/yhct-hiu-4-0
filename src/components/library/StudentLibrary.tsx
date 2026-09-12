import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BookOpen,Check,Copy,FileText,FlaskConical,GraduationCap,LibraryBig,LoaderCircle,LockKeyhole,RefreshCw} from 'lucide-react';
import type {Member} from '../../types';
import type {ModuleId} from '../../modules/moduleContract';
import {getLearningResource,learningResourceLink,listLearningResources,resourceKeyFromPath,type LearningResource} from '../../services/learningResourceService';
import {setLearningQuizPreset} from '../../services/learningLaunchService';
import './student-library.css';

type Props={member:Member|null;onLogin:()=>void;onNavigate:(module:ModuleId)=>void};
const typeLabel=(type:LearningResource['resourceType'])=>type==='quiz_source'?'Quiz học tập':type==='reference'?'Tài liệu tham khảo':'Tài liệu học';

export default function StudentLibrary({member,onLogin,onNavigate}:Props){
  const deepKey=useMemo(()=>typeof window==='undefined'?null:resourceKeyFromPath(window.location.pathname),[]);
  const [items,setItems]=useState<LearningResource[]>([]),[selected,setSelected]=useState<LearningResource|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[copied,setCopied]=useState('');
  const load=async()=>{
    if(!member)return;
    setBusy(true);setMessage('');
    try{
      const resources=await listLearningResources(80);setItems(resources);
      if(deepKey){const found=resources.find(x=>x.resourceKey===deepKey)||await getLearningResource(deepKey);setSelected(found);if(!found)setMessage('Tài nguyên này không còn được phát hành hoặc bạn không có quyền xem.')}
    }catch(e){const text=(e as Error).message;setMessage(text==='AUTH_REQUIRED'?'Đăng nhập để mở Thư viện học tập.':text)}finally{setBusy(false)}
  };
  useEffect(()=>{void load()},[member?.id]);
  const open=(item:LearningResource)=>{setSelected(item);setMessage('');window.history.pushState(null,'',learningResourceLink(item.resourceKey));window.scrollTo({top:0,behavior:'smooth'})};
  const copy=async(item:LearningResource)=>{
    const url=new URL(learningResourceLink(item.resourceKey),window.location.origin).toString();
    try{await navigator.clipboard.writeText(url);setCopied(item.resourceKey);window.setTimeout(()=>setCopied(''),1800)}catch{setMessage('Không thể sao chép tự động. Hãy dùng chức năng chia sẻ của trình duyệt.')}
  };
  const startQuiz=(item:LearningResource)=>{setLearningQuizPreset({count:20,subject:item.title,resourceKey:item.resourceKey});onNavigate('exam')};

  if(!member)return <section className="student-library" aria-label="Thư viện học tập"><header className="student-library__hero"><LibraryBig/><div><span>MY HIU YHCT · THƯ VIỆN</span><h2>Tài liệu đã phát hành, ở một nơi</h2><p>Thư viện chỉ hiển thị tài nguyên đã được hệ thống phát hành cho thành viên. Liên kết trong ứng dụng không làm lộ kho lưu trữ phía sau.</p></div></header><div className="student-library__login"><LockKeyhole/><div><h3>Đăng nhập để mở Thư viện</h3><p>Tài liệu học và quiz đã duyệt được gắn với tài khoản thành viên.</p></div><button onClick={onLogin}>Đăng nhập <ArrowRight/></button></div><button className="student-library__research" onClick={()=>onNavigate('research')}><FlaskConical/> Cần tra cứu y văn? Mở Trung tâm nghiên cứu</button></section>;

  return <section className="student-library" aria-label="Thư viện học tập">
    <header className="student-library__hero"><LibraryBig/><div><span>MY HIU YHCT · THƯ VIỆN</span><h2>Kho học tập đã phát hành</h2><p>Chỉ hiện nội dung đã được duyệt/phát hành. Tài nguyên dùng mã HIU ổn định; nguồn lưu trữ kỹ thuật được ẩn khỏi giao diện sinh viên.</p></div><button onClick={()=>void load()} disabled={busy}><RefreshCw className={busy?'spin':''}/>{busy?'Đang tải':'Làm mới'}</button></header>
    {selected&&<article className="student-library__selected"><div className="student-library__type">{selected.resourceType==='quiz_source'?<GraduationCap/>:<FileText/>}<span>{typeLabel(selected.resourceType)}</span></div><h3>{selected.title}</h3><p>{selected.resourceType==='quiz_source'?'Bộ câu hỏi đã duyệt, sẵn sàng luyện tập trong Learning Hub.':'Tài nguyên học tập đã được phát hành cho thành viên.'}</p><div>{selected.resourceType==='quiz_source'&&<button className="primary" onClick={()=>startQuiz(selected)}><GraduationCap/>Làm quiz 20 câu <ArrowRight/></button>}<button className="secondary" onClick={()=>void copy(selected)}>{copied===selected.resourceKey?<><Check/>Đã sao chép</>:<><Copy/>Sao chép liên kết</>}</button></div></article>}
    <div className="student-library__toolbar"><div><b>{items.length}</b><span>tài nguyên đang phát hành</span></div><button onClick={()=>onNavigate('research')}><FlaskConical/>Nghiên cứu có nguồn</button></div>
    {message&&<div className="student-library__message" role="status">{message}</div>}
    {busy&&!items.length?<div className="student-library__loading"><LoaderCircle className="spin"/>Đang đồng bộ thư viện…</div>:items.length?<div className="student-library__grid">{items.map(item=><article key={item.resourceKey} className={selected?.resourceKey===item.resourceKey?'active':''}><div className="student-library__type">{item.resourceType==='quiz_source'?<GraduationCap/>:<BookOpen/>}<span>{typeLabel(item.resourceType)}</span></div><h3>{item.title}</h3><small>{item.publishedAt?`Phát hành ${new Date(item.publishedAt).toLocaleDateString('vi-VN')}`:'Đã phát hành'}</small><div><button onClick={()=>open(item)}>Mở <ArrowRight/></button>{item.resourceType==='quiz_source'&&<button onClick={()=>startQuiz(item)}>Làm quiz</button>}<button aria-label={`Sao chép liên kết ${item.title}`} onClick={()=>void copy(item)}><Copy/></button></div></article>)}</div>:!busy&&<div className="student-library__empty"><LibraryBig/><h3>Chưa có tài nguyên được phát hành</h3><p>Khi Ban Quản lý Học tập duyệt và phát hành tài liệu/quiz, nội dung sẽ xuất hiện tại đây.</p></div>}
  </section>;
}