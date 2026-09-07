import type { Member } from '../types';
import { mapMember,SUPABASE_PUBLISHABLE_KEY,SUPABASE_URL,supabase } from './authService';

const withTimeout=<T>(promise:PromiseLike<T>,ms:number)=>new Promise<T>((resolve,reject)=>{const timer=window.setTimeout(()=>reject(new Error('timeout')),ms);Promise.resolve(promise).then(value=>{window.clearTimeout(timer);resolve(value)},error=>{window.clearTimeout(timer);reject(error)})});

export async function loginOptimized(studentCode:string,password:string):Promise<Member>{
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(`${SUPABASE_URL}/functions/v1/member-login`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({studentCode:studentCode.trim(),password}),signal:controller.signal});
    const body=await response.json().catch(()=>({})) as Record<string,unknown>;
    if(!response.ok)throw new Error(String(body.error||'Đăng nhập không thành công'));
    const sessionResult=await withTimeout(supabase.auth.setSession({access_token:String(body.access_token||''),refresh_token:String(body.refresh_token||'')}),3500) as {error?:Error|null};
    if(sessionResult.error)throw sessionResult.error;
    return mapMember((body.member||{}) as Record<string,unknown>);
  }catch(error){
    if((error as Error).name==='AbortError'||(error as Error).message==='timeout')throw new Error('Máy chủ xác thực chưa phản hồi trong 8 giây. Vui lòng thử lại.');
    throw error;
  }finally{window.clearTimeout(timer)}
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
