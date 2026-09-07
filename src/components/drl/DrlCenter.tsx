import { useEffect,useMemo,useState } from 'react';
import { FileSpreadsheet,Lock,Plus,Search,ShieldCheck,Upload } from 'lucide-react';
import type { Member } from '../../types';
import { roleAtLeast } from '../../types';
import { supabase } from '../../services/authService';
import { FiveElementsIcon } from '../icons/YhctIcons';
import { rankDrlCandidates } from '../../utils/vietnameseFuzzy';

type PublicRow={full_name:string;student_code_masked:string;semester_code:string;semester_title:string;total_points:number;match_score:number};
type HistoryRow={id:string;semester_code:string;semester_title:string;activity_name:string;points:number;note:string;occurred_at?:string|null;created_at:string};
type Semester={id:string;code:string;title:string;lock_at?:string|null;locked_at?:string|null;is_locked:boolean;published_at?:string|null;published_by?:string|null;is_published:boolean;row_count:number;student_count:number};
type ImportRow={mssv:string;ho_ten:string;ten_hoat_dong:string;hoc_ky:string;diem_cong:number|string;ghi_chu:string;occurred_at?:string};
type ImportMeta={format:'hiu_drl_proposal'|'flat';sheet_name:string;header_row:number;activity_name:string;semester_label:string;academic_year:string;occurred_at?:string;location:string;suggested_semester_code:string;suggested_semester_title:string};
type WorkerResult={ok:boolean;rows?:ImportRow[];invalid?:number;duplicateStudentCodes?:number;duplicateRows?:number;meta?:ImportMeta;error?:string};
type ParsedWorkbook={rows:ImportRow[];invalid:number;duplicateStudentCodes:number;duplicateRows:number;meta:ImportMeta};

