import {useEffect,useMemo,useState} from 'react';
import {Download,RefreshCw,UsersRound,CloudUpload} from 'lucide-react';
import * as XLSX from 'xlsx';
import {SUPABASE_PUBLISHABLE_KEY,SUPABASE_URL,supabase} from '../../services/authService';

type RegistrationStatus='awaiting_email'|'activated'|'conflict'|'cancelled';
type RegistrationRow={id:string;student_code:string;full_name:string;class_name:string;faculty:string;email:string;status:RegistrationStatus;created_at:string;activated_at:string|null};

const statusLabel:Record<RegistrationStatus,string>={awaiting_email:'Chờ kích hoạt email',activated:'Đã kích hoạt',conflict:'Xung đột MSSV',cancelled:'Đã hủy'};

function exportExcel(rows:RegistrationRow[]){
  const data=rows.map((row,index)=>({'STT':index+1,'MSSV':row.student_code,'Họ và tên':row.full_name,'Lớp':row.class_name,'Khoa':row.faculty,'Email kích hoạt':row.email,'Trạng thái':statusLabel[row.status],'Ngày đăng ký':new Date(row.created_at).toLocaleString('vi-VN'),'Ngày kích hoạt':row.activated_at?new Date(row.activated_at).toLocaleString('vi-VN'):''}));
  const workbook=XLSX.utils.book_new(),sheet=XLSX.utils.json_to_sheet(data.length?data:[{'STT':'','MSSV':'','Họ và tên':'','Lớp':'','Khoa':'','Email kích hoạt':'','Trạng thái':'Chưa có đăng ký','Ngày đăng ký':'','Ngày kích hoạt':''}]);
  sheet['!cols']=[{wch:7},{wch:18},{wch:32},{wch:18},{wch:28},{wch:34},{wch:22},{wch:24},{wch:24}];
  XLSX.utils.book_append_sheet(workbook,sheet,'Đăng ký thành viên');
  XLSX.writeFile(workbook,`HIU-YHCT-dang-ky-thanh-vien-${new Date().toISOString().slice(0,10)}.xlsx`,{compression:true});
}

export default function MemberSelfRegistrationMonitor(){
  const [rows,setRows]=useState<RegistrationRow[]>([]),[busy,setBusy]=useState(false),[syncBusy,setSyncBusy]=useState(false),[msg,setMsg]=useState('');
  const stats=useMemo(()=>({total:rows.length,waiting:rows.filter(x=>x.status==='awaiting_email').length,active:rows.filter(x=>x.status==='activated').length}),[rows]);
  const load=async()=>{setBusy(true);setMsg('');try{const {data,error}=await supabase.from('member_registration_requests').select('id,student_code,full_name,class_name,faculty,email,status,created_at,activated_at').order('created_at',{ascending:false}).limit(5000);if(error)throw error;setRows((data||[]) as RegistrationRow[])}catch(e){setMsg((e as Error).message||'Không thể tải danh sách đăng ký.')}finally{setBusy(false)}};
  useEffect(()=>{void load()},[]);
  const syncDrive=async()=>{setSyncBusy(true);setMsg('');try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Phiên đăng nhập đã hết hạn.');const response=await fetch(`${SUPABASE_URL}/functions/v1/member-register`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'sync_drive'})});const body=await response.json().catch(()=>({})) as Record<string,unknown>;if(!response.ok)throw new Error(String(body.error||'Không thể đồng bộ Drive.'));setMsg(`Đã đồng bộ ${Number(body.rows||0).toLocaleString('vi-VN')} đăng ký vào file Excel trên Drive.`)}catch(e){setMsg((e as Error).message||'Không thể đồng bộ Drive.')}finally{setSyncBusy(false)}};
  return <section className="member-registration-monitor moderation-card"><div className="row panel-title"><UsersRound/><div><h3>Đăng ký thành viên trực tuyến</h3><p>MSSV · Họ tên · Lớp · Khoa · Email kích hoạt. Chỉ admin được xem danh sách này.</p></div></div><div className="member-registration-toolbar"><button className="secondary" onClick={()=>void load()} disabled={busy}><RefreshCw/>{busy?'Đang tải…':'Làm mới'}</button><button className="secondary" onClick={()=>exportExcel(rows)} disabled={!rows.length}><Download/>Tải Excel</button><button onClick={()=>void syncDrive()} disabled={syncBusy}><CloudUpload/>{syncBusy?'Đang đồng bộ…':'Đồng bộ Excel lên Drive'}</button></div><div className="member-registration-stats"><span><b>{stats.total}</b><small>Tổng đăng ký</small></span><span><b>{stats.waiting}</b><small>Chờ kích hoạt email</small></span><span><b>{stats.active}</b><small>Đã kích hoạt</small></span></div>{msg&&<div className="ai-note" role="status">{msg}</div>}<div className="member-registration-list">{rows.slice(0,100).map(row=><article className="member-registration-row" key={row.id}><span><b>{row.full_name}</b><small>{row.student_code} · {row.class_name}</small></span><span><b>{row.faculty}</b><small>{row.email}</small></span><span><b>{new Date(row.created_at).toLocaleDateString('vi-VN')}</b><small>{row.activated_at?`Kích hoạt ${new Date(row.activated_at).toLocaleString('vi-VN')}`:'Chưa kích hoạt'}</small></span><em className="member-registration-status" data-status={row.status}>{statusLabel[row.status]}</em></article>)}{!busy&&!rows.length&&<p className="muted">Chưa có đăng ký thành viên trực tuyến.</p>}{rows.length>100&&<small>Đang hiển thị 100 đăng ký mới nhất. File Excel chứa toàn bộ dữ liệu đã tải.</small>}</div></section>;
}
