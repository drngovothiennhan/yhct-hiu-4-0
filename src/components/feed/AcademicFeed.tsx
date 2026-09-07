import { useEffect,useMemo,useState } from 'react';
import { Hash,Plus,Search } from 'lucide-react';
import type { AcademicPost,Member } from '../../types';
import AcademicPostCard,{academicScore} from './AcademicPostCard';
import TcmNewsRotator from '../news/TcmNewsRotator';
import CommunitySidebar from '../community/CommunitySidebar';
import AcademicComposer from './AcademicComposer';
import { supabase } from '../../services/authService';
import { addComment,createPost,deletePost,draftFromPost,repost,toggleBookmark,toggleFollow,toggleReaction,updatePost,type PostDraft } from '../../services/socialService';

const empty=():PostDraft=>({title:'',chiefComplaint:'',fourExams:{vong:'',van:'',vanHoi:'',thiet:''},eightPrinciples:[],syndrome:'',treatmentPrinciple:'',formula:'',acupoints:[],tags:[],citations:[],postType:'research',specialty:'general',visibility:'public',media:[]});

export default function AcademicFeed({posts,setPosts,member,reload,composeNonce=0}:{posts:AcademicPost[];setPosts:React.Dispatch<React.SetStateAction<AcademicPost[]>>;member:Member|null;reload:()=>Promise<void>;composeNonce?:number}){
  const [q,setQ]=useState(''),[tag,setTag]=useState(''),[draft,setDraft]=useState<PostDraft|null>(null),[editId,setEditId]=useState<string|null>(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const tags=useMemo(()=>[...new Set(posts.flatMap(p=>p.tags))],[posts]);
  const shown=useMemo(()=>posts.filter(p=>(!tag||p.tags.includes(tag))&&(!q||`${p.title} ${p.syndrome} ${p.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()))).sort((a,b)=>academicScore(b)-academicScore(a)),[posts,q,tag]);
  useEffect(()=>{if(!composeNonce||!member)return;setEditId(null);setDraft(empty());window.setTimeout(()=>document.querySelector('.composer-editor')?.scrollIntoView({behavior:'smooth',block:'start'}),0)},[composeNonce,member]);
  const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);setMsg('');try{await fn();await reload()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  const save=async()=>{if(!draft)return;await run(async()=>{if(editId)await updatePost(editId,draft);else await createPost(draft);setDraft(null);setEditId(null);setMsg('Bài viết đã được gửi vào hàng đợi kiểm duyệt. Chỉ bài đã duyệt mới xuất hiện trên Newsfeed.')})};
  const needMember=()=>{if(!member){setMsg('Vui lòng đăng nhập thành viên để tương tác.');return false}return true};
  const verifyPost=(post:AcademicPost,verified:boolean)=>run(async()=>{const {error}=await supabase.rpc('moderate_academic_post_v1',{p_post_id:post.id,p_action:verified?'approved':'pending'});if(error)throw error});

  return <section className="feed-layout">
    <div className="feed-main">
      <div className="between feed-toolbar"><div className="feed-tools"><div className="searchbox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm y án, thể bệnh, hashtag…" aria-label="Tìm trong bảng tin học thuật"/></div><div className="chips"><button className={!tag?'active':''} onClick={()=>setTag('')}>Tất cả</button>{tags.map(t=><button className={tag===t?'active':''} key={t} onClick={()=>setTag(t)}><Hash/>{t}</button>)}</div></div>{member&&<button className="desktop-compose-button" onClick={()=>{setEditId(null);setDraft(empty())}}><Plus/>Đăng bài học thuật</button>}</div>
      {msg&&<div className="ai-note">{msg}</div>}
      {draft&&<AcademicComposer draft={draft} setDraft={setDraft} busy={busy} editing={Boolean(editId)} onSave={()=>void save()} onClose={()=>{setDraft(null);setEditId(null)}}/>}
      {shown.map(p=><AcademicPostCard key={p.id} post={p} member={member} onFollow={x=>{if(needMember())void run(()=>toggleFollow(member!,x.author.id))}} onBookmark={x=>{if(needMember())void run(()=>toggleBookmark(member!,x.id).then(v=>{setPosts(a=>a.map(z=>z.id===x.id?{...z,bookmarked:v}:z))}))}} onLike={x=>{if(needMember())void run(()=>toggleReaction(member!,x.id,'like'))}} onComment={x=>{if(!needMember())return;const body=window.prompt('Nội dung bình luận học thuật:')||'';if(body.trim())void run(()=>addComment(member!,x.id,body))}} onRepost={x=>{if(!needMember())return;const quote=window.prompt('Nhận xét / trích dẫn học thuật:')||'';if(quote.trim())void run(()=>repost(member!,x.id,quote))}} onEdit={x=>{setEditId(x.id);setDraft(draftFromPost(x));window.scrollTo({top:0,behavior:'smooth'})}} onDelete={x=>{if(window.confirm('Xóa bài viết này?'))void run(()=>deletePost(x.id))}} onVerify={(x,verified)=>void verifyPost(x,verified)}/>)}
    </div>
    <div className="news-rail" aria-label="Điểm tin Y học cổ truyền tích hợp trong bảng tin"><TcmNewsRotator/></div>
    <CommunitySidebar/>
  </section>;
}
