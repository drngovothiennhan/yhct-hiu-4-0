import { useEffect,useMemo,useState,type ReactNode } from 'react';
import { Award,ShieldCheck,Users } from 'lucide-react';
import { supabase } from '../../services/authService';

type GroupKey='leadership'|'management'|'active';
type CommunityEntry={
  group_key:GroupKey;
  rank_no:number;
  member_id:string;
  full_name:string;
  position_title:string;
  avatar_url:string|null;
  total_points:number;
};

const PAGE_SIZE=3;
const ROTATE_MS=8000;
const REFRESH_MS=5*60*1000;
const ACTIVE_LIMIT=10;

const initials=(name:string)=>name.trim().split(/\s+/).slice(-2).map(part=>part[0]?.toUpperCase()||'').join('').slice(0,2)||'YH';

function visiblePage(items:CommunityEntry[],page:number){
  if(items.length<=PAGE_SIZE)return items;
  const start=(page*PAGE_SIZE)%items.length;
  return Array.from({length:PAGE_SIZE},(_,index)=>items[(start+index)%items.length]);
}

function displayTitle(item:CommunityEntry){
  if(item.group_key==='leadership')return item.rank_no===1?'Chủ nhiệm':'Phó Chủ nhiệm';
  if(item.group_key==='management')return'Ban quản lý';
  return item.position_title||'Thành viên';
}

function MemberRow({item,showRank=false}:{item:CommunityEntry;showRank?:boolean}){
  return <article className="community-member">
    <div className="community-avatar" aria-hidden="true">
      {item.avatar_url?<img src={item.avatar_url} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<span>{initials(item.full_name)}</span>}
    </div>
    <div className="community-member-copy">
      <b title={item.full_name}>{item.full_name}</b>
      <small>{showRank?`#${item.rank_no} · `:''}{displayTitle(item)}</small>
    </div>
    <strong>{item.total_points}đ</strong>
  </article>;
}

function Block({title,subtitle,items,icon,showRank=false}:{title:string;subtitle:string;items:CommunityEntry[];icon:ReactNode;showRank?:boolean}){
  return <section className="community-block">
    <header><div className="row">{icon}<div><h3>{title}</h3><small>{subtitle}</small></div></div></header>
    <div className="community-member-list">
      {items.length?items.map(item=><MemberRow key={item.member_id} item={item} showRank={showRank}/>):<div className="community-empty">Chưa có dữ liệu.</div>}
    </div>
  </section>;
}

export default function CommunitySidebar(){
  const [rows,setRows]=useState<CommunityEntry[]>([]);
  const [msg,setMsg]=useState('');
  const [managementPage,setManagementPage]=useState(0);
  const [activePage,setActivePage]=useState(0);

  useEffect(()=>{
    let mounted=true;
    const load=async()=>{
      try{
        const {data,error}=await supabase.rpc('community_sidebar_v1');
        if(error)throw error;
        if(mounted){setRows((data||[]) as CommunityEntry[]);setMsg('')}
      }catch(error){if(mounted)setMsg(error instanceof Error?error.message:'Không thể tải thông tin cộng đồng.')}
    };
    void load();
    const refreshId=window.setInterval(()=>void load(),REFRESH_MS);
    return()=>{mounted=false;window.clearInterval(refreshId)};
  },[]);

  const leadership=useMemo(()=>rows.filter(item=>item.group_key==='leadership').slice(0,PAGE_SIZE),[rows]);
  const management=useMemo(()=>rows.filter(item=>item.group_key==='management'),[rows]);
  const active=useMemo(()=>rows.filter(item=>item.group_key==='active').slice(0,ACTIVE_LIMIT),[rows]);

  useEffect(()=>{setManagementPage(page=>management.length?Math.min(page,Math.ceil(management.length/PAGE_SIZE)-1):0)},[management.length]);
  useEffect(()=>{setActivePage(page=>active.length?Math.min(page,Math.ceil(active.length/PAGE_SIZE)-1):0)},[active.length]);

  useEffect(()=>{
    if(management.length<=PAGE_SIZE)return;
    const id=window.setInterval(()=>setManagementPage(page=>(page+1)%Math.ceil(management.length/PAGE_SIZE)),ROTATE_MS);
    return()=>window.clearInterval(id);
  },[management.length]);

  useEffect(()=>{
    if(active.length<=PAGE_SIZE)return;
    const id=window.setInterval(()=>setActivePage(page=>(page+1)%Math.ceil(active.length/PAGE_SIZE)),ROTATE_MS);
    return()=>window.clearInterval(id);
  },[active.length]);

  return <aside className="community-sidebar" aria-label="Thông tin cộng đồng YHCT HIU">
    {msg&&<div className="community-load-note" role="status">Đang dùng dữ liệu gần nhất.</div>}
    <Block title="Ban chủ nhiệm" subtitle="Cố định · 3 thành viên" items={leadership} icon={<ShieldCheck/>}/>
    <Block title="Ban quản lý" subtitle="Tự động chuyển · 3 thành viên/lượt" items={visiblePage(management,managementPage)} icon={<Users/>}/>
    <Block title="Thành viên tích cực" subtitle="Top 10 theo điểm hoạt động · 3/lượt" items={visiblePage(active,activePage)} icon={<Award/>} showRank/>
  </aside>;
}
