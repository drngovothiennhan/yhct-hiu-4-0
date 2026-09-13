import {supabase} from './authService';

export type LearningResourceHit={
  resourceKey:string;
  title:string;
  resourceType:'document'|'quiz_source'|'reference'|string;
  mimeType:string;
  updatedAt:string;
};

type ResourceRow=LearningResourceHit&{status?:string;audience?:string};

const normalize=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const tokensOf=(value:string)=>[...new Set(normalize(value).split(' ').filter(token=>token.length>1))].slice(0,16);
const safeRow=(value:unknown):ResourceRow|null=>{
  if(!value||typeof value!=='object')return null;
  const row=value as Partial<ResourceRow>;
  if(typeof row.resourceKey!=='string'||!/^hiu_res_[0-9a-f]{20}$/.test(row.resourceKey)||typeof row.title!=='string'||!row.title.trim())return null;
  return{
    resourceKey:row.resourceKey,
    title:row.title.trim().slice(0,300),
    resourceType:typeof row.resourceType==='string'?row.resourceType:'document',
    mimeType:typeof row.mimeType==='string'?row.mimeType:'',
    updatedAt:typeof row.updatedAt==='string'?row.updatedAt:'',
    status:typeof row.status==='string'?row.status:'',
    audience:typeof row.audience==='string'?row.audience:''
  };
};

export async function findRelatedLearningResources(query:string,limit=6):Promise<LearningResourceHit[]>{
  const bounded=Math.max(1,Math.min(Math.floor(limit)||6,8));
  const {data,error}=await supabase.rpc('learning_resource_list_v1',{p_limit:80,p_include_drafts:false});
  if(error)throw error;
  const rows=(Array.isArray(data)?data:[]).map(safeRow).filter((row):row is ResourceRow=>Boolean(row&&row.status==='published'&&row.audience==='members'));
  const cleanQuery=normalize(query),tokens=tokensOf(query);
  return rows.map(row=>{
    const title=normalize(row.title);
    let score=cleanQuery&&title.includes(cleanQuery)?20:0;
    for(const token of tokens)if(title.includes(token))score+=token.length>=5?3:1;
    return{row,score};
  }).filter(item=>item.score>0||tokens.length===0).sort((a,b)=>b.score-a.score||Date.parse(b.row.updatedAt||'0')-Date.parse(a.row.updatedAt||'0')).slice(0,bounded).map(({row})=>({resourceKey:row.resourceKey,title:row.title,resourceType:row.resourceType,mimeType:row.mimeType,updatedAt:row.updatedAt}));
}
