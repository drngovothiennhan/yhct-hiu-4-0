import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {normalizeImportQuestion} from './mcq-parser.js';

const MAX_DOCX_BYTES=5_000_000;
const MAX_XML_BYTES=12_000_000;
const RED_NAMES=new Set(['RED','DARKRED']);
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
const attrValue=(xml,tag,attr='w:val')=>{const re=new RegExp(`<${tag}\\b[^>]*\\b${attr.replace(':','\\:')}=(?:"([^"]+)"|'([^']+)')[^>]*\\/?\\s*>`,'i'),m=xml.match(re);return String(m?.[1]||m?.[2]||'').trim()};
const runColor=run=>attrValue(run,'w:color').toUpperCase();
const runHighlight=run=>attrValue(run,'w:highlight').toUpperCase();
const normalizeHex=value=>{let x=String(value||'').trim().replace(/^#/,'').toUpperCase();if(x.length===3&&/^[0-9A-F]{3}$/.test(x))x=x.split('').map(c=>c+c).join('');if(x.length===8&&/^[0-9A-F]{8}$/.test(x))x=x.slice(-6);return x};
const isRedColor=value=>{const raw=String(value||'').trim().toUpperCase();if(RED_NAMES.has(raw))return true;const hex=normalizeHex(raw);if(!/^[0-9A-F]{6}$/.test(hex))return false;const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);return r>=160&&g<=115&&b<=115&&r-g>=55&&r-b>=55};
const isRedHighlight=value=>RED_NAMES.has(String(value||'').trim().toUpperCase());
const compactLength=value=>String(value||'').replace(/\s+/g,'').length;

export function inspectMarkedDocx(buffer){
  const xml=extractDocxEntry(buffer).toString('utf8');
  const paragraphs=[];
  for(const match of xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)){
    const fragment=match[0],runs=[...fragment.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)].map(m=>{const text=runText(m[0]),color=runColor(m[0]),highlight=runHighlight(m[0]);return{text,color,highlight,red:isRedColor(color)||isRedHighlight(highlight)}}).filter(x=>x.text.length);
    const text=clean(runs.map(x=>x.text).join(''),5000);if(!text)continue;
    const meaningful=runs.filter(x=>x.text.trim().length>0),totalChars=meaningful.reduce((sum,x)=>sum+compactLength(x.text),0),redChars=meaningful.filter(x=>x.red).reduce((sum,x)=>sum+compactLength(x.text),0),red=redChars>0&&totalChars>0&&(redChars/totalChars>=0.45||totalChars-redChars<=2);
    paragraphs.push({text,red,colors:[...new Set(meaningful.flatMap(x=>[x.color,x.highlight?`HIGHLIGHT:${x.highlight}`:'']).filter(Boolean))],redChars,totalChars});
  }
  return paragraphs;
}

function normalizeTrustedQuestion(q,file,sourceHash,layout='labeled-abcd-v1'){
  const uniqueMarked=[...new Set(q.marked)],structural=q.stem.length>=4&&q.options.length===4&&q.options.every(Boolean)&&new Set(q.options.map(x=>x.toLowerCase())).size===4;
  if(!structural||uniqueMarked.length!==1)return{question:null,invalid:{number:q.number,reason:!structural?'invalid_question_structure':uniqueMarked.length===0?'missing_red_answer':'multiple_red_answers',marked:uniqueMarked.map(i=>letters[i]).filter(Boolean)}};
  const correctIndex=uniqueMarked[0],normalized=normalizeImportQuestion({number:q.number,stem:q.stem,options:q.options,correctIndex,explanation:`Đáp án ${letters[correctIndex]} được đánh dấu đỏ trong tài liệu nguồn đã duyệt.`,answerEvidence:`Định dạng đỏ đã chuẩn hóa: ${letters[correctIndex]}`,raw:q.raw.join('\n')},file,true);
  normalized.externalKey=`trusted:${file.id}:${hash(`${q.stem}|${q.options.join('|')}|${correctIndex}`).slice(0,24)}`;
  normalized.reviewStatus='source_verified';
  normalized.provenance={...normalized.provenance,sourceHash,sourceMark:'word-font-color-red-v1',sourceMarkColor:'FF0000',sourceLayout:layout,sourceFormatNormalized:'common-red-v2',trustedApprovedSource:true,adminConfirmed:true,questionNumber:q.number,markedAnswer:letters[correctIndex]};
  return{question:normalized,invalid:null};
}

