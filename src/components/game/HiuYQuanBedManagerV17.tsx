import {useEffect,useMemo,useRef,useState} from 'react';
import {BellRing,BedDouble,Clock3,DoorOpen,RefreshCw,ShieldCheck,Stethoscope} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';
import '../../yquan-v17-three-bed.css';

type BedRow={bed_no:number;occupied:boolean;case_key?:string;patient_age?:number;patient_gender?:'male'|'female';patient_variant?:number;care_status?:'observing'|'recheck_due';recheck_due_at?:string|null;recheck_count?:number;ready?:boolean};
type BedState={beds:BedRow[];occupied_count:number;due_count:number;intake_blocked:boolean;intake_message:string};

type Props={member:Member;onClinicRefresh?:()=>void};
const emptyState:BedState={beds:[1,2,3].map(bed_no=>({bed_no,occupied:false})),occupied_count:0,due_count:0,intake_blocked:false,intake_message:'Ba giường trống: có thể tiếp nhận ca mới.'};
const patientLabel=(gender?:'male'|'female',age=0)=>age<13?(gender==='female'?'Bé gái':'Bé trai'):age<18?(gender==='female'?'Thiếu niên nữ':'Thiếu niên nam'):age>=60?(gender==='female'?'Cụ bà':'Cụ ông'):(gender==='female'?'Bệnh nhân nữ':'Bệnh nhân nam');
const countdown=(iso:string|undefined|null,now:number)=>{if(!iso)return '--:--';const sec=Math.max(0,Math.ceil((Date.parse(iso)-now)/1000));return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`};

export default function HiuYQuanBedManagerV17({member,onClinicRefresh}:Props){
  const [state,setState]=useState<BedState>(emptyState),[now,setNow]=useState(Date.now()),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
  const previousDue=useRef(0);
  const load=async(silent=false)=>{try{const {data,error}=await supabase.rpc('hiu_y_quan_beds_v17');if(error)throw error;const next={...emptyState,...(data||{})} as BedState;next.beds=[1,2,3].map(n=>next.beds?.find(x=>Number(x.bed_no)===n)||{bed_no:n,occupied:false});setState(next);if(!silent)setMessage('')}catch(e){if(!silent)setMessage((e as Error).message||'Không tải được trạng thái giường.')}};
  useEffect(()=>{void load(true);const tick=window.setInterval(()=>setNow(Date.now()),1000),sync=window.setInterval(()=>void load(true),12000);return()=>{window.clearInterval(tick);window.clearInterval(sync)}},[member.id]);
  const dueBeds=useMemo(()=>state.beds.filter(b=>b.occupied&&(b.ready||b.care_status==='recheck_due'||Boolean(b.recheck_due_at&&Date.parse(b.recheck_due_at)<=now))),[state.beds,now]);
  useEffect(()=>{if(dueBeds.length>0&&previousDue.current===0){setMessage(`🔔 Có ${dueBeds.length} bệnh nhân đã đến giờ tái khám.`)}previousDue.current=dueBeds.length;const old=document.title;if(dueBeds.length>0)document.title='🔔 Tái khám • HIU Y Quán';return()=>{document.title=old}},[dueBeds.length]);
  const act=async(row:BedRow,action:'discharge'|'observe')=>{if(!row.case_key||busy)return;setBusy(`${row.bed_no}-${action}`);setMessage('');try{const {data,error}=await supabase.rpc('hiu_y_quan_disposition_v17',{p_case_key:row.case_key,p_action:action});if(error)throw error;setMessage(String(data?.summary||'Đã cập nhật giường.'));await load(true);onClinicRefresh?.()}catch(e){setMessage((e as Error).message)}finally{setBusy('')}};
  return <section className="hyq-v17-ward" aria-label="Quản lý ba giường Dưỡng Trị">
    <header className="hyq-v17-head"><div><span className="hyq-v17-kicker"><BedDouble/> V17 · DƯỠNG TRỊ 3 GIƯỜNG</span><h3>Quản lý giường & tái khám</h3><p>Mỗi giường là một ca mô phỏng độc lập. Khi còn bệnh nhân trên giường, hệ thống tự khóa tiếp nhận ca mới.</p></div><button type="button" onClick={()=>void load()} disabled={Boolean(busy)}><RefreshCw/>Đồng bộ</button></header>
    <div className={`hyq-v17-intake ${state.intake_blocked?'blocked':'open'}`} role="status">{state.intake_blocked?<ShieldCheck/>:<Stethoscope/>}<div><b>{state.intake_blocked?'Đang khóa tiếp nhận':'Sẵn sàng tiếp nhận'}</b><span>{state.intake_message}</span></div><strong>{state.occupied_count}/3 giường</strong></div>
    {dueBeds.length>0&&<div className="hyq-v17-reminder" role="alert"><BellRing/><div><b>Nhắc bác sĩ tái khám</b><span>{dueBeds.map(b=>`Giường ${b.bed_no}`).join(' · ')} đã đến giờ đánh giá lại. Chọn cho về hoặc tiếp tục chờ tái khám.</span></div></div>}
    {message&&<div className="hyq-v17-message" role="status">{message}</div>}
    <div className="hyq-v17-beds">{state.beds.map(row=>{const ready=row.occupied&&(row.ready||row.care_status==='recheck_due'||Boolean(row.recheck_due_at&&Date.parse(row.recheck_due_at)<=now));return <article key={row.bed_no} className={`hyq-v17-bed ${row.occupied?'occupied':'empty'} ${ready?'ready':''}`}>
      <div className="hyq-v17-bed-visual"><span className="headboard"/><span className="mattress"/><span className="pillow"/>{row.occupied&&<span className={`patient ${row.patient_gender||'male'}`}><i/><i/></span>}<b>GIƯỜNG {row.bed_no}</b></div>
      {!row.occupied?<div className="hyq-v17-empty"><BedDouble/><b>Giường trống</b><span>Sẵn sàng khi quán mở tiếp nhận.</span></div>:<div className="hyq-v17-bed-info"><div className="hyq-v17-patient"><span><b>{patientLabel(row.patient_gender,row.patient_age)}</b><small>{row.patient_age} tuổi · lần theo dõi {row.recheck_count||0}</small></span><strong className={ready?'due':''}><Clock3/>{ready?'ĐẾN GIỜ':countdown(row.recheck_due_at,now)}</strong></div><div className="hyq-v17-bed-actions"><button type="button" className="discharge" disabled={Boolean(busy)} onClick={()=>void act(row,'discharge')}><DoorOpen/>{busy===`${row.bed_no}-discharge`?'Đang xử lý…':'Cho về'}</button><button type="button" className="observe" disabled={Boolean(busy)} onClick={()=>void act(row,'observe')}><Clock3/>{busy===`${row.bed_no}-observe`?'Đang chuyển…':'Chờ tái khám'}</button></div><small className="hyq-v17-note">Quyết định chỉ thuộc vòng chơi mô phỏng, không phải hướng dẫn xử trí lâm sàng.</small></div>}
    </article>})}</div>
  </section>;
}
