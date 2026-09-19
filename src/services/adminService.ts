import type { AppointmentTitle,Member,MemberStatus,SystemRole } from '../types';
import { SUPABASE_PUBLISHABLE_KEY,SUPABASE_URL,mapMember,supabase } from './authService';

export type AdminPasswordResetResult={username:string;memberId:string;provisioned:boolean;mustChangePassword:boolean;resetToDefault:boolean};

export async function appointMember(id:string,title:AppointmentTitle,role:SystemRole,status:MemberStatus,loginEnabled:boolean):Promise<Member>{const {data,error}=await supabase.rpc('admin_appoint_member_v1',{p_id:id,p_position_title:title,p_role:role,p_status:status,p_login_enabled:loginEnabled});if(error)throw error;return mapMember(data as Record<string,unknown>)}

export async function resetMemberPasswordByAdmin(memberId:string):Promise<AdminPasswordResetResult>{
  if(!memberId)throw new Error('Thiếu thành viên cần reset mật khẩu.');
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw new Error('Phiên Admin đã hết hạn. Vui lòng đăng nhập lại.');
  const response=await fetch(SUPABASE_URL+'/functions/v1/admin-reset-member-password',{
    method:'POST',
    headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({memberId}),
    cache:'no-store'
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String(body.error||'Không thể reset mật khẩu về mặc định lúc này.'));
  const username=String(body.username||'');
  if(!body.ok||!username||body.resetToDefault!==true||body.mustChangePassword!==true)throw new Error('Máy chủ trả về trạng thái reset mật khẩu không hợp lệ.');
  return{username,memberId:String(body.memberId||memberId),provisioned:Boolean(body.provisioned),mustChangePassword:true,resetToDefault:true};
}
