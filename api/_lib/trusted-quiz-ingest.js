import {createHash,createSign} from 'node:crypto';
import {learningContentAccess,memberRpc} from './member-access.js';
import {parseTrustedMarkedDocx} from './docx-marked-quiz.js';

const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FOLDER_MIME='application/vnd.google-apps.folder';
const DEFAULT_QUIZ_BANK_FOLDER='1_VvupTkvHvWKLLehVQt_JNA15qfKnIvO';
const BANK_FOLDER_NAME='NGÂN HÀNG TRẮC NGHIỆM';
const MANUAL_INTAKE_FOLDER='Thêm thủ công';
const MEMBER_SUBJECT='Ngân hàng HIU';
const PARSER_REVISION='red-layout-v2';
const MAX_DRIVE_BYTES=5_000_000,HTTP_MS=9000;
const clean=(value,max=1000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const sha256=value=>createHash('sha256').update(value).digest('hex');
const quizBankFolderId=()=>String(process.env.YHCT_DRIVE_QUIZ_BANK_FOLDER_ID||DEFAULT_QUIZ_BANK_FOLDER).trim();
const apiKey=()=>String(process.env.GOOGLE_DRIVE_API_KEY||'').trim();
const normalizedName=value=>clean(value,180).normalize('NFC').toLocaleLowerCase('vi-VN');
const sameTime=(left,right)=>{const a=Date.parse(String(left||'')),b=Date.parse(String(right||''));return Number.isFinite(a)&&Number.isFinite(b)&&a===b};
let tokenCache={token:'',expiresAt:0};

function serviceAccount(){
  const raw=String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON||'').trim();if(!raw)return null;
  try{const value=JSON.parse(raw),email=clean(value?.client_email,320),key=String(value?.private_key||'').replace(/\\n/g,'\n');return email&&key?{email,key}:null}catch{return null}
}
const b64url=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
async function serviceToken(){
  const cfg=serviceAccount();if(!cfg)return'';const now=Math.floor(Date.now()/1000);if(tokenCache.token&&tokenCache.expiresAt>now+60)return tokenCache.token;
  const header=b64url({alg:'RS256',typ:'JWT'}),claims=b64url({iss:cfg.email,scope:'https://www.googleapis.com/auth/drive.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3300}),unsigned=`${header}.${claims}`,signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${signer.sign(cfg.key,'base64url')}`})});if(!response.ok)throw new Error(`Google OAuth ${response.status}`);const payload=await response.json(),token=String(payload?.access_token||'');if(!token)throw new Error('Google OAuth returned no access token');tokenCache={token,expiresAt:now+Math.min(3200,Number(payload?.expires_in||3300))};return token;
}
async function driveFetch(url,init={},ms=HTTP_MS){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{const target=new URL(String(url)),headers=new Headers(init.headers||{}),token=await serviceToken();if(token)headers.set('authorization',`Bearer ${token}`);else{const key=apiKey();if(!key)throw new Error('Google Drive credential missing');target.searchParams.set('key',key)}headers.set('user-agent','HIU-YHCT-Quiz-Bank/2.2');return await fetch(target,{...init,headers,signal:controller.signal})}finally{clearTimeout(timer)}
}
const driveConfigured=()=>Boolean(serviceAccount()||apiKey());
const isDocx=file=>String(file?.mimeType||'')===DOCX_MIME||/\.docx$/i.test(String(file?.name||''));

async function listChildren(parent,pageSize=1000){
  const url=new URL('https://www.googleapis.com/drive/v3/files');url.searchParams.set('q',`'${parent}' in parents and trashed=false`);url.searchParams.set('fields','files(id,name,mimeType,createdTime,modifiedTime,size,parents)');url.searchParams.set('pageSize',String(Math.max(1,Math.min(1000,pageSize))));url.searchParams.set('orderBy','createdTime desc');url.searchParams.set('supportsAllDrives','true');url.searchParams.set('includeItemsFromAllDrives','true');
  const response=await driveFetch(url,{headers:{accept:'application/json'}});if(!response.ok)throw new Error(`Google Drive list ${response.status}`);const payload=await response.json();return Array.isArray(payload?.files)?payload.files:[];
}

async function listNewIntakeCandidates(){
  const rootId=quizBankFolderId();if(!driveConfigured())return{configured:false,folder:rootId,files:[],subjects:[],reason:'missing_google_drive_credential'};
  const root=await listChildren(rootId,1000),manual=root.find(x=>x.mimeType===FOLDER_MIME&&normalizedName(x.name)===normalizedName(MANUAL_INTAKE_FOLDER));
  if(!manual)throw new Error(`Không tìm thấy thư mục ${MANUAL_INTAKE_FOLDER} trong ${BANK_FOLDER_NAME}.`);
  const rows=await listChildren(manual.id,1000);
  const directFiles=rows.filter(isDocx).map(file=>({...file,parentName:MEMBER_SUBJECT,parentFolderId:manual.id}));
  const subjectFolders=rows.filter(row=>row?.mimeType===FOLDER_MIME&&clean(row?.name,160));
  const nestedGroups=await Promise.all(subjectFolders.map(async folder=>{
    const subject=clean(folder.name,160)||MEMBER_SUBJECT,children=await listChildren(folder.id,1000);
    return children.filter(isDocx).map(file=>({...file,parentName:subject,parentFolderId:folder.id}));
  }));
  const nestedFiles=nestedGroups.flat(),files=[...directFiles,...nestedFiles].sort((a,b)=>String(b.createdTime||'').localeCompare(String(a.createdTime||'')));
  const subjects=[...new Set(subjectFolders.map(folder=>clean(folder.name,160)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
  return{configured:true,folder:rootId,intakeFolderId:manual.id,subjects,files:files.slice(0,1000)};
}

async function downloadDocx(file){
  const url=new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);url.searchParams.set('alt','media');const response=await driveFetch(url,{},12000);if(!response.ok)throw new Error(`Google Drive download ${response.status}`);const len=Number(response.headers.get('content-length')||file.size||0);if(len>MAX_DRIVE_BYTES)throw new Error('DOCX vượt 5 MB');const buffer=Buffer.from(await response.arrayBuffer());if(!buffer.length||buffer.length>MAX_DRIVE_BYTES)throw new Error('DOCX không hợp lệ hoặc vượt 5 MB');return buffer;
}

const sourceSubject=file=>clean(file?.parentName,160)||MEMBER_SUBJECT;
const versionedMessage=message=>`${PARSER_REVISION} · ${clean(message,450)}`;
const documentMeta=(file,sourceHash,questionCount,syncStatus='ready',syncMessage='')=>({driveFileId:String(file.id),fileName:clean(file.name,300),mimeType:DOCX_MIME,modifiedTime:file.modifiedTime||null,sourceHash,subjectHint:sourceSubject(file),syncStatus,syncMessage:versionedMessage(syncMessage||`Đã nhận ${questionCount} câu có đúng một đáp án tô đỏ từ nguồn DOCX.`)});

async function registerSeenInvalid(req,file,sourceHash,parsed){
  const message=parsed.valid>0?`Đã đưa ${parsed.valid} câu đạt chuẩn vào ngân hàng; bỏ qua ${parsed.invalid.length} câu chưa đạt cấu trúc 4 lựa chọn/đáp án tô đỏ.`:'Không có câu đạt chuẩn: mỗi câu phải có đúng 4 lựa chọn và đúng một đáp án tô đỏ.';
  await memberRpc(req,'practice_source_pending_admin_v1',{p_document:documentMeta(file,sourceHash,parsed.valid,'needs_review',message)});
  return message;
}

async function importRedAnswerDocx(req,file,buffer){
  const subject=sourceSubject(file),sourceHash=sha256(buffer),sourceFile={...file,parentName:subject},parsed=parseTrustedMarkedDocx(buffer,sourceFile,sourceHash);
  if(!parsed.questions.length){const message=await registerSeenInvalid(req,file,sourceHash,parsed);return{ok:false,status:'invalid_red_answer_format',subject,total:parsed.total,valid:0,invalid:parsed.invalid.length,message}}
  const result=await memberRpc(req,'practice_trusted_quiz_ingest_v1',{p_document:documentMeta(file,sourceHash,parsed.valid,parsed.invalid.length?'needs_review':'ready',parsed.invalid.length?`${parsed.valid} câu đạt chuẩn; ${parsed.invalid.length} câu bị bỏ qua.`:''),p_questions:parsed.questions});
  let message='';if(parsed.invalid.length)message=await registerSeenInvalid(req,file,sourceHash,parsed);
  return{ok:true,status:parsed.invalid.length?'imported_partial':'imported',subject,total:parsed.total,valid:parsed.valid,invalid:parsed.invalid.length,inserted:Number(result?.inserted||0),updated:Number(result?.updated||0),marker:'word-font-color-red-v1',parserRevision:PARSER_REVISION,message};
}

function needsProcessing(file,state){
  if(!state)return true;
  if(!sameTime(state.modifiedTime,file.modifiedTime))return true;
  if(clean(state.subjectHint,160)!==sourceSubject(file))return true;
  if(String(state.syncStatus||'')!=='ready'&&!String(state.syncMessage||'').includes(PARSER_REVISION))return true;
  return false;
}

export async function handleTrustedQuizIngest(req,res){
  const access=await learningContentAccess(req);if(!access.ok)return res.status(access.status).json({error:access.error});
  const action=String(req.body?.action||'');
  try{
    if(action!=='trusted-quiz-sync')return res.status(400).json({error:'Ngân hàng đề thi chỉ nhận nguồn từ thư mục Thêm thủ công qua nút Cập nhật.'});
    const listing=await listNewIntakeCandidates();
    if(!listing.configured)return res.status(200).json({ok:false,degraded:true,reason:listing.reason,processed:[]});
    const ids=listing.files.map(file=>String(file.id)),known=ids.length?await memberRpc(req,'practice_source_sync_state_v1',{p_file_ids:ids}):[],knownById=new Map((Array.isArray(known)?known:[]).map(row=>[String(row?.fileId||''),row]));
    const pending=listing.files.filter(file=>needsProcessing(file,knownById.get(String(file.id)))),maxFiles=Math.max(1,Math.min(10,Number(req.body?.maxFiles)||10)),selected=pending.slice(0,maxFiles).reverse(),processed=[];
    for(const file of selected){try{processed.push(await importRedAnswerDocx(req,file,await downloadDocx(file)))}catch(error){processed.push({ok:false,status:'error',subject:sourceSubject(file),message:clean(error?.message||'Không xử lý được DOCX',300)})}}
    const remaining=Math.max(0,pending.length-selected.length),errors=processed.filter(x=>x.status==='error').length;
    return res.status(200).json({ok:true,intake:MANUAL_INTAKE_FOLDER,parserRevision:PARSER_REVISION,subjects:listing.subjects,filesSeen:listing.files.length,alreadySynced:listing.files.length-pending.length,pending:pending.length,remaining,errors,processed});
  }catch(error){return res.status(400).json({error:clean(error?.message||'Quiz bank update failed',400)})}
}
