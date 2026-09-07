import { useEffect,useMemo,useState,type ReactNode } from 'react';
import { Award,Copy,ShieldCheck,Users,X } from 'lucide-react';
import { supabase } from '../../services/authService';

type GroupKey='leadership'|'management'|'active';
type CommunityEntry={group_key:GroupKey;rank_no:number;member_id:string;full_name:string;position_title:string;avatar_url:string|null;total_credits:number;credit_rank:string};
const PAGE_SIZE=3,ROTATE_MS=8000,REFRESH_MS=5*60*1000,ACTIVE_LIMIT=10;
const initials=(name:string)=>name.trim().split(/\s+/).slice(-2).map(part=>part[0]?.toUpperCase()||'').join('').slice(0,2)||'YH';
function visiblePage(items:CommunityEntry[],page:number){if(items.length<=PAGE_SIZE)return items;const start=(page*PAGE_SIZE)%items.length;return Array.from({length:PAGE_SIZE},(_,index)=>items[(start+index)%items.length])}
function displayTitle(item:CommunityEntry){if(item.group_key==='leadership')return item.rank_no===1?'Chủ nhiệm':'Phó Chủ nhiệm';if(item.group_key==='management')return item.position_title||'Ban quản lý';return item.credit_rank||'Chưa xếp hạng'}
function creditLevel(total:number){if(total>1000)return 5;if(total>=501)return 4;if(total>=201)return 3;if(total>=51)return 2;if(total>=1)return 1;return 0}

function MemberRow({item,showRank=false,onOpen}:{item:CommunityEntry;showRank?:boolean;onOpen:(item:CommunityEntry)=>void}){
  const level=creditLevel(Number(item.total_credits||0));
  return <button type="button" className="community-member community-member-button" onClick={()=>onOpen(item)} aria-label={`Xem thông tin ${item.full_name}`}>
    <div className="community-avatar" aria-hidden="true">{item.avatar_url?<img src={item.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<span>{initials(item.full_name)}</span>}</div>
    <div className="community-member-copy"><b title={item.full_name}>{item.full_name}</b><small>{showRank?`#${item.rank_no} · `:''}{displayTitle(item)}</small></div>
    <div className={`community-credit-badge level-${level}`} title={`${item.credit_rank} · ${item.total_credits} tín dụng`}><Award aria-hidden="true"/><strong>{item.total_credits} TD</strong></div>
  </button>;
}

function Block({title,subtitle,items,icon,showRank=false,onOpen}:{title:string;subtitle:string;items:CommunityEntry[];icon:ReactNode;showRank?:boolean;onOpen:(item:CommunityEntry)=>void}){
  return <section className="community-block"><header><div className="row">{icon}<div><h3>{title}</h3><small>{subtitle}</small></div></div></header><div className="community-member-list">{items.length?items.map(item=><MemberRow key={`${item.group_key}-${item.member_id}`} item={item} showRank={showRank} onOpen={onOpen}/>):<div className="community-empty">Chưa có dữ liệu.</div>}</div></section>;
}

function MemberDialog({item,onClose}:{item:CommunityEntry;onClose:()=>void}){
  const [copied,setCopied]=useState(false);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[onClose]);
  const copyName=async()=>{try{await navigator.clipboard.writeText(item.full_name);setCopied(true);window.setTimeout(()=>setCopied(false),1400)}catch{setCopied(false)}};
  return <div className="community-member-backdrop" role="presentation" onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="community-member-dialog" role="dialog" aria-modal="true" aria-labelledby="community-member-dialog-title">
      <button type="button" className="community-dialog-close" onClick={onClose} aria-label="Đóng"><X/></button>
      <div className="community-dialog-avatar" aria-hidden="true">{item.avatar_url?<img src={item.avatar_url} alt=""/>:<span>{initials(item.full_name)}</span>}</div>
      <h3 id="community-member-dialog-title">{item.full_name}</h3>
      <p>{displayTitle(item)}</p>
      <div className="community-dialog-stats"><span><b>{item.total_credits}</b><small>Tín dụng cộng đồng</small></span><span><b>{item.credit_rank||'Chưa xếp hạng'}</b><small>Danh hiệu YHCT</small></span></div>
      <button type="button" className="secondary" onClick={()=>void copyName()}><Copy/>{copied?'Đã sao chép':'Sao chép tên'}</button>
    </section>
  </div>;
}

export default function CommunitySidebar(){
  const [rows,setRows]=useState<CommunityEntry[]>([]),[msg,setMsg]=useState(''),[managementPage,setManagementPage]=useState(0),[activePage,setActivePage]=useState(0),[selected,setSelected]=useState<CommunityEntry|null>(null);
  useEffect(()=>{let mounted=true;const load=async()=>{try{const {data,error}=await supabase.rpc('community_sidebar_v2');if(error)throw error;if(mounted){setRows((data||[]) as CommunityEntry[]);setMsg('')}}catch(error){if(mounted)setMsg(error instanceof Error?error.message:'Không thể tải thông tin cộng đồng.')}};void load();const refreshId=window.setInterval(()=>void load(),REFRESH_MS);return()=>{mounted=false;window.clearInterval(refreshId)}},[]);
  const leadership=useMemo(()=>rows.filter(item=>item.group_key==='leadership').slice(0,PAGE_SIZE),[rows]);
  const management=useMemo(()=>rows.filter(item=>item.group_key==='management'),[rows]);
  const active=useMemo(()=>rows.filter(item=>item.group_key==='active').slice(0,ACTIVE_LIMIT),[rows]);
  useEffect(()=>{setManagementPage(page=>management.length?Math.min(page,Math.ceil(management.length/PAGE_SIZE)-1):0)},[management.length]);
  useEffect(()=>{setActivePage(page=>active.length?Math.min(page,Math.ceil(active.length/PAGE_SIZE)-1):0)},[active.length]);
  useEffect(()=>{if(management.length<=PAGE_SIZE)return;const id=window.setInterval(()=>setManagementPage(page=>(page+1)%Math.ceil(management.length/PAGE_SIZE)),ROTATE_MS);return()=>window.clearInterval(id)},[management.length]);
  useEffect(()=>{if(active.length<=PAGE_SIZE)return;const id=window.setInterval(()=>setActivePage(page=>(page+1)%Math.ceil(active.length/PAGE_SIZE)),ROTATE_MS);return()=>window.clearInterval(id)},[active.length]);
  return <><aside className="community-sidebar" aria-label="Thông tin cộng đồng YHCT HIU">
    {msg&&<div className="community-load-note" role="status">Không thể làm mới · đang giữ dữ liệu gần nhất.</div>}
    <Block title="Ban chủ nhiệm" subtitle="Cơ cấu điều hành · tín dụng chỉ là hoạt động cộng đồng" items={leadership} icon={<ShieldCheck/>} onOpen={setSelected}/>
    <Block title="Ban quản lý" subtitle="Tự động chuyển · 3 thành viên/lượt" items={visiblePage(management,managementPage)} icon={<Users/>} onOpen={setSelected}/>
    <Block title="Thành viên tích cực" subtitle="Top 10 Tín dụng Cộng đồng · cộng dồn trọn đời" items={visiblePage(active,activePage)} icon={<Award/>} showRank onOpen={setSelected}/>
  </aside>{selected&&<MemberDialog item={selected} onClose={()=>setSelected(null)}/>}</>;
}
