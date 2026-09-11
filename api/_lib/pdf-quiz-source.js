import {createHash} from 'node:crypto';
import {PDFParse} from 'pdf-parse';

const MAX_PDF_BYTES=2_000_000;
const MAX_PDF_PAGES=80;
const MAX_SOURCE_TEXT=400_000;
const MAX_BASE64_CHARS=2_800_000;
const PDF_MIME='application/pdf';
const cleanName=value=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,300);
const sha256=value=>createHash('sha256').update(value).digest('hex');

function decodePdfBase64(base64){
 if(typeof base64!=='string'||!base64.length||base64.length>MAX_BASE64_CHARS||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error('Tệp PDF không hợp lệ hoặc lớn hơn 2 MB.');
 const buffer=Buffer.from(base64,'base64');
 if(!buffer.length||buffer.length>MAX_PDF_BYTES)throw new Error('Tệp PDF phải nhỏ hơn 2 MB.');
 if(buffer.subarray(0,5).toString('ascii')!=='%PDF-')throw new Error('Tệp tải lên không có chữ ký PDF hợp lệ.');
 return buffer;
}

export async function readUploadedPdfFile(name,base64){
 if(!/\.pdf$/i.test(String(name||'')))throw new Error('Định dạng tải lên không phải PDF.');
 const buffer=decodePdfBase64(base64),sourceHash=sha256(buffer),parser=new PDFParse({data:new Uint8Array(buffer)});
 try{
  const info=await parser.getInfo({parsePageInfo:false});
  const pages=Number(info?.total||0);
  if(!Number.isInteger(pages)||pages<1)throw new Error('Không xác định được số trang PDF.');
  if(pages>MAX_PDF_PAGES)throw new Error(`PDF có ${pages} trang, vượt giới hạn ${MAX_PDF_PAGES} trang; hãy chia nhỏ trước khi nhập.`);
  const extracted=await parser.getText();
  let text=String(extracted?.text||'').replace(/\r\n?/g,'\n').replace(/\u0000/g,'').trim();
  if(!text)throw new Error('PDF không có lớp văn bản có thể trích xuất. Hệ thống không OCR tự động; hãy dùng PDF có text hoặc chuyển sang DOCX/TXT.');
  if(text.length>MAX_SOURCE_TEXT)throw new Error('Nội dung PDF vượt 400.000 ký tự; hãy chia nhỏ trước khi nhập.');
  return{file:{id:`upload-${sourceHash}`,name:cleanName(name),mimeType:PDF_MIME},text,sourceHash,warnings:[`Đã trích xuất văn bản từ PDF ${pages} trang; cần đối chiếu nguyên văn trước khi nhập.`],pdfPages:pages};
 }catch(error){
  const message=String(error?.message||'Không trích xuất được PDF.');
  if(/password|encrypted/i.test(message))throw new Error('PDF được bảo vệ bằng mật khẩu hoặc mã hóa; hãy cung cấp bản PDF không khóa.');
  throw error;
 }finally{
  await parser.destroy().catch(()=>{});
 }
}

export const pdfQuizLimits=Object.freeze({maxBytes:MAX_PDF_BYTES,maxPages:MAX_PDF_PAGES,maxSourceText:MAX_SOURCE_TEXT});
