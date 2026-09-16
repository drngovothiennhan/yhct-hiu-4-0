import {useEffect,useMemo,useState} from 'react';
import {BookOpen,FileText,RefreshCw} from 'lucide-react';
import {listPublishedLearningResources,type LearningResourceHit} from '../../services/learningResourceService';
import {requestDeadline} from '../../services/aiRequest';
import './document-library.css';

export default function DocumentLibrary({memberId,onLogin}:{memberId?:string;onLogin:()=>void}){
 const [items,setItems]=useState<LearningResourceHit[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{
  setItems([]);setError('');if(!memberId){setBusy(false);return}
  let alive=true;const controller=new AbortController(),deadline=requestDeadline(15000,controller.signal);setBusy(true);
  void listPublishedLearningResources(deadline.signal).then(rows=>{if(alive)setItems(rows)}).catch(()=>{if(alive)setError('Chưa tải được danh mục tài liệu. Bạn có thể thử lại.')}).finally(()=>{deadline.dispose();if(alive)setBusy(false)});
  return()=>{alive=false;controller.abort();deadline.dispose()};
 },[memberId,revision]);
 const visible=useMemo(()=>items.filter(item=>item.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))),[items,query]);
 return <section className="document-library" aria-label="Thư viện tài liệu HIU">
  <header><div><h2><BookOpen/> Thư viện tài liệu</h2><p>Tài liệu học tập đã phát hành dành cho thành viên.</p></div>{memberId&&<button disabled={busy} onClick={()=>setRevision(value=>value+1)} aria-label="Làm mới thư viện"><RefreshCw/></button>}</header>
  {!memberId?<button onClick={onLogin}>Đăng nhập để xem tài liệu</button>:<>
   <label>Tìm tài liệu<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Nhập tên tài liệu…" maxLength={200}/></label>
   {busy?<p role="status">Đang tải danh mục…</p>:error?<p role="alert">{error}</p>:visible.length?<ul>{visible.map(item=><li key={item.resourceKey}><FileText/><div><b>{item.title}</b><small>{item.mimeType||'Tài liệu'}{item.updatedAt&&!Number.isNaN(Date.parse(item.updatedAt))?` · ${new Date(item.updatedAt).toLocaleDateString('vi-VN')}`:''}</small></div><span>Chưa mở tải</span></li>)}</ul>:<p>{items.length?'Không tìm thấy tài liệu phù hợp.':'Chưa có tài liệu được phát hành cho thành viên.'}</p>}
   <p className="document-library__note">Góc thư viện đã sẵn sàng. Chức năng tải sẽ mở sau khi quản trị viên hoàn tất liên kết và quyền tải tài liệu.</p>
  </>}
 </section>;
}
