import {createHash} from 'node:crypto';
import {memberAccess,memberRpc} from './member-access.js';
import {browseQuizFolder,quizRoots,scopedQuizItem,readSelectedQuizFile,readUploadedQuizFile,driveQuizMeta,driveCredentialMode} from './drive-quiz.js';
import {parseMcqDocument,normalizeImportQuestion} from './mcq-parser.js';
import {createGeminiJson,geminiAiConfigured,geminiAiModel} from './gemini-provider.js';

const clean=(value,max=4000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const sha=value=>createHash('sha256').update(String(value||'')).digest('hex');
const MODES=new Set(['auto','generate','extract']);
const QUIZ_SCHEMA={
 type:'object',
 properties:{
  subject:{type:'string'},
  questions:{type:'array',maxItems:12,items:{type:'object',properties:{topic:{type:'string'},stem:{type:'string'},options:{type:'array',minItems:4,maxItems:4,items:{type:'string'}},correctIndex:{type:'integer',minimum:0,maximum:3},explanation:{type:'string'},evidenceText:{type:'string'}},required:['topic','stem','options','correctIndex','explanation','evidenceText'],additionalProperties:false}}
 },
 required:['subject','questions'],additionalProperties:false
};

async function designQuizWithGemini(text,file){
 if(!geminiAiConfigured('research'))throw new Error('Gemini Research chưa được cấu hình để chuyển tài liệu thành trắc nghiệm.');
 const source=String(text||'').slice(0,18000);if(source.trim().length<120)throw new Error('Tài liệu quá ngắn để Gemini thiết kế câu hỏi có căn cứ.');
 const sourceEvidence=clean(source,18000).toLowerCase();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
 try{
  const output=await createGeminiJson({
   mode:'research',signal:controller.signal,maxOutputTokens:4200,schema:QUIZ_SCHEMA,
   systemInstruction:[
    'Bạn là Gemini Quiz Designer của HIU YHCT 4.0.',
    'Chỉ được dùng thông tin nằm trong SOURCE; tuyệt đối không bổ sung kiến thức ngoài tài liệu.',
    'Thiết kế tối đa 12 câu trắc nghiệm phục vụ ôn tập. Mỗi câu có đúng 4 lựa chọn A-D, đúng duy nhất 1 đáp án và các phương án nhiễu phải hợp lý nhưng không được tạo dữ kiện mới.',
    'evidenceText phải là một đoạn ngắn có trong SOURCE đủ chứng minh đáp án đúng. Nếu nguồn không đủ căn cứ thì không tạo câu đó.',
    'Không tạo chẩn đoán, kê đơn hoặc lời khuyên điều trị cá nhân. Không suy đoán đáp án.',
    'Kết quả luôn là bản nháp cần admin đối chiếu trước khi nhập ngân hàng.'
   ].join(' '),
   prompt:`SUBJECT_FOLDER=${clean(file.parentName||'',160)}\nFILE=${clean(file.name,240)}\nSOURCE:\n${source}`
  });
  const parsed=JSON.parse(output.text),raw=Array.isArray(parsed?.questions)?parsed.questions:[],model=output.model||geminiAiModel('research'),subject=clean(file.parentName||parsed?.subject||file.name,160)||'Chưa phân loại';
  const questions=raw.flatMap((q,index)=>{
   const stem=clean(q?.stem,4000),options=Array.isArray(q?.options)?q.options.map(x=>clean(x,1500)):[],correctIndex=Number(q?.correctIndex),explanation=clean(q?.explanation,4000),evidence=clean(q?.evidenceText,1200),topic=clean(q?.topic,180)||'Tổng hợp';
   if(stem.length<4||options.length!==4||options.some(x=>!x)||new Set(options.map(x=>x.toLowerCase())).size!==4||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3||!explanation||!evidence||!sourceEvidence.includes(evidence.toLowerCase()))return[];
   const basis=`${stem}|${options.join('|')}|${correctIndex}`;
   return[{id:sha(`${index}|${basis}`).slice(0,24),number:String(index+1),stem,options,correctIndex,explanation,issues:['Câu do Gemini thiết kế: admin phải đối chiếu dẫn chứng trước khi nhập.'],raw:evidence,answerEvidence:`Dẫn chứng từ tài liệu: ${evidence}`,aiGenerated:true,generationProvider:'gemini',generationModel:model,topic,subject}];
  });
  if(!questions.length)throw new Error('Gemini không tạo được câu hỏi nào có đủ dẫn chứng nguyên văn từ tài liệu.');
  return{questions,total:questions.length,ready:0,needsReview:questions.length,warnings:[`Gemini ${model} đã thiết kế ${questions.length} câu từ nội dung nguồn. Tất cả câu AI đều cần admin đối chiếu trước khi nhập.`],unassigned:[],sourceText:String(text||''),parser:'gemini-quiz-designer-v1',aiDesigner:{provider:'gemini',model}};
 }finally{clearTimeout(timer)}
}

const REPAIR_SCHEMA={type:'object',properties:{questions:{type:'array',maxItems:12,items:{type:'object',properties:{id:{type:'string'},correctIndex:{type:'integer',minimum:0,maximum:3},explanation:{type:'string'},evidenceText:{type:'string'}},required:['id','correctIndex','explanation','evidenceText'],additionalProperties:false}}},required:['questions'],additionalProperties:false};
async function repairQuizWithGemini(parsed,text,file){
 const candidates=(Array.isArray(parsed?.questions)?parsed.questions:[]).filter(q=>q?.correctIndex===null&&Array.isArray(q?.options)&&q.options.length===4&&q.options.every(Boolean)&&new Set(q.options.map(x=>String(x).toLowerCase())).size===4&&Array.isArray(q?.issues)&&q.issues.length===1&&q.issues[0]==='Chưa xác định đáp án').slice(0,12);
 if(!candidates.length||!geminiAiConfigured('research'))return parsed;
 const source=String(text||'').slice(0,18000),sourceEvidence=clean(source,18000).toLowerCase();if(source.trim().length<120)return parsed;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
 try{
  const output=await createGeminiJson({mode:'research',signal:controller.signal,maxOutputTokens:3200,schema:REPAIR_SCHEMA,systemInstruction:'Bạn là Gemini Quiz Designer. Chỉ dùng SOURCE. Với mỗi CANDIDATE, chỉ trả lời khi SOURCE có bằng chứng trực tiếp đủ xác định đúng duy nhất một đáp án A-D. Không đổi câu hỏi hoặc lựa chọn. evidenceText phải là đoạn nguyên văn có trong SOURCE. Nếu không đủ căn cứ thì bỏ candidate đó. Đây chỉ là bản nháp, admin vẫn phải đối chiếu.',prompt:`FILE=${clean(file.name,240)}\nCANDIDATES=${JSON.stringify(candidates.map(q=>({id:q.id,stem:q.stem,options:q.options})))}\nSOURCE:\n${source}`});
  const parsedRepair=JSON.parse(output.text),rows=Array.isArray(parsedRepair?.questions)?parsedRepair.questions:[],model=output.model||geminiAiModel('research'),byId=new Map();
  for(const row of rows){const id=clean(row?.id,80),correctIndex=Number(row?.correctIndex),explanation=clean(row?.explanation,4000),evidence=clean(row?.evidenceText,1200);if(!id||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3||!explanation||!evidence||!sourceEvidence.includes(evidence.toLowerCase()))continue;if(candidates.some(q=>q.id===id))byId.set(id,{correctIndex,explanation,evidence});}
  if(!byId.size)return parsed;
  const questions=parsed.questions.map(q=>{const fixed=byId.get(q.id);if(!fixed)return q;return{...q,correctIndex:fixed.correctIndex,explanation:fixed.explanation,answerEvidence:`Dẫn chứng từ tài liệu: ${fixed.evidence}`,raw:fixed.evidence,issues:['Câu có đáp án do Gemini suy ra từ SOURCE: admin phải đối chiếu dẫn chứng trước khi nhập.'],aiGenerated:true,generationProvider:'gemini',generationModel:model,topic:'Từ tài liệu gốc',subject:clean(file.parentName||file.name,160)||'Chưa phân loại'};});
  return{...parsed,questions,total:questions.length,ready:questions.filter(q=>!q.issues.length).length,needsReview:questions.filter(q=>q.issues.length).length,warnings:[...(parsed.warnings||[]),`Gemini ${model} đã bổ sung đáp án có dẫn chứng cho ${byId.size} câu chưa có đáp án. Admin vẫn phải đối chiếu trước khi cập nhật ngân hàng.`],parser:'gemini-answer-repair-v1',aiDesigner:{provider:'gemini',model}};
 }catch{return{...parsed,warnings:[...(parsed.warnings||[]),'Gemini chưa sửa được câu thiếu đáp án; giữ nguyên bản nháp để admin kiểm tra.']}}finally{clearTimeout(timer)}
}

function normalizeGeneratedQuestion(q,file){
 const stem=clean(q?.stem,4000),options=Array.isArray(q?.options)?q.options.map(x=>clean(x,1500)):[],correctIndex=Number(q?.correctIndex),evidence=clean(q?.raw||q?.answerEvidence,1400);
 if(stem.length<4||options.length!==4||options.some(x=>!x)||new Set(options.map(x=>x.toLowerCase())).size!==4||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3||!evidence)throw new Error('Câu Gemini chưa đủ nội dung, đáp án hoặc dẫn chứng để nhập.');
 const basis=`${stem}|${options.join('|')}|${correctIndex}`,digest=sha(basis),subject=clean(file.parentName||file.name,160)||'Chưa phân loại';
 return{externalKey:`drive:${file.id}:gemini:${digest.slice(0,24)}`,contentHash:digest,subject,topic:clean(q.topic,180)||'Từ tài liệu gốc',stem,options,correctIndex,explanation:clean(q.explanation,4000)||`Đáp án ${String.fromCharCode(65+correctIndex)} đã được admin đối chiếu với dẫn chứng trong tài liệu.`,generationMethod:'ai_generated',reviewStatus:'expert_approved',provenance:{driveFileId:file.id,fileName:file.name,subjectFolder:file.parentName||null,evidenceText:evidence,generator:`${clean(q.generationProvider,40)||'gemini'}:${clean(q.generationModel,100)||geminiAiModel('research')}`,adminConfirmed:true}};
}

export async function handleQuizWorkspace(req,res){
 const access=await memberAccess(req,'admin');if(!access.ok)return res.status(access.status).json({error:access.error});
 const body=req.body||{},action=String(body.action||'');
 const rpc=(type,key='',payload={})=>memberRpc(req,'practice_import_workspace_v2',{p_action:type,p_key:key,p_payload:payload});
 try{
  if(action==='quiz-roots'){const credentialMode=driveCredentialMode();return res.json({roots:quizRoots(),driveConfigured:credentialMode!=='none',credentialMode});}
  if(action==='quiz-browse')return res.json(await browseQuizFolder(body.folderId,body.pageToken));
  if(action==='quiz-drafts')return res.json({drafts:await rpc('list')});
  if(action==='quiz-draft')return res.json(await rpc('get',body.id));
  if(action==='quiz-preview'){
   const source=body.fileId?await readSelectedQuizFile(body.fileId):await readUploadedQuizFile(String(body.fileName||''),body.base64);
   if(body.subjectFolderId){const folder=await scopedQuizItem(body.subjectFolderId);if(folder.mimeType!=='application/vnd.google-apps.folder')throw new Error('Chủ đề phải là thư mục kiến thức');source.file.parentName=folder.name;source.file.subjectFolderId=folder.id;}
   else if(!body.fileId&&clean(body.subjectName,160))source.file.parentName=clean(body.subjectName,160);
   if(!source.file.parentName)throw new Error('Hãy chọn thư mục kiến thức hoặc nhập tên chủ đề trước khi tải Word.');
   const conversionMode=MODES.has(body.conversionMode)?body.conversionMode:'auto';
   let parsed=parseMcqDocument(source.text);if(parsed.questions.length>1000)throw new Error('Tài liệu có hơn 1.000 câu; hãy chia nhỏ.');
   if(conversionMode==='generate')parsed=await designQuizWithGemini(source.text,source.file);
   else if(conversionMode==='auto'){parsed=await repairQuizWithGemini(parsed,source.text,source.file);if(parsed.ready===0&&!parsed.questions.some(q=>q.aiGenerated))parsed=await designQuizWithGemini(source.text,source.file);}
   if(conversionMode==='extract'&&!parsed.questions.length)parsed={...parsed,warnings:[...parsed.warnings,'Chế độ chỉ trích xuất: tài liệu chưa có cấu trúc trắc nghiệm A–D, nên chưa tạo câu AI.']};
   const generated=parsed.parser==='gemini-quiz-designer-v1',id=createHash('sha256').update(`${source.file.id}|${source.sourceHash}|${source.file.parentName}|${conversionMode}`).digest('hex');
   const status=generated||parsed.needsReview?'needs_review':'ready',message=generated?`${parsed.total} câu do Gemini thiết kế; bắt buộc admin đối chiếu dẫn chứng.`:`${parsed.total} câu nhận diện; ${parsed.needsReview} câu cần kiểm tra.`;
   const document=driveQuizMeta(source.file,source.sourceHash,source.file.parentName,status,message);
   return res.json(await rpc('save',id,{...parsed,file:source.file,document,conversionMode,extractionWarnings:source.warnings||[]}));
  }
  if(action==='quiz-commit'){
   const draft=await rpc('get',body.id);if(draft.revision!==body.revision)return res.status(409).json({error:'Bản nháp đã thay đổi. Hãy mở lại.'});
   if(!Array.isArray(body.selection)||!body.selection.length||body.selection.length>200)throw new Error('Chọn từ 1 đến 200 câu mỗi lần nhập.');
   const ids=new Set(),questions=[];
   for(const entry of body.selection){
    const original=draft.questions.find(q=>q.id===entry.id&&!q.imported);if(!original||ids.has(entry.id))throw new Error('Câu bị trùng, đã nhập hoặc không tồn tại.');ids.add(entry.id);
    if(entry.confirmed!==true)throw new Error('Admin phải xác nhận câu hỏi trước khi nhập.');
    const question={...original,stem:entry.stem??original.stem,options:entry.options??original.options,correctIndex:entry.correctIndex===undefined?original.correctIndex:entry.correctIndex,explanation:entry.explanation??original.explanation};
    questions.push(question.aiGenerated?normalizeGeneratedQuestion(question,draft.file):normalizeImportQuestion(question,draft.file,true));
   }
   const result=await rpc('commit',body.id,{revision:body.revision,ids:[...ids],questions});return res.json(result);
  }
  return res.status(400).json({error:'Thao tác nhập liệu không hợp lệ'});
 }catch(error){console.warn('quiz-workspace',String(error?.message||error).slice(0,300));return res.status(400).json({error:String(error?.message||'Không xử lý được tài liệu').slice(0,500)})}
}
