import { createClient } from '@supabase/supabase-js';
import type { AppointmentTitle,Member,MemberStatus,SystemRole } from '../types';

const env=import.meta.env as Record<string,string|undefined>;
const url=(env.VITE_SUPABASE_URL||'https://gzmpnsrwqjpsbklyflqr.supabase.co').trim();
const anon=(env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG').trim();
export const SUPABASE_URL=url;
export const SUPABASE_PUBLISHABLE_KEY=anon;
export const supabase=createClient(url,anon,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

const ref=(()=>{try{return new URL(url).hostname.split('.')[0]}catch{return ''}})();
const authKey=`sb-${ref}-auth-token`;
const memberCacheKey='yhct-member-session-cache-v2';
const timeout=<T>(p:PromiseLike<T>,ms:number)=>new Promise<T>((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('timeout')),ms);Promise.resolve(p).then(v=>{clearTimeout(t);resolve(v)},e=>{clearTimeout(t);reject(e)})});
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export function mapMember(row:Record<string,unknown>):Member{
  const title=(String(row.position_title||row.title||'Hội viên')) as AppointmentTitle;
  const role=(String(row.role||'member')) as SystemRole;
  const status=(String(row.status||'approved')) as MemberStatus;
  return {
    id:String(row.id||''),studentCode:String(row.student_code||row.studentCode||'')||undefined,
    fullName:String(row.full_name||row.fullName||'Thành viên'),email:String(row.email||'')||undefined,
    phone:String(row.phone||'')||undefined,role,title,status,
    reputation:Number(row.academic_reputation_multiplier||row.reputation||1)*20,
    totalPoints:Number(row.total_points||row.totalPoints||0),avatarUrl:String(row.avatar_url||row.avatarUrl||'')||undefined,
    herbalAlias:String(row.herbal_alias||row.herbalAlias||'')||undefined,wallTheme:String(row.wall_theme||row.wallTheme||'')||undefined,
    wallMotto:String(row.wall_motto||row.wallMotto||'')||undefined,departmentSlug:String(row.department_slug||'')||undefined,
    elementRank:String(row.element_rank||'')||undefined,loginEnabled:row.login_enabled===undefined?true:Boolean(row.login_enabled),
    dataConflict:Boolean(row.data_conflict)
  };
}

export async function loginFast(studentCode:string,password:string):Promise<Member>{
  const c=new AbortController();
  const t=setTimeout(()=>c.abort(),3500);
  try{
    const r=await fetch(`${url}/functions/v1/member-login`,{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({studentCode:studentCode.trim(),password}),signal:c.signal});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body.error||'Đăng nhập không thành công');
    const set=await timeout(supabase.auth.setSession({access_token:body.access_token,refresh_token:body.refresh_token}),1800) as {error?:Error|null};
    if(set.error)throw set.error;
    const member=mapMember(body.member||{});
    persistMemberSession(member);
    return member;
  }catch(e){
    if((e as Error).name==='AbortError'||(e as Error).message==='timeout')throw new Error('Máy chủ phản hồi chậm. Hãy thử lại ngay.');
    throw e;
  }finally{clearTimeout(t)}
}

function readCachedSession(){
  try{
    const raw=localStorage.getItem(authKey);
    const cached=raw?JSON.parse(raw):null;
    return cached?.access_token&&cached?.user?cached:null;
  }catch{return null}
}

export function hasCachedAuthSession(){return Boolean(readCachedSession())}

export function readCachedMember():Member|null{
  if(!readCachedSession())return null;
  try{
    const raw=localStorage.getItem(memberCacheKey);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as Member;
    if(!parsed?.id||!parsed?.fullName)return null;
    return parsed;
  }catch{return null}
}

export function persistMemberSession(member:Member|null){
  try{
    if(member)localStorage.setItem(memberCacheKey,JSON.stringify(member));
    else localStorage.removeItem(memberCacheKey);
  }catch{}
}

