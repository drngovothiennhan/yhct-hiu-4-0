import type { AcademicMedia,AcademicPost,AppointmentTitle,Member,MemberStatus,SystemRole } from '../types';
import { mapMember,supabase } from './authService';
import { cacheGet,cachePut } from './offlineCache';

const FEED_CACHE_KEY='academic-feed-v2-authoritative';
const FEED_CACHE_TTL=10*60*1000;
const asStrings=(v:unknown):string[]=>Array.isArray(v)?v.map(x=>typeof x==='string'?x:JSON.stringify(x)).filter(Boolean):[];
const asObject=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const asMedia=(v:unknown):AcademicMedia[]=>Array.isArray(v)?v.flatMap(x=>{const m=asObject(x),aspect=String(m.aspect||'');if(!m.url||!['16:9','1:1'].includes(aspect))return[];return[{id:String(m.id||crypto.randomUUID()),name:String(m.name||'Ảnh học thuật'),url:String(m.url),aspect:aspect as AcademicMedia['aspect'],width:Number(m.width||0),height:Number(m.height||0)}]}):[];

function mapAcademicRows(data:unknown):AcademicPost[]{
  if(!Array.isArray(data))return [];
  return data.map((row:any)=>{
    const authorRow=asObject(row.author);
    const studentCode=String(authorRow.studentCode||'').trim();
    const avatarValue=String(authorRow.avatarUrl||authorRow.avatar_url||'').trim();
    const author:Member={id:String(authorRow.id||''),studentCode:studentCode||undefined,fullName:String(authorRow.fullName||'Thành viên'),role:String(authorRow.role||'member') as SystemRole,title:String(authorRow.title||'Hội viên') as AppointmentTitle,status:'approved',reputation:Number(authorRow.reputation||0),totalPoints:0,avatarUrl:avatarValue||undefined};
    const f=asObject(row.fourExams);
    return {id:String(row.id),author,title:String(row.title||''),chiefComplaint:String(row.chiefComplaint||''),fourExams:{vong:String(f.vong||''),van:String(f.van||''),vanHoi:String(f.vanHoi||f.van_hoi||''),thiet:String(f.thiet||'')},eightPrinciples:asStrings(row.eightPrinciples),syndrome:String(row.syndrome||''),treatmentPrinciple:String(row.treatmentPrinciple||''),formula:row.formula?String(row.formula):undefined,acupoints:asStrings(row.acupoints),citations:asStrings(row.citations),tags:asStrings(row.tags),createdAt:String(row.createdAt||new Date().toISOString()),approvedAt:row.approvedAt?String(row.approvedAt):undefined,modVerified:Boolean(row.modVerified),citationVerified:Boolean(row.modVerified),moderationStatus:String(row.moderationStatus||'approved') as AcademicPost['moderationStatus'],postType:String(row.postType||'research') as AcademicPost['postType'],specialty:String(row.specialty||'general'),visibility:String(row.visibility||'public') as AcademicPost['visibility'],media:asMedia(row.media),likes:Number(row.likes||0),agrees:0,comments:Number(row.comments||0)};
  });
}

async function fetchFeedSameOrigin(limit:number):Promise<unknown>{
  const response=await fetch(`/api/health?resource=academic-feed&limit=${encodeURIComponent(String(limit))}`,{cache:'no-store',headers:{accept:'application/json'}});
  if(!response.ok)throw new Error(`Feed gateway failed ${response.status}`);
  const payload=await response.json();
  return Array.isArray(payload)?payload:(payload&&Array.isArray(payload.posts)?payload.posts:[]);
}

export async function fetchAcademicFeed(limit=50):Promise<AcademicPost[]>{
  const normalizedLimit=Math.max(1,Math.min(100,Math.trunc(limit)||50));
  const cacheKey=`${FEED_CACHE_KEY}:${normalizedLimit}`;
  let directError:unknown=null;
  try{
    const {data,error}=await supabase.rpc('academic_feed_v1',{p_limit:normalizedLimit});
    if(error)throw error;
    const posts=mapAcademicRows(data);
    void cachePut(cacheKey,posts,FEED_CACHE_TTL);
    return posts;
  }catch(error){directError=error}
  try{
    const posts=mapAcademicRows(await fetchFeedSameOrigin(normalizedLimit));
    void cachePut(cacheKey,posts,FEED_CACHE_TTL);
    return posts;
  }catch(gatewayError){
    const cached=await cacheGet<AcademicPost[]>(cacheKey,{allowStale:false});
    if(cached)return cached;
    const directMessage=directError instanceof Error?directError.message:String(directError||'direct feed unavailable');
    const gatewayMessage=gatewayError instanceof Error?gatewayError.message:String(gatewayError||'gateway unavailable');
    throw new Error(`Không thể đồng bộ bảng tin. Supabase: ${directMessage}; gateway: ${gatewayMessage}`);
  }
}
export async function searchMembersRemote(query:string,limit=12):Promise<Member[]>{const q=query.trim();if(q.length<2)return[];const {data,error}=await supabase.rpc('management_member_search_v1',{p_query:q,p_limit:limit});if(error)throw error;if(!Array.isArray(data))return[];return data.map((row:Record<string,unknown>)=>mapMember(row))}
