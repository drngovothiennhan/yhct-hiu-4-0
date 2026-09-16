import type { Member } from '../types';
import { mapMember,persistMemberSession,SUPABASE_PUBLISHABLE_KEY,SUPABASE_URL,supabase } from './authService';

const withTimeout=<T>(promise:PromiseLike<T>,ms:number)=>new Promise<T>((resolve,reject)=>{const timer=window.setTimeout(()=>reject(new Error('timeout')),ms);Promise.resolve(promise).then(value=>{window.clearTimeout(timer);resolve(value)},error=>{window.clearTimeout(timer);reject(error)})});
const sleep=(ms:number)=>new Promise(resolve=>window.setTimeout(resolve,ms));
const isRetryableNetworkError=(error:unknown)=>{const name=String((error as {name?:unknown})?.name||'');const message=String((error as {message?:unknown})?.message||error||'').toLowerCase();return name==='AbortError'||message==='timeout'||message.includes('failed to fetch')||message.includes('network')||message.includes('load failed')||message.includes('fetch')};

export type SelfRegistrationInput={studentCode:string;fullName:string;className:string;faculty:string;email:string;password:string};
export type SelfRegistrationResult={ok:boolean;studentCode:string;awaitingEmail:boolean;driveSync?:{configured:boolean;synced:boolean;reason?:string|null}};

async function fetchMemberLogin(studentCode:string,password:string){
  let lastError:unknown=null;
  for(let attempt=0;attempt<2;attempt++){
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),8000);
    try{
      return await fetch(`${SUPABASE_URL}/functions/v1/member-login`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({studentCode:studentCode.trim(),password}),signal:controller.signal,cache:'no-store'});
    }catch(error){
      lastError=error;
      if(attempt===1||!isRetryableNetworkError(error))throw error;
      await sleep(350);
    }finally{window.clearTimeout(timer)}
  }
  throw lastError instanceof Error?lastError:new Error('Không thể kết nối máy chủ xác thực');
}

async function setSessionResilient(accessToken:string,refreshToken:string){
  let lastError:unknown=null;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const result=await withTimeout(supabase.auth.setSession({access_token:accessToken,refresh_token:refreshToken}),attempt===0?3500:5000) as {error?:Error|null};
      if(!result.error)return;
      lastError=result.error;
      if(attempt===1||!isRetryableNetworkError(result.error))throw result.error;
    }catch(error){
      lastError=error;
      if(attempt===1||!isRetryableNetworkError(error))throw error;
    }
    await sleep(300);
  }
  throw lastError instanceof Error?lastError:new Error('Không thể thiết lập phiên đăng nhập');
}

export async function loginOptimized(studentCode:string,password:string):Promise<Member>{
  try{
    const response=await fetchMemberLogin(studentCode,password);
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    if(!response.ok)throw new Error(String(body.error||'Đăng nhập không thành công'));
    await setSessionResilient(String(body.access_token||''),String(body.refresh_token||''));
    const member=mapMember((body.member||{}) as Record<string,unknown>);
    persistMemberSession(member);
    return member;
  }catch(error){
    const message=String((error as Error)?.message||error||'');
    if((error as Error)?.name==='AbortError'||message==='timeout')throw new Error('Máy chủ xác thực chưa phản hồi. Vui lòng thử lại.');
    if(isRetryableNetworkError(error))throw new Error('Không kết nối được máy chủ xác thực. Vui lòng kiểm tra mạng và thử lại.');
    throw error;
  }
}

export async function registerMemberSelf(input:SelfRegistrationInput):Promise<SelfRegistrationResult>{
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(`${SUPABASE_URL}/functions/v1/member-register`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({studentCode:input.studentCode.trim(),fullName:input.fullName.trim(),className:input.className.trim(),faculty:input.faculty.trim(),email:input.email.trim(),password:input.password}),signal:controller.signal});
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    if(!response.ok)throw new Error(String(body.error||'Không thể đăng ký thành viên'));
    return body as unknown as SelfRegistrationResult;
  }catch(error){
    if((error as Error).name==='AbortError')throw new Error('Yêu cầu đăng ký quá thời gian chờ. Vui lòng thử lại.');
    throw error;
  }finally{window.clearTimeout(timer)}
}

export async function resendMemberActivation(email:string):Promise<void>{
  const redirectTo=`${window.location.origin}/?member_activation=done`;
  const {error}=await supabase.auth.resend({type:'signup',email:email.trim().toLowerCase(),options:{emailRedirectTo:redirectTo}});
  if(error)throw new Error('Không thể gửi lại email kích hoạt lúc này.');
}

export async function changeMemberPassword(currentPassword:string,newPassword:string):Promise<void>{
  const {data:{session},error}=await supabase.auth.getSession();
  if(error||!session?.access_token)throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(`${SUPABASE_URL}/functions/v1/member-change-password`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({currentPassword,newPassword}),signal:controller.signal});
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    if(!response.ok)throw new Error(String(body.error||'Không thể đổi mật khẩu'));
  }catch(error){
    if((error as Error).name==='AbortError')throw new Error('Yêu cầu đổi mật khẩu quá thời gian chờ. Vui lòng thử lại.');
    throw error;
  }finally{window.clearTimeout(timer)}
}
