import mammoth from 'mammoth';
import {createHash,createSign} from 'node:crypto';
import {cloudAiEnabled,cloudAiModel} from './member-access.js';

export const DEFAULT_QUIZ_FOLDER_ID='1-515jyKjGXz9bLxYVHcbtS2zJlDeZe5B';
const HTTP_MS=9000,MAX_FILE_BYTES=5_000_000,MAX_SOURCE_TEXT=18000,MAX_FILES_PER_RUN=5,FOLDER_MIME='application/vnd.google-apps.folder',DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const clean=(v,max=1000)=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[ \t]+/g,' ').trim().slice(0,max);
const sha256=value=>createHash('sha256').update(String(value||''),'utf8').digest('hex');
const apiKey=()=>String(process.env.GOOGLE_DRIVE_API_KEY||'').trim();
export const quizFolderId=()=>String(process.env.YHCT_DRIVE_QUIZ_FOLDER_ID||DEFAULT_QUIZ_FOLDER_ID).trim();
const withTimeout=async(url,init={},ms=HTTP_MS)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...init,signal:controller.signal})}finally{clearTimeout(timer)}};
const isDocx=file=>String(file?.mimeType||'')===DOCX_MIME||String(file?.name||'').toLowerCase().endsWith('.docx');
const subjectFromName=name=>clean(String(name||'').replace(/\.docx$/i,'').replace(/^\s*\d+[._ -]*/,'').replace(/[_-]+/g,' '),160)||'Chưa phân loại';
const subjectForFile=file=>subjectFromName(file?.parentName||file?.name);
let serviceTokenCache={token:'',expiresAt:0};

function serviceAccountConfig(){
  const raw=String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'').trim();if(!raw)return null;
  try{const parsed=JSON.parse(raw),clientEmail=clean(parsed?.client_email,320),privateKey=String(parsed?.private_key||'').replace(/\\n/g,'\n');return clientEmail&&privateKey?{clientEmail,privateKey}:null}catch{return null}
}
const b64url=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
async function serviceAccountToken(){
  const cfg=serviceAccountConfig();if(!cfg)return'';const now=Math.floor(Date.now()/1000);if(serviceTokenCache.token&&serviceTokenCache.expiresAt>now+60)return serviceTokenCache.token;
  const header=b64url({alg:'RS256',typ:'JWT'}),claims=b64url({iss:cfg.clientEmail,scope:'https://www.googleapis.com/auth/drive.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3300}),unsigned=`${header}.${claims}`,signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();const assertion=`${unsigned}.${signer.sign(cfg.privateKey,'base64url')}`;
  const response=await withTimeout('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString()},8000);if(!response.ok)throw new Error(`Google OAuth ${response.status}`);const payload=await response.json(),token=String(payload?.access_token||'');if(!token)throw new Error('Google OAuth returned no access token');serviceTokenCache={token,expiresAt:now+Math.min(3200,Number(payload?.expires_in||3300))};return token;
}
async function driveFetch(url,init={},ms=HTTP_MS){
  const target=new URL(String(url)),token=await serviceAccountToken();const headers=new Headers(init.headers||{});headers.set('user-agent','HIU-YHCT-Quiz-Ingest/1.0');if(token)headers.set('authorization',`Bearer ${token}`);else{const key=apiKey();if(!key)throw new Error('Google Drive credential missing');target.searchParams.set('key',key)}return withTimeout(target,{...init,headers},ms);
}
export const driveCredentialMode=()=>serviceAccountConfig()?'service-account':apiKey()?'api-key':'none';

async function listChildren(parent,pageSize=40){
  const url=new URL('https://www.googleapis.com/drive/v3/files');url.searchParams.set('q',`'${parent}' in parents and trashed=false`);url.searchParams.set('fields','files(id,name,mimeType,modifiedTime,size,webViewLink)');url.searchParams.set('pageSize',String(Math.max(1,Math.min(100,pageSize))));url.searchParams.set('orderBy','modifiedTime desc');
  const response=await driveFetch(url,{headers:{accept:'application/json'}});if(!response.ok)throw new Error(`Google Drive list ${response.status}`);const payload=await response.json();return Array.isArray(payload?.files)?payload.files:[];
}

export async function listQuizDocuments(limit=MAX_FILES_PER_RUN){
  const folder=quizFolderId(),take=Math.max(1,Math.min(MAX_FILES_PER_RUN,limit)),credentialMode=driveCredentialMode();if(credentialMode==='none')return{configured:false,folder,files:[],credentialMode,reason:'missing_google_drive_credential'};
  const rootItems=await listChildren(folder,60),files=rootItems.filter(isDocx).map(f=>({...f,parentName:''}));
  const subjectFolders=rootItems.filter(f=>String(f.mimeType||'')===FOLDER_MIME).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'vi'));
  for(const subjectFolder of subjectFolders){if(files.length>=take)break;const nested=await listChildren(subjectFolder.id,20).catch(()=>[]);for(const file of nested.filter(isDocx)){files.push({...file,parentName:subjectFolder.name});if(files.length>=take)break}}
  files.sort((a,b)=>Date.parse(b.modifiedTime||0)-Date.parse(a.modifiedTime||0));
  return{configured:true,folder,credentialMode,files:files.slice(0,take)};
}

export async function readQuizDocument(file){
  const url=new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);url.searchParams.set('alt','media');const response=await driveFetch(url,{},11000);if(!response.ok)throw new Error(`Google Drive download ${response.status}`);
  const len=Number(response.headers.get('content-length')||file.size||0);if(len>MAX_FILE_BYTES)throw new Error('DOCX exceeds 5 MB ingestion limit');const buffer=Buffer.from(await response.arrayBuffer());if(buffer.length>MAX_FILE_BYTES)throw new Error('DOCX exceeds 5 MB ingestion limit');const extracted=await mammoth.extractRawText({buffer});const raw=String(extracted.value||'').replace(/\r\n?/g,'\n').replace(/\u0000/g,'').trim();return{text:raw.slice(0,MAX_SOURCE_TEXT),sourceHash:sha256(buffer),textHash:sha256(raw)};
}