const MAX_FILE_BYTES=10*1024*1024;
const MAX_ROWS=5000;
async function sha256(buf:ArrayBuffer){const d=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function parseWorkbook(buffer:ArrayBuffer):Promise<ParsedWorkbook>{
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('../../workers/drlParseWorker.ts',import.meta.url),{type:'module'});
    const timer=window.setTimeout(()=>{worker.terminate();reject(new Error('Phân tích bảng tính quá thời gian 15 giây.'))},15000);
    worker.onmessage=(event:MessageEvent<WorkerResult>)=>{window.clearTimeout(timer);worker.terminate();const x=event.data;if(!x.ok||!x.rows||!x.meta)return reject(new Error(x.error||'Không thể đọc bảng tính.'));resolve({rows:x.rows,invalid:Number(x.invalid||0),duplicateStudentCodes:Number(x.duplicateStudentCodes||0),duplicateRows:Number(x.duplicateRows||0),meta:x.meta})};
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

export default function DrlCenter({member}:{member:Member|null}){
  const [q,setQ]=useState(''),[rows,setRows]=useState<PublicRow[]>([]),[history,setHistory]=useState<HistoryRow[]>([]),[semesters,setSemesters]=useState<Semester[]>([]),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<ImportRow[]>([]),[checksum,setChecksum]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
  const [importMeta,setImportMeta]=useState<ImportMeta|null>(null),[resolvedSemester,setResolvedSemester]=useState(''),[importStats,setImportStats]=useState({invalid:0,duplicateStudentCodes:0,duplicateRows:0});
  const canManage=roleAtLeast(member?.role,'mod'),canLock=roleAtLeast(member?.role,'admin');

  const reloadHistory=async()=>{if(!member){setHistory([]);return}const {data,error}=await supabase.rpc('drl_member_history_v1');if(error)throw error;setHistory((Array.isArray(data)?data:[]) as HistoryRow[])};
  useEffect(()=>{void reloadHistory().catch(()=>setHistory([]))},[member?.id]);
  const reloadSemesters=async()=>{const r=await supabase.rpc('drl_semester_list_v1');if(r.error)throw r.error;const list=(Array.isArray(r.data)?r.data:[]) as Semester[];setSemesters(list);return list};
  useEffect(()=>{if(!canManage){setSemesters([]);return}void reloadSemesters().catch(()=>{})},[canManage]);
  const searchPublic=async(term:string)=>{const {data,error}=await supabase.rpc('drl_public_search_v1',{p_query:term,p_limit:20});if(error)throw error;setRows(rankDrlCandidates(term,(data||[]) as PublicRow[]).slice(0,12))};
  useEffect(()=>{
    let active=true;
    const term=q.trim();
    if(term.length<2){setRows([]);return()=>{active=false}};
    const timer=window.setTimeout(()=>{void searchPublic(term).catch(e=>{if(active){setMsg((e as Error).message);setRows([])}})},180);
    return()=>{active=false;window.clearTimeout(timer)};
  },[q]);

  const grouped=useMemo(()=>{const m=new Map<string,{title:string,total:number,items:HistoryRow[]}>();for(const x of history){const g=m.get(x.semester_code)||{title:x.semester_title,total:0,items:[]};g.total+=Number(x.points||0);g.items.push(x);m.set(x.semester_code,g)}return [...m.entries()]},[history]);
  const structuredImport=importMeta?.format==='hiu_drl_proposal';

  const parseFile=async(f:File)=>{
    setBusy(true);setMsg('');setFile(null);setPreview([]);setChecksum('');setImportMeta(null);setResolvedSemester('');setImportStats({invalid:0,duplicateStudentCodes:0,duplicateRows:0});
    try{
      if(!/\.(xlsx|xls|csv)$/i.test(f.name))throw new Error('Chỉ hỗ trợ .xlsx, .xls hoặc .csv.');
      if(f.size<=0||f.size>MAX_FILE_BYTES)throw new Error('File bảng tính tối đa 10 MB.');
      const original=await f.arrayBuffer();
      const checksumValue=await sha256(original.slice(0));
      const parsed=await parseWorkbook(original);
      if(parsed.rows.length>MAX_ROWS)throw new Error(`Tối đa ${MAX_ROWS.toLocaleString('vi-VN')} dòng mỗi lần nhập.`);
      const matched=matchDetectedSemester(parsed.meta,semesters);
      const normalized=matched?parsed.rows.map(r=>({...r,hoc_ky:matched.code})):parsed.rows;
      setFile(f);setPreview(normalized);setChecksum(checksumValue);setImportMeta(parsed.meta);setResolvedSemester(matched?.code||'');setImportStats({invalid:parsed.invalid,duplicateStudentCodes:parsed.duplicateStudentCodes,duplicateRows:parsed.duplicateRows});
      const notes=[`Đã đọc ${parsed.rows.length.toLocaleString('vi-VN')} dòng · header tự nhận ở dòng ${parsed.meta.header_row}.`];
      if(parsed.meta.format==='hiu_drl_proposal')notes.push(`Nhận diện mẫu HIU: ${parsed.meta.activity_name||'chưa rõ hoạt động'} · ${parsed.meta.semester_label||'chưa rõ học kỳ'}${parsed.meta.academic_year?` · ${parsed.meta.academic_year}`:''}.`);
      if(parsed.invalid)notes.push(`${parsed.invalid} dòng không hợp lệ theo kiểm tra MSSV/tên/điểm.`);
      if(parsed.duplicateStudentCodes)notes.push(`${parsed.duplicateStudentCodes} MSSV lặp (${parsed.duplicateRows} dòng lặp thêm) cần rà soát.`);
      if(parsed.meta.format==='hiu_drl_proposal'&&!matched)notes.push('Chưa có học kỳ tương ứng trong hệ thống; cần tạo/ánh xạ học kỳ trước khi commit.');
      if(matched?.is_published)notes.push('Học kỳ này đã công bố; phải gỡ công bố trước khi nhập hoặc chỉnh điểm.');
      setMsg(notes.join(' '));
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  const createDetectedSemester=async()=>{
    if(!importMeta||importMeta.format!=='hiu_drl_proposal'||!importMeta.suggested_semester_code||!importMeta.suggested_semester_title)return;
    setBusy(true);setMsg('');
    try{
      const {error}=await supabase.rpc('drl_admin_upsert_semester_v1',{p_id:null,p_code:importMeta.suggested_semester_code,p_title:importMeta.suggested_semester_title,p_starts_on:null,p_ends_on:null,p_lock_at:null});if(error)throw error;
      const list=await reloadSemesters();const matched=matchDetectedSemester(importMeta,list);if(!matched)throw new Error('Đã tạo học kỳ nhưng không thể ánh xạ lại file.');
      setResolvedSemester(matched.code);setPreview(current=>current.map(r=>({...r,hoc_ky:matched.code})));setMsg(`Đã tạo và ánh xạ ${matched.title} (${matched.code}). File sẵn sàng để commit.`)
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  const commit=async()=>{
    if(!file||!preview.length||!checksum)return;if(structuredImport&&!resolvedSemester){setMsg('File đã được nhận diện nhưng chưa có học kỳ tương ứng. Hãy tạo/ánh xạ học kỳ trước khi commit.');return}setBusy(true);setMsg('');
    try{const {data,error}=await supabase.rpc('drl_admin_import_v1',{p_file_name:file.name,p_checksum_sha256:checksum,p_rows:preview});if(error)throw error;const x=data as {accepted?:number;rejected?:number;duplicates?:number};await reloadSemesters();setMsg(`Commit hoàn tất: ${x.accepted||0} nhận · ${x.rejected||0} loại · ${x.duplicates||0} trùng. Điểm đang ở bản nháp và chưa hiển thị cho thành viên/công khai cho đến khi Admin/Mod bấm “Công bố điểm”.`);setPreview([]);setFile(null);setChecksum('');setImportMeta(null);setResolvedSemester('');setImportStats({invalid:0,duplicateStudentCodes:0,duplicateRows:0})}
    catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  const togglePublish=async(s:Semester)=>{
    if(!canManage)return;
    const next=!s.is_published;
    if(!window.confirm(next?`Công bố điểm ${s.title} cho thành viên và tra cứu công khai? Sau khi công bố dữ liệu sẽ chỉ đọc cho đến khi gỡ công bố.`:`Gỡ công bố điểm ${s.title}? Thành viên và tra cứu công khai sẽ không còn thấy điểm của học kỳ này.`))return;
    setBusy(true);setMsg('');
    try{
      const {error}=await supabase.rpc('drl_admin_publish_semester_v1',{p_semester_id:s.id,p_published:next});if(error)throw error;
      await reloadSemesters();
      await reloadHistory().catch(()=>{});
      if(q.trim().length>=2)await searchPublic(q.trim()).catch(()=>setRows([]));else setRows([]);
      setMsg(next?`Đã công bố ${s.title}. Chỉ điểm đã công bố mới hiển thị cho thành viên và tra cứu công khai.`:`Đã gỡ công bố ${s.title}. Điểm trở lại trạng thái nháp và có thể chỉnh sửa/nhập bổ sung.`);
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };
  const toggleLock=async(s:Semester)=>{if(!canLock)return;setBusy(true);try{const {error}=await supabase.rpc('drl_admin_lock_semester_v1',{p_semester_id:s.id,p_locked:!s.is_locked});if(error)throw error;await reloadSemesters()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};

  return <section>
    <div className="row panel-title"><FiveElementsIcon/><div><h2>Điểm hoạt động / Rèn luyện</h2><p>Điểm nhập vào là bản nháp · Admin/Mod phải công bố mới hiển thị cho thành viên và tra cứu công khai.</p></div></div>
    <section className="panel"><h3>Tra cứu điểm đã công bố</h3><div className="searchbox"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nhập họ tên hoặc MSSV"/></div><small className="muted">Chỉ học kỳ đã được Admin/Mod công bố mới xuất hiện; MSSV công khai được che và xếp hạng fuzzy tiếng Việt chạy tại trình duyệt.</small><div className="data-list">{rows.map((x,i)=><article key={`${x.student_code_masked}-${x.semester_code}-${i}`}><div><b>{x.full_name}</b><small>{x.student_code_masked} · {x.semester_title}</small></div><strong>{Number(x.total_points).toLocaleString('vi-VN')} điểm</strong></article>)}</div>{q.trim().length>=2&&rows.length===0&&<p className="muted">Không tìm thấy điểm đã công bố phù hợp.</p>}</section>
    {member&&<section className="panel"><h3>Điểm đã công bố của tôi</h3>{grouped.length===0?<p className="muted">Chưa có điểm đã công bố.</p>:grouped.map(([code,g])=><details key={code} open><summary>{g.title} · <b>{g.total.toLocaleString('vi-VN')} điểm</b></summary><div className="data-list compact">{g.items.map(x=><article key={x.id}><div><b>{x.activity_name}</b><small>{x.note||'Không ghi chú'} · {new Date(x.occurred_at||x.created_at).toLocaleDateString('vi-VN')}</small></div><strong>{Number(x.points)>0?'+':''}{Number(x.points)}</strong></article>)}</div></details>)}</section>}
    {canManage&&<section className="panel"><div className="row panel-title"><ShieldCheck/><div><h3>Quản trị điểm · Bản nháp & công bố</h3><p>Tự nhận mẫu HIU hoặc bảng phẳng · Web Worker · chống trùng · chỉ Admin/Mod được công bố/gỡ công bố.</p></div></div><label className="upload-box"><FileSpreadsheet/><span>Chọn file danh sách hoạt động · tối đa 10 MB / 5.000 dòng</span><input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void parseFile(f);e.currentTarget.value=''}}/></label>
      {structuredImport&&importMeta&&<div className="ai-note import-detected"><b>Đã nhận mẫu đề nghị ĐRL HIU</b><div className="data-list compact"><article><div><b>{importMeta.activity_name}</b><small>{importMeta.semester_label}{importMeta.academic_year?` · Năm học ${importMeta.academic_year}`:''}{importMeta.location?` · ${importMeta.location}`:''}</small></div><strong>Dòng {importMeta.header_row}</strong></article></div>{resolvedSemester?<small>Đã ánh xạ học kỳ hệ thống: <b>{resolvedSemester}</b>.</small>:importMeta.suggested_semester_code&&<button className="secondary" disabled={busy} onClick={()=>void createDetectedSemester()}><Plus/>Tạo học kỳ {importMeta.suggested_semester_code}</button>}</div>}
      {preview.length>0&&<><div className="import-preview-meta"><b>{preview.length.toLocaleString('vi-VN')} dòng sẵn sàng</b><small>SHA-256 {checksum.slice(0,16)}… · {importStats.invalid} dòng lỗi · {importStats.duplicateStudentCodes} MSSV lặp/{importStats.duplicateRows} dòng lặp thêm · chỉ hiển thị tối đa 12 dòng mẫu.</small></div><div className="data-list import-preview">{preview.slice(0,12).map((x,i)=><article key={`${x.mssv}-${i}`}><div><b>{x.ho_ten}</b><small>{x.mssv} · {x.hoc_ky} · {x.ten_hoat_dong}</small></div><strong>{Number(x.diem_cong)>0?'+':''}{x.diem_cong}</strong></article>)}</div><button disabled={busy||(structuredImport&&!resolvedSemester)} onClick={()=>void commit()}><Upload/>Commit bản nháp {preview.length.toLocaleString('vi-VN')} dòng</button></>}
      <div className="semester-grid">{semesters.map(s=><article key={s.id}><b>{s.title}</b><small>{s.code} · {Number(s.row_count||0).toLocaleString('vi-VN')} dòng/{Number(s.student_count||0).toLocaleString('vi-VN')} SV · {s.is_published?`Đã công bố${s.published_at?` ${new Date(s.published_at).toLocaleString('vi-VN')}`:''}`:'Chưa công bố'} · {s.is_locked?'Đã khóa':'Đang mở'}</small><div className="schedule-actions"><button className={s.is_published?'secondary':''} disabled={busy||(!s.is_published&&Number(s.row_count||0)===0)} onClick={()=>void togglePublish(s)}><ShieldCheck/>{s.is_published?'Gỡ công bố':'Công bố điểm'}</button>{canLock&&<button className="secondary" disabled={busy} onClick={()=>void toggleLock(s)}><Lock/>{s.is_locked?'Mở khóa':'Khóa sổ'}</button>}</div></article>)}</div></section>}
    {msg&&<div className="ai-note" role="status">{msg}</div>}
  </section>;
}
