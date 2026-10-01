import {useEffect,useMemo,useState} from 'react';
import {BookOpen,FileText,RefreshCw} from 'lucide-react';
import {listPublishedLearningResources,type LearningResourceHit} from '../../services/learningResourceService';
import {requestDeadline} from '../../services/aiRequest';
import './document-library.css';

export default function DocumentLibrary({memberId,onLogin}:{memberId?:string;onLogin:()=>void}){
 const [items,setItems]=useState<LearningResourceHit[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [deepLinkKey]=useState(()=>{try{return new URLSearchParams(window.location.search).get('resourceKey')||''}catch{return ''}});
 const safeDeepLinkKey=/^hiu_res_[0-9a-f]{20}$/.test(deepLinkKey)?deepLinkKey:'';
 useEffect(()=>{
  setItems([]);setError('');if(!memberId){setBusy(false);return}
  let alive=true;const controller=new AbortController(),deadline=requestDeadline(15000,controller.signal);setBusy(true);
  void listPublishedLearningResources(deadline.signal).then(rows=>{if(alive)setItems(rows)}).catch(()=>{if(alive)setError('Chưa tải được danh mục tài liệu. Bạn có thể thử lại.')}).finally(()=>{deadline.dispose();if(alive)setBusy(false)});
  return()=>{alive=false;controller.abort();deadline.dispose()};
 },[memberId,revision]);
 useEffect(()=>{
  if(!safeDeepLinkKey||busy||!items.some(item=>item.resourceKey===safeDeepLinkKey))return;
  const frame=window.requestAnimationFrame(()=>document.getElementById(`learning-resource-${safeDeepLinkKey}`)?.scrollIntoView({block:'center',behavior:'smooth'}));
  return()=>window.cancelAnimationFrame(frame);
 },[safeDeepLinkKey,busy,items]);
 const visible=useMemo(()=>items.filter(item=>item.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))),[items,query]);
 const deepLinkedItem=items.find(item=>item.resourceKey===safeDeepLinkKey);
 return <section className="document-library" aria-label="Thư viện tài liệu HIU">
  <header><div><h2><BookOpen/> Thư viện tài liệu</h2><p>Tài liệu học tập đã phát hành dành cho thành viên.</p></div>{memberId&&<button disabled={busy} onClick={()=>setRevision(value=>value+1)} aria-label="Làm mới thư viện"><RefreshCw/></button>}</header>
  {!memberId?<button onClick={onLogin}>Đăng nhập để xem tài liệu</button>:<>
   <label>Tìm tài liệu<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nhập tên tài liệu…" maxLength={200}/></label>
   {deepLinkedItem&&<p className="document-library__linked" role="status">Đang mở học liệu được chuyển từ HIU TMC Hub: <b>{deepLinkedItem.title}</b></p>}
   {busy?<p role="status">Đang tải danh mục…</p>:error?<p role="alert">{error}</p>:visible.length?<ul>{visible.map(item=><li id={`learning-resource-${item.resourceKey}`} className={item.resourceKey===safeDeepLinkKey?'document-library__from-hub':''} key={item.resourceKey} tabIndex={item.resourceKey===safeDeepLinkKey?-1:undefined}><FileText/><div><b>{item.title}</b><small>{item.mimeType||'Tài liệu'}{item.updatedAt&&!Number.isNaN(Date.parse(item.updatedAt))?` · ${new Date(item.updatedAt).toLocaleDateString('vi-VN')}`:''}</small></div><span>Đã xuất bản</span></li>)}</ul>:<p>{items.length?'Không tìm thấy tài liệu phù hợp.':'Chưa có tài liệu được phát hành cho thành viên.'}</p>}
   <p className="document-library__note">Tài liệu được quản lý và kiểm tra quyền truy cập trong StudyOS. Trình đọc online ở Hub chỉ mở định dạng được hỗ trợ.</p>
  </>}
 </section>;
}