const startQuestion=line=>{const m=line.match(/^\s*(?:câu\s*)?(\d{1,4})\s*[\.)\]:-]\s*(.+)$/i);return m?{n:m[1],stem:clean(m[2],4000)}:null};
const optionLine=line=>{const m=line.match(/^\s*([A-D])\s*[\.)\]:-]\s*(.+)$/i);return m?{letter:m[1].toUpperCase(),text:clean(m[2],1500)}:null};
const answerLine=line=>{const m=line.match(/^\s*(?:đáp\s*án(?:\s*đúng)?|dap\s*an(?:\s*dung)?|answer)\s*[:\-]?\s*([A-D])\b/i);return m?m[1].toUpperCase():''};
const explanationStart=line=>/^\s*(?:giải\s*thích|giai\s*thich|explanation)\s*[:\-]?/i.test(line);
const stripExplanation=line=>clean(line.replace(/^\s*(?:giải\s*thích|giai\s*thich|explanation)\s*[:\-]?\s*/i,''),4000);

export function parseExplicitMcqs(text,file){
  const lines=String(text||'').split('\n').map(x=>x.trim()).filter(Boolean),out=[];let current=null;
  const flush=()=>{if(!current)return;const opts=['A','B','C','D'].map(k=>current.options[k]||'');const correctIndex=['A','B','C','D'].indexOf(current.answer);if(current.stem.length>=4&&opts.every(Boolean)&&correctIndex>=0){const subject=subjectForFile(file),basis=`${current.stem}|${opts.join('|')}|${correctIndex}`;out.push({externalKey:`drive:${file.id}:parsed:${sha256(basis).slice(0,24)}`,contentHash:sha256(basis),subject,topic:'Từ tài liệu gốc',stem:current.stem,options:opts,correctIndex,explanation:current.explanation||`Đáp án ${current.answer} được ghi trực tiếp trong tài liệu nguồn.`,generationMethod:'parsed',reviewStatus:'source_verified',provenance:{driveFileId:file.id,fileName:file.name,subjectFolder:file.parentName||null,questionNumber:current.n,answerEvidence:`Đáp án: ${current.answer}`,parser:'deterministic-v1'}})}current=null};
  for(const line of lines){const q=startQuestion(line);if(q){flush();current={...q,options:{},answer:'',explanation:'',inExplanation:false};continue}if(!current)continue;const o=optionLine(line);if(o){current.options[o.letter]=o.text;current.inExplanation=false;continue}const a=answerLine(line);if(a){current.answer=a;current.inExplanation=false;continue}if(explanationStart(line)){current.explanation=stripExplanation(line);current.inExplanation=true;continue}if(current.inExplanation){current.explanation=clean(`${current.explanation} ${line}`,4000)}else if(Object.keys(current.options).length===0){current.stem=clean(`${current.stem} ${line}`,4000)}}flush();return out;
}

