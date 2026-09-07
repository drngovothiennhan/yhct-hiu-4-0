import type { AcademicPost,Member } from '../types';
import { supabase } from './authService';

export type PostMedia={url:string;alt?:string;ratio?:'16:9'|'1:1'};
export type PostDraft={title:string;chiefComplaint:string;fourExams:{vong:string;van:string;vanHoi:string;thiet:string};eightPrinciples:string[];syndrome:string;treatmentPrinciple:string;formula?:string;acupoints:string[];tags:string[];citations:string[];postType:'research'|'clinical_case'|'medicinal_diet';specialty:string;visibility:'public'|'members';media?:PostMedia[]};
const citations=(xs:string[])=>xs.map((raw,i)=>{try{const v=JSON.parse(raw);if(v&&typeof v==='object')return v}catch{}const value=raw.trim();const url=/^https?:\/\//i.test(value)?value:undefined;const doi=value.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0];return{id:`manual-${i+1}`,title:value,type:'other',...(url?{url}:{}),...(doi?{doi}: {})}});
const payload=(d:PostDraft)=>({title:d.title,chief_complaint:d.chiefComplaint,four_exams:{vong:d.fourExams.vong,van:d.fourExams.van,van_hoi:d.fourExams.vanHoi,thiet:d.fourExams.thiet},eight_principles:d.eightPrinciples,syndrome:d.syndrome,treatment_principle:d.treatmentPrinciple,formula:d.formula||'',acupoints:d.acupoints,tags:d.tags,citations:citations(d.citations),post_type:d.postType,specialty:d.specialty,visibility:d.visibility,media:d.media||[]});
export const draftFromPost=(p:AcademicPost):PostDraft=>({title:p.title,chiefComplaint:p.chiefComplaint,fourExams:{...p.fourExams},eightPrinciples:[...p.eightPrinciples],syndrome:p.syndrome,treatmentPrinciple:p.treatmentPrinciple,formula:p.formula||'',acupoints:[...(p.acupoints||[])],tags:[...p.tags],citations:[...p.citations],postType:p.postType||'research',specialty:p.specialty||'general',visibility:p.visibility||'public',media:[...(p.media||[])]});

const lastActionAt=new Map<string,number>();
function enforceDebounce(key:string,windowMs:number){const now=Date.now(),last=lastActionAt.get(key)||0;if(now-last<windowMs)throw new Error('Thao tác đang được xử lý. Vui lòng chờ một chút trước khi gửi lại.');lastActionAt.set(key,now)}
function validateCitationList(xs:string[]){if(!xs.some(x=>x.trim().length>=8&&!/^[-_.\s]+$/.test(x)))throw new Error('Nguồn trích dẫn/Tài liệu tham khảo hợp lệ là bắt buộc.');}
const imageExt=(type:string)=>type==='image/png'?'png':type==='image/webp'?'webp':'jpg';
async function uploadAcademicImages(postId:string,files:File[],existing:PostMedia[]=[]){
  if(files.length===0)return existing;
  if(existing.length+files.length>8)throw new Error('Tối đa 8 ảnh cho mỗi bài viết.');
  const {data:userData,error:userError}=await supabase.auth.getUser();if(userError||!userData.user)throw new Error('Phiên đăng nhập không hợp lệ để tải ảnh.');
  const uploaded:string[]=[],media:PostMedia[]=[...existing];
  try{
    for(const file of files){
      if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error(`Ảnh ${file.name} không đúng định dạng JPEG/PNG/WebP.`);
      if(file.size<=0||file.size>5*1024*1024)throw new Error(`Ảnh ${file.name} vượt giới hạn 5 MB.`);
      const path=`${userData.user.id}/${postId}/${crypto.randomUUID()}.${imageExt(file.type)}`;
      const {error}=await supabase.storage.from('academic-media').upload(path,file,{cacheControl:'31536000',contentType:file.type,upsert:false});if(error)throw error;
      uploaded.push(path);const {data}=supabase.storage.from('academic-media').getPublicUrl(path);if(!data.publicUrl)throw new Error('Không tạo được URL ảnh học thuật.');
      media.push({url:data.publicUrl,alt:file.name.replace(/\.[^.]+$/,'').slice(0,240),ratio:/diagram|schema|huyet|acupoint|so_do/i.test(file.name)?'1:1':'16:9'});
    }
    const {data,error}=await supabase.rpc('attach_academic_media_v1',{p_post_id:postId,p_media:media});if(error)throw error;if(data!==true)throw new Error('Không thể gắn ảnh vào bài viết.');
    return media;
  }catch(error){if(uploaded.length)await supabase.storage.from('academic-media').remove(uploaded).catch(()=>{});throw error}
}

export async function createPost(d:PostDraft,files:File[]=[]){validateCitationList(d.citations);enforceDebounce('create-post',1400);const {data,error}=await supabase.rpc('create_academic_post',{p_draft:payload(d),p_academic_score:0});if(error)throw error;const id=String(data);try{await uploadAcademicImages(id,files,d.media||[]);return id}catch(error){await supabase.rpc('delete_academic_post',{p_post_id:id}).catch(()=>{});throw error}}
export async function updatePost(id:string,d:PostDraft,files:File[]=[]){validateCitationList(d.citations);const {data,error}=await supabase.rpc('update_academic_post',{p_post_id:id,p_draft:payload(d),p_academic_score:0});if(error)throw error;if(data!==true)return false;if(files.length)await uploadAcademicImages(id,files,d.media||[]);return true}
export async function deletePost(id:string){const {data,error}=await supabase.rpc('delete_academic_post',{p_post_id:id});if(error)throw error;return Boolean(data)}
export async function toggleFollow(me:Member,authorId:string){if(me.id===authorId)return false;const {data,error}=await supabase.from('member_follows').select('followed_member_id').eq('follower_id',me.id).eq('followed_member_id',authorId).maybeSingle();if(error)throw error;if(data){const r=await supabase.from('member_follows').delete().eq('follower_id',me.id).eq('followed_member_id',authorId);if(r.error)throw r.error;return false}const r=await supabase.from('member_follows').insert({follower_id:me.id,followed_member_id:authorId});if(r.error)throw r.error;return true}
async function savedCollection(me:Member){const found=await supabase.from('bookmark_collections').select('id').eq('member_id',me.id).eq('name','Đã lưu').maybeSingle();if(found.error)throw found.error;if(found.data?.id)return String(found.data.id);const made=await supabase.from('bookmark_collections').insert({member_id:me.id,name:'Đã lưu',description:'Bộ sưu tập mặc định'}).select('id').single();if(made.error)throw made.error;return String(made.data.id)}
export async function toggleBookmark(me:Member,postId:string){const collectionId=await savedCollection(me);const found=await supabase.from('bookmark_items').select('post_id').eq('collection_id',collectionId).eq('post_id',postId).maybeSingle();if(found.error)throw found.error;if(found.data){const r=await supabase.from('bookmark_items').delete().eq('collection_id',collectionId).eq('post_id',postId);if(r.error)throw r.error;return false}const r=await supabase.from('bookmark_items').insert({collection_id:collectionId,post_id:postId,note:''});if(r.error)throw r.error;return true}
export async function repost(me:Member,postId:string,quote:string){const r=await supabase.from('academic_reposts').insert({post_id:postId,member_id:me.id,quote:quote.trim()});if(r.error)throw r.error}
export async function toggleReaction(me:Member,postId:string,kind:'like'|'agree'='like'){const found=await supabase.from('post_reactions').select('kind').eq('post_id',postId).eq('member_id',me.id).eq('kind',kind).maybeSingle();if(found.error)throw found.error;if(found.data){const r=await supabase.from('post_reactions').delete().eq('post_id',postId).eq('member_id',me.id).eq('kind',kind);if(r.error)throw r.error;return false}const r=await supabase.from('post_reactions').insert({post_id:postId,member_id:me.id,kind});if(r.error)throw r.error;return true}
export async function addComment(me:Member,postId:string,body:string){const text=body.trim();if(!text)return;enforceDebounce(`comment:${me.id}:${postId}:${text.toLocaleLowerCase('vi-VN')}`,1600);const r=await supabase.from('comments').insert({post_id:postId,member_id:me.id,body:text});if(r.error)throw r.error}
export async function toggleTopicFollow(me:Member,hashtag:string){const tag=hashtag.replace(/^#/,'').trim();if(!tag)return false;const found=await supabase.from('topic_follows').select('hashtag').eq('member_id',me.id).eq('hashtag',tag).maybeSingle();if(found.error)throw found.error;if(found.data){const r=await supabase.from('topic_follows').delete().eq('member_id',me.id).eq('hashtag',tag);if(r.error)throw r.error;return false}const r=await supabase.from('topic_follows').insert({member_id:me.id,hashtag:tag});if(r.error)throw r.error;return true}
