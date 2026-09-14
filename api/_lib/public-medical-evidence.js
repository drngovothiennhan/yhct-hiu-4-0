const MAX_EVIDENCE=6;
const FETCH_TIMEOUT_MS=8500;
const clean=(value,max=2400)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const stripDiacritics=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
const safeUrl=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'?url.toString():''}catch{return''}};
const normalizeDoi=value=>String(value||'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').trim();

const SPECIAL_ALIASES=[
  [/\bsam\s*ngoc\s*linh\b/i,'Panax vietnamensis Ngoc Linh ginseng'],
  [/\bpanax\s*vietnamensis\b/i,'Panax vietnamensis Ngoc Linh ginseng']
];
const MEDICAL_ALIASES=[
  [/\bsinh\s*ly\b/i,'physiology'],
  [/\bgiai\s*phau\b/i,'anatomy'],
  [/\bky\s*sinh\s*trung\b/i,'parasitology'],
  [/\bvi\s*sinh\b/i,'microbiology'],
  [/\bduoc\s*ly\b/i,'pharmacology'],
  [/\bgiai\s*phau\s*benh\b|\bbenh\s*hoc\b/i,'pathology'],
  [/\bsinh\s*hoa\b/i,'biochemistry'],
  [/\bmo\s*phoi\b|\bmo\s*hoc\b/i,'histology embryology'],
  [/\bmien\s*dich\b/i,'immunology'],
  [/\bnoi\s*tiet\b/i,'endocrinology'],
  [/\bcham\s*cuu\b/i,'acupuncture'],
  [/\bduoc\s*lieu\b/i,'medicinal plants herbal medicine'],
  [/\bphuong\s*te\b/i,'traditional Chinese medicine formula'],
  [/\by\s*hoc\s*co\s*truyen\b|\byhct\b/i,'traditional Chinese medicine'],
  [/\bbat\s*cuong\b/i,'eight principles traditional Chinese medicine'],
  [/\bam\s*duong\b/i,'yin yang traditional Chinese medicine'],
  [/\bngu\s*hanh\b/i,'five phases traditional Chinese medicine'],
  [/\btang\s*phu\b/i,'zang fu traditional Chinese medicine']
];

export function expandMedicalQuery(value){
  const original=clean(value,260),plain=stripDiacritics(original);
  const special=SPECIAL_ALIASES.find(([pattern])=>pattern.test(plain))?.[1]||'';
  const alias=MEDICAL_ALIASES.find(([pattern])=>pattern.test(plain))?.[1]||'';
  return{original,english:special||alias||original};
}

function linkedSignal(parent,timeoutMs=FETCH_TIMEOUT_MS){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  const abort=()=>controller.abort();
  if(parent?.aborted)controller.abort();else parent?.addEventListener?.('abort',abort,{once:true});
  return{signal:controller.signal,cleanup(){clearTimeout(timer);parent?.removeEventListener?.('abort',abort)}};
}

async function fetchJson(url,parentSignal,timeoutMs=FETCH_TIMEOUT_MS){
  const linked=linkedSignal(parentSignal,timeoutMs);
  try{
    const response=await fetch(url,{signal:linked.signal,headers:{accept:'application/json','user-agent':'HIU-YHCT-StudyOS/4.0'}});
    if(!response.ok)throw new Error(`public_source_${response.status}`);
    return await response.json();
  }finally{linked.cleanup()}
}

function decodeOpenAlexAbstract(index){
  if(!index||typeof index!=='object')return'';
  let max=-1;
  for(const positions of Object.values(index))for(const position of Array.isArray(positions)?positions:[])max=Math.max(max,Number(position)||0);
  if(max<0||max>12000)return'';
  const words=Array(max+1).fill('');
  for(const [word,positions] of Object.entries(index))for(const position of Array.isArray(positions)?positions:[])if(Number.isInteger(position)&&position>=0&&position<words.length)words[position]=word;
  return clean(words.join(' '),2600);
}

async function searchOpenAlex(query,signal,limit=4){
  const url=new URL('https://api.openalex.org/works');
  url.searchParams.set('search',query);
  url.searchParams.set('per-page',String(Math.max(1,Math.min(limit,12))));
  url.searchParams.set('select','id,doi,title,publication_year,authorships,primary_location,cited_by_count,abstract_inverted_index');
  const payload=await fetchJson(url,signal,6500);
  return(Array.isArray(payload?.results)?payload.results:[]).map(item=>{
    const abstract=decodeOpenAlexAbstract(item?.abstract_inverted_index),doi=normalizeDoi(item?.doi),id=safeUrl(item?.id),doiUrl=doi?`https://doi.org/${doi}`:'';
    return{id:id||doiUrl||clean(item?.title,260),title:clean(item?.title,260),authors:(item?.authorships||[]).map(x=>clean(x?.author?.display_name,120)).filter(Boolean).slice(0,12),year:Number(item?.publication_year)||null,source:clean(item?.primary_location?.source?.display_name||'OpenAlex',160),url:doiUrl||id,doi:doi||undefined,abstract,citedBy:Number(item?.cited_by_count)||0,provider:'OpenAlex'};
  }).filter(item=>item.title&&item.url);
}

