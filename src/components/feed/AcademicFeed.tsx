import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,Hash,Plus,Search} from 'lucide-react';
import type {AcademicPost,Member} from '../../types';
import {roleAtLeast} from '../../types';
import AcademicPostCard from './AcademicPostCard';
import CommunitySidebar from '../community/CommunitySidebar';
import AcademicPostComposer from './AcademicPostComposer';
import DocxImportPanel from './DocxImportPanel';
import {supabase} from '../../services/authService';
import {addComment,createPost,deletePost,draftFromPost,repost,toggleBookmark,toggleFollow,toggleReaction,updatePost,type PostDraft} from '../../services/socialService';

const DesktopAcademicWidgets=lazy(()=>import('../widgets/DesktopAcademicWidgets'));
const SYSTEM_AI_CODE='AI-YHCT-SYSTEM';
const SYSTEM_AI_NAME='YHCT HIU A.I Học thuật';
const PAGE_SIZE=3;
const MEDIA_PRIORITY_WINDOW_MS=24*60*60*1000;
const empty=():PostDraft=>({title:'',chiefComplaint:'',fourExams:{vong:'',van:'',vanHoi:'',thiet:''},eightPrinciples:[],syndrome:'',treatmentPrinciple:'',formula:'',acupoints:[],tags:[],citations:[],postType:'research',specialty:'general',visibility:'public',media:[]});
const isSystemAiPost=(p:AcademicPost)=>p.author.studentCode===SYSTEM_AI_CODE||p.author.fullName===SYSTEM_AI_NAME;
const postTime=(p:AcademicPost)=>{const value=Date.parse(p.approvedAt||p.createdAt);return Number.isFinite(value)?value:0};
const hasMedia=(p:AcademicPost)=>Boolean(p.media?.some(m=>Boolean(m.url)));
function feedOrder(a:AcademicPost,b:AcademicPost){const ta=postTime(a),tb=postTime(b),delta=tb-ta;if(Math.abs(delta)<=MEDIA_PRIORITY_WINDOW_MS&&hasMedia(a)!==hasMedia(b))return hasMedia(a)?-1:1;return delta}
function useDesktopWidgetGate(){const [enabled,setEnabled]=useState(false);useEffect(()=>{const media=window.matchMedia('(min-width:1600px)'),root=document.documentElement,sync=()=>setEnabled(media.matches&&root.dataset.viewportMode==='desktop');sync();media.addEventListener('change',sync);const observer=new MutationObserver(sync);observer.observe(root,{attributes:true,attributeFilter:['data-viewport-mode']});return()=>{media.removeEventListener('change',sync);observer.disconnect()}},[]);return enabled}