async function readSessionResilient(){
  let lastError:unknown=null;
  for(const [attempt,ms] of [3500,7000].entries()){
    try{
      const result=await timeout(supabase.auth.getSession(),ms) as any;
      if(result.error)throw result.error;
      if(result.data.session)return result.data.session;
      const cached=readCachedSession();
      if(!cached)return null;
      try{
        const refreshed=await timeout(supabase.auth.refreshSession(),7000) as any;
        if(refreshed.error)throw refreshed.error;
        if(refreshed.data.session)return refreshed.data.session;
      }catch(error){lastError=error}
      return cached;
    }catch(error){
      lastError=error;
      if(attempt===0)await sleep(300);
    }
  }
  const cached=readCachedSession();
  if(cached)return cached;
  if(lastError)throw lastError;
  return null;
}

async function fetchMemberRow(accessToken:string,field:'id'|'auth_user_id',value:string){
  const select='id,auth_user_id,full_name,avatar_url,herbal_alias,wall_theme,wall_motto,department_slug,role,status,element_rank,position_title,login_enabled,data_conflict,academic_reputation_multiplier';
  const endpoint=new URL(`${url}/rest/v1/club_members`);
  endpoint.searchParams.set('select',select);
  endpoint.searchParams.set(field,`eq.${value}`);
  endpoint.searchParams.set('limit','1');
  const response=await timeout(fetch(endpoint.toString(),{headers:{apikey:anon,Authorization:`Bearer ${accessToken}`}}),6000);
  if(!response.ok)throw new Error(`member restore HTTP ${response.status}`);
  const rows=await response.json() as Record<string,unknown>[];
  return rows[0]||null;
}

async function loadMemberRowFromSession(session:any){
  const memberId=String(session.user?.app_metadata?.member_id||'');
  const authUserId=String(session.user?.id||'');
  const accessToken=String(session.access_token||'');
  if(!accessToken||!authUserId)return null;
  let row=memberId?await fetchMemberRow(accessToken,'id',memberId):await fetchMemberRow(accessToken,'auth_user_id',authUserId);
  if(!row&&memberId)row=await fetchMemberRow(accessToken,'auth_user_id',authUserId);
  if(!row)return null;
  return mapMember({...row,student_code:session.user?.user_metadata?.student_code});
}

async function loadMemberFromSession(session:any){
  try{return await loadMemberRowFromSession(session)}
  catch(error){
    if(!String((error as Error)?.message||error).includes('member restore HTTP 401'))throw error;
    const refreshed=await timeout(supabase.auth.refreshSession(),7000) as any;
    if(refreshed.error)throw refreshed.error;
    if(!refreshed.data.session)throw error;
    return loadMemberRowFromSession(refreshed.data.session);
  }
}

export async function restoreMember():Promise<Member|null>{
  const cachedMember=readCachedMember();
  try{
    const session=await readSessionResilient();
    if(!session){persistMemberSession(null);return null}
    try{
      const member=await loadMemberFromSession(session);
      if(member){persistMemberSession(member);return member}
      persistMemberSession(null);
      return null;
    }catch(error){
      if(cachedMember){console.warn('restoreMember using cached member while session refresh is transient',error);return cachedMember}
      throw error;
    }
  }catch(error){
    if(cachedMember&&hasCachedAuthSession()){
      console.warn('restoreMember preserved cached member after bounded retries',error);
      return cachedMember;
    }
    console.warn('restoreMember failed after bounded retries',error);
    return null;
  }
}

export function logoutFast(){
  let token='';
  try{const raw=localStorage.getItem(authKey);token=raw?JSON.parse(raw)?.access_token||'':''}catch{}
  try{localStorage.removeItem(authKey);sessionStorage.removeItem(authKey);localStorage.removeItem(memberCacheKey)}catch{}
  if(token)void fetch(`${url}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${token}`},keepalive:true}).catch(()=>{});
}