async function searchEuropePmc(query,signal,limit=4){
  const url=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.searchParams.set('query',query);
  url.searchParams.set('format','json');
  url.searchParams.set('resultType','core');
  url.searchParams.set('pageSize',String(Math.max(1,Math.min(limit,12))));
  const payload=await fetchJson(url,signal,6500);
  return(Array.isArray(payload?.resultList?.result)?payload.resultList.result:[]).map(item=>{
    const sourceKey=clean(item?.source||'MED',24),extId=clean(item?.id||item?.pmid||item?.pmcid||item?.doi||item?.title,100),doi=normalizeDoi(item?.doi),authors=(item?.authorList?.author||[]).map(x=>clean(x?.fullName||[x?.firstName,x?.lastName].filter(Boolean).join(' '),120)).filter(Boolean).slice(0,12);
    return{id:`${sourceKey}:${extId}`,title:clean(item?.title,260),authors:authors.length?authors:String(item?.authorString||'').split(',').map(x=>clean(x,120)).filter(Boolean).slice(0,12),year:Number(item?.pubYear)||Number(String(item?.firstPublicationDate||'').slice(0,4))||null,source:clean(item?.journalTitle||item?.publisher||'Europe PMC',160),url:extId?`https://europepmc.org/article/${encodeURIComponent(sourceKey)}/${encodeURIComponent(extId)}`:'',doi:doi||undefined,abstract:clean(item?.abstractText,2600),citedBy:Number(item?.citedByCount)||0,provider:'Europe PMC'};
  }).filter(item=>item.title&&item.url);
}

async function searchClinicalTrials(query,signal,limit=5){
  const url=new URL('https://clinicaltrials.gov/api/v2/studies');
  url.searchParams.set('query.term',query);
  url.searchParams.set('pageSize',String(Math.max(1,Math.min(limit,10))));
  url.searchParams.set('format','json');
  const payload=await fetchJson(url,signal,7000);
  return(Array.isArray(payload?.studies)?payload.studies:[]).map(study=>{
    const p=study?.protocolSection||{},id=clean(p?.identificationModule?.nctId,80),title=clean(p?.identificationModule?.briefTitle||p?.identificationModule?.officialTitle||id,260),lead=clean(p?.sponsorCollaboratorsModule?.leadSponsor?.name,160),summary=clean(p?.descriptionModule?.briefSummary,2600),start=String(p?.statusModule?.startDateStruct?.date||''),status=clean(p?.statusModule?.overallStatus,80);
    return{id,title,authors:lead?[lead]:[],year:Number(start.slice(0,4))||null,source:`ClinicalTrials.gov${status?` · ${status}`:''}`,url:id?`https://clinicaltrials.gov/study/${encodeURIComponent(id)}`:'',abstract:summary,citedBy:0,provider:'ClinicalTrials.gov'};
  }).filter(item=>item.id&&item.title&&item.url);
}

async function searchCrossref(query,signal,limit=6){
  const url=new URL('https://api.crossref.org/works');
  url.searchParams.set('query.bibliographic',query);
  url.searchParams.set('rows',String(Math.max(1,Math.min(limit,10))));
  const payload=await fetchJson(url,signal,6500);
  return(Array.isArray(payload?.message?.items)?payload.message.items:[]).map(item=>{
    const doi=normalizeDoi(item?.DOI),title=clean(Array.isArray(item?.title)?item.title[0]:item?.title,260),authors=(item?.author||[]).map(x=>clean([x?.given,x?.family].filter(Boolean).join(' '),120)).filter(Boolean).slice(0,12),year=Number(item?.published?.['date-parts']?.[0]?.[0]||item?.['published-print']?.['date-parts']?.[0]?.[0]||item?.created?.['date-parts']?.[0]?.[0])||null,source=clean((Array.isArray(item?.['container-title'])&&item['container-title'][0])||item?.publisher||'Crossref',160),urlValue=safeUrl(item?.URL)||(doi?`https://doi.org/${doi}`:'');
    return{id:doi||urlValue||title,title,authors,year,source,url:urlValue,doi:doi||undefined,abstract:clean(item?.abstract,2600),citedBy:Number(item?.['is-referenced-by-count'])||0,provider:'Crossref'};
  }).filter(item=>item.id&&item.title&&item.url);
}

async function searchWikipedia(query,signal,language='vi',limit=2){
  const url=new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.searchParams.set('action','query');url.searchParams.set('generator','search');url.searchParams.set('gsrsearch',query);url.searchParams.set('gsrlimit',String(Math.max(1,Math.min(limit,3))));url.searchParams.set('prop','extracts|info');url.searchParams.set('exintro','1');url.searchParams.set('explaintext','1');url.searchParams.set('inprop','url');url.searchParams.set('format','json');url.searchParams.set('formatversion','2');
  const payload=await fetchJson(url,signal),pages=Array.isArray(payload?.query?.pages)?payload.query.pages:[];
  return pages.map(page=>({title:clean(page?.title,260),url:safeUrl(page?.fullurl),snippet:clean(page?.extract,2600),provider:language==='vi'?'Wikipedia VI':'Wikipedia EN',year:null,source:'Wikipedia'})).filter(item=>item.title&&item.url&&item.snippet.length>=120);
}

