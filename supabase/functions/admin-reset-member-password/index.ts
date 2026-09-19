import { createClient } from 'npm:@supabase/supabase-js@2.102.0'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
const SERVICE_KEY=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const APP_RECOVERY_URL='https://yhct-hiu-final4-stage.vercel.app/?password_recovery=1'
const allowedOrigins=new Set([
  'https://yhct-hiu-4-0.vercel.app',
  'https://yhct-hiu-4-0-hiu-yhct.vercel.app',
  'https://yhct-hiu-final4-stage.vercel.app',
  'https://yhct-hiu-final4-stage-hiu-yhct.vercel.app',
  'https://yhct-hiu-final4-stage-git-main-hiu-yhct.vercel.app',
  'http://localhost:5173','http://localhost:4173'
])
function originAllowed(origin:string){if(allowedOrigins.has(origin))return true;try{const u=new URL(origin);return u.protocol==='https:'&&u.hostname.endsWith('.vercel.app')&&(u.hostname.startsWith('yhct-hiu-4-0-')||u.hostname.startsWith('yhct-hiu-final4-stage-'))}catch{return false}}
function cors(req:Request){const origin=req.headers.get('origin')||'';return{'Access-Control-Allow-Origin':originAllowed(origin)?origin:'https://yhct-hiu-final4-stage.vercel.app','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  try{
    const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim()
    if(!token)return json(req,{error:'Phiên Admin không hợp lệ'},401)
    const {data:userData,error:userError}=await admin.auth.getUser(token)
    if(userError||!userData.user)return json(req,{error:'Phiên Admin đã hết hạn'},401)
    const {data:actor,error:actorError}=await admin.from('club_members').select('id,role,status,login_enabled,data_conflict').eq('auth_user_id',userData.user.id).maybeSingle()
    if(actorError)throw actorError
    if(!actor||actor.status!=='approved'||actor.login_enabled===false||actor.data_conflict===true||actor.role!=='admin')return json(req,{error:'Chỉ Admin đang hoạt động mới được reset mật khẩu'},403)

    const body=await req.json().catch(()=>({}))
    const memberId=String(body.memberId||'').trim()
    if(!UUID.test(memberId))return json(req,{error:'Mã thành viên không hợp lệ'},400)
    if(memberId===actor.id)return json(req,{error:'Không reset mật khẩu Admin đang đăng nhập. Hãy dùng chức năng đổi mật khẩu cá nhân.'},400)

    const {data:target,error:targetError}=await admin.from('club_members').select('id,student_code,full_name,role,status,data_conflict,auth_user_id,source_file').eq('id',memberId).maybeSingle()
    if(targetError)throw targetError
    if(!target)return json(req,{error:'Không tìm thấy thành viên'},404)
    if(target.role==='admin')return json(req,{error:'Không reset tài khoản Admin bằng công cụ quản trị thành viên.'},403)
    if(target.data_conflict===true)return json(req,{error:'Hồ sơ đang có xung đột dữ liệu. Cần xử lý danh tính trước khi reset mật khẩu.'},409)
    if(target.status!=='approved')return json(req,{error:'Chỉ reset mật khẩu cho thành viên đã được duyệt.'},409)
    const studentCode=String(target.student_code||'').trim().toUpperCase()
    if(!studentCode)return json(req,{error:'Hồ sơ chưa có MSSV/tên đăng nhập hợp lệ.'},409)

    const resetAt=new Date().toISOString()
    let authUserId=target.auth_user_id?String(target.auth_user_id):''
    let authEmail=''
    let provisioned=false

    if(authUserId){
      const {data:authUser,error:authReadError}=await admin.auth.admin.getUserById(authUserId)
      if(authReadError||!authUser.user)return json(req,{error:'Tài khoản xác thực liên kết không tồn tại.'},409)
      authEmail=String(authUser.user.email||'').trim().toLowerCase()
      if(!authEmail)return json(req,{error:'Tài khoản xác thực chưa có email đăng nhập hợp lệ.'},409)
    }else{
      if(String(target.source_file||'')==='self-registration')return json(req,{error:'Tài khoản đăng ký trực tuyến chưa liên kết Auth. Cần kiểm tra liên kết danh tính trước.'},409)
      authEmail=(studentCode+'@members.yhct-hiu.app').toLowerCase()
      const {data:created,error:createError}=await admin.auth.admin.createUser({
        email:authEmail,
        email_confirm:true,
        user_metadata:{full_name:String(target.full_name||''),student_code:studentCode},
        app_metadata:{member_id:target.id,provisioned_by:'admin-password-recovery'}
      })
      if(createError||!created.user)return json(req,{error:createError?.message||'Không thể khởi tạo tài khoản xác thực cho thành viên.'},409)
      authUserId=created.user.id
      const {data:linked,error:linkError}=await admin.from('club_members').update({auth_user_id:authUserId,updated_at:resetAt}).eq('id',target.id).is('auth_user_id',null).select('id').maybeSingle()
      if(linkError||!linked){await admin.auth.admin.deleteUser(authUserId).catch(()=>{});return json(req,{error:'Không thể liên kết tài khoản xác thực. Chưa thay đổi hồ sơ thành viên.'},409)}
      provisioned=true
    }

    const {data:linkData,error:linkError}=await admin.auth.admin.generateLink({type:'recovery',email:authEmail})
    if(linkError)throw linkError
    const rawLink=String(linkData?.properties?.action_link||'').trim()
    if(!rawLink)return json(req,{error:'Không thể tạo liên kết khôi phục mật khẩu.'},500)
    const recovery=new URL(rawLink)
    recovery.searchParams.set('redirect_to',APP_RECOVERY_URL)
    const recoveryUrl=recovery.toString()

    const {error:auditError}=await admin.from('system_audit_logs').insert({
      actor_member_id:actor.id,
      action:'member.password_recovery_link',
      entity_type:'club_members',
      entity_id:target.id,
      severity:'warning',
      metadata:{target_member_id:target.id,student_code:studentCode,auth_user_id:authUserId,provisioned,generated_at:resetAt}
    })
    if(auditError)console.error('admin-reset-member-password audit',auditError)
    return json(req,{ok:true,memberId:target.id,username:studentCode,recoveryUrl,provisioned})
  }catch(error){
    console.error('admin-reset-member-password',error)
    return json(req,{error:'Không thể tạo liên kết reset mật khẩu lúc này.'},500)
  }
})
