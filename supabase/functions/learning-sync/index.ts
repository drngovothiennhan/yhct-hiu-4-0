
import { createClient } from 'npm:@supabase/supabase-js@2.102.0'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const publishableKeys=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}')
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
const PUBLIC_KEY=publishableKeys.default||Deno.env.get('SUPABASE_ANON_KEY')!
const SECRET_KEY=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAX_JSON_BYTES=600_000
const explicitOrigins=new Set([
  'https://hiutmc.com',
  'https://www.hiutmc.com',
  'https://yhct-hiu-4-0.vercel.app',
  'https://yhct-hiu-4-0-hiu-yhct.vercel.app',
  'https://yhct-hiu-final4-stage.vercel.app',
  'https://yhct-hiu-final4-stage-hiu-yhct.vercel.app',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:4173'
])
function isAllowedOrigin(origin:string){
  if(explicitOrigins.has(origin))return true
  try{
    const u=new URL(origin)
    if(u.protocol!=='https:'||!u.hostname.endsWith('.vercel.app'))return false
    return u.hostname.startsWith('yhct-hiu-4-0-')||u.hostname.startsWith('yhct-hiu-final4-stage-')
  }catch{return false}
}
function cors(req:Request){
  const origin=req.headers.get('origin')||''
  const allow=isAllowedOrigin(origin)?origin:'https://yhct-hiu-final4-stage-hiu-yhct.vercel.app'
  return{
    'Access-Control-Allow-Origin':allow,
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
    'Access-Control-Max-Age':'86400',
    'Vary':'Origin'
  }
}
function json(req:Request,body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
}
const enc=new TextEncoder()
function toBase64(bytes:Uint8Array){
  let binary=''
  const chunk=0x8000
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,i+chunk))
  return btoa(binary)
}
function fromBase64(value:string){
  const binary=atob(value)
  const bytes=new Uint8Array(binary.length)
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i)
  return bytes
}
function toHex(bytes:Uint8Array){return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function gzip(bytes:Uint8Array){
  const source=new Blob([bytes]).stream()
  const compressed=source.pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(compressed).arrayBuffer())
}
async function memberKey(memberId:string,usage:KeyUsage[]){
  const material=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(`${SECRET_KEY}:learning-sync:v1:${memberId}`)))
  return crypto.subtle.importKey('raw',material,{name:'AES-GCM'},false,usage)
}
async function encryptForMember(memberId:string,plain:Uint8Array){
  const key=await memberKey(memberId,['encrypt'])
  const iv=crypto.getRandomValues(new Uint8Array(12))
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain))
  return{encrypted,iv}
}
async function decryptForMember(memberId:string,ciphertext:Uint8Array,iv:Uint8Array){
  const key=await memberKey(memberId,['decrypt'])
  return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ciphertext))
}
async function gunzip(bytes:Uint8Array){
  const source=new Blob([bytes]).stream()
  const plain=source.pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(plain).arrayBuffer())
}
function boundedInt(value:unknown,min:number,max:number,fallback=0){
  const n=Math.floor(Number(value))
  return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback
}
function optionalScore(value:unknown){
  if(value===undefined||value===null||value==='')return null
  return boundedInt(value,0,100,0)
}
function hcmDay(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get=(type:string)=>parts.find(x=>x.type===type)?.value||''
  return `${get('year')}-${get('month')}-${get('day')}`
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors(req)})
  if(req.method!=='GET'&&req.method!=='POST')return json(req,{error:'Method not allowed'},405)

  try{
    const auth=req.headers.get('authorization')||''
    if(!auth.toLowerCase().startsWith('bearer '))return json(req,{error:'Authentication required'},401)

    const userClient=createClient(SUPABASE_URL,PUBLIC_KEY,{
      global:{headers:{Authorization:auth}},
      auth:{persistSession:false,autoRefreshToken:false}
    })
    const {data:userData,error:userError}=await userClient.auth.getUser()
    if(userError||!userData.user)return json(req,{error:'Invalid or expired session'},401)

    const admin=createClient(SUPABASE_URL,SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
    const appMemberId=String(userData.user.app_metadata?.member_id||'').trim()
    let memberQuery=admin.from('club_members')
      .select('id,status,login_enabled,data_conflict')
      .eq('status','approved')
      .eq('login_enabled',true)
      .eq('data_conflict',false)
    memberQuery=appMemberId?memberQuery.eq('id',appMemberId):memberQuery.eq('auth_user_id',userData.user.id)
    const {data:member,error:memberError}=await memberQuery.limit(1).maybeSingle()
    if(memberError)throw memberError
    if(!member)return json(req,{error:'Approved member required'},403)

    if(req.method==='GET'){
      const {data:stats,error:statsReadError}=await admin.from('learning_sync_stats')
        .select('synced_at,client_active_date,client_streak,client_xp,client_today_questions,client_exam_attempts,client_last_exam_score,client_ai_uses,review_card_count,source_version')
        .eq('member_id',member.id)
        .maybeSingle()
      if(statsReadError)throw statsReadError
      const base={
        ok:true,
        hasSync:Boolean(stats),
        stats:stats?{
          syncedAt:stats.synced_at,
          activeDate:stats.client_active_date,
          streak:stats.client_streak,
          xp:stats.client_xp,
          todayQuestions:stats.client_today_questions,
          examAttempts:stats.client_exam_attempts,
          lastExamScore:stats.client_last_exam_score,
          aiUses:stats.client_ai_uses,
          reviewCardCount:stats.review_card_count,
          sourceVersion:stats.source_version
        }:null
      }
      if(new URL(req.url).searchParams.get('snapshot')!=='1')return json(req,base)
      const {data:stored,error:snapshotReadError}=await admin.from('learning_sync_snapshots')
        .select('payload_ciphertext,iv_base64,checksum_sha256,client_updated_at,updated_at,schema_version,source_version')
        .eq('member_id',member.id)
        .order('updated_at',{ascending:false})
        .limit(1)
        .maybeSingle()
      if(snapshotReadError)throw snapshotReadError
      if(!stored)return json(req,{...base,snapshot:null,snapshotMeta:null})
      const compressed=await decryptForMember(member.id,fromBase64(stored.payload_ciphertext),fromBase64(stored.iv_base64))
      const checksum=toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',compressed)))
      if(checksum!==stored.checksum_sha256)throw new Error('Learning snapshot checksum mismatch')
      const plain=await gunzip(compressed)
      const snapshot=JSON.parse(new TextDecoder().decode(plain))
      return json(req,{
        ...base,
        snapshot,
        snapshotMeta:{
          clientUpdatedAt:stored.client_updated_at,
          updatedAt:stored.updated_at,
          checksum:stored.checksum_sha256,
          schemaVersion:stored.schema_version,
          sourceVersion:stored.source_version
        }
      })
    }

    const body=await req.json().catch(()=>({})) as Record<string,unknown>
    const snapshot=body.snapshot
    if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return json(req,{error:'Invalid learning snapshot'},400)

    const canonical=JSON.stringify(snapshot)
    const raw=enc.encode(canonical)
    if(raw.byteLength>MAX_JSON_BYTES)return json(req,{error:'Learning snapshot exceeds 600 KB'},413)

    const compressed=await gzip(raw)
    const checksum=toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',compressed)))
    const {encrypted,iv}=await encryptForMember(member.id,compressed)

    const journey=(snapshot as Record<string,unknown>).journey
    const j=journey&&typeof journey==='object'&&!Array.isArray(journey)?journey as Record<string,unknown>:{}
    const review=(snapshot as Record<string,unknown>).reviewCards
    const sourceVersion=String(body.sourceVersion||'study-os-web').slice(0,120)
    const clientUpdatedAtRaw=String(body.clientUpdatedAt||j.updatedAt||'')
    const clientUpdatedAt=Number.isNaN(Date.parse(clientUpdatedAtRaw))?null:new Date(clientUpdatedAtRaw).toISOString()

    if(clientUpdatedAt){
      const {data:latest,error:latestError}=await admin.from('learning_sync_snapshots')
        .select('client_updated_at,updated_at,checksum_sha256')
        .eq('member_id',member.id)
        .order('updated_at',{ascending:false})
        .limit(1)
        .maybeSingle()
      if(latestError)throw latestError
      const latestClient=latest?.client_updated_at?Date.parse(latest.client_updated_at):0
      const incomingClient=Date.parse(clientUpdatedAt)
      if(latestClient&&incomingClient<latestClient){
        return json(req,{ok:true,staleIgnored:true,checksum:latest?.checksum_sha256||null,syncedAt:latest?.updated_at||null})
      }
    }

    const snapshotRow={
      member_id:member.id,
      snapshot_day:hcmDay(),
      schema_version:1,
      codec:'gzip+aes-gcm',
      payload_ciphertext:toBase64(encrypted),
      iv_base64:toBase64(iv),
      checksum_sha256:checksum,
      compressed_bytes:compressed.byteLength,
      source_version:sourceVersion,
      client_updated_at:clientUpdatedAt,
      updated_at:new Date().toISOString()
    }
    const {error:snapshotError}=await admin.from('learning_sync_snapshots')
      .upsert(snapshotRow,{onConflict:'member_id,snapshot_day'})
    if(snapshotError)throw snapshotError

    const statsRow={
      member_id:member.id,
      synced_at:new Date().toISOString(),
      client_active_date:/^\d{4}-\d{2}-\d{2}$/.test(String(j.lastActiveDate||''))?String(j.lastActiveDate):null,
      client_streak:boundedInt(j.streak,0,5000),
      client_xp:boundedInt(j.xp,0,100000000),
      client_today_questions:boundedInt(j.todayQuestions,0,100000),
      client_exam_attempts:boundedInt(j.examAttempts,0,1000000),
      client_last_exam_score:optionalScore(j.lastExamScore),
      client_ai_uses:boundedInt(j.aiUses,0,1000000),
      review_card_count:Array.isArray(review)?Math.min(review.length,5000):0,
      snapshot_checksum:checksum,
      source_version:sourceVersion
    }
    const {error:statsError}=await admin.from('learning_sync_stats')
      .upsert(statsRow,{onConflict:'member_id'})
    if(statsError)throw statsError

    const {error:auditError}=await admin.from('system_audit_logs').insert({
      actor_member_id:member.id,
      action:'learning.sync.snapshot',
      entity_type:'learning_sync_snapshots',
      entity_id:`${member.id}:${hcmDay()}`,
      severity:'info',
      metadata:{
        schemaVersion:1,
        codec:'gzip+aes-gcm',
        compressedBytes:compressed.byteLength,
        checksum:checksum.slice(0,16),
        sourceVersion
      }
    })
    if(auditError)console.error('learning-sync audit',auditError)

    return json(req,{
      ok:true,
      schemaVersion:1,
      codec:'gzip+aes-gcm',
      checksum,
      compressedBytes:compressed.byteLength,
      syncedAt:new Date().toISOString()
    })
  }catch(error){
    console.error('learning-sync',error)
    return json(req,{error:'Không thể đồng bộ dữ liệu học tập lúc này'},500)
  }
})
