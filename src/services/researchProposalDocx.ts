export type ProposalFormData={
  title:string;chairName:string;studentCode:string;className:string;studentYear:string;faculty:string;phone:string;email:string;address:string;
  adviserName:string;adviserDegree:string;adviserSpecialty:string;adviserUnit:string;adviserPhone:string;adviserEmail:string;adviserAddress:string;
  durationMonths:string;teamMembers:string;overview:string;significance:string;objectives:string;populationScope:string;location:string;mainContents:string;methods:string;
  expectedResults:string;reportOutline:string;assignments:string;totalBudget:string;progress:string;specialNeeds:string;references:string;
};

const encoder=new TextEncoder();
const esc=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const sanitize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-_]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80)||'de-cuong-nghien-cuu';

let crcTable:Uint32Array|undefined;
function getCrcTable(){
  if(crcTable)return crcTable;
  crcTable=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0}
  return crcTable;
}
function crc32(bytes:Uint8Array){let c=0xffffffff,t=getCrcTable();for(const b of bytes)c=t[(c^b)&0xff]^(c>>>8);return(c^0xffffffff)>>>0}
function u16(n:number){return new Uint8Array([n&255,(n>>>8)&255])}
function u32(n:number){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
function concat(parts:Uint8Array[]){const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}

function zipStore(files:{name:string;content:string}[]){
  const locals:Uint8Array[]=[],centrals:Uint8Array[]=[];let offset=0;
  for(const file of files){
    const name=encoder.encode(file.name),data=encoder.encode(file.content),crc=crc32(data),flags=0x0800;
    const local=concat([u32(0x04034b50),u16(20),u16(flags),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    locals.push(local);
    const central=concat([u32(0x02014b50),u16(20),u16(20),u16(flags),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    centrals.push(central);offset+=local.length;
  }
  const central=concat(centrals),body=concat(locals),eocd=concat([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(central.length),u32(body.length),u16(0)]);
  return concat([body,central,eocd]);
}

function run(text:string,bold=false,italic=false,size=26){return`<w:r><w:rPr>${bold?'<w:b/>':''}${italic?'<w:i/>':''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`}
function paragraph(text='',opts:{bold?:boolean;italic?:boolean;align?:'left'|'center'|'right';size?:number;after?:number;before?:number;pageBreakBefore?:boolean}={}){
  const lines=String(text??'').split(/\r?\n/),pPr=`<w:pPr>${opts.align?`<w:jc w:val="${opts.align}"/>`:''}${opts.before||opts.after?`<w:spacing w:before="${opts.before||0}" w:after="${opts.after||0}"/>`:''}${opts.pageBreakBefore?'<w:pageBreakBefore/>':''}</w:pPr>`;
  return`<w:p>${pPr}${lines.map((line,i)=>`${i?'<w:r><w:br/></w:r>':''}${run(line,Boolean(opts.bold),Boolean(opts.italic),opts.size||26)}`).join('')}</w:p>`;
}
function labelValue(label:string,value:string){return`<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${run(`${label}: `,true,false,26)}${run(value||' ',false,false,26)}</w:p>`}
function section(num:number,title:string,value:string,hint=''){return`${paragraph(`${num}. ${title}`,{bold:true,size:26,after:50})}${hint?paragraph(`(${hint})`,{italic:true,size:24,after:70}):''}${paragraph(value||' ',{size:26,after:100})}`}
function cell(text:string,bold=false){return`<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run(text,bold,false,23)}</w:p></w:tc>`}
function table(rows:string[][],header=true){
  const trs=rows.map((r,ri)=>`<w:tr>${r.map(x=>cell(x,header&&ri===0)).join('')}</w:tr>`).join('');
  return`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="777777"/><w:left w:val="single" w:sz="6" w:color="777777"/><w:bottom w:val="single" w:sz="6" w:color="777777"/><w:right w:val="single" w:sz="6" w:color="777777"/><w:insideH w:val="single" w:sz="4" w:color="AAAAAA"/><w:insideV w:val="single" w:sz="4" w:color="AAAAAA"/></w:tblBorders></w:tblPr>${trs}</w:tbl>`;
}
function parseRows(text:string,columns:number,limit=12){
  return String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,limit).map(line=>{const parts=line.split('|').map(x=>x.trim()).slice(0,columns);while(parts.length<columns)parts.push('');return parts});
}

function documentXml(data:ProposalFormData){
  const year=new Date().getFullYear(),month=new Date().getMonth()+1;
  const team=parseRows(data.teamMembers,6,5),teamRows=[['TT','Họ và tên','MSSV','Lớp/Khoa','Học lực','Điện thoại / Chức danh'],...team.map((r,i)=>[String(i+1),...r.slice(0,4),`${r[4]}${r[5]?` / ${r[5]}`:''}`])];
  const assignmentRows=[['TT','Họ và tên','Chức danh','Nhiệm vụ được giao','Thời gian'],...parseRows(data.assignments,4,5).map((r,i)=>[String(i+1),...r])];
  const progressRows=[['TT','Công việc','Bắt đầu','Kết thúc','Thời lượng','Người chịu trách nhiệm'],...parseRows(data.progress,5,12).map((r,i)=>[String(i+1),...r])];
  const cover=`${paragraph('(Trang bìa của Mẫu 01-SV)',{italic:true,align:'right',size:23,after:120})}${paragraph('BỘ GIÁO DỤC VÀ ĐÀO TẠO',{align:'center',size:27})}${paragraph('TRƯỜNG ĐẠI HỌC QUỐC TẾ HỒNG BÀNG',{align:'center',bold:true,size:28,after:520})}${paragraph('THUYẾT MINH',{align:'center',bold:true,size:40})}${paragraph(`ĐỀ TÀI SINH VIÊN NĂM HỌC ${year}–${year+1}`,{align:'center',size:32})}${paragraph('[In màu, bìa màu xanh]',{align:'center',italic:true,size:22,after:420})}${labelValue('Tên đề tài',data.title)}${paragraph('',{after:520})}${labelValue('Chủ nhiệm đề tài',data.chairName)}${labelValue('Thành viên tham gia',team.map(r=>r[0]).filter(Boolean).join(', '))}${labelValue('Giảng viên hướng dẫn',data.adviserName)}${paragraph('',{after:550})}${paragraph(`Thành phố Hồ Chí Minh, tháng ${month} năm ${year}`,{align:'center',size:25})}<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
  const header=`${paragraph('(Mẫu 01-SV)',{italic:true,align:'right',size:23})}${table([['BỘ GIÁO DỤC VÀ ĐÀO TẠO\nTRƯỜNG ĐẠI HỌC QUỐC TẾ HỒNG BÀNG','CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập – Tự do – Hạnh phúc']],true)}${paragraph(`TP. Hồ Chí Minh, ngày …… tháng …… năm ${year}`,{align:'right',italic:true,size:24,after:160})}${paragraph('THUYẾT MINH ĐỀ TÀI SINH VIÊN CẤP TRƯỜNG',{align:'center',bold:true,size:31,after:180})}`;
  const identity=`${section(1,'Tên đề tài (không viết chữ in hoa)',data.title)}${paragraph('2. Chủ nhiệm đề tài',{bold:true,size:26})}${labelValue('- Họ tên',data.chairName)}${labelValue('- Mã số sinh viên',data.studentCode)}${labelValue('- Lớp / Sinh viên năm thứ',`${data.className}${data.studentYear?` / ${data.studentYear}`:''}`)}${labelValue('- Khoa/Viện/Bộ môn',data.faculty)}${labelValue('- Số điện thoại',data.phone)}${labelValue('- Email',data.email)}${labelValue('- Địa chỉ liên lạc',data.address)}${paragraph('3. Giảng viên hướng dẫn (01 người)',{bold:true,size:26})}${labelValue('- Họ tên',data.adviserName)}${labelValue('- Học hàm, học vị',data.adviserDegree)}${labelValue('- Chuyên môn',data.adviserSpecialty)}${labelValue('- Khoa/Viện/Bộ môn',data.adviserUnit)}${labelValue('- Số điện thoại',data.adviserPhone)}${labelValue('- Email',data.adviserEmail)}${labelValue('- Địa chỉ liên lạc',data.adviserAddress)}${section(4,'Thời gian (tháng)',data.durationMonths||'12','bao nhiêu tháng kể từ ngày đề cương được phê duyệt – tối đa 12 tháng')}${paragraph('5. Thông tin về nhân lực (từ 3 – 5 sinh viên, không kể giảng viên hướng dẫn)',{bold:true,size:26,after:70})}${table(teamRows)}`;
  const body=`${section(6,'Tổng quan',data.overview,'Tóm lược tình hình nghiên cứu trong và ngoài nước để khẳng định được sự cần thiết phải thực hiện đề tài này')}${section(7,'Ý nghĩa khoa học, ý nghĩa thực tiễn',data.significance,'Cần làm nổi bật tính mới, ý nghĩa của nghiên cứu này')}${section(8,'Mục tiêu nghiên cứu',data.objectives,'Nội dung trong nghiên cứu này để đạt được mục tiêu gì')}${section(9,'Đối tượng và phạm vi nghiên cứu',data.populationScope,'Chỉ rõ đối tượng nghiên cứu, giới hạn, phạm vi nghiên cứu này')}${section(10,'Địa điểm nghiên cứu',data.location,'Tại Khoa/Viện/Bộ môn, Phòng thí nghiệm của Nhà trường, Labo, Bệnh viện/Cơ sở thực hành của HIU…')}${section(11,'Nội dung chủ yếu của đề tài',data.mainContents,'Nêu cụ thể nghiên cứu cái gì, như thế nào và bằng những nguồn lực gì')}${section(12,'Phương pháp nghiên cứu',data.methods,'Nêu rõ thiết kế, tiêu chuẩn chọn mẫu, loại trừ, cỡ mẫu và công thức tính cỡ mẫu khi phù hợp')}${section(13,'Dự kiến kết quả, sản phẩm nghiên cứu',data.expectedResults)}${section(14,'Bố cục của báo cáo tổng kết (dự kiến sơ lược, không cần chi tiết)',data.reportOutline)}${paragraph('15. Dự kiến phân công công việc',{bold:true,size:26,after:70})}${table(assignmentRows)}${section(16,'Dự toán kinh phí',data.totalBudget||'Chưa xác định','Chỉ nêu tổng kinh phí, phần diễn giải trình bày phía dưới')}${paragraph('17. Tiến độ (dự kiến)',{bold:true,size:26,after:70})}${table(progressRows)}${section(18,'Nhu cầu đặc biệt để thực hiện đề tài',data.specialNeeds,'Mua sắm, chế tạo thiết bị, khảo sát trong/ngoài nước… nếu có')}${section(19,'Danh mục tài liệu tham khảo',data.references,'Trình bày rõ ràng theo định dạng chuẩn IEEE')}${paragraph('LÃNH ĐẠO KHOA                  GIẢNG VIÊN HƯỚNG DẪN                  CHỦ NHIỆM ĐỀ TÀI',{align:'center',bold:true,size:23,before:260})}${paragraph('(Ký, ghi rõ họ tên)                       (Ký, ghi rõ họ tên)                       (Ký, ghi rõ họ tên)',{align:'center',size:22,after:180})}<w:p><w:r><w:br w:type="page"/></w:r></w:p>${paragraph('DỰ TOÁN KINH PHÍ ĐỀ TÀI SINH VIÊN CẤP TRƯỜNG',{align:'center',bold:true,size:30,after:120})}${labelValue('Tên đề tài',data.title)}${table([['TT','Nội dung công việc','Thành tiền (đồng)'],['1','Kinh phí tổ chức Hội đồng xét duyệt, nghiệm thu','2.500.000'],['2','Kinh phí mua vật tư / hoạt động khác (phối hợp GVHD để xác định)',''],['','TỔNG KINH PHÍ',data.totalBudget||'']])}${paragraph('Lưu ý: Nhóm nghiên cứu phối hợp với GVHD để thực hiện nội dung kinh phí cho chính xác.',{italic:true,size:23,after:160})}${paragraph('CHỦ NHIỆM ĐỀ TÀI',{align:'right',bold:true,size:25})}`;
  return`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cover}${header}${identity}${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
const documentRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

export function buildResearchProposalDocx(data:ProposalFormData){
  const now=new Date().toISOString(),core=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(data.title)}</dc:title><dc:creator>YHCT HIU 4.0 Research Center</dc:creator><cp:lastModifiedBy>YHCT HIU 4.0 Research Center</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  return zipStore([{name:'[Content_Types].xml',content:contentTypes},{name:'_rels/.rels',content:rels},{name:'docProps/core.xml',content:core},{name:'word/document.xml',content:documentXml(data)},{name:'word/styles.xml',content:stylesXml},{name:'word/_rels/document.xml.rels',content:documentRels}]);
}

export function downloadResearchProposalDocx(data:ProposalFormData){
  const bytes=buildResearchProposalDocx(data),blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`Mau-01-SV-${sanitize(data.title)}.docx`;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),2500);
}
