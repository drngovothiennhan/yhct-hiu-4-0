import * as XLSX from 'xlsx';

type ImportRow={mssv:string;ho_ten:string;ten_hoat_dong:string;hoc_ky:string;diem_cong:string;ghi_chu:string;occurred_at?:string};
type RowError={row:number;field:'MSSV'|'Họ tên'|'Tên hoạt động'|'Học kỳ'|'Điểm cộng'|'Mẫu file';value:string;message:string};
type ImportMeta={format:'hiu_drl_proposal';sheet_name:string;header_row:number;activity_name:string;semester_label:string;academic_year:string;occurred_at?:string;location:string;suggested_semester_code:string;suggested_semester_title:string};
type ColMap={stt:number;mssv:number;name:number;faculty:number;role:number;points:number};

const key=(s:unknown)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const text=(v:unknown,max:number)=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const aliases={
  stt:['stt','so_thu_tu'],
  mssv:['mssv','ma_sinh_vien','student_code'],
  name:['ho_va_ten','ho_ten','hoten','full_name'],
  faculty:['khoa','faculty','department'],
  role:['vai_tro_tham_gia','vai_tro','tham_gia','role'],
  points:['diem_de_xuat_drl','diem_de_xuat','drl','diem_cong','diem','points'],
};
const findCol=(row:unknown[],list:string[])=>row.findIndex(v=>list.includes(key(v)));

function findHeader(matrix:unknown[][]){
  for(let i=0;i<Math.min(matrix.length,80);i++){
    const row=matrix[i]||[];
    const map:ColMap={
      stt:findCol(row,aliases.stt),
      mssv:findCol(row,aliases.mssv),
      name:findCol(row,aliases.name),
      faculty:findCol(row,aliases.faculty),
      role:findCol(row,aliases.role),
      points:findCol(row,aliases.points),
    };
    if(map.stt>=0&&map.mssv>=0&&map.name>=0&&map.faculty>=0&&map.role>=0&&map.points>=0)return{index:i,map};
  }
  throw new Error('Mẫu DRL không hợp lệ. Bắt buộc có các cột: STT, MSSV, Họ và tên, Khoa, Vai trò tham gia, Điểm đề xuất ĐRL.');
}

function nearestRight(row:unknown[],from:number){
  for(let j=from+1;j<Math.min(row.length,from+8);j++){
    const v=text(row[j],500);
    if(v)return v;
  }
  return'';
}

function metaValue(matrix:unknown[][],end:number,labels:string[]){
  for(let i=0;i<end;i++){
    const row=matrix[i]||[];
    for(let j=0;j<row.length;j++)if(labels.includes(key(row[j])))return nearestRight(row,j);
  }
  return'';
}

function toIsoDate(value:string){
  const normalized=value.trim();
  const m=normalized.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(!m)return'';
  const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]);
  if(d<1||d>31||mo<1||mo>12)return'';
  return`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T00:00:00+07:00`;
}

function semesterCode(label:string,year:string){
  const n=(label.match(/\d+/)||[])[0]||'';
  const y=(year.match(/20\d{2}\s*[-–]\s*20\d{2}/)||[])[0]?.replace(/\s/g,'').replace('–','-')||'';
  return n&&y?`HK${n}-${y}`:'';
}

function logicalKey(mssv:string,activity:string,semester:string){return`${mssv}|${key(activity)}|${key(semester)}`}

