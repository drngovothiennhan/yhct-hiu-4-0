import type {Member} from '../types';
import {mapMember,persistMemberSession,supabase} from './authService';

export type AssistantMemberProfile=Member&{
  faculty?:string;
  className?:string;
  organizationalUnit?:string;
};

const MEMBER_SELECT='id,auth_user_id,student_code,full_name,email,phone,avatar_url,herbal_alias,wall_theme,wall_motto,department_slug,role,status,element_rank,position_title,login_enabled,data_conflict,academic_reputation_multiplier,faculty,class_name,organizational_unit';
const text=(value:unknown)=>String(value??'').trim()||undefined;
const normalizedCode=(value:unknown)=>String(value??'').trim().replace(/\s+/g,'').toUpperCase();

function fallbackMatchesAuth(fallback:Member,user:any){
  const memberId=String(user?.app_metadata?.member_id||'').trim();
  const studentCode=normalizedCode(user?.user_metadata?.student_code);
  if(memberId&&fallback.id!==memberId)return false;
  if(studentCode&&normalizedCode(fallback.studentCode)!==studentCode)return false;
  return Boolean(memberId||studentCode);
}

/**
 * Refresh the signed-in member from the canonical club_members row before
 * showing personal assistant data. Cached member data is only accepted when
 * it matches the authenticated member_id / MSSV of the active Supabase session.
 */
export async function refreshCurrentMemberForAssistant(fallback:Member):Promise<AssistantMemberProfile|null>{
  try{
    const {data:{session},error:sessionError}=await supabase.auth.getSession();
    if(sessionError||!session?.user)return null;
    const user=session.user;
    const memberId=String(user.app_metadata?.member_id||'').trim();
    const base=supabase.from('club_members').select(MEMBER_SELECT);
    const request=memberId?base.eq('id',memberId):base.eq('auth_user_id',user.id);
    const {data,error}=await request.limit(1).maybeSingle();
    if(error||!data)return fallbackMatchesAuth(fallback,user)?fallback:null;
    const mapped=mapMember(data as Record<string,unknown>);
    if(!mapped.id)return fallbackMatchesAuth(fallback,user)?fallback:null;
    const current:AssistantMemberProfile={
      ...mapped,
      faculty:text((data as Record<string,unknown>).faculty),
      className:text((data as Record<string,unknown>).class_name),
      organizationalUnit:text((data as Record<string,unknown>).organizational_unit)
    };
    persistMemberSession(current);
    return current;
  }catch{
    try{
      const {data:{session}}=await supabase.auth.getSession();
      return session?.user&&fallbackMatchesAuth(fallback,session.user)?fallback:null;
    }catch{
      return null;
    }
  }
}
