import { createClient } from 'npm:@supabase/supabase-js@2.102.0'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}')
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
const PUBLIC_KEY=publishableKeys.default||Deno.env.get('SUPABASE_ANON_KEY')!
const SECRET_KEY=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const allowedOrigins=new Set([
  'https://yhct-hiu-4-0.vercel.app',
  'https://yhct-hiu-4-0-hiu-yhct.vercel.app',
  'https://yhct-hiu-final4-stage.vercel.app',
  'https://yhct-hiu-final4-stage-hiu-yhct.vercel.app',
  'https://yhct-hiu-final4-stage-git-main-hiu-yhct.vercel.app',
  'https://localhost','http://localhost','capacitor://localhost','http://localhost:5173','http://localhost:4173'
])
function originAllowed(origin:string){if(allowedOrigins.has(origin))return true;try{const u=new URL(origin);return u.protocol==='https:'&&u.hostname.endsWith('.vercel.app')&&(u.hostname.startsWith('yhct-hiu-4-0-')||u.hostname.startsWith('yhct-hiu-final4-stage-'))}catch{return false}}
function cors(req:Request){const origin=req.headers.get('origin')||'';return{'Access-Control-Allow-Origin':originAllowed(origin)?origin:'https://yhct-hiu-4-0.vercel.app','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
const strong=(value:string)=>value.length>=8&&/[A-Z]/.test(value)&&/[0-9]/.test(value)&&/[^A-Za-z0-9]/.test(value)

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  try{
    const authHeader=req.headers.get('authorization')||''
    const token=authHeader.replace(/^Bearer\s+/i,'').trim()
    if(!token)return json(req,{error:'Phiên đăng nhập không hợp lệ'},401)
    const body=await req.json().catch(()=>({}))
    const currentPassword=String(body.currentPassword||'')
    const newPassword=String(body.newPassword||'')
    if(currentPassword.length<6||currentPassword.length>128)return json(req,{error:'Mật khẩu hiện tại không hợp lệ'},400)
    if(newPassword.length>128)return json(req,{error:'Mật khẩu mới không hợp lệ'},400)
    if(currentPassword===newPassword)return json(req,{error:'Mật khẩu mới phải khác mật khẩu hiện tại'},400)

    const admin=createClient(SUPABASE_URL,SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:userData,error:userError}=await admin.auth.getUser(token)
    const user=userData.user
    if(userError||!user?.id||!user.email)return json(req,{error:'Phiên đăng nhập đã hết hạn'},401)

    const {data:member,error:memberError}=await admin.from('club_members').select('student_code').eq('auth_user_id',user.id).maybeSingle()
    if(memberError)throw memberError
    const oneTimeLecturerSetup=String(member?.student_code||'').toUpperCase()==='GIANGVIEN1'&&newPassword.length>=6
    if(!strong(newPassword)&&!oneTimeLecturerSetup)return json(req,{error:'Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, số và ký tự đặc biệt'},400)

    const client=createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
    const verified=await client.auth.signInWithPassword({email:user.email,password:currentPassword})
    if(verified.error||verified.data.user?.id!==user.id)return json(req,{error:'Mật khẩu hiện tại không đúng',code:'CURRENT_PASSWORD_INVALID'},400)

    const updated=await admin.auth.admin.updateUserById(user.id,{password:newPassword,app_metadata:{...user.app_metadata,must_change_password:false,password_changed_at:new Date().toISOString()}})
    if(updated.error)throw updated.error
    return json(req,{ok:true,message:'Đổi mật khẩu thành công'})
  }catch(error){console.error('member-change-password',error);return json(req,{error:'Không thể đổi mật khẩu lúc này'},500)}
})
