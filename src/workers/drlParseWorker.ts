import * as XLSX from 'xlsx';

type RawRow=Record<string,unknown>;
type ImportRow={mssv:string;ho_ten:string;ten_hoat_dong:string;hoc_ky:string;diem_cong:string;ghi_chu:string;occurred_at?:string};
const key=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const pick=(r:RawRow,keys:string[])=>{for(const [k,v] of Object.entries(r))if(keys.includes(key(k)))return v;return ''};
const text=(v:unknown,max:number)=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
self.onmessage=(event:MessageEvent<ArrayBuffer>)=>{
  try{
    const wb=XLSX.read(event.data,{type:'array',cellDates:true,cellFormula:false,cellHTML:false,cellStyles:false});
    const first=wb.SheetNames[0];if(!first)throw new Error('Workbook không có sheet.');
    const ws=wb.Sheets[first];
    const raw=XLSX.utils.sheet_to_json<RawRow>(ws,{defval:'',raw:false,blankrows:false});
    if(raw.length>5000)throw new Error('Tối đa 5.000 dòng mỗi lần nhập.');
    const rows:ImportRow[]=raw.map(r=>({
      mssv:text(pick(r,['mssv','ma_sinh_vien','student_code']),20).replace(/\s/g,''),
      ho_ten:text(pick(r,['ho_ten','hoten','full_name']),160),
      ten_hoat_dong:text(pick(r,['ten_hoat_dong','hoat_dong','activity_name']),240),
      hoc_ky:text(pick(r,['hoc_ky','hocky','semester']),80),
      diem_cong:text(pick(r,['diem_cong','diem','points']),40).replace(',','.'),
      ghi_chu:text(pick(r,['ghi_chu','ghichu','note']),500)
    }));
    const invalid=rows.filter(x=>!/^\d{8,14}$/.test(x.mssv)||!x.ho_ten||!x.ten_hoat_dong||!x.hoc_ky||!Number.isFinite(Number(x.diem_cong))).length;
    self.postMessage({ok:true,rows,invalid});
  }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:'Không thể đọc bảng tính.'})}
};
export {};
