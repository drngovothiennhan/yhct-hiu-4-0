import { createClient } from 'npm:@supabase/supabase-js@2.102.0'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}')
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
const PUBLIC_KEY=publishableKeys.default||Deno.env.get('SUPABASE_ANON_KEY')!
const SECRET_KEY=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WINDOW_MS=10*60*1000
const BLOCK_MS=10*60*1000
const MAX_FAILURES=8
const LOGIN_ID=/^[A-Z0-9][A-Z0-9._-]{3,31}$/
const explicitOrigins=new Set(['https://yhct-hiu-4-0.vercel.app','https://yhct-hiu-4-0-hiu-yhct.vercel.app','https://yhct-hiu-final4-stage.vercel.app','https://yhct-hiu-final4-stage-hiu-yhct.vercel.app','https://yhct-hiu-final4-stage-git-main-hiu-yhct.vercel.app','http://localhost:5173','http://localhost:4173','http://localhost','https://localhost','capacitor://localhost'])
function isAllowedOrigin(origin:string){if(explicitOrigins.has(origin))return true;try{const u=new URL(origin);if(u.protocol!=='https:'||!u.hostname.endsWith('.vercel.app'))return false;return u.hostname.startsWith('yhct-hiu-4-0-')||u.hostname.startsWith('yhct-hiu-final4-stage-')}catch{return false}}
function cors(req:Request){const origin=req.headers.get('origin')||'';const allow=isAllowedOrigin(origin)?origin:'https://yhct-hiu-4-0.vercel.app';return{'Access-Control-Allow-Origin':allow,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function json(req:Request,body:unknown,status=200,timing=''){const headers:Record<string,string>={...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};if(timing)headers['Server-Timing']=timing;return new Response(JSON.stringify(body),{status,headers})}
function clientIp(req:Request){return(req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'unknown').split(',')[0].trim().slice(0,80)}
async function sha256(value:string){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function throttleKey(req:Request,studentCode:string){return sha256(`${studentCode}|${clientIp(req)}`)}

Deno.serve(async(req:Request)=>{
  const started=performance.now()
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  const admin=createClient(SUPABASE_URL,SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  try{
    const body=await req.json().catch(()=>({}))
    const studentCode=String(body.studentCode||'').trim().replace(/\s/g,'').toUpperCase()
    const password=String(body.password||'')
    if(!LOGIN_ID.test(studentCode)||password.length<6||password.length>128)return json(req,{error:'Tên đăng nhập hoặc mật khẩu không hợp lệ'},401)
    const key=await throttleKey(req,studentCode)
    const now=Date.now()
    const throttlePromise=admin.from('login_throttle').select('window_start,failures,blocked_until').eq('throttle_key',key).maybeSingle()
    const memberPromise=admin.from('club_members').select('id,full_name,email,student_code,role,status,auth_user_id,login_enabled,data_conflict,element_rank,position_title,avatar_url,source_file').eq('student_code',studentCode).eq('status','approved').eq('login_enabled',true).eq('data_conflict',false).maybeSingle()
    const [{data:throttle,error:throttleError},{data:member,error:memberError}]=await Promise.all([throttlePromise,memberPromise])
    if(throttleError)throw throttleError
    if(memberError)throw memberError
    if(throttle?.blocked_until&&new Date(throttle.blocked_until).getTime()>now){const retry=Math.max(1,Math.ceil((new Date(throttle.blocked_until).getTime()-now)/1000));return json(req,{error:'Có quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.',retry_after:retry},429)}
    const recordFailure=async()=>{const windowStart=throttle?.window_start?new Date(throttle.window_start).getTime():0;const sameWindow=now-windowStart<WINDOW_MS;const failures=sameWindow?Number(throttle?.failures||0)+1:1;const blockedUntil=failures>=MAX_FAILURES?new Date(now+BLOCK_MS).toISOString():null;await admin.from('login_throttle').upsert({throttle_key:key,window_start:sameWindow&&throttle?.window_start?throttle.window_start:new Date(now).toISOString(),failures,blocked_until:blockedUntil,updated_at:new Date(now).toISOString()},{onConflict:'throttle_key'})}
    const clearFailure=()=>admin.from('login_throttle').delete().eq('throttle_key',key)
    if(!member){await recordFailure();return json(req,{error:'Tên đăng nhập hoặc mật khẩu không đúng'},401)}
    const authStarted=performance.now()
    const client=createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
    const selfRegistered=String(member.source_file||'')==='self-registration'
    const email=selfRegistered&&member.email?String(member.email).trim().toLowerCase():`${studentCode}@members.yhct-hiu.app`
    if(member.auth_user_id&&!selfRegistered&&password===studentCode){
      const existing=await admin.auth.admin.getUserById(member.auth_user_id)
      const legacy=existing.data.user
      const legacyEmail=String(legacy?.email||'').trim().toLowerCase()
      const importedBy=String(legacy?.app_metadata?.provisioned_by||'')
      if(!existing.error&&legacy&&legacyEmail===email&&!legacy.last_sign_in_at&&['member-bulk-import','member-bulk-import-mssv-repair'].includes(importedBy)){
        const repaired=await admin.auth.admin.updateUserById(legacy.id,{password:studentCode,app_metadata:{...legacy.app_metadata,member_id:member.id,must_change_password:true,login_username:studentCode,provisioned_by:'member-bulk-import-mssv-repair'}})
        if(repaired.error)throw repaired.error
      }
    }
    let authResult=await client.auth.signInWithPassword({email,password})
    const mayBootstrap=!member.auth_user_id&&!selfRegistered&&password===studentCode
    if(authResult.error&&mayBootstrap){const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:member.full_name,student_code:studentCode},app_metadata:{member_id:member.id,must_change_password:true,provisioned_by:'member-login-bootstrap'}});if(created.error&&!String(created.error.message||'').toLowerCase().includes('already'))throw created.error;authResult=await client.auth.signInWithPassword({email,password})}
    if(authResult.error||!authResult.data.session||!authResult.data.user){await recordFailure();return json(req,{error:'Tên đăng nhập hoặc mật khẩu không đúng'},401)}
    const authUserId=authResult.data.user.id
    if(member.auth_user_id&&member.auth_user_id!==authUserId){await client.auth.signOut();await recordFailure();return json(req,{error:'Tài khoản không khớp hồ sơ thành viên'},403)}
    if(!member.auth_user_id){const {error:linkError}=await admin.from('club_members').update({auth_user_id:authUserId,updated_at:new Date().toISOString()}).eq('id',member.id).is('auth_user_id',null);if(linkError)throw linkError}
    if(!authResult.data.user.app_metadata?.member_id){const {error:metaError}=await admin.auth.admin.updateUserById(authUserId,{app_metadata:{...authResult.data.user.app_metadata,member_id:member.id,provisioned_by:selfRegistered?'self-registration':authResult.data.user.app_metadata?.provisioned_by}});if(metaError)console.error('member-login app metadata',metaError)}
    const {error:queueError}=await admin.from('member_auth_provision_queue').update({status:'provisioned',last_error:null}).eq('member_id',member.id).eq('status','pending')
    if(queueError)console.error('member-login provision queue',queueError)
    await clearFailure()
    const session=authResult.data.session
    const total=Math.round(performance.now()-started)
    const authMs=Math.round(performance.now()-authStarted)
    return json(req,{access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,expires_at:session.expires_at,token_type:session.token_type,must_change_password:Boolean(authResult.data.user.app_metadata?.must_change_password),member:{id:member.id,full_name:member.full_name,email:member.email,student_code:member.student_code,role:member.role,status:member.status,element_rank:member.element_rank,position_title:member.position_title,avatar_url:member.avatar_url}},200,`auth;dur=${authMs},total;dur=${total}`)
  }catch(error){console.error('member-login',error);return json(req,{error:'Không thể đăng nhập lúc này'},500)}
})
