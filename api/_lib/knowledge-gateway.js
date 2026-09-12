import {learningContentAccess,memberAccess,memberRpc} from './member-access.js';

const clean=(value,max=300)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const resourceKey=value=>{const key=clean(value,80);return /^hiu_res_[0-9a-f]{20}$/.test(key)?key:''};

export async function listLearningResources(req,{limit=50,includeDrafts=false}={}){
  const access=includeDrafts?await learningContentAccess(req):await memberAccess(req,'member');
  if(!access.ok)return access;
  try{
    const data=await memberRpc(req,'learning_resource_list_v1',{p_limit:Math.max(1,Math.min(100,Number(limit)||50)),p_include_drafts:Boolean(includeDrafts)});
    return{ok:true,status:200,data:Array.isArray(data)?data:[]};
  }catch(error){return{ok:false,status:503,error:clean(error?.message||'Resource service unavailable',240)}}
}

export async function getLearningResource(req,key){
  const access=await memberAccess(req,'member');if(!access.ok)return access;
  const safeKey=resourceKey(key);if(!safeKey)return{ok:false,status:404,error:'Resource not found'};
  try{return{ok:true,status:200,data:await memberRpc(req,'learning_resource_get_v1',{p_resource_key:safeKey})}}
  catch{return{ok:false,status:404,error:'Resource not found'}}
}

export async function upsertLearningResource(req,{key='',title,resourceType='document',audience='private',source}={}){
  const access=await learningContentAccess(req);if(!access.ok)return access;
  const safeKey=key?resourceKey(key):'';if(key&&!safeKey)return{ok:false,status:400,error:'Invalid resource key'};
  const payload={
    title:clean(title,300),
    resourceType:clean(resourceType,40),
    audience:clean(audience,40),
    source:{
      provider:clean(source?.provider,20),
      id:clean(source?.id,2048),
      version:clean(source?.version,300),
      mimeType:clean(source?.mimeType,240),
      contentHash:clean(source?.contentHash,160),
      metadata:source?.metadata&&typeof source.metadata==='object'&&!Array.isArray(source.metadata)?source.metadata:{}
    }
  };
  if(!payload.title||!payload.source.provider||!payload.source.id)return{ok:false,status:400,error:'Resource title and source are required'};
  try{return{ok:true,status:200,data:await memberRpc(req,'learning_resource_upsert_v1',{p_resource_key:safeKey,p_payload:payload})}}
  catch(error){return{ok:false,status:400,error:clean(error?.message||'Unable to register resource',240)}}
}

export async function publishLearningResource(req,key,status='published'){
  const access=await learningContentAccess(req);if(!access.ok)return access;
  const safeKey=resourceKey(key);if(!safeKey)return{ok:false,status:400,error:'Invalid resource key'};
  const nextStatus=clean(status,20);if(!['draft','published','archived'].includes(nextStatus))return{ok:false,status:400,error:'Invalid resource status'};
  try{return{ok:true,status:200,data:await memberRpc(req,'learning_resource_publish_v1',{p_resource_key:safeKey,p_status:nextStatus})}}
  catch(error){return{ok:false,status:400,error:clean(error?.message||'Unable to update resource status',240)}}
}

export async function registerDriveLearningResource(req,{driveFileId,fileName,mimeType='',sourceHash='',sourceVersion='',resourceType='quiz_source'}={}){
  return upsertLearningResource(req,{
    title:fileName,
    resourceType,
    audience:'private',
    source:{provider:'drive',id:driveFileId,version:sourceVersion,mimeType,contentHash:sourceHash,metadata:{}}
  });
}
