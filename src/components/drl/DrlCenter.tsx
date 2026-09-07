import { useEffect,useMemo,useState } from 'react';
import { FileSpreadsheet,Lock,Search,ShieldCheck,Upload } from 'lucide-react';
import type { Member } from '../../types';
import { roleAtLeast } from '../../types';
import { supabase } from '../../services/authService';
import { FiveElementsIcon } from '../icons/YhctIcons';
import { rankDrlCandidates } from '../../utils/vietnameseFuzzy';

type PublicRow={full_name:string;student_code_masked:string;semester_code:string;semester_title:string;total_points:number;match_score:number};
type HistoryRow={id:string;semester_code:string;semester_title:string;activity_name:string;points:number;note:string;occurred_at?:string|null;created_at:string};
type Semester={id:string;code:string;title:string;lock_at?:string|null;locked_at?:string|null;is_locked:boolean};
type ImportRow={mssv:string;ho_ten:string;ten_hoat_dong:string;hoc_ky:string;diem_cong:number|string;ghi_chu:string;occurred_at?:string};
type WorkerResult={ok:boolean;rows?:ImportRow[];invalid?:number;error?:string};

const MAX_FILE_BYTES=10*1024*1024;
const MAX_ROWS=5000;
async function sha256(buf:ArrayBuffer){const d=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function parseWorkbook(buffer:ArrayBuffer):Promise<{rows:ImportRow[];invalid:number}>{
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('../../workers/drlParseWorker.ts',import.meta.url),{type:'module'});
    const timer=window.setTimeout(()=>{worker.terminate();reject(new Error('Phân tích bảng tính quá thời gian 15 giây.'))},15000);
    worker.onmessage=(event:MessageEvent<WorkerResult>)=>{window.clearTimeout(timer);worker.terminate();const x=event.data;if(!x.ok||!x.rows)return reject(new Error(x.error||'Không thể đọc bảng tính.'));resolve({rows:x.rows,invalid:Number(x.invalid||0)})};
    worker.onerror=()=>{window.clearTimeout(timer);worker.terminate();reject(new Error('Worker đọc bảng tính gặp lỗi.'))};
    worker.postMessage(buffer,[buffer]);
  });
}

