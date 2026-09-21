import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";
import * as XLSX from "npm:xlsx@0.18.5";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const PUBLIC_KEY=publishableKeys.default||Deno.env.get('SUPABASE_ANON_KEY')!;
const SECRET_KEY=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MSSV=/^\d{8,14}$/;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTEMPTS=12;
const WINDOW_MS=30*60*1000;
const BLOCK_MS=30*60*1000;
const DRIVE_FILE_NAME='HIU YHCT 4.0 - Dang ky thanh vien.xlsx';
const explicitOrigins=new Set(['https://yhct-hiu-4-0.vercel.app','https://yhct-hiu-4-0-hiu-yhct.vercel.app','https://yhct-hiu-final4-stage.vercel.app','https://yhct-hiu-final4-stage-hiu-yhct.vercel.app','https://yhct-hiu-final4-stage-git-main-hiu-yhct.vercel.app','http://localhost:5173','http://localhost:4173','http://localhost','https://localhost','capacitor://localhost']);

function isAllowedOrigin(origin:string){if(explicitOrigins.has(origin))return true;try{const u=new URL(origin);if(u.protocol!=='https:'||!u.hostname.endsWith('.vercel.app'))return false;return u.hostname.startsWith('yhct-hiu-4-0-')||u.hostname.startsWith('yhct-hiu-final4-stage-')}catch{return false}}
function cors(req:Request){const origin=req.headers.get('origin')||'';const allow=isAllowedOrigin(origin)?origin:'https://yhct-hiu-final4-stage.vercel.app';return{'Access-Control-Allow-Origin':allow,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
const clean=(value:unknown,max:number)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const normalizeStudentCode=(value:unknown)=>clean(value,20).replace(/\s/g,'').toUpperCase();
const normalizeEmail=(value:unknown)=>clean(value,254).toLowerCase();
function clientIp(req:Request){return(req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'unknown').split(',')[0].trim().slice(0,80)}
async function sha256(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')}
function b64url(bytes:Uint8Array){let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
function utf8b64url(value:string){return b64url(new TextEncoder().encode(value))}
function pemToBytes(pem:string){const body=pem.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----/g,'').replace(/-----END PRIVATE KEY-----/g,'').replace(/\s+/g,'');const binary=atob(body);return Uint8Array.from(binary,c=>c.charCodeAt(0))}
function driveConfig(){let email=clean(Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL')||'',320),privateKey=String(Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY')||''),folderId=clean(Deno.env.get('YHCT_DRIVE_MEMBER_FOLDER_ID')||'',220);const raw=Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON')||'';if(raw){try{const parsed=JSON.parse(raw);email=email||clean(parsed.client_email,320);privateKey=privateKey||String(parsed.private_key||'')}catch{}}return{email,privateKey,folderId,configured:Boolean(email&&privateKey&&folderId)}}
async function googleAccessToken(email:string,privateKey:string){const now=Math.floor(Date.now()/1000),header=utf8b64url(JSON.stringify({alg:'RS256',typ:'JWT'})),payload=utf8b64url(JSON.stringify({iss:email,scope:'https://www.googleapis.com/auth/drive.file',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})),unsigned=`${header}.${payload}`;const key=await crypto.subtle.importKey('pkcs8',pemToBytes(privateKey),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));const assertion=`${unsigned}.${b64url(signature)}`;const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});const body=await response.json().catch(()=>({}));if(!response.ok||!body.access_token)throw new Error(`Google OAuth ${response.status}`);return String(body.access_token)}
function concatBytes(...parts:Uint8Array[]){const total=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(total);let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length}return out}
async function uploadWorkbook(bytes:Uint8Array){const cfg=driveConfig();if(!cfg.configured)return{configured:false,reason:'missing_drive_write_credentials'};const token=await googleAccessToken(cfg.email,cfg.privateKey);const q=`name = '${DRIVE_FILE_NAME}' and '${cfg.folderId}' in parents and trashed = false`;const listUrl=new URL('https://www.googleapis.com/drive/v3/files');listUrl.searchParams.set('q',q);listUrl.searchParams.set('fields','files(id,name,webViewLink)');listUrl.searchParams.set('pageSize','10');const list=await fetch(listUrl,{headers:{Authorization:`Bearer ${token}`}});if(!list.ok)throw new Error(`Google Drive list ${list.status}`);const existing=((await list.json()).files||[])[0];const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';if(existing?.id){const updateUrl=`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media&fields=id,name,webViewLink`;const updated=await fetch(updateUrl,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':mime},body:bytes});const body=await updated.json().catch(()=>({}));if(!updated.ok)throw new Error(`Google Drive update ${updated.status}`);return{configured:true,fileId:String(body.id||existing.id),fileName:DRIVE_FILE_NAME,webViewLink:String(body.webViewLink||existing.webViewLink||'')}}const boundary=`yhct_${crypto.randomUUID().replace(/-/g,'')}`,meta=JSON.stringify({name:DRIVE_FILE_NAME,parents:[cfg.folderId]});const enc=new TextEncoder(),head=enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),tail=enc.encode(`\r\n--${boundary}--`),multipart=concatBytes(head,bytes,tail);const created=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':`multipart/related; boundary=${boundary}`},body:multipart});const body=await created.json().catch(()=>({}));if(!created.ok)throw new Error(`Google Drive create ${created.status}`);return{configured:true,fileId:String(body.id||''),fileName:DRIVE_FILE_NAME,webViewLink:String(body.webViewLink||'')}}
async function syncRegistrationWorkbook(admin:any){const {data,error}=await admin.from('member_registration_requests').select('student_code,full_name,class_name,faculty,email,status,created_at,activated_at').order('created_at',{ascending:true});if(error)throw error;const rows=(data||[]).map((r:any,i:number)=>({'STT':i+1,'MSSV':r.student_code,'Họ và tên':r.full_name,'Lớp':r.class_name,'Khoa':r.faculty,'Email kích hoạt':r.email,'Trạng thái':r.status==='activated'?'Đã kích hoạt':r.status==='awaiting_email'?'Chờ kích hoạt email':r.status==='conflict'?'Xung đột MSSV':'Đã hủy','Ngày đăng ký':r.created_at?new Date(r.created_at).toISOString():'','Ngày kích hoạt':r.activated_at?new Date(r.activated_at).toISOString():''}));const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet(rows.length?rows:[{'STT':'','MSSV':'','Họ và tên':'','Lớp':'','Khoa':'','Email kích hoạt':'','Trạng thái':'Chưa có đăng ký','Ngày đăng ký':'','Ngày kích hoạt':''}]);ws['!cols']=[{wch:7},{wch:18},{wch:32},{wch:18},{wch:28},{wch:34},{wch:22},{wch:25},{wch:25}];XLSX.utils.book_append_sheet(wb,ws,'Đăng ký thành viên');const raw=XLSX.write(wb,{type:'array',bookType:'xlsx',compression:true});const bytes=raw instanceof Uint8Array?raw:new Uint8Array(raw as ArrayBuffer);const uploaded=await uploadWorkbook(bytes);return{...uploaded,rows:rows.length}}
async function consumeQuota(admin:any,req:Request){const key=await sha256(`member-register|${clientIp(req)}`),now=Date.now();const {data,error}=await admin.from('login_throttle').select('window_start,failures,blocked_until').eq('throttle_key',key).maybeSingle();if(error)throw error;if(data?.blocked_until&&new Date(data.blocked_until).getTime()>now)return{ok:false,retryAfter:Math.max(1,Math.ceil((new Date(data.blocked_until).getTime()-now)/1000))};const start=data?.window_start?new Date(data.window_start).getTime():0,same=now-start<WINDOW_MS,attempts=same?Number(data?.failures||0)+1:1,blockedUntil=attempts>=MAX_ATTEMPTS?new Date(now+BLOCK_MS).toISOString():null;const {error:upsertError}=await admin.from('login_throttle').upsert({throttle_key:key,window_start:same&&data?.window_start?data.window_start:new Date(now).toISOString(),failures:attempts,blocked_until:blockedUntil,updated_at:new Date(now).toISOString()},{onConflict:'throttle_key'});if(upsertError)throw upsertError;return{ok:attempts<=MAX_ATTEMPTS,retryAfter:blockedUntil?Math.ceil(BLOCK_MS/1000):0}}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)});
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405);
  const admin=createClient(SUPABASE_URL,SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  try{
    const body=await req.json().catch(()=>({}));
    if(body.action==='sync_drive'){
      const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
      if(!token)return json(req,{error:'Unauthorized'},401);
      const {data:userData,error:userError}=await admin.auth.getUser(token);
      if(userError||!userData.user)return json(req,{error:'Unauthorized'},401);
      const {data:actor,error:actorError}=await admin.from('club_members').select('id,role,status,login_enabled,data_conflict').eq('auth_user_id',userData.user.id).maybeSingle();
      if(actorError)throw actorError;
      if(!actor||actor.role!=='admin'||actor.status!=='approved'||!actor.login_enabled||actor.data_conflict)return json(req,{error:'Admin role required'},403);
      const result=await syncRegistrationWorkbook(admin);
      if(!result.configured)return json(req,{error:'Drive write chưa được cấu hình cho hệ thống.',code:'DRIVE_WRITE_NOT_CONFIGURED',rows:result.rows},503);
      return json(req,{ok:true,...result});
    }

    const quota=await consumeQuota(admin,req);
    if(!quota.ok)return json(req,{error:'Đã đạt giới hạn đăng ký từ thiết bị này. Vui lòng thử lại sau.',retry_after:quota.retryAfter},429);

    const studentCode=normalizeStudentCode(body.studentCode),fullName=clean(body.fullName,180),className=clean(body.className,80),faculty=clean(body.faculty,120),email=normalizeEmail(body.email),password=String(body.password||'');
    if(!MSSV.test(studentCode))return json(req,{error:'MSSV phải gồm 8–14 chữ số.'},400);
    if(fullName.length<2)return json(req,{error:'Vui lòng nhập họ tên đầy đủ.'},400);
    if(!className)return json(req,{error:'Vui lòng nhập lớp.'},400);
    if(!faculty)return json(req,{error:'Vui lòng nhập khoa.'},400);
    if(!EMAIL.test(email))return json(req,{error:'Email kích hoạt không hợp lệ.'},400);
    if(password.length<8||password.length>128)return json(req,{error:'Mật khẩu phải từ 8 đến 128 ký tự.'},400);

    const [memberCheck,requestCodeCheck,requestEmailCheck]=await Promise.all([
      admin.from('club_members').select('id').ilike('student_code',studentCode).limit(1),
      admin.from('member_registration_requests').select('id,status').ilike('student_code',studentCode).in('status',['awaiting_email','activated']).limit(1),
      admin.from('member_registration_requests').select('id,status').ilike('email',email).in('status',['awaiting_email','activated']).limit(1)
    ]);
    if(memberCheck.error)throw memberCheck.error;if(requestCodeCheck.error)throw requestCodeCheck.error;if(requestEmailCheck.error)throw requestEmailCheck.error;
    if((memberCheck.data||[]).length||(requestCodeCheck.data||[]).length)return json(req,{error:'MSSV này đã có tài khoản hoặc đang chờ kích hoạt.'},409);
    if((requestEmailCheck.data||[]).length)return json(req,{error:'Email này đã được dùng cho một đăng ký thành viên.'},409);

    const publicClient=createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const origin=req.headers.get('origin')||'';
    const redirectTo=isAllowedOrigin(origin)?`${origin}/?member_activation=done`:'https://yhct-hiu-final4-stage.vercel.app/?member_activation=done';
    const signup=await publicClient.auth.signUp({email,password,options:{emailRedirectTo:redirectTo,data:{registration_source:'self',student_code:studentCode,full_name:fullName,class_name:className,faculty}}});
    if(signup.error||!signup.data.user){const message=String(signup.error?.message||'Không thể tạo đăng ký.');if(/already|registered|exists/i.test(message))return json(req,{error:'Email này đã gắn với một tài khoản. Hãy dùng email khác hoặc liên hệ admin.'},409);return json(req,{error:'Không thể gửi email kích hoạt lúc này.'},502)}
    const authUser=signup.data.user;
    if(signup.data.session||authUser.email_confirmed_at){await admin.auth.admin.deleteUser(authUser.id).catch(()=>{});return json(req,{error:'Hệ thống email kích hoạt chưa được bật đúng cấu hình. Đăng ký chưa được ghi nhận.',code:'EMAIL_CONFIRMATION_REQUIRED'},503)}

    const {data:requestRow,error:requestError}=await admin.from('member_registration_requests').insert({auth_user_id:authUser.id,student_code:studentCode,full_name:fullName,class_name:className,faculty,email,status:'awaiting_email'}).select('id').single();
    if(requestError){await admin.auth.admin.deleteUser(authUser.id).catch(()=>{});if((requestError as any).code==='23505')return json(req,{error:'MSSV hoặc email vừa được đăng ký ở một phiên khác.'},409);throw requestError}
    const {error:metadataError}=await admin.auth.admin.updateUserById(authUser.id,{app_metadata:{registration_request_id:requestRow.id,provisioned_by:'self-registration'}});
    if(metadataError)console.error('member-register app metadata',metadataError);

    let driveSync:any={configured:false,reason:'not_attempted'};
    try{driveSync=await syncRegistrationWorkbook(admin)}catch(error){console.error('member-register drive sync',error);driveSync={configured:Boolean(driveConfig().configured),reason:'sync_failed'}}
    return json(req,{ok:true,studentCode,awaitingEmail:true,driveSync:{configured:Boolean(driveSync.configured),synced:Boolean(driveSync.fileId),reason:driveSync.reason||null}},201);
  }catch(error){console.error('member-register',error);return json(req,{error:'Không thể đăng ký thành viên lúc này.'},500)}
});