self.onmessage=(event:MessageEvent<ArrayBuffer>)=>{
  try{
    const wb=XLSX.read(event.data,{type:'array',cellDates:true,cellFormula:false,cellHTML:false,cellStyles:false});
    const first=wb.SheetNames[0];
    if(!first)throw new Error('Workbook không có sheet.');
    const matrix=XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[first],{header:1,defval:'',raw:false,blankrows:true});
    const {index:headerIndex,map}=findHeader(matrix);

    const activityMeta=metaValue(matrix,headerIndex,['ten_hoat_dong']);
    const semesterMeta=metaValue(matrix,headerIndex,['hoc_ky']);
    const academicYear=metaValue(matrix,headerIndex,['nam_hoc']);
    const occurredMeta=metaValue(matrix,headerIndex,['thoi_gian_to_chuc','ngay_to_chuc']);
    const location=metaValue(matrix,headerIndex,['dia_diem']);

    const missingMeta:string[]=[];
    if(!activityMeta)missingMeta.push('Tên hoạt động');
    if(!semesterMeta)missingMeta.push('Học kỳ');
    if(!academicYear)missingMeta.push('Năm học');
    if(!occurredMeta)missingMeta.push('Thời gian tổ chức');
    if(!location)missingMeta.push('Địa điểm');
    if(missingMeta.length)throw new Error(`Mẫu DRL không hợp lệ. Thiếu metadata bắt buộc: ${missingMeta.join(', ')}.`);

    const suggestedCode=semesterCode(semesterMeta,academicYear);
    if(!suggestedCode)throw new Error('Không nhận diện được Học kỳ/Năm học theo mẫu HIU.');
    const suggestedTitle=`${semesterMeta} · Năm học ${academicYear}`;
    const rows:ImportRow[]=[],rowErrors:RowError[]=[];
    let invalid=0,duplicateRows=0;
    const seenCodes=new Set<string>(),duplicateCodes=new Set<string>(),seenLogical=new Set<string>();

    for(let i=headerIndex+1;i<matrix.length;i++){
      const row=matrix[i]||[],rowNo=i+1;
      const stt=text(row[map.stt],20);
      const mssv=text(row[map.mssv],20).replace(/\s/g,'').toUpperCase();
      const name=text(row[map.name],160);
      const rawPoints=text(row[map.points],40).replace(',','.');
      if(!stt&&!mssv&&!name&&!rawPoints)continue;
      if(stt&&!/^\d+$/.test(stt))continue;

      const activity=text(activityMeta,240);
      const semester=suggestedCode.toUpperCase();
      const points=Number(rawPoints);
      const noteParts:string[]=[];
      const faculty=text(row[map.faculty],120);if(faculty)noteParts.push(`Khoa: ${faculty}`);
      const role=text(row[map.role],120);if(role)noteParts.push(`Vai trò: ${role}`);
      const occurred=toIsoDate(occurredMeta)||text(occurredMeta,64);
      const item:ImportRow={mssv,ho_ten:name,ten_hoat_dong:activity,hoc_ky:semester,diem_cong:rawPoints,ghi_chu:noteParts.join(' · ')};
      if(occurred)item.occurred_at=occurred;

      const errors:RowError[]=[];
      if(!/^\d{8,14}$/.test(mssv))errors.push({row:rowNo,field:'MSSV',value:mssv,message:'MSSV phải gồm 8–14 chữ số.'});
      if(!name)errors.push({row:rowNo,field:'Họ tên',value:name,message:'Họ tên không được trống.'});
      if(!Number.isFinite(points))errors.push({row:rowNo,field:'Điểm cộng',value:rawPoints,message:'Điểm đề xuất ĐRL phải là số.'});
      else if(points<0)errors.push({row:rowNo,field:'Điểm cộng',value:rawPoints,message:'Điểm đề xuất ĐRL không được âm.'});
      else if(!Number.isInteger(points))errors.push({row:rowNo,field:'Điểm cộng',value:rawPoints,message:'Điểm đề xuất ĐRL phải là số nguyên.'});
      else if(points>1000)errors.push({row:rowNo,field:'Điểm cộng',value:rawPoints,message:'Điểm đề xuất ĐRL vượt giới hạn 1000.'});
      if(errors.length){invalid++;rowErrors.push(...errors);continue}

      if(seenCodes.has(mssv))duplicateCodes.add(mssv);else seenCodes.add(mssv);
      const identity=logicalKey(mssv,activity,semester);
      if(seenLogical.has(identity)){duplicateRows++;continue}
      seenLogical.add(identity);
      rows.push(item);
      if(rows.length>5000)throw new Error('Tối đa 5.000 dòng hợp lệ mỗi lần nhập.');
    }

    const meta:ImportMeta={
      format:'hiu_drl_proposal',
      sheet_name:first,
      header_row:headerIndex+1,
      activity_name:activityMeta,
      semester_label:semesterMeta,
      academic_year:academicYear,
      location,
      suggested_semester_code:suggestedCode,
      suggested_semester_title:suggestedTitle,
    };
    const iso=toIsoDate(occurredMeta);if(iso)meta.occurred_at=iso;
    if(!rows.length&&!rowErrors.length)throw new Error('Không tìm thấy dòng dữ liệu điểm trong mẫu HIU.');
    self.postMessage({ok:true,rows,invalid,duplicateStudentCodes:duplicateCodes.size,duplicateRows,rowErrors,meta});
  }catch(error){
    self.postMessage({ok:false,error:error instanceof Error?error.message:'Không thể đọc bảng tính.'});
  }
};

export {};
