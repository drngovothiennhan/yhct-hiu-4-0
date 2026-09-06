import type { AppointmentTitle,Member,MemberStatus,SystemRole } from '../types';
import { mapMember,supabase } from './authService';
export async function appointMember(id:string,title:AppointmentTitle,role:SystemRole,status:MemberStatus,loginEnabled:boolean):Promise<Member>{const {data,error}=await supabase.rpc('admin_appoint_member_v1',{p_id:id,p_position_title:title,p_role:role,p_status:status,p_login_enabled:loginEnabled});if(error)throw error;return mapMember(data as Record<string,unknown>)}
