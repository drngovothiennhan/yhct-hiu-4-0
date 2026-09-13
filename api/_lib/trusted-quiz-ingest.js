import {createHash,createSign} from 'node:crypto';
import {learningContentAccess,memberRpc} from './member-access.js';
import {parseTrustedMarkedDocx} from './docx-marked-quiz.js';

const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FOLDER_MIME='application/vnd.google-apps.folder';
const DEFAULT_QUIZ_BANK_FOLDER='1_VvupTkvHvWKLLehVQt_JNA15qfKnIvO';
const MANUAL_INTAKE_FOLDER='Thêm thủ công';
const MAX_UPLOAD_BYTES=2_000_000,MAX_DRIVE_BYTES=5_000_000,HTTP_MS=9000;
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
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{const target=new URL(String(url)),headers=new Headers(init.headers||{}),token=await serviceToken();if(token)headers.set('authorization',`Bearer ${token}`);else{const key=apiKey();if(!key)throw new Error('Google Drive credential missing');target.searchParams.set('key',key)}headers.set('user-agent','HIU-YHCT-Trusted-Quiz/1.0');return await fetch(target,{...init,headers,signal:controller.signal})}finally{clearTimeout(timer)}
}
const driveConfigured=()=>Boolean(serviceAccount()||apiKey());
const isDocx=file=>String(file?.mimeType||'')===DOCX_MIME||/\.docx$/i.test(String(file?.name||''));
const subjectFromName=name=>clean(String(name||'').replace(/\.docx$/i,'').replace(/^\s*\d+[._ -]*/,'').replace(/[_-]+/g,' '),160)||'Chưa phân loại';
const subjectForFile=file=>normalizedName(file?.parentName)===normalizedName(MANUAL_INTAKE_FOLDER)?subjectFromName(file?.name):(clean(file?.parentName,160)||subjectFromName(file?.name));

async function listChildren(parent,pageSize=100){
  const url=new URL('https://www.googleapis.com/drive/v3/files');url.searchParams.set('q',`'${parent}' in parents and trashed=false`);url.searchParams.set('fields','files(id,name,mimeType,createdTime,modifiedTime,size,parents)');url.searchParams.set('pageSize',String(Math.max(1,Math.min(100,pageSize))));url.searchParams.set('orderBy','createdTime desc');url.searchParams.set('supportsAllDrives','true');url.searchParams.set('includeItemsFromAllDrives','true');
  const response=await driveFetch(url,{headers:{accept:'application/json'}});if(!response.ok)throw new Error(`Google Drive list ${response.status}`);const payload=await response.json();return Array.isArray(payload?.files)?payload.files:[];
}

async function listQuizBankDocxCandidates(){
  const folder=quizBankFolderId();if(!driveConfigured())return{configured:false,folder,folderName:MANUAL_INTAKE_FOLDER,files:[],subjects:[],reason:'missing_google_drive_credential'};
  const root=await listChildren(folder,100),manual=root.find(x=>x.mimeType===FOLDER_MIME&&normalizedName(x.name)===normalizedName(MANUAL_INTAKE_FOLDER));
  if(!manual)return{configured:true,folder,folderName:MANUAL_INTAKE_FOLDER,files:[],subjects:[],reason:'manual_intake_folder_missing'};
  const rows=await listChildren(manual.id,100),files=rows.filter(isDocx).map(file=>({...file,parentName:MANUAL_INTAKE_FOLDER}));
  const subjectFolders=rows.filter(x=>x.mimeType===FOLDER_MIME).slice(0,40);
  for(const child of subjectFolders){const nested=await listChildren(child.id,100).catch(()=>[]);for(const file of nested.filter(isDocx))files.push({...file,parentName:clean(child.name,160)})}
  const dedup=[...new Map(files.map(file=>[file.id,file])).values()];dedup.sort((a,b)=>Date.parse(b.createdTime||0)-Date.parse(a.createdTime||0));
  return{configured:true,folder,folderName:MANUAL_INTAKE_FOLDER,subjects:subjectFolders.map(x=>clean(x.name,160)).filter(Boolean),files:dedup.slice(0,400)};
}

async function downloadDocx(file){
  const url=new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);url.searchParams.set('alt','media');const response=await driveFetch(url,{},12000);if(!response.ok)throw new Error(`Google Drive download ${response.status}`);const len=Number(response.headers.get('content-length')||file.size||0);if(len>MAX_DRIVE_BYTES)throw new Error('DOCX exceeds 5 MB ingestion limit');const buffer=Buffer.from(await response.arrayBuffer());if(!buffer.length||buffer.length>MAX_DRIVE_BYTES)throw new Error('DOCX exceeds 5 MB ingestion limit');return buffer;
}

const documentMeta=(file,sourceHash,questionCount,subjectHint=subjectForFile(file),syncStatus='ready',syncMessage='')=>({driveFileId:String(file.id),fileName:clean(file.name,300),mimeType:DOCX_MIME,modifiedTime:file.modifiedTime||null,sourceHash,subjectHint,syncStatus,syncMessage:syncMessage||`Trusted DOCX: ${questionCount} câu có đúng một đáp án tô đỏ.`});

async function registerWaiting(req,file,sourceHash,parsed,subjectHint=subjectForFile(file)){
  const message=parsed.valid>0?`Đã nhập ${parsed.valid} câu có đáp án đỏ; còn ${parsed.invalid.length} câu chờ admin tô đỏ.`:'Chưa có câu đủ 4 lựa chọn với đúng một đáp án tô đỏ; chờ admin bổ sung.';
  await memberRpc(req,'practice_source_pending_admin_v1',{p_document:documentMeta(file,sourceHash,parsed.valid,subjectHint,'needs_review',message)});
  return message;
}

