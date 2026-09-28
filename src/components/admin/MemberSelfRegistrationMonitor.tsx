import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {ChevronDown,ChevronUp,Download,RefreshCw,UsersRound,CloudUpload} from 'lucide-react';
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

type ProvisionResult={summary?:{created:number};created?:Array<{username:string;temporary_password:string}>;duplicates?:Array<{reason?:string}>;errors?:Array<{reason?:string}>;failed?:Array<{reason?:string}>;error?:string};
function AdminMemberProvisioning({onCreated}:{onCreated:()=>Promise<void>}){
  const [studentCode,setStudentCode]=useState(''),[fullName,setFullName]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[created,setCreated]=useState<{username:string;temporary_password:string}|null>(null);
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setMessage('');setCreated(null);
    const code=studentCode.trim().replace(/\s/g,'').toUpperCase(),name=fullName.trim().replace(/\s+/g,' ');
    if(!/^\d{8,14}$/.test(code)){setMessage('MSSV phải gồm 8–14 chữ số.');return}
    if(!name){setMessage('Vui lòng nhập họ và tên.');return}
    setBusy(true);
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error('Phiên đăng nhập đã hết hạn.');
      const response=await fetch(`${SUPABASE_URL}/functions/v1/member-bulk-import`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({file_name:'acc-member-registration',rows:[{source_row:2,mssv:code,ho_ten:name,lop:'',contact:'',ban:''}]})});
      const body=await response.json().catch(()=>({})) as ProvisionResult;
      if(!response.ok)throw new Error(body.error||'Không thể tạo tài khoản thành viên.');
      if(body.summary?.created===1&&body.created?.[0]){
        setCreated(body.created[0]);setMessage('Đã tạo tài khoản thành viên. Gửi thông tin đăng nhập tạm thời riêng cho thành viên; họ cần đổi mật khẩu khi đăng nhập.');
        setStudentCode('');setFullName('');await onCreated();return;
      }
      const reason=body.duplicates?.[0]?.reason||body.errors?.[0]?.reason||body.failed?.[0]?.reason;
      setMessage(reason||'Không tạo được tài khoản. Vui lòng kiểm tra MSSV hoặc thử lại.');
    }catch(error){setMessage((error as Error).message||'Không thể tạo tài khoản thành viên.')}
    finally{setBusy(false)}
  };
  return <section className="panel member-provisioning">
    <div className="row panel-title"><UsersRound/><div><h3>Tạo tài khoản thành viên</h3><p>Nhập MSSV và họ tên; tài khoản được tạo với quyền thành viên.</p></div></div>
    <form className="member-provisioning-form" onSubmit={submit}>
      <label>Mã số sinh viên<input inputMode="numeric" autoComplete="off" maxLength={14} value={studentCode} onChange={event=>{setStudentCode(event.target.value);setCreated(null)}} disabled={busy} placeholder="Ví dụ: 2613120148"/></label>
      <label>Họ và tên<input autoComplete="name" maxLength={180} value={fullName} onChange={event=>{setFullName(event.target.value);setCreated(null)}} disabled={busy} placeholder="Nhập họ và tên"/></label>
      <button type="submit" disabled={busy}>{busy?'Đang tạo…':'Tạo thành viên'}</button>
    </form>
    {created&&<div className="member-provisioning-result" role="status"><b>Đã tạo tài khoản</b><span>MSSV: {created.username}</span><span>Mật khẩu tạm: <code>{created.temporary_password}</code></span></div>}
    {message&&<div className="ai-note" role="status">{message}</div>}
  </section>;
}

