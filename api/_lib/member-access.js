const SUPABASE_URL=(process.env.VITE_SUPABASE_URL||'https://gzmpnsrwqjpsbklyflqr.supabase.co').trim();
const PUBLISHABLE_KEY=(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG').trim();
const ROLE_LEVEL={guest:0,member:1,mod:2,super_mod:3,leader:4,admin:5};

export const DEFAULT_OPENAI_MODEL='gpt-5.6-luna';
export const cloudAiEnabled=()=>process.env.ENABLE_CLOUD_AI==='true';
export const cloudAiModel=()=>String(process.env.OPENAI_MODEL||DEFAULT_OPENAI_MODEL).trim();
export const cloudAiConfigured=()=>Boolean(cloudAiEnabled()&&process.env.OPENAI_API_KEY&&cloudAiModel());
export const roleAtLeast=(role,minRole='member')=>(ROLE_LEVEL[String(role||'guest')]??0)>=(ROLE_LEVEL[String(minRole||'member')]??1);

const bearer=req=>String(req.headers?.authorization||'');

export async function memberRpc(req,rpcName,args={}){
  const auth=bearer(req),name=String(rpcName||'');
  if(!auth.startsWith('Bearer ')||auth.length<32)throw new Error('Authentication required');
  if(!/^[a-z0-9_]+$/i.test(name))throw new Error('Invalid RPC name');
  if(!SUPABASE_URL||!PUBLISHABLE_KEY)throw new Error('Supabase public configuration missing');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,authorization:auth,'content-type':'application/json'},body:JSON.stringify(args&&typeof args==='object'?args:{}),signal:controller.signal});
    if(!r.ok){const text=await r.text().catch(()=>String(r.status));throw new Error(`Member RPC ${name} failed ${r.status}: ${text.slice(0,180)}`)}
    return await r.json();
  }finally{clearTimeout(timer)}
}

export async function memberAccess(req,minRole='member'){
  const auth=bearer(req);
  if(!auth.startsWith('Bearer ')||auth.length<32)return{ok:false,status:401,error:'Authentication required'};
  try{
    const data=await memberRpc(req,'current_member_access_v1',{});
    const approved=Boolean(data?.approved),role=String(data?.role||'guest');
    if(!approved||!roleAtLeast(role,minRole))return{ok:false,status:403,error:'Insufficient role'};
    return{ok:true,status:200,memberId:String(data.memberId||''),role};
  }catch(error){
    const message=String(error?.message||'');
    if(message.includes('Authentication required'))return{ok:false,status:401,error:'Authentication required'};
    return{ok:false,status:503,error:'Authorization service unavailable'};
  }
}
