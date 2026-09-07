import {createClient} from 'npm:@supabase/supabase-js@2.102.0'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}')
const PUBLIC_KEY=publishableKeys.default||Deno.env.get('SUPABASE_ANON_KEY')!
const ROLE_LEVEL:Record<string,number>={guest:0,member:1,mod:2,super_mod:3,leader:4,admin:5}
const explicitOrigins=new Set(['https://yhct-hiu-4-0.vercel.app','https://yhct-hiu-4-0-hiu-yhct.vercel.app','https://yhct-hiu-final4-stage.vercel.app','https://yhct-hiu-final4-stage-hiu-yhct.vercel.app','https://yhct-hiu-final4-stage-git-main-hiu-yhct.vercel.app','https://drngovothiennhan.github.io','http://localhost:5173','http://localhost:4173'])

function allowed(origin:string){
  if(explicitOrigins.has(origin))return true
  try{
    const url=new URL(origin)
    if(url.protocol!=='https:')return false
    if(url.hostname.endsWith('.vercel.app'))return url.hostname.startsWith('yhct-hiu-4-0-')||url.hostname.startsWith('yhct-hiu-final4-stage-')
    if(url.hostname.endsWith('.pages.dev'))return url.hostname.startsWith('yhct-hiu')
    return false
  }catch{return false}
}
function cors(req:Request){const origin=req.headers.get('origin')||'';return{'Access-Control-Allow-Origin':allowed(origin)?origin:'https://drngovothiennhan.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400','Vary':'Origin'}}
const safe=(value:unknown)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,4000)
function local(body:{logs?:unknown[]}){const logs=Array.isArray(body.logs)?body.logs as Array<Record<string,unknown>>:[],severe=logs.filter(x=>['error','critical'].includes(String(x?.severity))),warnings=logs.filter(x=>String(x?.severity)==='warning'),lines=[`Diagnostic local: ${severe.length} lỗi nghiêm trọng, ${warnings.length} cảnh báo trong mẫu ${logs.length} log.`];if(severe.length)lines.push('Ưu tiên cô lập route/module lỗi lặp, đối chiếu timestamp với deployment SHA và chạy smoke test trên staging.');else lines.push('Không thấy lỗi nghiêm trọng trong mẫu log; tiếp tục theo dõi auth, Supabase RPC và runtime frontend.');lines.push('Auto-hotfix an toàn: chỉ vá trên nhánh RC/staging sau CI; không tự đổi production trước gate.');return lines.join('\n')}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='POST')return json(req,{error:'Method not allowed'},405)
  try{
    const auth=req.headers.get('authorization')||''
    if(!auth.startsWith('Bearer '))return json(req,{error:'Authentication required'},401)
    const client=createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:auth}}})
    const {data:access,error:accessError}=await client.rpc('current_member_access_v1')
    const role=String(access?.role||'guest')
    if(accessError||!access?.approved||(ROLE_LEVEL[role]||0)<ROLE_LEVEL.admin)return json(req,{error:'Insufficient role'},403)
    const body=await req.json().catch(()=>({})) as Record<string,unknown>
    const logs=Array.isArray(body.logs)?body.logs.slice(0,50).map((item:unknown)=>{const row=(item&&typeof item==='object'?item:{}) as Record<string,unknown>;return{action:safe(row.action),severity:safe(row.severity),entity:safe(row.entity),createdAt:safe(row.createdAt),metadata:row.metadata&&typeof row.metadata==='object'?row.metadata:{}}}):[]
    const health=body.health&&typeof body.health==='object'?body.health:{},fallback=local({logs})
    const key=Deno.env.get('OPENAI_API_KEY'),model=Deno.env.get('OPENAI_MODEL')||'gpt-5.6-luna'
    if(!key)return json(req,{analysis:fallback,provider:'local'})
    const input=`Bạn là Principal DevSecOps cho YHCT HIU 4.0. Không được đề xuất bỏ RBAC/RLS, không tiết lộ secret, không chạy lệnh phá hủy. Trả lời tiếng Việt theo 4 mục: Phát hiện; Root cause khả dĩ; Suggested patch; Gate kiểm thử. Mọi patch phải qua staging+CI trước production. HEALTH=${JSON.stringify(health).slice(0,7000)} LOGS=${JSON.stringify(logs).slice(0,15000)}`
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000)
      let response:Response
      try{response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,input,max_output_tokens:900}),signal:controller.signal})}finally{clearTimeout(timer)}
      if(!response.ok)throw new Error(`OpenAI ${response.status}`)
      const result=await response.json(),text=result.output_text||result.output?.flatMap((item:any)=>item.content||[]).map((part:any)=>part.text||'').join('')||fallback
      return json(req,{analysis:safe(text),provider:'openai',model})
    }catch(error){console.error('acc-diagnostics-openai',String(error));return json(req,{analysis:fallback,provider:'local'})}
  }catch(error){console.error('acc-diagnostics',String(error));return json(req,{error:'Không thể chẩn đoán lúc này'},500)}
})