const stripOptionLabel=value=>clean(String(value||'').replace(/^\s*[A-D]\s*[.)：:]\s*/i,''),1500);
function parsePrefixedFourOptionQuestions(paragraphs){
  const starts=[];
  for(let index=0;index<paragraphs.length;index++){
    const match=paragraphs[index].text.match(/^(?:Câu|Cau)\s+(\d{1,4})\s*[.)：:\-]?\s*(.*)$/i);
    if(match)starts.push({index,number:match[1],stem:clean(match[2],4000)});
  }
  const questions=[];
  for(let at=0;at<starts.length;at++){
    const start=starts[at],end=at+1<starts.length?starts[at+1].index:paragraphs.length,segment=paragraphs.slice(start.index+1,end),marked=[];
    segment.forEach((x,index)=>{if(x.red)marked.push(index)});
    questions.push({number:start.number,stem:start.stem,options:segment.map(x=>stripOptionLabel(x.text)),marked,raw:[paragraphs[start.index].text,...segment.map(x=>x.text)],layout:'prefixed-four-options-v2'});
  }
  return questions;
}

function parseLabeledQuestions(paragraphs){
  const questions=[];let current=null,lastOption=-1;
  const flush=()=>{if(!current)return;questions.push(current);current=null;lastOption=-1};
  for(const paragraph of paragraphs){
    const q=paragraph.text.match(/^(?:Câu|Cau)\s+(\d{1,4})\s*[.)：:\-]?\s*(.*)$/i);
    if(q){flush();current={number:q[1],stem:clean(q[2],4000),options:['','','',''],marked:[],raw:[paragraph.text],layout:'labeled-abcd-v1'};continue}
    const option=paragraph.text.match(/^([A-D])\s*[.)：:]\s*(.*)$/i);
    if(option&&current){const index=letters.indexOf(option[1].toUpperCase());current.options[index]=clean(option[2],1500);lastOption=index;current.raw.push(paragraph.text);if(paragraph.red)current.marked.push(index);continue}
    if(!current)continue;
    current.raw.push(paragraph.text);
    if(lastOption<0)current.stem=clean(`${current.stem} ${paragraph.text}`,4000);else current.options[lastOption]=clean(`${current.options[lastOption]} ${paragraph.text}`,1500);
  }
  flush();return questions;
}

function parseSplitLabelQuestions(paragraphs){
  const starts=[];
  for(let index=0;index+2<paragraphs.length;index++){
    if(!/^\d{1,4}$/.test(paragraphs[index].text))continue;
    if(/^(?:\d{1,4}|[A-D])$/i.test(paragraphs[index+1].text))continue;
    if(!/^A$/i.test(paragraphs[index+2].text))continue;
    starts.push({index,number:paragraphs[index].text});
  }
  const questions=[];
  for(let at=0;at<starts.length;at++){
    const start=starts[at],end=at+1<starts.length?starts[at+1].index:paragraphs.length,segment=paragraphs.slice(start.index+1,end);
    if(!segment.length)continue;
    const q={number:start.number,stem:clean(segment[0].text,4000),options:['','','',''],marked:[],raw:[paragraphs[start.index].text,...segment.map(x=>x.text)],layout:'split-label-paragraphs-v1'};
    for(let pos=1;pos<segment.length;pos++){
      const label=segment[pos].text.match(/^([A-D])(?:\s*[.)：:]\s*(.*))?$/i);if(!label)continue;
      const optionIndex=letters.indexOf(label[1].toUpperCase()),inline=clean(label[2]||'',1500);
      if(inline){q.options[optionIndex]=inline;if(segment[pos].red)q.marked.push(optionIndex);continue}
      const value=segment[pos+1];if(!value)continue;q.options[optionIndex]=clean(value.text,1500);if(segment[pos].red||value.red)q.marked.push(optionIndex);pos++;
    }
    questions.push(q);
  }
  return questions;
}

