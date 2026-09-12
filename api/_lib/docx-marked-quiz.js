import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {normalizeImportQuestion} from './mcq-parser.js';

const MAX_DOCX_BYTES=5_000_000;
const MAX_XML_BYTES=12_000_000;
const RED_MARKERS=new Set(['FF0000','RED']);
const letters=['A','B','C','D'];
const clean=(value,max=4000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const hash=value=>createHash('sha256').update(value).digest('hex');
const xmlDecode=value=>String(value||'').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');

function findEocd(buffer){
  const min=Math.max(0,buffer.length-65_557);
  for(let at=buffer.length-22;at>=min;at--)if(buffer.readUInt32LE(at)===0x06054b50)return at;
  throw new Error('DOCX ZIP directory not found');
}

export function extractDocxEntry(buffer,name='word/document.xml'){
  if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>MAX_DOCX_BYTES)throw new Error('DOCX không hợp lệ hoặc vượt 5 MB');
  const eocd=findEocd(buffer),entries=buffer.readUInt16LE(eocd+10),directoryOffset=buffer.readUInt32LE(eocd+16);
  let at=directoryOffset;
  for(let i=0;i<entries;i++){
    if(at+46>buffer.length||buffer.readUInt32LE(at)!==0x02014b50)throw new Error('DOCX ZIP directory malformed');
    const flags=buffer.readUInt16LE(at+8),method=buffer.readUInt16LE(at+10),compressedSize=buffer.readUInt32LE(at+20),uncompressedSize=buffer.readUInt32LE(at+24),fileNameLength=buffer.readUInt16LE(at+28),extraLength=buffer.readUInt16LE(at+30),commentLength=buffer.readUInt16LE(at+32),localOffset=buffer.readUInt32LE(at+42);
    const fileName=buffer.subarray(at+46,at+46+fileNameLength).toString('utf8');
    if(fileName===name){
      if(flags&1)throw new Error('DOCX mã hóa không được hỗ trợ');
      if(uncompressedSize>MAX_XML_BYTES)throw new Error('DOCX XML vượt giới hạn an toàn');
      if(localOffset+30>buffer.length||buffer.readUInt32LE(localOffset)!==0x04034b50)throw new Error('DOCX local entry malformed');
      const localNameLength=buffer.readUInt16LE(localOffset+26),localExtraLength=buffer.readUInt16LE(localOffset+28),start=localOffset+30+localNameLength+localExtraLength,end=start+compressedSize;
      if(start<0||end>buffer.length)throw new Error('DOCX entry vượt phạm vi tệp');
      const packed=buffer.subarray(start,end);let output;
      if(method===0)output=Buffer.from(packed);else if(method===8)output=inflateRawSync(packed,{maxOutputLength:MAX_XML_BYTES});else throw new Error(`DOCX compression ${method} chưa được hỗ trợ`);
      if(output.length>MAX_XML_BYTES)throw new Error('DOCX XML vượt giới hạn an toàn');
      return output;
    }
    at+=46+fileNameLength+extraLength+commentLength;
  }
  throw new Error('DOCX thiếu word/document.xml');
}

const runText=run=>[...run.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(m=>xmlDecode(m[1])).join('');
const runColor=run=>{const m=run.match(/<w:color\b[^>]*\bw:val=(?:"([^"]+)"|'([^']+)')[^>]*\/?\s*>/i);return String(m?.[1]||m?.[2]||'').trim().toUpperCase()};
const isRed=color=>RED_MARKERS.has(String(color||'').toUpperCase());

export function inspectMarkedDocx(buffer){
  const xml=extractDocxEntry(buffer).toString('utf8');
  const paragraphs=[];
  for(const match of xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)){
    const fragment=match[0],runs=[...fragment.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)].map(m=>({text:runText(m[0]),color:runColor(m[0])})).filter(x=>x.text.length);
    const text=clean(runs.map(x=>x.text).join(''),5000);if(!text)continue;
    const meaningful=runs.filter(x=>x.text.trim().length>0),red=meaningful.length>0&&meaningful.every(x=>isRed(x.color));
    paragraphs.push({text,red,colors:[...new Set(meaningful.map(x=>x.color).filter(Boolean))]});
  }
  return paragraphs;
}

export function parseTrustedMarkedDocx(buffer,file,sourceHash=''){
  const paragraphs=inspectMarkedDocx(buffer),questions=[];let current=null,lastOption=-1;
  const flush=()=>{if(!current)return;questions.push(current);current=null;lastOption=-1};
  for(const paragraph of paragraphs){
    const q=paragraph.text.match(/^(?:Câu|Cau)\s+(\d{1,4})\s*[.)：:\-]?\s*(.*)$/i);
    if(q){flush();current={number:q[1],stem:clean(q[2],4000),options:['','','',''],marked:[],raw:[paragraph.text]};continue}
    const option=paragraph.text.match(/^([A-D])\s*[.)：:]\s*(.*)$/i);
    if(option&&current){const index=letters.indexOf(option[1].toUpperCase());current.options[index]=clean(option[2],1500);lastOption=index;current.raw.push(paragraph.text);if(paragraph.red)current.marked.push(index);continue}
    if(!current)continue;
    current.raw.push(paragraph.text);
    if(lastOption<0)current.stem=clean(`${current.stem} ${paragraph.text}`,4000);else current.options[lastOption]=clean(`${current.options[lastOption]} ${paragraph.text}`,1500);
  }
  flush();

  const valid=[],invalid=[];
  for(const q of questions){
    const uniqueMarked=[...new Set(q.marked)],structural=q.stem.length>=4&&q.options.every(Boolean)&&new Set(q.options.map(x=>x.toLowerCase())).size===4;
    if(!structural||uniqueMarked.length!==1){invalid.push({number:q.number,reason:!structural?'invalid_question_structure':uniqueMarked.length===0?'missing_red_answer':'multiple_red_answers',marked:uniqueMarked.map(i=>letters[i])});continue}
    const correctIndex=uniqueMarked[0],normalized=normalizeImportQuestion({number:q.number,stem:q.stem,options:q.options,correctIndex,explanation:`Đáp án ${letters[correctIndex]} được đánh dấu đỏ trong tài liệu nguồn đã duyệt.`,answerEvidence:`Word font color FF0000: ${letters[correctIndex]}`,raw:q.raw.join('\n')},file,true);
    normalized.externalKey=`trusted:${file.id}:${hash(`${q.stem}|${q.options.join('|')}|${correctIndex}`).slice(0,24)}`;
    normalized.reviewStatus='source_verified';
    normalized.provenance={...normalized.provenance,sourceHash,sourceMark:'word-font-color-red-v1',sourceMarkColor:'FF0000',trustedApprovedSource:true,adminConfirmed:true,questionNumber:q.number,markedAnswer:letters[correctIndex]};
    valid.push(normalized);
  }
  const trusted=questions.length>0&&invalid.length===0&&valid.length===questions.length;
  return{trusted,questions:valid,total:questions.length,valid:valid.length,invalid,marker:'word-font-color-red-v1'};
}