export default function MemberSelfRegistrationMonitor(){
  const [rows,setRows]=useState<RegistrationRow[]>([]),[busy,setBusy]=useState(false),[syncBusy,setSyncBusy]=useState(false),[msg,setMsg]=useState(''),[expanded,setExpanded]=useState(false);
  const stats=useMemo(()=>({total:rows.length,waiting:rows.filter(x=>x.status==='awaiting_email').length,active:rows.filter(x=>x.status==='activated').length}),[rows]);
  const load=async()=>{setBusy(true);setMsg('');try{const {data,error}=await supabase.from('member_registration_requests').select('id,student_code,full_name,class_name,faculty,email,status,created_at,activated_at').order('created_at',{ascending:false}).limit(5000);if(error)throw error;setRows((data||[]) as RegistrationRow[])}catch(e){setMsg((e as Error).message||'Không thể tải danh sách đăng ký.')}finally{setBusy(false)}};
  useEffect(()=>{void load()},[]);
  const syncDrive=async()=>{setSyncBusy(true);setMsg('');try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error('Phiên đăng nhập đã hết hạn.');const response=await fetch(`${SUPABASE_URL}/functions/v1/member-register`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'sync_drive'})});const body=await response.json().catch(()=>({})) as Record<string,unknown>;if(!response.ok)throw new Error(String(body.error||'Không thể đồng bộ Drive.'));setMsg(`Đã đồng bộ ${Number(body.rows||0).toLocaleString('vi-VN')} đăng ký vào file Excel trên Drive.`)}catch(e){setMsg((e as Error).message||'Không thể đồng bộ Drive.')}finally{setSyncBusy(false)}};
  return <div className="member-registration-acc"><AdminMemberProvisioning onCreated={load}/><section className="member-registration-monitor moderation-card">
    <div className="row panel-title">
      <UsersRound/>
      <div>
        <h3>Đăng ký thành viên trực tuyến</h3>
        <p>{busy?'Đang tải…':`${stats.total} đăng ký · ${stats.waiting} chờ kích hoạt · ${stats.active} đã kích hoạt`}</p>
      </div>
      <button className="secondary" type="button" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>
        {expanded?<ChevronUp/>:<ChevronDown/>}{expanded?'Thu gọn':'Mở danh sách'}
      </button>
    </div>
    {expanded&&<>
      <p className="muted">MSSV · Họ tên · Lớp · Khoa · Email kích hoạt. Chỉ admin được xem danh sách này.</p>
      <div className="member-registration-toolbar"><button className="secondary" onClick={()=>void load()} disabled={busy}><RefreshCw/>{busy?'Đang tải…':'Làm mới'}</button><button className="secondary" onClick={()=>exportExcel(rows)} disabled={!rows.length}><Download/>Tải Excel</button><button onClick={()=>void syncDrive()} disabled={syncBusy}><CloudUpload/>{syncBusy?'Đang đồng bộ…':'Đồng bộ Excel lên Drive'}</button></div>
      <div className="member-registration-stats"><span><b>{stats.total}</b><small>Tổng đăng ký</small></span><span><b>{stats.waiting}</b><small>Chờ kích hoạt email</small></span><span><b>{stats.active}</b><small>Đã kích hoạt</small></span></div>
      {msg&&<div className="ai-note" role="status">{msg}</div>}
      <div className="member-registration-list">{rows.slice(0,100).map(row=><article className="member-registration-row" key={row.id}><span><b>{row.full_name}</b><small>{row.student_code} · {row.class_name}</small></span><span><b>{row.faculty}</b><small>{row.email}</small></span><span><b>{new Date(row.created_at).toLocaleDateString('vi-VN')}</b><small>{row.activated_at?`Kích hoạt ${new Date(row.activated_at).toLocaleString('vi-VN')}`:'Chưa kích hoạt'}</small></span><em className="member-registration-status" data-status={row.status}>{statusLabel[row.status]}</em></article>)}{!busy&&!rows.length&&<p className="muted">Chưa có đăng ký thành viên trực tuyến.</p>}{rows.length>100&&<small>Đang hiển thị 100 đăng ký mới nhất. File Excel chứa toàn bộ dữ liệu đã tải.</small>}</div>
    </>}
  </section></div>;
}
