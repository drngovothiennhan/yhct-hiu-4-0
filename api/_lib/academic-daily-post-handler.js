import {createGeminiJson,geminiAiConfigured,geminiAiModel} from './gemini-provider.js';
import {publicRpc} from './member-access.js';

const RUN_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ABSTRACT=7200;
const TOPICS=[
  '"traditional Chinese medicine"',
  '"Chinese herbal medicine"',
  'acupuncture',
  'moxibustion'
];
const ARTICLE_SCHEMA={
  type:'object',
  properties:{
    topic:{type:'string'},
    summary:{type:'string'},
    tags:{type:'array',items:{type:'string'},maxItems:6}
  },
  required:['topic','summary','tags'],
  additionalProperties:false
};

const clean=(value,max=1200)=>String(value??'').replace(/<[^>]+>/g,' ').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const normalizeDoi=value=>clean(value,220).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').toLowerCase();
const dateValue=value=>{const n=Date.parse(String(value||''));return Number.isFinite(n)?n:0};
const wordSet=value=>new Set(clean(value,600).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x.length>=4));
function titleOverlap(a,b){const left=wordSet(a),right=wordSet(b);if(!left.size||!right.size)return 0;let hit=0;for(const word of left)if(right.has(word))hit++;return hit/Math.min(left.size,right.size)}
function response(res,status,body){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body)}
async function fetchJson(url,timeoutMs=8500){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{accept:'application/json','user-agent':'HIU-YHCT-AcademicDaily/2.0'}});
    if(!r.ok)throw new Error(`source_http_${r.status}`);
    return await r.json();
  }finally{clearTimeout(timer)}
}
async function europePmcCandidates(){
  const year=new Date().getUTCFullYear(),from=year-7,to=year;
  const batches=await Promise.allSettled(TOPICS.map(async topic=>{
    const url=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.searchParams.set('query',`(${topic}) AND HAS_ABSTRACT:Y AND SRC:MED AND FIRST_PDATE:[${from}-01-01 TO ${to}-12-31]`);
    url.searchParams.set('format','json');url.searchParams.set('resultType','core');url.searchParams.set('pageSize','25');
    const payload=await fetchJson(url);
    return Array.isArray(payload?.resultList?.result)?payload.resultList.result:[];
  }));
  const byPmid=new Map();
  for(const batch of batches)if(batch.status==='fulfilled')for(const item of batch.value){
    const pmid=clean(item?.pmid,20),title=clean(item?.title,500),abstractText=clean(item?.abstractText,MAX_ABSTRACT);
    if(!/^\d{5,10}$/.test(pmid)||title.length<20||abstractText.length<180)continue;
    const candidate={
      sourceId:`pubmed:${pmid}`,pmid,title,abstractText,
      doi:normalizeDoi(item?.doi),journal:clean(item?.journalTitle,260),
      authorString:clean(item?.authorString,600),publicationYear:clean(item?.pubYear||item?.firstPublicationDate,20),
      publishedAt:clean(item?.firstPublicationDate||item?.electronicPublicationDate||item?.journalInfo?.printPublicationDate,40)
    };
    const existing=byPmid.get(pmid);
    if(!existing||dateValue(candidate.publishedAt)>dateValue(existing.publishedAt))byPmid.set(pmid,candidate);
  }
  return [...byPmid.values()].sort((a,b)=>dateValue(b.publishedAt)-dateValue(a.publishedAt)).slice(0,60);
}
async function seenSourceIds(candidates){
  if(!candidates.length)return new Set();
  const payload=candidates.map(x=>({sourceId:x.sourceId,pmid:x.pmid,doi:x.doi}));
  const seen=await publicRpc('academic_ai_seen_sources_v2',{p_sources:payload},7000);
  return new Set(Array.isArray(seen)?seen.map(String):[]);
}
async function verifyPubmed(candidate){
  const url=new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
  url.searchParams.set('db','pubmed');url.searchParams.set('id',candidate.pmid);url.searchParams.set('retmode','json');
  const payload=await fetchJson(url,8000),record=payload?.result?.[candidate.pmid];
  const verifiedTitle=clean(record?.title,500);
  if(!verifiedTitle||titleOverlap(candidate.title,verifiedTitle)<0.45)return null;
  return{
    ...candidate,title:verifiedTitle,
    journal:clean(record?.fulljournalname||record?.source||candidate.journal,260),
    publicationYear:clean(record?.pubdate||candidate.publicationYear,30),
    pubmedUrl:`https://pubmed.ncbi.nlm.nih.gov/${candidate.pmid}/`
  };
}
async function pickVerifiedSource(){
  const candidates=await europePmcCandidates(),seen=await seenSourceIds(candidates);
  for(const candidate of candidates){
    if(seen.has(candidate.sourceId))continue;
    try{const verified=await verifyPubmed(candidate);if(verified)return verified}catch{}
  }
  return null;
}
function citationText(source){
  return [source.authorString,source.title,source.journal,source.publicationYear,source.doi?`doi:${source.doi}`:''].filter(Boolean).join('. ').slice(0,1600);
}
async function generateArticle(source){
  if(!geminiAiConfigured('default'))throw new Error('gemini_not_configured');
  const systemInstruction=[
    'Bạn là biên tập viên học thuật của CLB YHCT HIU.',
    'Chỉ tóm tắt từ bài PubMed đã được hệ thống xác minh bên dưới; tuyệt đối không thêm số liệu, kết luận hoặc nguồn không có trong dữ liệu đầu vào.',
    'Viết tiếng Việt tự nhiên, súc tích, dành cho sinh viên YHCT.',
    'summary dài khoảng 450-900 ký tự, nêu mục tiêu/chủ đề, kết quả chính và giới hạn nếu abstract có đề cập.',
    'Không chẩn đoán, kê đơn, khuyến cáo điều trị cá nhân. Không dùng Markdown.',
    'topic là chủ đề ngắn 2-6 từ. tags gồm 3-6 từ khóa ngắn.'
  ].join(' ');
  const prompt=[
    `PMID: ${source.pmid}`,`Tên bài: ${source.title}`,`Tạp chí: ${source.journal||'không ghi'}`,
    `Năm/ngày: ${source.publicationYear||source.publishedAt||'không ghi'}`,`DOI: ${source.doi||'không ghi'}`,
    `TÓM TẮT GỐC:\n${source.abstractText}`
  ].join('\n');
  const out=await createGeminiJson({systemInstruction,prompt,schema:ARTICLE_SCHEMA,maxOutputTokens:1200,mode:'default'});
  const parsed=JSON.parse(out.text),topic=clean(parsed?.topic,80),summary=clean(parsed?.summary,1800);
  const tags=(Array.isArray(parsed?.tags)?parsed.tags:[]).map(x=>clean(x,40)).filter(Boolean).slice(0,6);
  if(topic.length<2||summary.length<120)throw new Error('gemini_invalid_article');
  return{topic,summary,tags,model:out.model||geminiAiModel('default')};
}
export async function handleAcademicDailyPost(req,res){
  if(req.method!=='POST')return response(res,405,{error:'Method not allowed'});
  const runId=clean(req.body?.runId,80);
  if(!RUN_ID.test(runId))return response(res,400,{error:'Invalid run'});
  let claimed=false;
  try{
    const claim=await publicRpc('academic_ai_claim_daily_run_v2',{p_run_id:runId},7000);
    if(claim?.ok!==true)return response(res,409,{ok:false,reason:clean(claim?.reason||'not_claimable',80)});
    claimed=true;
    const source=await pickVerifiedSource();
    if(!source)throw new Error('no_new_verified_pubmed_source');
    const article=await generateArticle(source);
    const citation={
      id:source.sourceId,title:source.title,type:'pubmed',url:source.pubmedUrl,pmid:source.pmid,doi:source.doi,
      citation:citationText(source),journal:source.journal,publicationYear:source.publicationYear,verifiedBy:'NCBI ESummary'
    };
    const published=await publicRpc('academic_ai_publish_daily_v2',{
      p_run_id:runId,p_topic:article.topic,p_summary:article.summary,p_tags:article.tags,p_source:citation,p_model:article.model
    },9000);
    if(published?.ok!==true)throw new Error(clean(published?.reason||'publish_failed',120));
    console.info(JSON.stringify({event:'academic_daily_ai_v2',ok:true,runId,postId:published.postId,sourceId:source.sourceId,model:article.model}));
    return response(res,200,{ok:true,posted:true,postId:published.postId,sourceId:source.sourceId,model:article.model});
  }catch(error){
    const reason=clean(error?.message||'academic_daily_failed',180);
    if(claimed)try{await publicRpc('academic_ai_fail_daily_run_v2',{p_run_id:runId,p_reason:reason},5000)}catch{}
    console.warn(JSON.stringify({event:'academic_daily_ai_v2',ok:false,runId,reason}));
    return response(res,502,{ok:false,posted:false,reason});
  }
}