function parseNumberedUnlabeledQuestions(paragraphs){
  const starts=[];
  for(let index=0;index<paragraphs.length;index++){
    const match=paragraphs[index].text.match(/^(\d{1,4})\s*[.)：:]\s*(.+)$/);
    if(match)starts.push({index,number:match[1],stem:clean(match[2],4000)});
  }
  const questions=[];
  for(let at=0;at<starts.length;at++){
    const start=starts[at],end=at+1<starts.length?starts[at+1].index:paragraphs.length,optionParagraphs=paragraphs.slice(start.index+1,end);
    const options=optionParagraphs.map(x=>clean(x.text,1500)),marked=[];
    optionParagraphs.forEach((x,index)=>{if(x.red)marked.push(index)});
    questions.push({number:start.number,stem:start.stem,options,marked,raw:[paragraphs[start.index].text,...optionParagraphs.map(x=>x.text)],layout:'numbered-unlabeled-options-v1'});
  }
  return questions;
}

function parseFiveParagraphBlocks(paragraphs){
  const questions=[];let index=0,number=1;
  while(index+4<paragraphs.length){
    const block=paragraphs.slice(index,index+5),optionParagraphs=block.slice(1),marked=[];
    optionParagraphs.forEach((x,optionIndex)=>{if(x.red)marked.push(optionIndex)});
    const structurallyPossible=!block[0].red&&clean(block[0].text,4000).length>=4&&optionParagraphs.every(x=>clean(x.text,1500))&&new Set(optionParagraphs.map(x=>clean(x.text,1500).toLowerCase())).size===4&&marked.length===1;
    if(structurallyPossible){questions.push({number:String(number++),stem:clean(block[0].text,4000),options:optionParagraphs.map(x=>clean(x.text,1500)),marked,raw:block.map(x=>x.text),layout:'unlabeled-five-paragraph-block-v1'});index+=5}else index++;
  }
  return questions;
}

const structuralScore=questions=>questions.reduce((score,q)=>score+(q.stem.length>=4&&q.options.length===4&&q.options.every(Boolean)&&new Set(q.options.map(x=>x.toLowerCase())).size===4?1:0),0);
export function parseTrustedMarkedDocx(buffer,file,sourceHash=''){
  const paragraphs=inspectMarkedDocx(buffer),variants=[parsePrefixedFourOptionQuestions(paragraphs),parseLabeledQuestions(paragraphs),parseSplitLabelQuestions(paragraphs),parseNumberedUnlabeledQuestions(paragraphs),parseFiveParagraphBlocks(paragraphs)];
  let sourceQuestions=[],bestScore=-1;
  for(const questions of variants){if(!questions.length)continue;const score=structuralScore(questions);if(score>bestScore){sourceQuestions=questions;bestScore=score}}
  const valid=[],invalid=[];
  for(const q of sourceQuestions){
    if(q.options.length!==4){invalid.push({number:q.number,reason:'invalid_option_count',optionCount:q.options.length,marked:q.marked.map(i=>letters[i]||String(i+1))});continue}
    const normalized=normalizeTrustedQuestion(q,file,sourceHash,q.layout);
    if(normalized.question)valid.push(normalized.question);else invalid.push(normalized.invalid);
  }
  const trusted=sourceQuestions.length>0&&invalid.length===0&&valid.length===sourceQuestions.length;
  return{trusted,questions:valid,total:sourceQuestions.length,valid:valid.length,invalid,marker:'word-font-color-red-v1'};
}