async function importTrusted(req,file,buffer){
  const sourceHash=sha256(buffer),subjectHint=subjectForFile(file),sourceFile={...file,parentName:subjectHint},parsed=parseTrustedMarkedDocx(buffer,sourceFile,sourceHash);
  if(!parsed.questions.length){const message=await registerWaiting(req,file,sourceHash,parsed,subjectHint);return{ok:false,status:'waiting_for_red_answer',fileName:file.name,subject:subjectHint,total:parsed.total,valid:0,invalid:parsed.invalid.length,message,sourceHash}}
  const meta=documentMeta(file,sourceHash,parsed.questions.length,subjectHint,parsed.invalid.length?'needs_review':'ready',parsed.invalid.length?`Trusted partial DOCX: ${parsed.valid} câu hợp lệ, ${parsed.invalid.length} câu chờ tô đỏ.`:'');
  const result=await memberRpc(req,'practice_trusted_quiz_ingest_v1',{p_document:meta,p_questions:parsed.questions});
  let message='';if(parsed.invalid.length)message=await registerWaiting(req,file,sourceHash,parsed,subjectHint);
  return{ok:true,status:parsed.invalid.length?'imported_partial':'imported',fileName:file.name,subject:subjectHint,total:parsed.total,valid:parsed.valid,invalid:parsed.invalid.length,inserted:Number(result?.inserted||0),updated:Number(result?.updated||0),sourceHash,marker:parsed.marker,message};
}

function uploadedDocx(body){
  const name=clean(body.fileName,300),base64=String(body.base64||'');if(!/\.docx$/i.test(name))throw new Error('Tài liệu chuẩn phải là .docx');if(!base64||base64.length>2_800_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error('Tệp DOCX không hợp lệ hoặc vượt 2 MB');const buffer=Buffer.from(base64,'base64');if(!buffer.length||buffer.length>MAX_UPLOAD_BYTES)throw new Error('Tệp DOCX phải nhỏ hơn 2 MB');const sourceHash=sha256(buffer),subject=clean(body.subjectName,160)||subjectFromName(name);return{file:{id:`upload-trusted-${sourceHash}`,name,mimeType:DOCX_MIME,parentName:subject,createdTime:new Date().toISOString(),modifiedTime:new Date().toISOString()},buffer};
}

const needsSync=(file,row)=>{if(!row)return true;const subjectChanged=normalizedName(row.subjectHint)!==normalizedName(subjectForFile(file));const modifiedChanged=!sameTime(row.modifiedTime,file.modifiedTime);return subjectChanged||modifiedChanged||String(row.syncStatus||'')==='error'};

export async function handleTrustedQuizIngest(req,res){
  const access=await learningContentAccess(req);if(!access.ok)return res.status(access.status).json({error:access.error});
  const action=String(req.body?.action||'');
  try{
    if(action==='trusted-quiz-upload'){
      const {file,buffer}=uploadedDocx(req.body||{}),result=await importTrusted(req,file,buffer);return res.status(result.ok?200:422).json(result);
    }
    if(action==='trusted-quiz-sync'){
      const listing=await listQuizBankDocxCandidates();
      if(!listing.configured)return res.status(200).json({ok:false,degraded:true,reason:listing.reason,folderId:listing.folder,folderName:MANUAL_INTAKE_FOLDER,bankFolderName:'NGÂN HÀNG TRẮC NGHIỆM',subjects:listing.subjects||[],processed:[]});
      if(listing.reason==='manual_intake_folder_missing')return res.status(200).json({ok:false,degraded:true,reason:listing.reason,folderId:listing.folder,folderName:MANUAL_INTAKE_FOLDER,bankFolderName:'NGÂN HÀNG TRẮC NGHIỆM',subjects:listing.subjects||[],processed:[]});
      const ids=listing.files.map(file=>String(file.id)),known=ids.length?await memberRpc(req,'practice_source_sync_state_v1',{p_file_ids:ids}):[],knownRows=Array.isArray(known)?known:[],knownById=new Map(knownRows.map(row=>[String(row?.fileId||''),row]));
      const pending=listing.files.filter(file=>needsSync(file,knownById.get(String(file.id)))),maxFiles=Math.max(1,Math.min(10,Number(req.body?.maxFiles)||10)),selected=pending.slice(0,maxFiles).reverse(),processed=[];
      for(const file of selected){try{processed.push(await importTrusted(req,file,await downloadDocx(file)))}catch(error){processed.push({ok:false,status:'error',fileName:file.name,subject:subjectForFile(file),message:clean(error?.message||'Không xử lý được DOCX',300)})}}
      const remaining=Math.max(0,pending.length-selected.length),errors=processed.filter(x=>x.status==='error').length;
      return res.status(200).json({ok:true,folderId:listing.folder,folderName:MANUAL_INTAKE_FOLDER,bankFolderName:'NGÂN HÀNG TRẮC NGHIỆM',subjects:listing.subjects||[],filesSeen:listing.files.length,alreadySynced:listing.files.length-pending.length,pending:pending.length,remaining,errors,processed});
    }
    return res.status(400).json({error:'Unsupported trusted quiz action'});
  }catch(error){return res.status(400).json({error:clean(error?.message||'Trusted quiz ingest failed',400)})}
}
