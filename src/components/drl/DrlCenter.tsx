import { useEffect,useMemo,useState } from 'react';
import { CheckCircle2,FileSpreadsheet,Lock,Plus,Search,ShieldCheck,Upload,X } from 'lucide-react';
import type { Member } from '../../types';
import { roleAtLeast } from '../../types';
import { supabase } from '../../services/authService';
import { cacheGet,cachePut } from '../../services/offlineCache';
import { FiveElementsIcon } from '../icons/YhctIcons';
import { rankDrlCandidates } from '../../utils/vietnameseFuzzy';

type PublicRow={full_name:string;student_code_masked:string;semester_code:string;semester_title:string;total_points:number;match_score:number};
type ExactActivity={id:string;activity_name:string;points:number;note:string;occurred_at?:string|null};
type ExactSemester={student_code_masked:string;semester_code:string;semester_title:string;is_published:boolean;publication_status:'published'|'waiting';total_points:number|null;activities:ExactActivity[]};
type HistoryRow={id:string;semester_code:string;semester_title:string;activity_name:string;points:number;note:string;occurred_at?:string|null;created_at:string};
type Semester={id:string;code:string;title:string;lock_at?:string|null;locked_at?:string|null;is_locked:boolean;published_at?:string|null;published_by?:string|null;is_published:boolean;row_count:number;student_count:number};
type ImportRow={mssv:string;ho_ten:string;ten_hoat_dong:string;hoc_ky:string;diem_cong:number|string;ghi_chu:string;occurred_at?:string};
type RowError={row:number;field:'MSSV'|'Họ tên'|'Tên hoạt động'|'Học kỳ'|'Điểm cộng';value:string;message:string};
type ImportMeta={format:'hiu_drl_proposal'|'flat';sheet_name:string;header_row:number;activity_name:string;semester_label:string;academic_year:string;occurred_at?:string;location:string;suggested_semester_code:string;suggested_semester_title:string};
type WorkerResult={ok:boolean;rows?:ImportRow[];invalid?:number;duplicateStudentCodes?:number;duplicateRows?:number;rowErrors?:RowError[];meta?:ImportMeta;error?:string};
type ParsedWorkbook={rows:ImportRow[];invalid:number;duplicateStudentCodes:number;duplicateRows:number;rowErrors:RowError[];meta:ImportMeta};
type PublishDialog={semester:Semester;target:boolean;step:1|2};

const MAX_FILE_BYTES=10*1024*1024;
const MAX_ROWS=5000;
const MSSV=/^\d{8,14}$/;
const DRL_CACHE_TTL=10*60*1000;

async function sha256(buf:ArrayBuffer){const d=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function parseWorkbook(buffer:ArrayBuffer):Promise<ParsedWorkbook>{
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('../../workers/drlParseWorker.ts',import.meta.url),{type:'module'});
    const timer=window.setTimeout(()=>{worker.terminate();reject(new Error('Phân tích bảng tính quá thời gian 15 giây.'))},15000);
    worker.onmessage=(event:MessageEvent<WorkerResult>)=>{window.clearTimeout(timer);worker.terminate();const x=event.data;if(!x.ok||!x.rows||!x.meta)return reject(new Error(x.error||'Không thể đọc bảng tính.'));resolve({rows:x.rows,invalid:Number(x.invalid||0),duplicateStudentCodes:Number(x.duplicateStudentCodes||0),duplicateRows:Number(x.duplicateRows||0),rowErrors:Array.isArray(x.rowErrors)?x.rowErrors:[],meta:x.meta})};
    worker.onerror=()=>{window.clearTimeout(timer);worker.terminate();reject(new Error('Worker đọc bảng tính gặp lỗi.'))};
    worker.postMessage(buffer,[buffer]);
  });
}
const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
function matchDetectedSemester(meta:ImportMeta,list:Semester[]){
  if(meta.format!=='hiu_drl_proposal')return null;
  const suggested=fold(meta.suggested_semester_code),label=fold(meta.semester_label),year=fold(meta.academic_year),number=(meta.semester_label.match(/\d+/)||[])[0]||'';
  return list.find(s=>fold(s.code)===suggested)||list.find(s=>{const hay=fold(`${s.code}_${s.title}`);const semOk=!label||hay.includes(label)||(number&&(hay.includes(`hoc_ky_${number}`)||hay.includes(`hk${number}`)));const yearOk=!year||hay.includes(year);return Boolean(semOk&&yearOk)})||null;
}
function normalizeExactRows(data:unknown):ExactSemester[]{
  if(!Array.isArray(data))return[];
  return data.map(row=>{const x=row as Omit<ExactSemester,'activities'>&{activities?:unknown};return{...x,total_points:x.total_points===null?null:Number(x.total_points),activities:Array.isArray(x.activities)?x.activities.map(a=>{const y=a as ExactActivity;return{...y,points:Number(y.points)}}):[]}});
}

