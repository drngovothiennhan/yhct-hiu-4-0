import {createHash,createSign} from 'node:crypto';
import {learningContentAccess,memberRpc} from './member-access.js';
import {parseTrustedMarkedDocx} from './docx-marked-quiz.js';

const DOCX_MIME='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FOLDER_MIME='application/vnd.google-apps.folder';
const DEFAULT_QUIZ_BANK_FOLDER='1_VvupTkvHvWKLLehVQt_JNA15qfKnIvO';
const QUIZ_BANK_ARCHIVE_FOLDERS=new Set(['01_ĐÃ_TRÍCH_XUẤT_CÂU_HỎI','02_TÀI_LIỆU_ĐÃ_XỬ_LÝ','99_CẦN_DUYỆT_THỦ_CÔNG']);
const QUIZ_BANK_INTAKE_FOLDERS=new Set(['00_DOCX_MỚI_CHỜ_XỬ_LÝ','Thêm thủ công']);
const MAX_UPLOAD_BYTES=2_000_000,MAX_DRIVE_BYTES=5_000_000,HTTP_MS=9000;
const clean=(value,max=1000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const sha256=value=>createHash('sha256').update(value).digest('hex');
const quizBankFolderId=()=>String(process.env.YHCT_DRIVE_QUIZ_BANK_FOLDER_ID||DEFAULT_QUIZ_BANK_FOLDER).trim();
const apiKey=()=>String(process.env.GOOGLE_DRIVE_API_KEY||'').trim();
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
const subjectForFile=file=>{const parent=clean(file?.parentName,160);return !parent||QUIZ_BANK_INTAKE_FOLDERS.has(parent)?subjectFromName(file?.name):parent};

async function listChildren(parent,pageSize=100){
  const url=new URL('https://www.googleapis.com/drive/v3/files');url.searchParams.set('q',`'${parent}' in parents and trashed=false`);url.searchParams.set('fields','files(id,name,mimeType,createdTime,modifiedTime,size,parents)');url.searchParams.set('pageSize',String(Math.max(1,Math.min(100,pageSize))));url.searchParams.set('orderBy','createdTime desc');url.searchParams.set('supportsAllDrives','true');url.searchParams.set('includeItemsFromAllDrives','true');
  const response=await driveFetch(url,{headers:{accept:'application/json'}});if(!response.ok)throw new Error(`Google Drive list ${response.status}`);const payload=await response.json();return Array.isArray(payload?.files)?payload.files:[];
}

async function listQuizBankDocxCandidates(){
  const folder=quizBankFolderId();if(!driveConfigured())return{configured:false,folder,files:[],reason:'missing_google_drive_credential'};
  const root=await listChildren(folder,100),files=root.filter(isDocx).map(file=>({...file,parentName:''}));
  const folders=root.filter(x=>x.mimeType===FOLDER_MIME&&!QUIZ_BANK_ARCHIVE_FOLDERS.has(String(x.name||'').trim())).slice(0,40);
  for(const child of folders){const rows=await listChildren(child.id,100).catch(()=>[]);for(const file of rows.filter(isDocx))files.push({...file,parentName:child.name})}
  const dedup=[...new Map(files.map(file=>[file.id,file])).values()];dedup.sort((a,b)=>Date.parse(b.createdTime||0)-Date.parse(a.createdTime||0));
  return{configured:true,folder,files:dedup.slice(0,400)};
}

async function downloadDocx(file){
  const url=new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);url.searchParams.set('alt','media');const response=await driveFetch(url,{},12000);if(!response.ok)throw new Error(`Google Drive download ${response.status}`);const len=Number(response.headers.get('content-length')||file.size||0);if(len>MAX_DRIVE_BYTES)throw new Error('DOCX exceeds 5 MB ingestion limit');const buffer=Buffer.from(await response.arrayBuffer());if(!buffer.length||buffer.length>MAX_DRIVE_BYTES)throw new Error('DOCX exceeds 5 MB ingestion limit');return buffer;
}

