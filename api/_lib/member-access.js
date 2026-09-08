const SUPABASE_URL=(process.env.VITE_SUPABASE_URL||'https://gzmpnsrwqjpsbklyflqr.supabase.co').trim();
const PUBLISHABLE_KEY=(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG').trim();
const ROLE_LEVEL={guest:0,member:1,mod:2,super_mod:3,leader:4,admin:5};

export const DEFAULT_OPENAI_MODEL='gpt-5.6-luna';
export const cloudAiEnabled=()=>process.env.ENABLE_CLOUD_AI==='true';
export const cloudAiModel=()=>String(process.env.OPENAI_MODEL||DEFAULT_OPENAI_MODEL).trim();
export const cloudAiConfigured=()=>Boolean(cloudAiEnabled()&&process.env.OPENAI_API_KEY&&cloudAiModel());

export async function memberAccess(req,minRole='member'){
  const auth=String(req.headers?.authorization||'');
  if(!auth.startsWith('Bearer ')||auth.length<32)return{ok:false,status:401,error:'Authentication required'};
  if(!SUPABASE_URL||!PUBLISHABLE_KEY)return{ok:false,status:503,error:'Supabase public configuration missing'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/current_member_access_v1`,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,authorization:auth,'content-type':'application/json'},body:'{}',signal:controller.signal});
    if(!r.ok)return{ok:false,status:r.status===401?401:403,error:'Member authorization failed'};
    const data=await r.json();
    const approved=Boolean(data?.approved),role=String(data?.role||'guest');
    if(!approved||(ROLE_LEVEL[role]??0)<(ROLE_LEVEL[minRole]??1))return{ok:false,status:403,error:'Insufficient role'};
    return{ok:true,status:200,memberId:String(data.memberId||''),role};
  }catch{return{ok:false,status:503,error:'Authorization service unavailable'}}finally{clearTimeout(timer)}
}