export default function DrlCenter({member}:{member:Member|null}){
  const [q,setQ]=useState(''),[rows,setRows]=useState<PublicRow[]>([]),[exactRows,setExactRows]=useState<ExactSemester[]>([]),[history,setHistory]=useState<HistoryRow[]>([]),[semesters,setSemesters]=useState<Semester[]>([]),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<ImportRow[]>([]),[checksum,setChecksum]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const [importMeta,setImportMeta]=useState<ImportMeta|null>(null),[resolvedSemester,setResolvedSemester]=useState(''),[importStats,setImportStats]=useState({invalid:0,duplicateStudentCodes:0,duplicateRows:0}),[rowErrors,setRowErrors]=useState<RowError[]>([]),[publishDialog,setPublishDialog]=useState<PublishDialog|null>(null);
  const canManage=roleAtLeast(member?.role,'mod'),canPublish=roleAtLeast(member?.role,'admin'),canLock=roleAtLeast(member?.role,'admin');

  const reloadHistory=async()=>{if(!member){setHistory([]);return}const {data,error}=await supabase.rpc('drl_member_history_v1');if(error)throw error;setHistory((Array.isArray(data)?data:[]) as HistoryRow[])};
  useEffect(()=>{void reloadHistory().catch(()=>setHistory([]))},[member?.id]);
  const reloadSemesters=async()=>{const r=await supabase.rpc('drl_semester_list_v1');if(r.error)throw r.error;const list=(Array.isArray(r.data)?r.data:[]) as Semester[];setSemesters(list);return list};
  useEffect(()=>{if(!canManage){setSemesters([]);return}void reloadSemesters().catch(()=>{})},[canManage]);

  const searchPublic=async(term:string)=>{const {data,error}=await supabase.rpc('drl_public_search_v1',{p_query:term,p_limit:20});if(error)throw error;setRows(rankDrlCandidates(term,(data||[]) as PublicRow[]).slice(0,12))};
  const lookupMssv=async(code:string)=>{
    const cacheKey=`drl-lookup-v2:${code}`;
    try{
      const {data,error}=await supabase.rpc('drl_public_lookup_v2',{p_student_code:code});if(error)throw error;
      const normalized=normalizeExactRows(data);setExactRows(normalized);void cachePut(cacheKey,normalized,DRL_CACHE_TTL);setMsg('');
    }catch(error){
      const cached=await cacheGet<ExactSemester[]>(cacheKey,{allowStale:true});
      if(cached){setExactRows(cached);setMsg('Kết nối tạm thời gián đoạn · đang hiển thị kết quả tra cứu đã lưu gần nhất.');return}
      throw error;
    }
  };
  useEffect(()=>{
    let active=true;
    const term=q.trim();const normalized=term.replace(/\s/g,'').toUpperCase();
    if(term.length<2){setRows([]);setExactRows([]);return()=>{active=false}};
    const timer=window.setTimeout(()=>{
      const task=MSSV.test(normalized)?(setRows([]),lookupMssv(normalized)):(setExactRows([]),searchPublic(term));
      void task.catch(error=>{if(active){setMsg(error instanceof Error?error.message:'Không thể tra cứu điểm.');setRows([]);setExactRows([])}});
    },180);
    return()=>{active=false;window.clearTimeout(timer)};
  },[q]);

  const grouped=useMemo(()=>{const m=new Map<string,{title:string,total:number,items:HistoryRow[]}>();for(const x of history){const g=m.get(x.semester_code)||{title:x.semester_title,total:0,items:[]};g.total+=Number(x.points||0);g.items.push(x);m.set(x.semester_code,g)}return [...m.entries()]},[history]);
  const structuredImport=importMeta?.format==='hiu_drl_proposal';

  useEffect(()=>{if(!publishDialog)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)setPublishDialog(null)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[publishDialog,busy]);

  const parseFile=async(f:File)=>{
    setBusy(true);setMsg('');setFile(null);setPreview([]);setChecksum('');setImportMeta(null);setResolvedSemester('');setRowErrors([]);setImportStats({invalid:0,duplicateStudentCodes:0,duplicateRows:0});
    try{
      if(!/\.(xlsx|xls|csv)$/i.test(f.name))throw new Error('Chỉ hỗ trợ .xlsx, .xls hoặc .csv.');
      if(f.size<=0||f.size>MAX_FILE_BYTES)throw new Error('File bảng tính tối đa 10 MB.');
      const original=await f.arrayBuffer();const checksumValue=await sha256(original.slice(0));const parsed=await parseWorkbook(original);
      if(parsed.rows.length>MAX_ROWS)throw new Error(`Tối đa ${MAX_ROWS.toLocaleString('vi-VN')} dòng mỗi lần nhập.`);
      const matched=matchDetectedSemester(parsed.meta,semesters);const normalized=matched?parsed.rows.map(r=>({...r,hoc_ky:matched.code,mssv:r.mssv.toUpperCase()})):parsed.rows.map(r=>({...r,mssv:r.mssv.toUpperCase()}));
      setFile(f);setPreview(normalized);setChecksum(checksumValue);setImportMeta(parsed.meta);setResolvedSemester(matched?.code||'');setRowErrors(parsed.rowErrors);setImportStats({invalid:parsed.invalid,duplicateStudentCodes:parsed.duplicateStudentCodes,duplicateRows:parsed.duplicateRows});
      const notes=[`Đã đọc ${parsed.rows.length.toLocaleString('vi-VN')} dòng hợp lệ · header tự nhận ở dòng ${parsed.meta.header_row}.`];
      if(parsed.meta.format==='hiu_drl_proposal')notes.push(`Nhận diện mẫu HIU: ${parsed.meta.activity_name||'chưa rõ hoạt động'} · ${parsed.meta.semester_label||'chưa rõ học kỳ'}${parsed.meta.academic_year?` · ${parsed.meta.academic_year}`:''}.`);
      if(parsed.invalid)notes.push(`${parsed.invalid} lỗi dữ liệu đã bị chặn trước commit; xem bảng lỗi theo dòng bên dưới.`);
      if(parsed.duplicateRows)notes.push(`Đã loại ${parsed.duplicateRows} dòng trùng khóa MSSV + Hoạt động + Học kỳ.`);
      if(parsed.duplicateStudentCodes)notes.push(`${parsed.duplicateStudentCodes} MSSV có nhiều hoạt động/dòng khác nhau.`);
      if(parsed.meta.format==='hiu_drl_proposal'&&!matched)notes.push('Chưa có học kỳ tương ứng trong hệ thống; cần tạo/ánh xạ học kỳ trước khi commit.');
      if(matched?.is_published)notes.push('Học kỳ này đã chốt điểm; phải gỡ công bố trước khi nhập hoặc chỉnh dữ liệu.');
      setMsg(notes.join(' '));
    }catch(error){setMsg(error instanceof Error?error.message:'Không thể đọc file.')}finally{setBusy(false)}
  };

  const createDetectedSemester=async()=>{
    if(!importMeta||importMeta.format!=='hiu_drl_proposal'||!importMeta.suggested_semester_code||!importMeta.suggested_semester_title)return;
    setBusy(true);setMsg('');
    try{
      const {error}=await supabase.rpc('drl_admin_upsert_semester_v1',{p_id:null,p_code:importMeta.suggested_semester_code,p_title:importMeta.suggested_semester_title,p_starts_on:null,p_ends_on:null,p_lock_at:null});if(error)throw error;
      const list=await reloadSemesters();const matched=matchDetectedSemester(importMeta,list);if(!matched)throw new Error('Đã tạo học kỳ nhưng không thể ánh xạ lại file.');
      setResolvedSemester(matched.code);setPreview(current=>current.map(r=>({...r,hoc_ky:matched.code})));setMsg(`Đã tạo và ánh xạ ${matched.title} (${matched.code}). File sẵn sàng để commit.`);
    }catch(error){setMsg(error instanceof Error?error.message:'Không thể tạo học kỳ.')}finally{setBusy(false)}
  };

  const commit=async()=>{
    if(!file||!preview.length||!checksum)return;
    if(rowErrors.length){setMsg(`Còn ${rowErrors.length} lỗi dữ liệu. Hãy sửa file Excel và tải lại trước khi commit.`);return}
    if(structuredImport&&!resolvedSemester){setMsg('File đã được nhận diện nhưng chưa có học kỳ tương ứng. Hãy tạo/ánh xạ học kỳ trước khi commit.');return}
    setBusy(true);setMsg('');
    try{
      const {data,error}=await supabase.rpc('drl_admin_import_v1',{p_file_name:file.name,p_checksum_sha256:checksum,p_rows:preview});if(error)throw error;
      const x=data as {accepted?:number;rejected?:number;duplicates?:number};await reloadSemesters();
      setMsg(`Commit hoàn tất: ${x.accepted||0} nhận · ${x.rejected||0} loại · ${x.duplicates||0} trùng. Đây là dữ liệu nháp; chỉ Admin có quyền công bố điểm học kỳ.`);
      setPreview([]);setFile(null);setChecksum('');setImportMeta(null);setResolvedSemester('');setRowErrors([]);setImportStats({invalid:0,duplicateStudentCodes:0,duplicateRows:0});
    }catch(error){setMsg(error instanceof Error?error.message:'Không thể commit điểm.')}finally{setBusy(false)}
  };

  const executePublication=async()=>{
    if(!publishDialog||!canPublish)return;
    const {semester,target}=publishDialog;setBusy(true);setMsg('');
    try{
      const {error}=await supabase.rpc('drl_admin_publish_semester_v1',{p_semester_id:semester.id,p_published:target});if(error)throw error;
      setPublishDialog(null);await reloadSemesters();await reloadHistory().catch(()=>{});
      const code=q.trim().replace(/\s/g,'').toUpperCase();if(MSSV.test(code))await lookupMssv(code).catch(()=>setExactRows([]));else if(q.trim().length>=2)await searchPublic(q.trim()).catch(()=>setRows([]));
      setMsg(target?`Đã công bố ${semester.title}. Hệ thống đã tạo thông báo cho thành viên có điểm; dữ liệu được mở cho tra cứu công khai.`:`Đã gỡ công bố ${semester.title}. Học kỳ trở lại “Đang tổng hợp / Chờ duyệt”.`);
    }catch(error){setMsg(error instanceof Error?error.message:'Không thể thay đổi trạng thái công bố.')}finally{setBusy(false)}
  };

  const toggleLock=async(s:Semester)=>{if(!canLock)return;setBusy(true);try{const {error}=await supabase.rpc('drl_admin_lock_semester_v1',{p_semester_id:s.id,p_locked:!s.is_locked});if(error)throw error;await reloadSemesters()}catch(error){setMsg(error instanceof Error?error.message:'Không thể khóa học kỳ.')}finally{setBusy(false)}};

  const exactMode=MSSV.test(q.trim().replace(/\s/g,'').toUpperCase());

  return <section>
    <div className="row panel-title"><FiveElementsIcon/><div><h2>Điểm hoạt động / Rèn luyện</h2><p>DRL theo học kỳ · độc lập hoàn toàn với Tín dụng Cộng đồng.</p></div></div>

    <section className="panel"><h3>Tra cứu DRL</h3><div className="searchbox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nhập MSSV để xem trạng thái/điểm; hoặc họ tên để tìm điểm đã công bố" autoCapitalize="characters"/></div><small className="muted">Tra cứu MSSV chính xác hiển thị từng học kỳ. Học kỳ chưa công bố chỉ hiện “Đang tổng hợp / Chờ duyệt”, không lộ tổng điểm nháp.</small>
      {exactMode&&<div className="drl-public-semesters">{exactRows.map(semester=><article className={`drl-public-semester ${semester.is_published?'is-published':'is-waiting'}`} key={semester.semester_code}><header><div><b>{semester.semester_title}</b><small>{semester.student_code_masked} · {semester.semester_code}</small></div><span className="drl-public-status">{semester.is_published?<><CheckCircle2/>Đã chốt điểm</>:<>Đang tổng hợp / Chờ duyệt</>}</span></header>{semester.is_published?<><strong className="drl-public-total">{Number(semester.total_points||0).toLocaleString('vi-VN')} điểm</strong><div className="data-list compact">{semester.activities.map(activity=><article key={activity.id}><div><b>{activity.activity_name}</b><small>{activity.note||'Không ghi chú'}{activity.occurred_at?` · ${new Date(activity.occurred_at).toLocaleDateString('vi-VN')}`:''}</small></div><strong>{Number(activity.points)>0?'+':''}{Number(activity.points)}</strong></article>)}</div></>:<p className="muted">Điểm vẫn đang ở bản nháp nội bộ. Tổng điểm và chi tiết điểm chưa được công bố.</p>}</article>)}{q.trim().length>=8&&exactRows.length===0&&<p className="muted">Chưa có dữ liệu hoạt động phù hợp với MSSV này.</p>}</div>}
      {!exactMode&&<><div className="data-list">{rows.map((x,i)=><article key={`${x.student_code_masked}-${x.semester_code}-${i}`}><div><b>{x.full_name}</b><small>{x.student_code_masked} · {x.semester_title}</small></div><strong>{Number(x.total_points).toLocaleString('vi-VN')} điểm</strong></article>)}</div>{q.trim().length>=2&&rows.length===0&&<p className="muted">Không tìm thấy điểm đã công bố phù hợp.</p>}</>}
    </section>

    {member&&<section className="panel"><h3>Điểm đã chốt của tôi</h3>{grouped.length===0?<p className="muted">Chưa có học kỳ đã công bố.</p>:grouped.map(([code,g])=><details key={code} open><summary>{g.title} · <b>{g.total.toLocaleString('vi-VN')} điểm</b></summary><div className="data-list compact">{g.items.map(x=><article key={x.id}><div><b>{x.activity_name}</b><small>{x.note||'Không ghi chú'} · {new Date(x.occurred_at||x.created_at).toLocaleDateString('vi-VN')}</small></div><strong>{Number(x.points)>0?'+':''}{Number(x.points)}</strong></article>)}</div></details>)}</section>}

    {canManage&&<section className="panel"><div className="row panel-title"><ShieldCheck/><div><h3>Quản trị DRL · Nháp → Công bố</h3><p>Parser Web Worker · chuẩn hóa MSSV · chặn điểm âm/thập phân · báo lỗi theo dòng · chống trùng MSSV + Hoạt động + Học kỳ.</p></div></div><label className="upload-box"><FileSpreadsheet/><span>Chọn Excel/CSV · tối đa 10 MB / 5.000 dòng</span><input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void parseFile(f);e.currentTarget.value=''}}/></label>
      {structuredImport&&importMeta&&<div className="ai-note import-detected"><b>Đã nhận mẫu đề nghị ĐRL HIU</b><div className="data-list compact"><article><div><b>{importMeta.activity_name}</b><small>{importMeta.semester_label}{importMeta.academic_year?` · Năm học ${importMeta.academic_year}`:''}{importMeta.location?` · ${importMeta.location}`:''}</small></div><strong>Dòng {importMeta.header_row}</strong></article></div>{resolvedSemester?<small>Đã ánh xạ học kỳ hệ thống: <b>{resolvedSemester}</b>.</small>:importMeta.suggested_semester_code&&<button className="secondary" disabled={busy} onClick={()=>void createDetectedSemester()}><Plus/>Tạo học kỳ {importMeta.suggested_semester_code}</button>}</div>}
      {rowErrors.length>0&&<section className="drl-row-errors" role="alert"><h4>Lỗi cần sửa trước khi commit ({rowErrors.length})</h4><div className="data-list compact">{rowErrors.slice(0,50).map((e,i)=><article key={`${e.row}-${e.field}-${i}`}><div><b>Dòng {e.row} · {e.field}</b><small>{e.message}{e.value?` · Giá trị: “${e.value}”`:''}</small></div><span className="badge">Bị chặn</span></article>)}</div>{rowErrors.length>50&&<small>Còn {rowErrors.length-50} lỗi khác. Sửa file nguồn rồi tải lại để kiểm tra toàn bộ.</small>}</section>}
      {preview.length>0&&<><div className="import-preview-meta"><b>{preview.length.toLocaleString('vi-VN')} dòng hợp lệ sẵn sàng</b><small>SHA-256 {checksum.slice(0,16)}… · {importStats.invalid} lỗi bị chặn · đã loại {importStats.duplicateRows} dòng trùng khóa logic · {importStats.duplicateStudentCodes} MSSV có nhiều dòng khác nhau.</small></div><div className="data-list import-preview">{preview.slice(0,12).map((x,i)=><article key={`${x.mssv}-${x.ten_hoat_dong}-${i}`}><div><b>{x.ho_ten}</b><small>{x.mssv} · {x.hoc_ky} · {x.ten_hoat_dong}</small></div><strong>{Number(x.diem_cong)>0?'+':''}{x.diem_cong}</strong></article>)}</div><button disabled={busy||rowErrors.length>0||(structuredImport&&!resolvedSemester)} onClick={()=>void commit()}><Upload/>Commit bản nháp {preview.length.toLocaleString('vi-VN')} dòng</button></>}
      <div className="semester-grid">{semesters.map(s=><article key={s.id}><b>{s.title}</b><small>{s.code} · {Number(s.row_count||0).toLocaleString('vi-VN')} dòng/{Number(s.student_count||0).toLocaleString('vi-VN')} SV · {s.is_published?'Đã chốt điểm':'Đang tổng hợp / Chờ duyệt'} · {s.is_locked?'Đã khóa':'Đang mở'}</small><div className="schedule-actions">{canPublish&&<button className={s.is_published?'secondary':''} disabled={busy||(!s.is_published&&Number(s.row_count||0)===0)} onClick={()=>setPublishDialog({semester:s,target:!s.is_published,step:1})}><ShieldCheck/>{s.is_published?'Gỡ công bố':'Công bố điểm học kỳ'}</button>}{canLock&&<button className="secondary" disabled={busy} onClick={()=>void toggleLock(s)}><Lock/>{s.is_locked?'Mở khóa':'Khóa sổ'}</button>}</div></article>)}</div></section>}

    {msg&&<div className="ai-note" role="status">{msg}</div>}

    {publishDialog&&<div className="modal drl-publish-backdrop" onMouseDown={()=>!busy&&setPublishDialog(null)}><section className="drl-publish-dialog" role="alertdialog" aria-modal="true" aria-labelledby="drl-publish-title" onMouseDown={e=>e.stopPropagation()}><button className="close" disabled={busy} onClick={()=>setPublishDialog(null)} aria-label="Đóng"><X/></button><ShieldCheck className="drl-publish-icon"/><h3 id="drl-publish-title">{publishDialog.target?'Công bố điểm học kỳ':'Gỡ công bố điểm'} · Bước {publishDialog.step}/2</h3>{publishDialog.step===1?<><p><b>{publishDialog.semester.title}</b> · {publishDialog.semester.code}</p><p>{publishDialog.target?'Sau khi công bố, tổng điểm và từng hoạt động sẽ được mở công khai; thông báo được tạo cho thành viên có điểm.':'Sau khi gỡ công bố, người dùng chỉ thấy trạng thái “Đang tổng hợp / Chờ duyệt”; dữ liệu có thể chỉnh sửa lại.'}</p><button disabled={busy} onClick={()=>setPublishDialog(current=>current?{...current,step:2}:current)}>Tiếp tục xác nhận</button></>:<><div className="warning"><b>Xác nhận cuối cùng.</b><br/>{publishDialog.target?'Hệ thống sẽ chốt và công bố toàn bộ điểm của học kỳ này.':'Hệ thống sẽ thu hồi trạng thái công bố của học kỳ này.'}</div><div className="schedule-actions"><button className="secondary" disabled={busy} onClick={()=>setPublishDialog(current=>current?{...current,step:1}:current)}>Quay lại</button><button disabled={busy} onClick={()=>void executePublication()}>{busy?'Đang xử lý…':publishDialog.target?'Xác nhận công bố':'Xác nhận gỡ công bố'}</button></div></>}</section></div>}
  </section>;
}
