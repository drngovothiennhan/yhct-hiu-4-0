import {createHash} from 'node:crypto';
import {learningContentAccess,memberRpc} from './member-access.js';
import {driveQuizMeta,readSelectedQuizFile,readUploadedQuizFile,scopedQuizItem} from './drive-quiz.js';
import {parseMcqDocument} from './mcq-parser.js';
import {createGeminiJson,geminiAiConfigured,geminiAiModel} from './gemini-provider.js';

const clean=(value,max=4000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const sha=value=>createHash('sha256').update(String(value||'')).digest('hex');
const shaBuffer=value=>createHash('sha256').update(value).digest('hex');
const MODES=new Set(['auto','generate','extract']);
const PIPELINE_ACTIONS=new Set(['quiz-start','quiz-process-chunk','quiz-retry']);
const CHUNK_CHARS=12000;
const CHUNK_OVERLAP=450;
const MAX_CHUNKS=48;
const MAX_UPLOAD_BYTES=2_000_000;
const MAX_SOURCE_TEXT=400_000;
const QUIZ_SCHEMA={type:'object',properties:{subject:{type:'string'},questions:{type:'array',maxItems:10,items:{type:'object',properties:{topic:{type:'string'},stem:{type:'string'},options:{type:'array',minItems:4,maxItems:4,items:{type:'string'}},correctIndex:{type:'integer',minimum:0,maximum:3},explanation:{type:'string'},evidenceText:{type:'string'}},required:['topic','stem','options','correctIndex','explanation','evidenceText'],additionalProperties:false}}},required:['subject','questions'],additionalProperties:false};

export const isQuizPipelineV2Action=action=>PIPELINE_ACTIONS.has(String(action||''));

export function planQuizChunks(text,maxChars=CHUNK_CHARS,overlap=CHUNK_OVERLAP){
 const source=String(text||'');
 if(!source.length)return[];
 const chunks=[];let start=0;
 while(start<source.length&&chunks.length<MAX_CHUNKS){
  const hardEnd=Math.min(source.length,start+maxChars);let end=hardEnd;
  if(hardEnd<source.length){
   const candidates=[source.lastIndexOf('\n\n',hardEnd),source.lastIndexOf('\n',hardEnd),source.lastIndexOf('. ',hardEnd)].filter(x=>x>start+Math.floor(maxChars*.55));
   if(candidates.length)end=Math.max(...candidates)+1;
  }
  if(end<=start)end=hardEnd;
  const chunkText=source.slice(start,end).trim();
  if(chunkText)chunks.push({index:chunks.length,start,end,text:chunkText,hash:sha(chunkText).slice(0,16)});
  if(end>=source.length){start=source.length;break;}
  start=Math.max(start+1,end-overlap);
 }
 if(start<source.length)throw new Error('Tài liệu quá dài cho pipeline an toàn; hãy chia tài liệu thành các phần nhỏ hơn.');
 return chunks;
}

async function designChunkWithGemini(text,file){
 if(!geminiAiConfigured('research'))throw new Error('Gemini Research chưa được cấu hình để chuyển tài liệu thành trắc nghiệm.');
 const source=String(text||'');if(source.trim().length<120)return{questions:[],model:geminiAiModel('research')};
 const evidenceSource=clean(source,CHUNK_CHARS+1000).toLowerCase();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
 try{
  const output=await createGeminiJson({mode:'research',signal:controller.signal,maxOutputTokens:3600,schema:QUIZ_SCHEMA,systemInstruction:[
   'Bạn là Gemini Quiz Designer của HIU YHCT 4.0.',
   'Chỉ dùng thông tin có trong SOURCE_CHUNK; tuyệt đối không bổ sung kiến thức ngoài nguồn.',
   'Tạo tối đa 10 câu trắc nghiệm, mỗi câu đúng 4 lựa chọn A-D và đúng duy nhất một đáp án.',
   'evidenceText phải là đoạn ngắn xuất hiện trong SOURCE_CHUNK và đủ chứng minh đáp án.',
   'Nếu chunk không đủ căn cứ thì có thể trả questions rỗng.',
   'Không tạo chẩn đoán, kê đơn hoặc lời khuyên điều trị cá nhân.',
   'Mọi câu tạo ra vẫn là bản nháp cần người quản lý Học tập đối chiếu.'
  ].join(' '),prompt:`SUBJECT_FOLDER=${clean(file.parentName||'',160)}\nFILE=${clean(file.name,240)}\nSOURCE_CHUNK:\n${source}`});
  const parsed=JSON.parse(output.text),rows=Array.isArray(parsed?.questions)?parsed.questions:[],model=output.model||geminiAiModel('research'),subject=clean(file.parentName||parsed?.subject||file.name,160)||'Chưa phân loại';
  const questions=rows.flatMap(q=>{
   const stem=clean(q?.stem,4000),options=Array.isArray(q?.options)?q.options.map(x=>clean(x,1500)):[],correctIndex=Number(q?.correctIndex),explanation=clean(q?.explanation,4000),evidence=clean(q?.evidenceText,1200),topic=clean(q?.topic,180)||'Tổng hợp';
   if(stem.length<4||options.length!==4||options.some(x=>!x)||new Set(options.map(x=>x.toLowerCase())).size!==4||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3||!explanation||!evidence||!evidenceSource.includes(evidence.toLowerCase()))return[];
   return[{stem,options,correctIndex,explanation,raw:evidence,answerEvidence:`Dẫn chứng từ tài liệu: ${evidence}`,issues:['Câu do Gemini thiết kế: người quản lý Học tập phải đối chiếu dẫn chứng trước khi nhập.'],aiGenerated:true,generationProvider:'gemini',generationModel:model,topic,subject}];
  });
  return{questions,model};
 }finally{clearTimeout(timer)}
}

function readUploadedTextFile(name,base64){
 if(!/\.txt$/i.test(name))throw new Error('Định dạng tải lên chưa được hỗ trợ.');
 if(typeof base64!=='string'||base64.length>2_800_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error('Tệp TXT không hợp lệ hoặc lớn hơn 2 MB.');
 const buffer=Buffer.from(base64,'base64');if(!buffer.length||buffer.length>MAX_UPLOAD_BYTES)throw new Error('Tệp TXT phải nhỏ hơn 2 MB.');
 let text='';try{text=new TextDecoder('utf-8',{fatal:true}).decode(buffer)}catch{throw new Error('TXT phải dùng mã hóa UTF-8 hợp lệ.');}
 text=text.replace(/\r\n?/g,'\n').replace(/\u0000/g,'').trim();
 if(!text)throw new Error('Tệp TXT không có nội dung văn bản.');
 if(text.length>MAX_SOURCE_TEXT)throw new Error('Tài liệu vượt 400.000 ký tự, hãy chia nhỏ.');
 const sourceHash=shaBuffer(buffer);return{file:{id:`upload-${sourceHash}`,name:clean(name,300),mimeType:'text/plain'},text,sourceHash,warnings:[]};
}

async function resolveSource(body){
 const fileName=String(body.fileName||'');
 const source=body.fileId?await readSelectedQuizFile(body.fileId):/\.txt$/i.test(fileName)?readUploadedTextFile(fileName,body.base64):await readUploadedQuizFile(fileName,body.base64);
 if(body.subjectFolderId){
  const folder=await scopedQuizItem(body.subjectFolderId);if(folder.mimeType!=='application/vnd.google-apps.folder')throw new Error('Chủ đề phải là thư mục kiến thức');
  source.file.parentName=folder.name;source.file.subjectFolderId=folder.id;
 }else if(!body.fileId&&clean(body.subjectName,160))source.file.parentName=clean(body.subjectName,160);
 if(!source.file.parentName)throw new Error('Hãy chọn thư mục kiến thức hoặc nhập tên chủ đề trước khi tải tài liệu.');
 return source;
}

const pipelineId=(source,mode)=>sha(`pipeline-v2|${source.file.id}|${source.sourceHash}|${source.file.parentName}|${mode}`);
const withoutRuntime=draft=>{const {id,revision,...payload}=draft;return payload};
const questionKey=q=>sha(`${clean(q?.stem,4000)}|${(Array.isArray(q?.options)?q.options:[]).map(x=>clean(x,1500)).join('|')}|${Number(q?.correctIndex)}`);
function mergeGenerated(existing,incoming,draftId,chunkIndex){
 const merged=[...existing],seen=new Set(existing.map(questionKey));
 for(const row of incoming){
  const key=questionKey(row);if(seen.has(key)||merged.length>=1000)continue;seen.add(key);
  merged.push({...row,id:sha(`${draftId}|${chunkIndex}|${key}`).slice(0,24),number:String(merged.length+1)});
 }
 return merged;
}
function counts(questions){return{total:questions.length,ready:questions.filter(q=>!q.issues?.length).length,needsReview:questions.filter(q=>q.issues?.length).length};}
function withDocument(draft,state,message){
 const syncStatus=state==='processing'?'needs_ai_conversion':state==='ready'?'ready':state==='error'?'error':'needs_review';
 return{...draft,document:{...draft.document,syncStatus,syncMessage:clean(message,500)}};
}

async function startPipeline(body,rpc){
 const source=await resolveSource(body),conversionMode=MODES.has(body.conversionMode)?body.conversionMode:'auto';
 const parsed=parseMcqDocument(source.text);if(parsed.questions.length>1000)throw new Error('Tài liệu có hơn 1.000 câu; hãy chia nhỏ.');
 const generate=conversionMode==='generate'||(conversionMode==='auto'&&parsed.questions.length===0);
 const chunks=generate?planQuizChunks(source.text):[];
 if(generate&&!chunks.length)throw new Error('Tài liệu quá ngắn để tạo câu hỏi có căn cứ.');
 const id=pipelineId(source,conversionMode),now=new Date().toISOString();
 const questions=generate?[]:parsed.questions;
 const state=generate?'processing':parsed.needsReview?'needs_review':'ready';
 const message=generate?`Đã lập kế hoạch ${chunks.length} phần; chưa tự động nhập câu hỏi.`:`Đã nhận diện ${parsed.total} câu; ${parsed.needsReview} câu cần kiểm tra.`;
 const document=driveQuizMeta(source.file,source.sourceHash,source.file.parentName,state==='processing'?'needs_ai_conversion':state,message);
 const pipeline={version:2,state,strategy:generate?'generate_chunks':'extract',totalChunks:chunks.length,completedChunks:generate?0:chunks.length,nextChunk:0,failedChunk:null,attempt:1,percent:generate?0:100,retryable:generate,sourceChars:String(source.text||'').length,chunkSize:CHUNK_CHARS,startedAt:now,updatedAt:now,lastError:null};
 const payload={...parsed,questions,...counts(questions),sourceText:String(source.text||''),file:source.file,document,conversionMode,extractionWarnings:source.warnings||[],pipeline,parser:generate?'gemini-batched-v2':parsed.parser};
 return rpc('save',id,payload);
}

async function processChunk(body,rpc,res){
 const id=clean(body.id,240);if(!id)throw new Error('Thiếu mã bản nháp.');
 const draft=await rpc('get',id),pipeline=draft.pipeline||{};
 if(Number(body.revision)!==Number(draft.revision))return res.status(409).json({error:'Bản nháp đã thay đổi. Hãy tải lại tiến độ.',draft});
 if(pipeline.state!=='processing')return res.json(draft);
 const chunks=planQuizChunks(draft.sourceText),index=Number.isInteger(pipeline.failedChunk)?pipeline.failedChunk:Number(pipeline.nextChunk||0);
 if(index<0||index>=chunks.length)throw new Error('Tiến độ chunk không hợp lệ; hãy tải lại bản nháp.');
 try{
  const generated=await designChunkWithGemini(chunks[index].text,draft.file),questions=mergeGenerated(draft.questions||[],generated.questions,id,index),completed=Math.max(Number(pipeline.completedChunks||0),index+1),nextIndex=index+1,done=nextIndex>=chunks.length,now=new Date().toISOString();
  let state=done?'needs_review':'processing',lastError=null,retryable=true;
  if(done&&!questions.length){state='error';lastError='Gemini đã xử lý toàn bộ tài liệu nhưng chưa tạo được câu hỏi có đủ dẫn chứng.';retryable=true;}
  const percent=Math.min(100,Math.round((completed/chunks.length)*100));
  const nextPipeline={...pipeline,state,totalChunks:chunks.length,completedChunks:completed,nextChunk:done?chunks.length:nextIndex,failedChunk:null,percent,retryable,updatedAt:now,completedAt:done&&questions.length?now:null,lastError};
  const summary=state==='processing'?`Đã xử lý ${completed}/${chunks.length} phần.`:state==='needs_review'?`Đã xử lý đủ ${chunks.length} phần, tạo ${questions.length} câu cần đối chiếu.`:lastError;
  let next={...withoutRuntime(draft),questions,...counts(questions),pipeline:nextPipeline,warnings:[...(draft.warnings||[])]};
  if(done&&questions.length&&!next.warnings.some(x=>String(x).includes('pipeline chia phần')))next.warnings.push(`Gemini ${generated.model} đã xử lý tài liệu theo pipeline chia phần. Tất cả câu AI phải được người quản lý Học tập đối chiếu trước khi nhập.`);
  next=withDocument(next,state,summary);
  return res.json(await rpc('replace',id,{revision:draft.revision,draft:next}));
 }catch(error){
  const message=clean(error?.message||'Không xử lý được phần tài liệu.',400),now=new Date().toISOString();
  const failed=withDocument({...withoutRuntime(draft),pipeline:{...pipeline,state:'error',failedChunk:index,retryable:true,lastError:message,updatedAt:now}},'error',`Dừng ở phần ${index+1}/${chunks.length}: ${message}`);
  let saved=draft;try{saved=await rpc('replace',id,{revision:draft.revision,draft:failed})}catch{}
  return res.status(502).json({error:message,draft:saved});
 }
}

async function retryPipeline(body,rpc){
 const id=clean(body.id,240);if(!id)throw new Error('Thiếu mã bản nháp.');
 const draft=await rpc('get',id),pipeline=draft.pipeline||{};
 if(Number(body.revision)!==Number(draft.revision))throw new Error('Draft changed. Reload before updating.');
 if(pipeline.state!=='error'||pipeline.retryable===false)return draft;
 const restartAll=!Number.isInteger(pipeline.failedChunk),now=new Date().toISOString();
 const questions=restartAll?[]:(draft.questions||[]),completed=restartAll?0:Number(pipeline.completedChunks||0),total=Math.max(1,Number(pipeline.totalChunks||1));
 const next={...withoutRuntime(draft),questions,...counts(questions),pipeline:{...pipeline,state:'processing',attempt:Number(pipeline.attempt||1)+1,completedChunks:completed,nextChunk:restartAll?0:Number(pipeline.failedChunk),failedChunk:null,percent:Math.min(99,Math.round((completed/total)*100)),lastError:null,updatedAt:now,completedAt:null}};
 return rpc('replace',id,{revision:draft.revision,draft:withDocument(next,'processing',`Đang thử lại pipeline, lần ${Number(pipeline.attempt||1)+1}.`)});
}

export async function handleQuizPipelineV2(req,res){
 const access=await learningContentAccess(req);if(!access.ok)return res.status(access.status).json({error:access.error});
 const body=req.body||{},action=String(body.action||''),rpc=(type,key='',payload={})=>memberRpc(req,'practice_import_workspace_v2',{p_action:type,p_key:key,p_payload:payload});
 try{
  if(action==='quiz-start')return res.json(await startPipeline(body,rpc));
  if(action==='quiz-process-chunk')return processChunk(body,rpc,res);
  if(action==='quiz-retry')return res.json(await retryPipeline(body,rpc));
  return res.status(400).json({error:'Thao tác pipeline không hợp lệ'});
 }catch(error){const message=String(error?.message||'Không xử lý được pipeline').slice(0,500);console.warn('quiz-pipeline-v2',message);return res.status(message.includes('Draft changed')?409:400).json({error:message});}
}
