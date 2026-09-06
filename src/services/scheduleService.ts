import type { ActivitySchedule, ScheduleDraft } from '../types';
import { supabase } from './authService';
const KEY='yhct_schedule_cache_v1';
const map=(r:any):ActivitySchedule=>({id:String(r.id),kind:r.kind,title:r.title,startsAt:r.starts_at||r.startsAt,endsAt:r.ends_at||r.endsAt,location:r.location||'',visibility:r.visibility||'members',status:r.status||'scheduled',notes:r.notes||'',createdBy:r.created_by,createdAt:r.created_at,updatedAt:r.updated_at,assigneeIds:r.assignee_ids||r.assigneeIds||[],pendingSync:Boolean(r.pendingSync)});
const save=(items:ActivitySchedule[])=>{try{localStorage.setItem(KEY,JSON.stringify(items))}catch{}};
export const loadCachedSchedules=():ActivitySchedule[]=>{try{return (JSON.parse(localStorage.getItem(KEY)||'[]') as any[]).map(map)}catch{return []}};
export async function fetchSchedules(){try{const {data,error}=await supabase.rpc('schedule_feed_v1');if(error)throw error;const items=(data||[]).map(map);save(items);return items}catch{return loadCachedSchedules()}}
export async function upsertSchedule(d:ScheduleDraft){const payload={p_id:d.id||null,p_kind:d.kind,p_title:d.title,p_starts_at:new Date(d.startsAt).toISOString(),p_ends_at:new Date(d.endsAt).toISOString(),p_location:d.location,p_visibility:d.visibility,p_notes:d.notes,p_assignee_ids:d.assigneeIds};const {data,error}=await supabase.rpc('schedule_upsert_v1',payload);if(error)throw error;return String(data)}
export async function cancelSchedule(id:string){const {data,error}=await supabase.rpc('schedule_cancel_v1',{p_id:id});if(error)throw error;return Boolean(data)}
