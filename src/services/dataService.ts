import type { AcademicPost,AppointmentTitle,Member,MemberStatus,SystemRole } from '../types';
import { mapMember,supabase } from './authService';

const asStrings=(v:unknown):string[]=>Array.isArray(v)?v.map(x=>typeof x==='string'?x:JSON.stringify(x)).filter(Boolean):[];
const asObject=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

export async function fetchAcademicFeed(limit=50):Promise<AcademicPost[]>{
  const {data,error}=await supabase.rpc('academic_feed_v1',{p_limit:limit});
  if(error)throw error;
  if(!Array.isArray(data))return [];
  return data.map((row:any)=>{
    const authorRow=asObject(row.author);
    const author:Member={
      id:String(authorRow.id||''),fullName:String(authorRow.fullName||'Thành viên'),
      role:String(authorRow.role||'member') as SystemRole,
      title:String(authorRow.title||'Hội viên') as AppointmentTitle,
      status:'approved',reputation:Number(authorRow.reputation||0),totalPoints:0
    };
    const f=asObject(row.fourExams);
    return {
      id:String(row.id),author,title:String(row.title||''),chiefComplaint:String(row.chiefComplaint||''),
      fourExams:{vong:String(f.vong||''),van:String(f.van||''),vanHoi:String(f.vanHoi||f.van_hoi||''),thiet:String(f.thiet||'')},
      eightPrinciples:asStrings(row.eightPrinciples),syndrome:String(row.syndrome||''),
      treatmentPrinciple:String(row.treatmentPrinciple||''),formula:row.formula?String(row.formula):undefined,
      acupoints:asStrings(row.acupoints),citations:asStrings(row.citations),tags:asStrings(row.tags),
      createdAt:String(row.createdAt||new Date().toISOString()),modVerified:Boolean(row.modVerified),
      likes:Number(row.likes||0),agrees:0,comments:Number(row.comments||0)
    } as AcademicPost;
  });
}

export async function searchMembersRemote(query:string,limit=12):Promise<Member[]>{
  const q=query.trim(); if(q.length<2)return [];
  const {data,error}=await supabase.rpc('management_member_search_v1',{p_query:q,p_limit:limit});
  if(error)throw error;
  if(!Array.isArray(data))return [];
  return data.map((row:Record<string,unknown>)=>mapMember(row));
}
