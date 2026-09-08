import { createClient } from 'npm:@supabase/supabase-js@2.102.0'

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}')
const SERVICE_KEY=secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const TRUSTED_PUBLISHERS=['Bộ Y tế','Sức khỏe & Đời sống','VOV','Thông tấn xã Việt Nam','VietnamPlus','Nhân Dân','Tuổi Trẻ','Thanh Niên','VnExpress']
const KEYWORDS=['y học cổ truyền','dược liệu','đông y','châm cứu','thảo dược','y học truyền thống']
const MAX_XML_BYTES=2_000_000
function decodeXml(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")}
function stripHtml(s:string){return decodeXml(s).replace(/<[^>]+>/g,' ').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()}
function tag(xml:string,name:string){const m=xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));return m?decodeXml(m[1]).trim():''}
async function sha256(s:string){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('')}
function publisherFromTitle(title:string){const parts=title.split(' - ');return parts.length>1?parts.at(-1)!.trim():''}
function tagsFor(text:string){const n=text.toLowerCase();return KEYWORDS.filter(k=>n.includes(k)).slice(0,5)}
function scorePublisher(name:string,base:number){const trusted=TRUSTED_PUBLISHERS.some(x=>name.toLowerCase().includes(x.toLowerCase()));return Math.min(1,Math.max(0,base+(trusted?0.28:0)))}
async function fetchFeed(url:string){const u=new URL(url);if(u.protocol!=='https:')throw new Error('feed must use https');const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);try{const r=await fetch(u,{signal:c.signal,headers:{'user-agent':'YHCT-HIU-4.0-NewsBot/3.0 (+academic aggregator)'}});if(!r.ok)throw new Error(`rss ${r.status}`);const len=Number(r.headers.get('content-length')||0);if(len>MAX_XML_BYTES)throw new Error('feed too large');const xml=await r.text();if(new TextEncoder().encode(xml).byteLength>MAX_XML_BYTES)throw new Error('feed too large');return xml}finally{clearTimeout(t)}}
Deno.serve(async(req:Request)=>{
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
  if(req.method==='GET')return new Response(JSON.stringify({ok:true,trigger:'POST',pipeline:'auto-approved-news-only',postAuth:'internal-secret'}),{headers})
  if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers})
  const ingressKey=(req.headers.get('x-yhct-ingest-key')||'').trim()
  if(!ingressKey||ingressKey.length>256)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers})
  const gate=await admin.rpc('tcm_news_validate_ingest_secret_v1',{p_secret:ingressKey})
  if(gate.error||gate.data!==true)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers})
  const slot=await admin.rpc('tcm_news_acquire_ingest_slot_v1',{p_interval_seconds:1800})
  if(slot.error)return new Response(JSON.stringify({error:'rate_gate_failed'}),{status:500,headers})
  if(slot.data!==true)return new Response(JSON.stringify({ok:true,skipped:'rate_limited'}),{headers})
  const {data:sources,error:sourceError}=await admin.from('tcm_news_sources').select('id,name,feed_url,trust_weight').eq('active',true)
  if(sourceError)return new Response(JSON.stringify({error:'source_query_failed'}),{status:500,headers})
  let fetched=0,inserted=0,updated=0,failed=0
  for(const source of (sources||[]).slice(0,20)){
    try{
      const xml=await fetchFeed(String(source.feed_url||''));fetched++
      let itemCount=0
      for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
        if(++itemCount>120)break
        const item=m[1],rawTitle=stripHtml(tag(item,'title')).slice(0,500),link=stripHtml(tag(item,'link')).slice(0,2000);if(!rawTitle||!link)continue
        let parsedLink:URL;try{parsedLink=new URL(link);if(!['https:','http:'].includes(parsedLink.protocol))continue}catch{continue}
        const description=stripHtml(tag(item,'description')).slice(0,3000),pub=publisherFromTitle(rawTitle).slice(0,180),title=(pub?rawTitle.replace(new RegExp(`\\s+-\\s+${pub.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`),'').trim():rawTitle).slice(0,500)
        const combined=`${title} ${description}`,tags=tagsFor(combined);if(tags.length===0)continue
        const publishedRaw=stripHtml(tag(item,'pubDate')).slice(0,120),publishedAt=Number.isNaN(Date.parse(publishedRaw))?null:new Date(publishedRaw).toISOString(),trust=scorePublisher(pub,Number(source.trust_weight||0.5)),contentHash=await sha256(`${title.toLowerCase()}|${pub.toLowerCase()}|${publishedAt||''}`),domain=parsedLink.hostname.slice(0,253),summary=(description||title).slice(0,600)
        const {data:existing}=await admin.from('tcm_news_items').select('id').eq('canonical_url',link).maybeSingle()
        const payload={source_id:source.id,title,canonical_url:link,publisher:pub,publisher_domain:domain,published_at:publishedAt,raw_excerpt:description.slice(0,1500),summary,tags,language:'vi',trust_score:trust,status:'published',content_hash:contentHash,ai_provider:'local',updated_at:new Date().toISOString()}
        const {error}=await admin.from('tcm_news_items').upsert(payload,{onConflict:'canonical_url'});if(error)failed++;else if(existing)updated++;else inserted++
      }
    }catch(e){failed++;console.error('tcm-news-ingest',String(source.name||'source').slice(0,120),String(e).slice(0,500))}
  }
  return new Response(JSON.stringify({ok:true,fetched,inserted,updated,failed,serverTime:new Date().toISOString()}),{headers})
})