function dedupe(rows,limit=MAX_EVIDENCE){
  const seen=new Set(),out=[];
  for(const row of rows){const key=String(row.url||row.doi||row.title||'').toLowerCase();if(!key||seen.has(key))continue;seen.add(key);out.push(row);if(out.length>=limit)break}
  return out;
}
const STOP_WORDS=new Set(['the','and','for','with','from','into','about','study','research','medical','medicine','clinical','tong','quan','hieu','qua','an','toan','chat','luong','bang','chung']);
function queryTokens(...values){return[...new Set(values.flatMap(value=>stripDiacritics(value).match(/[a-z0-9]{3,}/g)||[]).filter(token=>!STOP_WORDS.has(token)))].slice(0,16)}
function relevanceScore(row,tokens,english){
  const title=stripDiacritics(row.title),abstract=stripDiacritics(row.abstract||row.snippet||''),source=stripDiacritics(row.source||''),phrase=stripDiacritics(english);
  let score=0;for(const token of tokens){if(title.includes(token))score+=5;if(abstract.includes(token))score+=1;if(source.includes(token))score+=0.25}
  if(phrase&&title.includes(phrase))score+=20;
  if(phrase.includes('panax vietnamensis')&&(title.includes('panax vietnamensis')||abstract.includes('panax vietnamensis')))score+=24;
  return score;
}
function rankResearchRows(rows,original,english,limit){
  const tokens=queryTokens(original,english),ranked=dedupe(rows,Math.max(limit*3,24)).map((row,index)=>({row,index,score:relevanceScore(row,tokens,english)}));
  const positive=ranked.filter(item=>item.score>0),pool=positive.length?positive:ranked;
  return pool.sort((a,b)=>b.score-a.score||Number(b.row.citedBy||0)-Number(a.row.citedBy||0)||a.index-b.index).slice(0,limit).map(item=>item.row);
}

export async function retrievePublicMedicalEvidence(topic,{signal,limit=MAX_EVIDENCE}={}){
  const {original,english}=expandMedicalQuery(topic);if(!original)return[];
  const settled=await Promise.allSettled([searchOpenAlex(original,signal,4),searchEuropePmc(english,signal,4)]);let rows=[];
  for(const result of settled)if(result.status==='fulfilled')rows.push(...result.value.map(item=>({...item,snippet:item.abstract||''})));
  rows=dedupe(rows,limit);if(rows.length>=Math.min(4,limit))return rows;
  const wiki=await Promise.allSettled([searchWikipedia(original,signal,'vi',2),...(english!==original?[searchWikipedia(english,signal,'en',2)]:[])]);
  for(const result of wiki)if(result.status==='fulfilled')rows.push(...result.value);
  return dedupe(rows,limit);
}

export async function retrievePublicResearchEvidence(topic,{signal,limit=18}={}){
  const {original,english}=expandMedicalQuery(topic),safeLimit=Math.max(1,Math.min(Number(limit)||18,24));
  if(!original)return{query:'',works:[],unavailableProviders:[]};
  const providers=[['Europe PMC',()=>searchEuropePmc(english,signal,10)],['OpenAlex',()=>searchOpenAlex(english,signal,10)],['ClinicalTrials.gov',()=>searchClinicalTrials(english,signal,6)]];
  const settled=await Promise.allSettled(providers.map(([,run])=>run())),unavailableProviders=[],rows=[];
  settled.forEach((result,index)=>{if(result.status==='fulfilled')rows.push(...result.value);else unavailableProviders.push(providers[index][0])});
  let ranked=rankResearchRows(rows,original,english,safeLimit);
  if(ranked.length<Math.min(6,safeLimit)){
    try{ranked=rankResearchRows([...ranked,...await searchCrossref(english,signal,8)],original,english,safeLimit)}catch{unavailableProviders.push('Crossref')}
  }
  return{query:english,works:ranked,unavailableProviders:[...new Set(unavailableProviders)]};
}

export function publicEvidencePacket(evidence){
  return evidence.map((item,index)=>[`[${index}] ${clean(item.title,260)}`,`Nguồn: ${clean(item.provider,80)}${item.year?` · ${item.year}`:''}${item.source?` · ${clean(item.source,120)}`:''}`,`URL: ${safeUrl(item.url)}`,`Trích yếu: ${clean(item.snippet||item.abstract,2400)}`].join('\n')).join('\n\n').slice(0,17000);
}

export function publicEvidenceSources(evidence){
  return evidence.map(item=>({title:clean(item.title,260),url:safeUrl(item.url),provider:clean(item.provider,80),year:item.year||null})).filter(item=>item.title&&item.url).slice(0,MAX_EVIDENCE);
}