export default function AcademicFeed({posts,setPosts,member,reload,composeNonce=0}:{posts:AcademicPost[];setPosts:React.Dispatch<React.SetStateAction<AcademicPost[]>>;member:Member|null;reload:()=>Promise<void>;composeNonce?:number}){
  const [q,setQ]=useState(''),[tag,setTag]=useState(''),[page,setPage]=useState(0),[draft,setDraft]=useState<PostDraft|null>(null),[editId,setEditId]=useState<string|null>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const desktopWidgets=useDesktopWidgetGate(),tags=useMemo(()=>[...new Set(posts.flatMap(p=>p.tags))],[posts]);
  const visibleSystemAiIds=useMemo(()=>new Set(posts.filter(isSystemAiPost).sort((a,b)=>postTime(b)-postTime(a)).slice(0,3).map(p=>p.id)),[posts]);
  const filtered=useMemo(()=>posts.filter(p=>(!isSystemAiPost(p)||visibleSystemAiIds.has(p.id))&&(!tag||p.tags.includes(tag))&&(!q||`${p.title} ${p.syndrome} ${p.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))).sort(feedOrder),[posts,q,tag,visibleSystemAiIds]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const shown=useMemo(()=>filtered.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE),[filtered,page]);
  useEffect(()=>{setPage(0)},[q,tag]);
  useEffect(()=>{setPage(current=>Math.min(current,pageCount-1))},[pageCount]);
  useEffect(()=>{if(!composeNonce||!member)return;setEditId(null);setDraft(empty());window.setTimeout(()=>document.querySelector('.composer-editor')?.scrollIntoView({behavior:'smooth',block:'start'}),0)},[composeNonce,member]);
  const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);setMsg('');try{await fn();await reload()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  const save=async()=>{if(!draft||busy)return;setBusy(true);setMsg('');try{if(editId){await updatePost(editId,draft);await reload();setDraft(null);setEditId(null);setMsg('Đã cập nhật bài. Nếu nội dung cần kiểm duyệt lại, trạng thái sẽ hiển thị trong hệ thống.')}else{const postId=await createPost(draft);await reload();setDraft(null);setEditId(null);setMsg(`Đã gửi bài thành công · mã ${postId.slice(0,8)}. Bài đã vào hàng đợi kiểm duyệt và MOD/Admin đã nhận thông báo.`)}}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  const needMember=()=>{if(!member){setMsg('Vui lòng đăng nhập thành viên để tương tác.');return false}return true};
  const verifyPost=(post:AcademicPost,verified:boolean)=>run(async()=>{const {error}=await supabase.rpc('set_post_mod_verified',{p_post_id:post.id,p_verified:verified});if(error)throw error});
  return <section className={`feed-layout${desktopWidgets?' has-desktop-widgets':''}`} data-system-ai-visible={visibleSystemAiIds.size} data-feed-page-size={PAGE_SIZE} data-news-surface="hidden">
    {desktopWidgets&&<Suspense fallback={null}><DesktopAcademicWidgets member={member}/></Suspense>}
    <div className="feed-main"><div className="between feed-toolbar"><div className="feed-tools"><div className="searchbox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm y án, thể bệnh, hashtag…" aria-label="Tìm trong bảng tin học thuật"/></div><div className="chips"><button className={!tag?'active':''} onClick={()=>setTag('')}>Tất cả</button>{tags.map(t=><button className={tag===t?'active':''} key={t} onClick={()=>setTag(t)}><Hash/>{t}</button>)}</div></div>{member&&<button className="desktop-compose-button" onClick={()=>{setEditId(null);setDraft(empty());setMsg('')}}><Plus/>Đăng bài học thuật</button>}</div>{msg&&<div className="ai-note submission-confirmation" role="status" aria-live="polite">{msg}</div>}{draft&&<>{roleAtLeast(member?.role,'mod')&&<DocxImportPanel onApply={suggestion=>setDraft(current=>current?{...current,title:suggestion.title||current.title,chiefComplaint:suggestion.summary||current.chiefComplaint,tags:[...new Set([...current.tags,...suggestion.tags])].slice(0,12)}:current)}/>}<AcademicPostComposer draft={draft} onChange={setDraft} onSave={()=>void save()} onClose={()=>{setDraft(null);setEditId(null)}} busy={busy} editing={!!editId}/></>}{shown.map(p=><AcademicPostCard key={p.id} post={p} member={member} onFollow={x=>{if(needMember())void run(()=>toggleFollow(member!,x.author.id))}} onBookmark={x=>{if(needMember())void run(()=>toggleBookmark(member!,x.id).then(v=>setPosts(a=>a.map(z=>z.id===x.id?{...z,bookmarked:v}:z))))}} onLike={x=>{if(needMember())void run(()=>toggleReaction(member!,x.id,'like'))}} onComment={x=>{if(!needMember())return;const body=window.prompt('Nội dung bình luận học thuật:')||'';if(body.trim())void run(()=>addComment(member!,x.id,body))}} onRepost={x=>{if(!needMember())return;const quote=window.prompt('Nhận xét / trích dẫn học thuật:')||'';if(quote.trim())void run(()=>repost(member!,x.id,quote))}} onEdit={x=>{setEditId(x.id);setDraft(draftFromPost(x));window.scrollTo({top:0,behavior:'smooth'})}} onDelete={x=>{if(window.confirm('Xóa bài viết này?'))void run(()=>deletePost(x.id))}} onVerify={(x,verified)=>void verifyPost(x,verified)}/>) }{filtered.length>PAGE_SIZE&&<nav className="feed-pagination" aria-label="Phân trang bảng tin học thuật"><button className="secondary" disabled={page===0} onClick={()=>{setPage(p=>Math.max(0,p-1));window.scrollTo({top:0,behavior:'smooth'})}}><ChevronLeft/>Bài mới hơn</button><span><b>Trang {page+1}/{pageCount}</b><small>Tối đa {PAGE_SIZE} bài/trang · bài có ảnh được ưu tiên trong cùng 24 giờ</small></span><button className="secondary" disabled={page>=pageCount-1} onClick={()=>{setPage(p=>Math.min(pageCount-1,p+1));window.scrollTo({top:0,behavior:'smooth'})}}>Bài cũ hơn<ChevronRight/></button></nav>}</div>
    <CommunitySidebar/>
  </section>;
}