export default function DrlCenter({member}:{member:Member|null}){
  const [q,setQ]=useState(''),[rows,setRows]=useState<PublicRow[]>([]),[history,setHistory]=useState<HistoryRow[]>([]),[semesters,setSemesters]=useState<Semester[]>([]),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<ImportRow[]>([]),[checksum,setChecksum]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const canManage=roleAtLeast(member?.role,'mod'),canLock=roleAtLeast(member?.role,'admin');

  useEffect(()=>{if(!member){setHistory([]);return}void supabase.rpc('drl_member_history_v1').then(({data,error})=>{if(!error&&Array.isArray(data))setHistory(data as HistoryRow[])})},[member]);
  useEffect(()=>{if(!canManage){setSemesters([]);return}void supabase.rpc('drl_semester_list_v1').then(({data,error})=>{if(!error&&Array.isArray(data))setSemesters(data as Semester[])})},[canManage]);
  useEffect(()=>{
    let active=true;
    const term=q.trim();
    if(term.length<2){setRows([]);return()=>{active=false}};
    const timer=window.setTimeout(()=>{
      void supabase.rpc('drl_public_search_v1',{p_query:term,p_limit:20}).then(({data,error})=>{
        if(!active)return;
        if(error){setMsg(error.message);setRows([]);return}
        setRows(rankDrlCandidates(term,(data||[]) as PublicRow[]).slice(0,12));
      });
    },180);
    return()=>{active=false;window.clearTimeout(timer)};
  },[q]);

  const grouped=useMemo(()=>{const m=new Map<string,{title:string,total:number,items:HistoryRow[]}>();for(const x of history){const g=m.get(x.semester_code)||{title:x.semester_title,total:0,items:[]};g.total+=Number(x.points||0);g.items.push(x);m.set(x.semester_code,g)}return [...m.entries()]},[history]);

  const parseFile=async(f:File)=>{
    setBusy(true);setMsg('');setFile(null);setPreview([]);setChecksum('');
    try{
      if(!/\.(xlsx|xls|csv)$/i.test(f.name))throw new Error('Chỉ hỗ trợ .xlsx, .xls hoặc .csv.');
      if(f.size<=0||f.size>MAX_FILE_BYTES)throw new Error('File bảng tính tối đa 10 MB.');
      const original=await f.arrayBuffer();
      const checksumValue=await sha256(original.slice(0));
      const parsed=await parseWorkbook(original);
      if(parsed.rows.length>MAX_ROWS)throw new Error(`Tối đa ${MAX_ROWS.toLocaleString('vi-VN')} dòng mỗi lần nhập.`);
      setFile(f);setPreview(parsed.rows);setChecksum(checksumValue);
      setMsg(parsed.invalid?`Đã đọc ${parsed.rows.length} dòng trong Web Worker; ${parsed.invalid} dòng cần kiểm tra và sẽ bị máy chủ từ chối nếu không hợp lệ.`:`Đã kiểm tra ${parsed.rows.length} dòng ngoài luồng giao diện. Có thể commit.`);
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  const commit=async()=>{
    if(!file||!preview.length||!checksum)return;setBusy(true);setMsg('');
    try{const {data,error}=await supabase.rpc('drl_admin_import_v1',{p_file_name:file.name,p_checksum_sha256:checksum,p_rows:preview});if(error)throw error;const x=data as {accepted?:number;rejected?:number;duplicates?:number};setMsg(`Commit hoàn tất: ${x.accepted||0} nhận · ${x.rejected||0} loại · ${x.duplicates||0} trùng.`);setPreview([]);setFile(null);setChecksum('')}
    catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  const toggleLock=async(s:Semester)=>{if(!canLock)return;setBusy(true);try{const {error}=await supabase.rpc('drl_admin_lock_semester_v1',{p_semester_id:s.id,p_locked:!s.is_locked});if(error)throw error;const r=await supabase.rpc('drl_semester_list_v1');if(!r.error&&Array.isArray(r.data))setSemesters(r.data as Semester[])}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};

  return <section>
    <div className="row panel-title"><FiveElementsIcon/><div><h2>Điểm hoạt động / Rèn luyện</h2><p>Tra cứu công khai có che MSSV · chi tiết chỉ dành cho thành viên và quản trị.</p></div></div>
    <section className="panel"><h3>Tra cứu công khai</h3><div className="searchbox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nhập họ tên hoặc MSSV"/></div><small className="muted">Ứng viên được máy chủ giới hạn và che MSSV; xếp hạng fuzzy tiếng Việt không dấu chạy tại trình duyệt.</small><div className="data-list">{rows.map((x,i)=><article key={`${x.student_code_masked}-${x.semester_code}-${i}`}><div><b>{x.full_name}</b><small>{x.student_code_masked} · {x.semester_title}</small></div><strong>{Number(x.total_points).toLocaleString('vi-VN')} điểm</strong></article>)}</div></section>
    {member&&<section className="panel"><h3>Điểm của tôi</h3>{grouped.length===0?<p className="muted">Chưa có dữ liệu điểm.</p>:grouped.map(([code,g])=><details key={code} open><summary>{g.title} · <b>{g.total.toLocaleString('vi-VN')} điểm</b></summary><div className="data-list compact">{g.items.map(x=><article key={x.id}><div><b>{x.activity_name}</b><small>{x.note||'Không ghi chú'} · {new Date(x.occurred_at||x.created_at).toLocaleDateString('vi-VN')}</small></div><strong>{Number(x.points)>0?'+':''}{Number(x.points)}</strong></article>)}</div></details>)}</section>}
    {canManage&&<section className="panel"><div className="row panel-title"><ShieldCheck/><div><h3>Quản trị điểm</h3><p>Nhập .xlsx/.xls/.csv trong Web Worker, kiểm tra trước commit, chống trùng theo SHA-256/fingerprint.</p></div></div><label className="upload-box"><FileSpreadsheet/><span>Chọn file danh sách hoạt động · tối đa 10 MB / 5.000 dòng</span><input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void parseFile(f);e.currentTarget.value=''}}/></label>{preview.length>0&&<><div className="import-preview-meta"><b>{preview.length.toLocaleString('vi-VN')} dòng sẵn sàng</b><small>SHA-256 {checksum.slice(0,16)}… · chỉ hiển thị tối đa 12 dòng mẫu để tránh lag.</small></div><div className="data-list import-preview">{preview.slice(0,12).map((x,i)=><article key={`${x.mssv}-${i}`}><div><b>{x.ho_ten}</b><small>{x.mssv} · {x.hoc_ky} · {x.ten_hoat_dong}</small></div><strong>{Number(x.diem_cong)>0?'+':''}{x.diem_cong}</strong></article>)}</div><button disabled={busy} onClick={()=>void commit()}><Upload/>Commit {preview.length.toLocaleString('vi-VN')} dòng</button></>}<div className="semester-grid">{semesters.map(s=><article key={s.id}><b>{s.title}</b><small>{s.code} · {s.is_locked?'Đã khóa':'Đang mở'}</small>{canLock&&<button className="secondary" disabled={busy} onClick={()=>void toggleLock(s)}><Lock/>{s.is_locked?'Mở khóa':'Khóa sổ'}</button>}</article>)}</div></section>}
    {msg&&<div className="ai-note" role="status">{msg}</div>}
  </section>;
}
