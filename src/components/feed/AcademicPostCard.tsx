import { Bookmark,CheckCircle2,Heart,MessageCircle,Pencil,Repeat2,Trash2,UserPlus } from 'lucide-react';
import type { AcademicPost,Member } from '../../types';
import { roleAtLeast } from '../../types';

export function academicScore(p:AcademicPost){const tu=[p.fourExams.vong,p.fourExams.van,p.fourExams.vanHoi,p.fourExams.thiet].filter(x=>x.trim().length>2).length/4*25;const bat=Math.min(25,p.eightPrinciples.length/4*25);const cites=Math.min(15,p.citations.length*5);const rep=Math.min(25,p.author.reputation/100*25);const mod=p.modVerified?30:0;return Math.round((tu+bat+cites+rep+mod)*10)/10}
const initials=(name:string)=>name.trim().split(/\s+/).slice(-2).map(x=>x.charAt(0)).join('').toLocaleUpperCase('vi-VN')||'YH';

export default function AcademicPostCard({post,member,onBookmark,onFollow,onLike,onComment,onRepost,onEdit,onDelete,onVerify}:{post:AcademicPost;member:Member|null;onBookmark:(p:AcademicPost)=>void;onFollow:(p:AcademicPost)=>void;onLike:(p:AcademicPost)=>void;onComment:(p:AcademicPost)=>void;onRepost:(p:AcademicPost)=>void;onEdit:(p:AcademicPost)=>void;onDelete:(p:AcademicPost)=>void;onVerify:(p:AcademicPost,verified:boolean)=>void}){
  const canManage=!!member&&(member.id===post.author.id||roleAtLeast(member.role,'mod'));
  const canVerify=roleAtLeast(member?.role,'mod');
  return <article className="post-card">
    <header className="post-head"><div className="post-author"><div className="post-avatar" aria-hidden="true">{post.author.avatarUrl?<img src={post.author.avatarUrl} alt="" loading="lazy"/>:<span>{initials(post.author.fullName)}</span>}</div><div className="post-author-copy"><b>{post.author.fullName}</b><span>{post.author.title} · {new Date(post.createdAt).toLocaleString('vi-VN')}</span></div></div><div className="rank">{post.modVerified&&<CheckCircle2/>} {academicScore(post)}/120</div></header>
    <h3>{post.title}</h3><p className="post-lead"><b>Chủ chứng:</b> {post.chiefComplaint}</p>
    <div className="four"><span><b>Vọng</b>{post.fourExams.vong}</span><span><b>Văn</b>{post.fourExams.van}</span><span><b>Vấn</b>{post.fourExams.vanHoi}</span><span><b>Thiết</b>{post.fourExams.thiet}</span></div>
    <p><b>Bát cương:</b> {post.eightPrinciples.join(' · ')}</p><p><b>Biện chứng:</b> {post.syndrome}</p><p><b>Pháp trị:</b> {post.treatmentPrinciple}</p>{post.formula&&<p><b>Phương:</b> {post.formula}</p>}<div className="tags">{post.tags.map(t=><span key={t}>#{t}</span>)}</div>
    <footer>{member&&member.id!==post.author.id&&<button onClick={()=>onFollow(post)}><UserPlus/>Theo dõi</button>}<button disabled={!member} onClick={()=>onLike(post)}><Heart/>{post.likes}</button><button disabled={!member} onClick={()=>onComment(post)}><MessageCircle/>{post.comments}</button><button disabled={!member} onClick={()=>onRepost(post)}><Repeat2/>Trích dẫn</button><button disabled={!member} onClick={()=>onBookmark(post)}><Bookmark fill={post.bookmarked?'currentColor':'none'}/>Lưu</button>{canVerify&&<button className={post.modVerified?'verified-action':''} onClick={()=>onVerify(post,!post.modVerified)}><CheckCircle2/>{post.modVerified?'Gỡ xác minh':'Xác minh'}</button>}{canManage&&<><button onClick={()=>onEdit(post)}><Pencil/>Sửa</button><button onClick={()=>onDelete(post)}><Trash2/>Xóa</button></>}</footer>
  </article>;
}
