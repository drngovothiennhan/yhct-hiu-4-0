import {supabase} from './authService';

export type LearningResource={
  resourceKey:string;
  title:string;
  resourceType:'document'|'quiz_source'|'reference';
  status:string;
  audience:string;
  mimeType:string|null;
  publishedAt:string|null;
  updatedAt:string|null;
};

type ResourceResponse={ok?:boolean;resources?:LearningResource[];resource?:LearningResource;error?:string};
const RESOURCE_KEY=/^hiu_res_[0-9a-f]{20}$/;

async function bearer(){
  const {data}=await supabase.auth.getSession();
  const token=data.session?.access_token;
  if(!token)throw new Error('AUTH_REQUIRED');
  return token;
}
async function request(url:string){
  const token=await bearer();
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},cache:'no-store'});
  const body=await response.json().catch(()=>({})) as ResourceResponse;
  if(!response.ok)throw new Error(body.error||`Không tải được thư viện (${response.status}).`);
  return body;
}
export async function listLearningResources(limit=50){
  const safe=Math.max(1,Math.min(100,Math.round(limit)));
  const body=await request(`/api/knowledge/resources?limit=${safe}`);
  return Array.isArray(body.resources)?body.resources:[];
}
export async function getLearningResource(resourceKey:string){
  if(!RESOURCE_KEY.test(resourceKey))throw new Error('RESOURCE_NOT_FOUND');
  const body=await request(`/api/knowledge/resources?resourceKey=${encodeURIComponent(resourceKey)}`);
  return body.resource||null;
}
export function resourceKeyFromPath(pathname:string){
  const match=pathname.match(/^\/r\/(hiu_res_[0-9a-f]{20})\/?$/);
  return match?.[1]||null;
}
export function learningResourceLink(resourceKey:string){
  if(!RESOURCE_KEY.test(resourceKey))return '/library';
  return `/r/${resourceKey}`;
}