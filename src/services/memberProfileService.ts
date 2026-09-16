import type {Member} from '../types';
import {mapMember,persistMemberSession,supabase} from './authService';

export type AssistantMemberProfile=Member&{
  faculty?:string;
  className?:string;
  organizationalUnit?:string;
};

const MEMBER_SELECT='id,auth_user_id,student_code,full_name,email,phone,avatar_url,herbal_alias,wall_theme,wall_motto,department_slug,role,status,element_rank,position_title,login_enabled,data_conflict,academic_reputation_multiplier,faculty,class_name,organizational_unit';
const text=(value:unknown)=>String(value??'').trim()||undefined;

/**
 * Refresh the signed-in member from the canonical club_members row before
 * showing personal assistant data. The existing member is only a resilient
 * fallback for transient network/auth failures; it is never used to choose a
 * different member row.
 */
export async function refreshCurrentMemberForAssistant(fallback:Member):Promise<AssistantMemberProfile>{
  try{
    const {data:{user},error:userError}=await supabase.auth.getUser();
    if(userError||!user)return fallback;
    const memberId=String(user.app_metadata?.member_id||'').trim();
    const base=supabase.from('club_members').select(MEMBER_SELECT);
    const request=memberId?base.eq('id',memberId):base.eq('auth_user_id',user.id);
    const {data,error}=await request.limit(1).maybeSingle();
    if(error||!data)return fallback;
    const mapped=mapMember(data as Record<string,unknown>);
    if(!mapped.id)return fallback;
    const current:AssistantMemberProfile={
      ...mapped,
      faculty:text((data as Record<string,unknown>).faculty),
      className:text((data as Record<string,unknown>).class_name),
      organizationalUnit:text((data as Record<string,unknown>).organizational_unit)
    };
    persistMemberSession(current);
    return current;
  }catch{
    return fallback;
  }
}