const AI_SCHEMA={type:'object',properties:{subject:{type:'string'},questions:{type:'array',maxItems:12,items:{type:'object',properties:{topic:{type:'string'},stem:{type:'string'},options:{type:'array',minItems:4,maxItems:4,items:{type:'string'}},correctIndex:{type:'integer',minimum:0,maximum:3},explanation:{type:'string'},evidenceText:{type:'string'}},required:['topic','stem','options','correctIndex','explanation','evidenceText'],additionalProperties:false}}},required:['subject','questions'],additionalProperties:false};
const extractOutputText=payload=>{if(typeof payload?.output_text==='string')return payload.output_text;const parts=[];for(const item of Array.isArray(payload?.output)?payload.output:[])for(const c of Array.isArray(item?.content)?item.content:[])if(typeof c?.text==='string')parts.push(c.text);return parts.join('').trim()};

export async function generateMcqsFromStudyText(text,file){
  const key=String(process.env.OPENAI_API_KEY||'').trim(),model=cloudAiModel();if(!cloudAiEnabled()||!key||!model)return{configured:false,questions:[],reason:'cloud_ai_unavailable'};const source=String(text||'').slice(0,MAX_SOURCE_TEXT);if(source.length<120)return{configured:false,questions:[],reason:'source_too_short'};const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:controller.signal,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,store:false,max_output_tokens:4200,reasoning:{effort:'low'},instructions:'Bạn chuyển tài liệu học tập thành câu hỏi trắc nghiệm ôn tập. Chỉ dùng thông tin có trong SOURCE; tuyệt đối không bổ sung kiến thức ngoài nguồn. Mỗi câu có đúng 4 lựa chọn, đúng duy nhất 1 đáp án. evidenceText phải là đoạn ngắn từ SOURCE đủ chứng minh đáp án. Không tạo câu nếu nguồn không đủ căn cứ. Trả JSON đúng schema.',input:`SUBJECT_FOLDER=${clean(file.parentName||'',160)}\nFILE=${clean(file.name,240)}\nSOURCE:\n${source}`,text:{format:{type:'json_schema',name:'drive_quiz_v1',strict:true,schema:AI_SCHEMA}}})});if(!response.ok){const detail=await response.json().catch(()=>null);throw new Error(`OpenAI ${response.status}: ${clean(detail?.error?.code||detail?.error?.message||'provider_error',160)}`)}const payload=await response.json(),parsed=JSON.parse(extractOutputText(payload)),folderSubject=subjectForFile(file),subject=folderSubject!=='Chưa phân loại'?folderSubject:(clean(parsed?.subject,160)||folderSubject),raw=Array.isArray(parsed?.questions)?parsed.questions:[];const questions=raw.flatMap((q,index)=>{const opts=Array.isArray(q?.options)?q.options.map(x=>clean(x,1500)):[];const correctIndex=Number(q?.correctIndex),stem=clean(q?.stem,4000),evidence=clean(q?.evidenceText,1200);if(opts.length!==4||opts.some(x=>!x)||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3||stem.length<4||!evidence)return[];const basis=`${stem}|${opts.join('|')}|${correctIndex}`;return[{externalKey:`drive:${file.id}:ai:${sha256(basis).slice(0,24)}`,contentHash:sha256(basis),subject,topic:clean(q?.topic,180)||'Tổng hợp',stem,options:opts,correctIndex,explanation:clean(q?.explanation,4000),generationMethod:'ai_generated',reviewStatus:'needs_review',provenance:{driveFileId:file.id,fileName:file.name,subjectFolder:file.parentName||null,evidenceText:evidence,generator:'openai-structured-v1',ordinal:index+1}}]});return{configured:true,questions,reason:questions.length?'generated':'no_grounded_questions'}}finally{clearTimeout(timer)}
}

export const driveQuizMeta=(file,sourceHash,subjectHint,syncStatus,syncMessage='')=>({driveFileId:String(file.id),fileName:clean(file.name,300),mimeType:clean(file.mimeType,180),modifiedTime:file.modifiedTime||null,sourceHash,subjectHint:clean(subjectHint||subjectForFile(file),160)||subjectForFile(file),syncStatus,syncMessage:clean(syncMessage,500)});
