import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const letters=['A','B','C','D'];
const trim=value=>String(value??'').replace(/[ \t]+/g,' ').trim();
/** Preserve every detected question, including ambiguous and unanswered items. Never infer a medical answer. */
export function parseMcqDocument(input){
  const source=String(input??'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
  if(source.length>400000)throw new Error('Tài liệu vượt 400.000 ký tự; hãy chia nhỏ. Không có nội dung nào được nhập một phần.');
  const keys=new Map(),warnings=[],questions=[],unassigned=[];
  let inKey=false,keyPending='',body=[];
  for(const raw of source.split('\n')){
    let line=trim(raw);
    if(/^(?:(?:bảng|bảng tổng hợp)\s+)?(?:đáp\s*án|answer\s*key)\s*[:：]?\s*$/i.test(line)){inKey=true;continue}
    if(inKey){
      if(!line)continue;
      const pairs=[...line.matchAll(/(?:^|[\s;,|])(?:câu\s*)?(\d{1,4})\s*[.\-:)=]?\s*([A-D])(?=$|[\s;,|])/gi)];
      if(pairs.length){for(const m of pairs){const list=keys.get(m[1])||[];keys.set(m[1],[...list,m[2].toUpperCase()])}continue}
      if(/^\d{1,4}$/.test(line)){keyPending=line;continue}
      if(keyPending&&/^[A-D]$/i.test(line)){keys.set(keyPending,[...(keys.get(keyPending)||[]),line.toUpperCase()]);keyPending='';continue}
      if(/^câu\s+\d+/i.test(line)){inKey=false}else{unassigned.push(line);continue}
    }
    // Split inline A/B/C/D only when at least two option markers exist, avoiding isolated abbreviations.
    const marks=[...line.matchAll(/(?:^|\s)([*✓]?\s*[A-D][.)：:]\s+)/g)];
    if(marks.length>=2){let last=0;for(const m of marks){const at=m.index;if(at>last)body.push(line.slice(last,at));last=at}body.push(line.slice(last));}
    else body.push(line);
  }
  let current=null,lastOption=null,explanation=false,tail=[];
  const make=(number,stem)=>({number,stem,options:['','','',''],correctIndex:null,explanation:'',issues:[],evidence:[],marks:[],raw:[]});
  const flush=()=>{
    if(!current)return;
    if(tail.length&&lastOption!==null)current.options[lastOption]=trim(current.options[lastOption]+' '+tail.join(' '));tail=[];
    const keyed=keys.get(current.number)||[];const candidates=[...current.evidence.map(x=>x.letter),...keyed];
    const unique=[...new Set(candidates)];
    if(unique.length===1)current.correctIndex=letters.indexOf(unique[0]);
    if(current.marks.length&&(current.marks.length>1||current.correctIndex!==null&&current.marks.some(x=>x!==current.correctIndex)))current.issues.push('Dấu chọn và đáp án không thống nhất');
    if(unique.length>1)current.issues.push('Đáp án mâu thuẫn trong nguồn');
    if(!unique.length&&current.marks.length===1){current.correctIndex=current.marks[0];current.issues.push('Dấu đánh dấu đáp án cần admin xác nhận');}
    if(current.correctIndex===null)current.issues.push('Chưa xác định đáp án');
    if(current.stem.length<4)current.issues.push('Thiếu nội dung câu hỏi');
    if(current.options.some(x=>!x))current.issues.push('Chưa đủ bốn lựa chọn A–D');
    if(new Set(current.options.map(x=>x.toLowerCase())).size<4)current.issues.push('Lựa chọn trùng hoặc trống');
    if(current.stem.length>4000||current.options.some(x=>x.length>1500))current.issues.push('Nội dung quá dài; cần tách câu');
    current.answerEvidence=unique.length===1?(current.evidence.map(x=>x.text).join(' · ')||`Bảng đáp án: ${current.number} ${unique[0]}`):'';
    current.raw=current.raw.join('\n');current.id=hash(`${questions.length}|${current.raw}`).slice(0,24);
    delete current.evidence;delete current.marks;questions.push(current);current=null;lastOption=null;explanation=false;
  };
  let preamble=[];
  for(const raw of body){
    const line=trim(raw);if(!line)continue;
    const q=line.match(/^(?:câu\s+(\d{1,4})\s*(?:[.):：\-]\s*)?|(?:question\s+)?(\d{1,4})[.)]\s+)(.*)$/i);
    if(q){flush();current=make(q[1]||q[2],trim(q[3]));current.raw.push(line);preamble=[];continue}
    const o=line.match(/^([*✓]?)\s*([A-D])[.)：:]\s*(.*)$/i);
    if(o){
      const index=letters.indexOf(o[2].toUpperCase());
      if(!current){current=make('',trim(preamble.join(' ')));current.issues.push('Câu không đánh số: kiểm tra ranh giới nội dung');current.raw.push(...preamble);preamble=[];}
      else if(index===0&&current.options.every(Boolean)&&tail.length){const nextStem=tail.join(' ');tail=[];flush();current=make('',nextStem);current.issues.push('Câu không đánh số: kiểm tra ranh giới nội dung');current.raw.push(nextStem)}
      if(current.options[index])current.issues.push(`Lặp nhãn ${letters[index]}`);
      current.options[index]=trim(current.options[index]+' '+o[3]);if(o[1])current.marks.push(index);
      current.raw.push(line);lastOption=index;explanation=false;continue;
    }
    if(!current){preamble.push(line);continue}
    current.raw.push(line);
    if(/^[E-Z][.)：:]\s*/.test(line))current.issues.push('Có lựa chọn ngoài A–D; cần kiểm tra');
    const a=line.match(/^(?:đáp\s*án(?:\s*đúng)?|đ\s*a|dap\s*an|answer|chọn)\s*(?:là\s*)?[:：=\-]?\s*([A-D])(?:[.\s]|$)/i);
    if(a){if(/\b[A-D]\s*(?:,|;|\/|và|hoặc|&)\s*[A-D]\b/i.test(line))current.issues.push('Nguồn có nhiều đáp án; cần kiểm tra');current.evidence.push({letter:a[1].toUpperCase(),text:line});explanation=false;continue}
    if(/^(?:giải\s*thích|explanation)\s*[:：]/i.test(line)){explanation=true;current.explanation=trim(line.replace(/^[^:：]+[:：]/,''));continue}
    if(explanation){current.explanation=trim(current.explanation+' '+line);continue}
    if(lastOption===null)current.stem=trim(current.stem+' '+line);
    else if(lastOption===3)tail.push(line);
    else current.options[lastOption]=trim(current.options[lastOption]+' '+line);
  }
  flush();
  const numbers=new Map();for(const q of questions)if(q.number)numbers.set(q.number,(numbers.get(q.number)||0)+1);
  const seen=new Set();for(const q of questions){if(q.number&&numbers.get(q.number)>1)q.issues.push('Số câu trùng; kiểm tra bảng đáp án');const signature=hash(q.stem+'|'+q.options.join('|'));if(seen.has(signature))q.issues.push('Câu trùng nội dung trong tài liệu');seen.add(signature);q.issues=[...new Set(q.issues)];}
  if(preamble.length)unassigned.push(...preamble);
  if(unassigned.length)warnings.push('Có đoạn ngoài câu hỏi hoặc bảng đáp án chưa nhận diện; xem nguyên văn để đối soát.');
  if(!questions.length)warnings.push('Không tìm thấy cấu trúc câu hỏi A–D; chưa tạo câu hỏi tự động.');
  return {questions,total:questions.length,ready:questions.filter(q=>!q.issues.length).length,needsReview:questions.filter(q=>q.issues.length).length,warnings,unassigned,sourceText:source,parser:'deterministic-v2'};
}
export function normalizeImportQuestion(q,file,manual=false){
  const stem=trim(q.stem),options=Array.isArray(q.options)?q.options.map(trim):[];
  if(stem.length<4||stem.length>4000||options.length!==4||options.some(x=>!x||x.length>1500)||new Set(options.map(x=>x.toLowerCase())).size!==4||!Number.isInteger(q.correctIndex)||q.correctIndex<0||q.correctIndex>3)throw new Error('Câu chưa đủ nội dung hoặc đáp án hợp lệ.');
  const basis=`${stem}|${options.join('|')}|${q.correctIndex}`,digest=hash(basis);
  return {externalKey:`drive:${file.id}:parsed:${digest.slice(0,24)}`,contentHash:digest,subject:trim(file.parentName||file.name).slice(0,160),topic:'Từ tài liệu gốc',stem,options,correctIndex:q.correctIndex,explanation:trim(q.explanation)||`Đáp án ${letters[q.correctIndex]} ${manual?'đã được admin xác nhận':'ghi trong nguồn'}.`,generationMethod:'parsed',reviewStatus:'source_verified',provenance:{driveFileId:file.id,fileName:file.name,subjectFolder:file.parentName,questionNumber:q.number,answerEvidence:q.answerEvidence||'',parser:'deterministic-v2',adminConfirmed:manual,sourceExcerpt:q.raw||''}};
}
