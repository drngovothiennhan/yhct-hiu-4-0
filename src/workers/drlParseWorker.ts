import * as XLSX from 'xlsx';

type ImportRow={mssv:string;ho_ten:string;ten_hoat_dong:string;hoc_ky:string;diem_cong:string;ghi_chu:string;occurred_at?:string};
type ImportMeta={format:'hiu_drl_proposal'|'flat';sheet_name:string;header_row:number;activity_name:string;semester_label:string;academic_year:string;occurred_at?:string;location:string;suggested_semester_code:string;suggested_semester_title:string};
type ColMap={stt:number;mssv:number;name:number;faculty:number;role:number;points:number;activity:number;semester:number;note:number;occurred:number};

const key=(s:unknown)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const text=(v:unknown,max:number)=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const aliases={
  stt:['stt','so_thu_tu'],mssv:['mssv','ma_sinh_vien','student_code'],name:['ho_va_ten','ho_ten','hoten','full_name'],faculty:['khoa','faculty','department'],role:['vai_tro_tham_gia','vai_tro','tham_gia','role'],points:['diem_de_xuat_drl','diem_de_xuat','drl','diem_cong','diem','points'],activity:['ten_hoat_dong','hoat_dong','activity_name'],semester:['hoc_ky','hocky','semester'],note:['ghi_chu','ghichu','note'],occurred:['thoi_gian_to_chuc','ngay_to_chuc','occurred_at']
};
const findCol=(row:unknown[],list:string[])=>row.findIndex(v=>list.includes(key(v)));
function findHeader(matrix:unknown[][]){
  for(let i=0;i<Math.min(matrix.length,80);i++){
    const row=matrix[i]||[];
    const map:ColMap={stt:findCol(row,aliases.stt),mssv:findCol(row,aliases.mssv),name:findCol(row,aliases.name),faculty:findCol(row,aliases.faculty),role:findCol(row,aliases.role),points:findCol(row,aliases.points),activity:findCol(row,aliases.activity),semester:findCol(row,aliases.semester),note:findCol(row,aliases.note),occurred:findCol(row,aliases.occurred)};
    if(map.mssv>=0&&map.name>=0&&map.points>=0)return{index:i,map};
  }
  throw new Error('Không nhận diện được hàng tiêu đề có MSSV, Họ và tên và Điểm/ĐRL.');
}
function nearestRight(row:unknown[],from:number){for(let j=from+1;j<Math.min(row.length,from+6);j++){const v=text(row[j],500);if(v)return v}return''}
function metaValue(matrix:unknown[][],end:number,labels:string[]){for(let i=0;i<end;i++){const row=matrix[i]||[];for(let j=0;j<row.length;j++)if(labels.includes(key(row[j])))return nearestRight(row,j)}return''}
function toIsoDate(value:string){const m=value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(!m)return'';const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);if(d<1||d>31||mo<1||mo>12)return'';return`${y.toString().padStart(4,'0')}-${mo.toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}T00:00:00+07:00`}
function semesterCode(label:string,year:string){const n=(label.match(/\d+/)||[])[0]||'';const y=(year.match(/20\d{2}\s*[-–]\s*20\d{2}/)||[])[0]?.replace(/\s/g,'').replace('–','-')||'';return n&&y?`HK${n}-${y}`:''}

self.onmessage=(event:MessageEvent<ArrayBuffer>)=>{
  try{
    const wb=XLSX.read(event.data,{type:'array',cellDates:true,cellFormula:false,cellHTML:false,cellStyles:false});
    const first=wb.SheetNames[0];if(!first)throw new Error('Workbook không có sheet.');
    const ws=wb.Sheets[first];
    const matrix=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,defval:'',raw:false,blankrows:true});
    const {index:headerIndex,map}=findHeader(matrix);
    const activityMeta=metaValue(matrix,headerIndex,['ten_hoat_dong']);
    const semesterMeta=metaValue(matrix,headerIndex,['hoc_ky']);
    const academicYear=metaValue(matrix,headerIndex,['nam_hoc']);
    const occurredMeta=metaValue(matrix,headerIndex,['thoi_gian_to_chuc','ngay_to_chuc']);
    const location=metaValue(matrix,headerIndex,['dia_diem']);
    const structured=Boolean(activityMeta&&semesterMeta&&map.activity<0&&map.semester<0);
    const suggestedCode=semesterCode(semesterMeta,academicYear);
    const suggestedTitle=[semesterMeta,academicYear?`Năm học ${academicYear}`:''].filter(Boolean).join(' · ');
    const rows:ImportRow[]=[];let invalid=0,duplicateRows=0;const seen=new Set<string>(),duplicateCodes=new Set<string>();
    for(let i=headerIndex+1;i<matrix.length;i++){
      const row=matrix[i]||[];
      const mssv=text(row[map.mssv],20).replace(/\s/g,'');
      const name=text(row[map.name],160);
      const points=text(row[map.points],40).replace(',','.');
      const stt=map.stt>=0?text(row[map.stt],20):'';
      if(!mssv&&!name&&!points)continue;
      if(!mssv&&stt&&!/^\d+$/.test(stt))continue;
      const activity=map.activity>=0?text(row[map.activity],240):text(activityMeta,240);
      const semester=map.semester>=0?text(row[map.semester],80):text(semesterMeta,80);
      const noteParts:string[]=[];
      const note=map.note>=0?text(row[map.note],500):'';if(note)noteParts.push(note);
      const faculty=map.faculty>=0?text(row[map.faculty],120):'';if(faculty)noteParts.push(`Khoa: ${faculty}`);
      const role=map.role>=0?text(row[map.role],120):'';if(role)noteParts.push(`Vai trò: ${role}`);
      const occurredRaw=map.occurred>=0?text(row[map.occurred],64):occurredMeta;
      const occurred=toIsoDate(occurredRaw)||text(occurredRaw,64);
      const item:ImportRow={mssv,ho_ten:name,ten_hoat_dong:activity,hoc_ky:semester,diem_cong:points,ghi_chu:noteParts.join(' · ')};
      if(occurred)item.occurred_at=occurred;
      if(!/^\d{8,14}$/.test(mssv)||!name||!activity||!semester||!Number.isFinite(Number(points)))invalid++;
      if(mssv){if(seen.has(mssv)){duplicateRows++;duplicateCodes.add(mssv)}else seen.add(mssv)}
      rows.push(item);
      if(rows.length>5000)throw new Error('Tối đa 5.000 dòng mỗi lần nhập.');
    }
    if(!rows.length)throw new Error('Không tìm thấy dòng dữ liệu điểm sau hàng tiêu đề.');
    const meta:ImportMeta={format:structured?'hiu_drl_proposal':'flat',sheet_name:first,header_row:headerIndex+1,activity_name:activityMeta,semester_label:semesterMeta,academic_year:academicYear,location,suggested_semester_code:suggestedCode,suggested_semester_title:suggestedTitle};
    const iso=toIsoDate(occurredMeta);if(iso)meta.occurred_at=iso;
    self.postMessage({ok:true,rows,invalid,duplicateStudentCodes:duplicateCodes.size,duplicateRows,meta});
  }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:'Không thể đọc bảng tính.'})}
};
export {};
