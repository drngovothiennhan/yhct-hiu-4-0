import { createClient } from 'npm:@supabase/supabase-js@2.102.0'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
const SERVICE_KEY=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const MSSV=/^\d{8,14}$/
const UPPER='ABCDEFGHJKLMNPQRSTUVWXYZ',LOWER='abcdefghijkmnopqrstuvwxyz',DIGITS='23456789',SPECIAL='!@#$%',ALL=UPPER+LOWER+DIGITS+SPECIAL
const clean=(v:unknown,max=180)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)
const normalizeCode=(v:unknown)=>clean(v,20).replace(/\s/g,'').toUpperCase()
const emailLike=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
function randomIndex(limit:number){if(!Number.isInteger(limit)||limit<1||limit>256)throw new Error('Invalid random range');const ceiling=256-(256%limit),buf=new Uint8Array(1);let value=256;while(value>=ceiling){crypto.getRandomValues(buf);value=buf[0]}return value%limit}
function pick(pool:string){return pool[randomIndex(pool.length)]}
function shuffle(chars:string[]){for(let i=chars.length-1;i>0;i--){const j=randomIndex(i+1);[chars[i],chars[j]]=[chars[j],chars[i]]}return chars}
function tempPassword(){const chars=[pick(UPPER),pick(LOWER),pick(DIGITS),pick(SPECIAL),...Array.from({length:14},()=>pick(ALL))];return shuffle(chars).join('')}
function sourceRow(value:unknown,index:number){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=100000?n:index+2}
function cors(req:Request){const origin=req.headers.get('origin')||'*';return{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  try{
    const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
    if(!token)return json(req,{error:'Unauthorized'},401)
    const {data:userData,error:userError}=await admin.auth.getUser(token)
    if(userError||!userData.user)return json(req,{error:'Unauthorized'},401)
    const {data:actor,error:actorError}=await admin.from('club_members').select('id,role,status').eq('auth_user_id',userData.user.id).maybeSingle()
    if(actorError)throw actorError
    if(!actor||actor.status!=='approved'||actor.role!=='admin')return json(req,{error:'Admin role required'},403)
    const body=await req.json().catch(()=>({}))
    const rawRows=Array.isArray(body.rows)?body.rows:[]
    if(rawRows.length===0||rawRows.length>1000)return json(req,{error:'Số dòng phải từ 1 đến 1000.'},400)
    const normalized=rawRows.map((row:any,index:number)=>({
      row:sourceRow(row.source_row??row.row,index),
      source_row:sourceRow(row.source_row??row.row,index),
      student_code:normalizeCode(row.mssv??row.MSSV??row.student_code),
      full_name:clean(row.ho_ten??row['Họ và tên']??row['Họ tên']??row.full_name,180),
      class_name:clean(row.lop??row['Lớp']??row.class_name,80),
      contact:clean(row.contact??row['SĐT/Email']??row.email??row.phone,180),
      organizational_unit:clean(row.ban??row['Chi hội/Ban']??row.department??row.organizational_unit??'',120)
    }))
    const seen=new Set<string>(),errors:any[]=[],valid:any[]=[]
    for(const row of normalized){
      if(!MSSV.test(row.student_code)){errors.push({...row,mssv:row.student_code,ho_ten:row.full_name,lop:row.class_name,ban:row.organizational_unit,reason:'MSSV phải gồm 8–14 chữ số.'});continue}
      if(!row.full_name){errors.push({...row,mssv:row.student_code,ho_ten:row.full_name,lop:row.class_name,ban:row.organizational_unit,reason:'Họ và tên không được để trống.'});continue}
      if(seen.has(row.student_code)){errors.push({...row,mssv:row.student_code,ho_ten:row.full_name,lop:row.class_name,ban:row.organizational_unit,reason:'MSSV trùng trong chính file nhập.'});continue}
      seen.add(row.student_code);valid.push(row)
    }
    const codes=valid.map(x=>x.student_code)
    const {data:existing,error:existingError}=codes.length?await admin.from('club_members').select('student_code,full_name').in('student_code',codes):{data:[],error:null}
    if(existingError)throw existingError
    const existingMap=new Map((existing||[]).map((x:any)=>[String(x.student_code).toUpperCase(),x]))
    const duplicates:any[]=[],created:any[]=[],failed:any[]=[]
    const publicRow=(row:any)=>({row:row.row,source_row:row.source_row,mssv:row.student_code,ho_ten:row.full_name,lop:row.class_name,contact:row.contact,ban:row.organizational_unit})
    for(const row of valid){
      const duplicate=existingMap.get(row.student_code)
      if(duplicate){duplicates.push({...publicRow(row),existing_name:(duplicate as any).full_name});continue}
      const password=tempPassword(),loginEmail=`${row.student_code}@members.yhct-hiu.app`
      const {data:authCreated,error:authError}=await admin.auth.admin.createUser({
        email:loginEmail,password,email_confirm:true,
        user_metadata:{full_name:row.full_name,student_code:row.student_code,class_name:row.class_name},
        app_metadata:{provisioned_by:'member-bulk-import',must_change_password:true}
      })
      if(authError||!authCreated.user){failed.push({...publicRow(row),reason:authError?.message||'Không thể tạo Auth user'});continue}
      const email=row.contact&&emailLike(row.contact)?row.contact:null
      const phone=row.contact&&!email?row.contact:null
      const {data:member,error:memberError}=await admin.from('club_members').insert({
        auth_user_id:authCreated.user.id,full_name:row.full_name,email,phone,
        student_code:row.student_code,class_name:row.class_name||null,organizational_unit:row.organizational_unit||null,
        role:'member',status:'approved',login_enabled:true,position_title:'Hội viên',source_file:clean(body.file_name||'bulk-import',255)
      }).select('id').single()
      if(memberError){await admin.auth.admin.deleteUser(authCreated.user.id).catch(()=>{});if((memberError as any).code==='23505'){const {data:raceDuplicate}=await admin.from('club_members').select('full_name').eq('student_code',row.student_code).maybeSingle();duplicates.push({...publicRow(row),existing_name:raceDuplicate?.full_name||row.full_name,reason:'MSSV vừa được tạo bởi một phiên import khác.'})}else failed.push({...publicRow(row),reason:memberError.message});continue}
      const {error:linkError}=await admin.auth.admin.updateUserById(authCreated.user.id,{app_metadata:{member_id:member.id,provisioned_by:'member-bulk-import',must_change_password:true}})
      if(linkError){await admin.from('club_members').delete().eq('id',member.id).catch(()=>{});await admin.auth.admin.deleteUser(authCreated.user.id).catch(()=>{});failed.push({...publicRow(row),reason:'Không thể liên kết tài khoản xác thực với hồ sơ thành viên.'});continue}
      created.push({...publicRow(row),username:row.student_code,temporary_password:password})
    }
    const {error:auditError}=await admin.from('system_audit_logs').insert({actor_member_id:actor.id,action:'member.bulk_import',entity_type:'club_members',severity:failed.length?'warning':'info',metadata:{file_name:clean(body.file_name||'',255),input:rawRows.length,created:created.length,duplicates:duplicates.length,invalid:errors.length,failed:failed.length}})
    if(auditError)console.error('member-bulk-import audit',auditError)
    return json(req,{ok:true,summary:{input:rawRows.length,created:created.length,duplicates:duplicates.length,invalid:errors.length,failed:failed.length},created,duplicates,errors,failed})
  }catch(error){console.error('member-bulk-import',error);return json(req,{error:'Không thể nhập thành viên lúc này.'},500)}
})