const documentMeta=(file,sourceHash,questionCount,subjectHint=subjectForFile(file))=>({driveFileId:String(file.id),fileName:clean(file.name,300),mimeType:DOCX_MIME,modifiedTime:file.modifiedTime||null,sourceHash,subjectHint, syncStatus:'ready',syncMessage:`Trusted DOCX: ${questionCount} câu có đúng một đáp án tô đỏ.`});

async function importTrusted(req,file,buffer){
  const sourceHash=sha256(buffer),subjectHint=subjectForFile(file),sourceFile={...file,parentName:subjectHint},parsed=parseTrustedMarkedDocx(buffer,sourceFile,sourceHash);
  if(!parsed.trusted)return{ok:false,status:'invalid',fileName:file.name,total:parsed.total,valid:parsed.valid,invalid:parsed.invalid,message:'Tài liệu chưa đạt chuẩn: mỗi câu phải có đúng 4 lựa chọn và đúng một đáp án tô đỏ.'};
  const meta=documentMeta(file,sourceHash,parsed.questions.length,subjectHint),result=await memberRpc(req,'practice_trusted_quiz_ingest_v1',{p_document:meta,p_questions:parsed.questions});
  return{ok:true,status:'imported',fileName:file.name,total:parsed.total,inserted:Number(result?.inserted||0),updated:Number(result?.updated||0),sourceHash,marker:parsed.marker};
}

function uploadedDocx(body){
  const name=clean(body.fileName,300),base64=String(body.base64||'');if(!/\.docx$/i.test(name))throw new Error('Tài liệu chuẩn phải là .docx');if(!base64||base64.length>2_800_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error('Tệp DOCX không hợp lệ hoặc vượt 2 MB');const buffer=Buffer.from(base64,'base64');if(!buffer.length||buffer.length>MAX_UPLOAD_BYTES)throw new Error('Tệp DOCX phải nhỏ hơn 2 MB');const sourceHash=sha256(buffer),subject=clean(body.subjectName,160)||subjectFromName(name);return{file:{id:`upload-trusted-${sourceHash}`,name,mimeType:DOCX_MIME,parentName:subject,createdTime:new Date().toISOString(),modifiedTime:new Date().toISOString()},buffer};
}

export async function handleTrustedQuizIngest(req,res){
  const access=await learningContentAccess(req);if(!access.ok)return res.status(access.status).json({error:access.error});
  const action=String(req.body?.action||'');
  try{
    if(action==='trusted-quiz-upload'){
      const {file,buffer}=uploadedDocx(req.body||{}),result=await importTrusted(req,file,buffer);return res.status(result.ok?200:422).json(result);
    }
    if(action==='trusted-quiz-sync'){
      const listing=await listQuizBankDocxCandidates();if(!listing.configured)return res.status(200).json({ok:false,degraded:true,reason:listing.reason,folderId:listing.folder,folderName:'NGÂN HÀNG TRẮC NGHIỆM',processed:[]});
      const ids=listing.files.map(file=>String(file.id)),known=ids.length?await memberRpc(req,'practice_source_sync_state_v1',{p_file_ids:ids}):[],knownIds=new Set((Array.isArray(known)?known:[]).map(row=>String(row?.fileId||'')));
      const pending=listing.files.filter(file=>!knownIds.has(String(file.id))),maxFiles=Math.max(1,Math.min(10,Number(req.body?.maxFiles)||5)),selected=pending.slice(0,maxFiles).reverse(),processed=[];
      for(const file of selected){try{processed.push(await importTrusted(req,file,await downloadDocx(file)))}catch(error){processed.push({ok:false,status:'error',fileName:file.name,message:clean(error?.message||'Không xử lý được DOCX',300)})}}
      return res.status(200).json({ok:true,folderId:listing.folder,folderName:'NGÂN HÀNG TRẮC NGHIỆM',filesSeen:listing.files.length,alreadySynced:knownIds.size,pending:pending.length,processed});
    }
    return res.status(400).json({error:'Unsupported trusted quiz action'});
  }catch(error){return res.status(400).json({error:clean(error?.message||'Trusted quiz ingest failed',400)})}
}