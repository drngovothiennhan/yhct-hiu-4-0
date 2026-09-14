const MAX_EVIDENCE=6;
const FETCH_TIMEOUT_MS=8500;
const clean=(value,max=2400)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const stripDiacritics=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
const safeUrl=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'?url.toString():''}catch{return''}};

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
  const alias=MEDICAL_ALIASES.find(([pattern])=>pattern.test(plain))?.[1]||'';
  return{original,english:alias||original};
}

function linkedSignal(parent,timeoutMs=FETCH_TIMEOUT_MS){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  const abort=()=>controller.abort();
  if(parent?.aborted)controller.abort();else parent?.addEventListener?.('abort',abort,{once:true});
  return{signal:controller.signal,cleanup(){clearTimeout(timer);parent?.removeEventListener?.('abort',abort)}};
}

async function fetchJson(url,parentSignal){
  const linked=linkedSignal(parentSignal);
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
  url.searchParams.set('per-page',String(Math.max(1,Math.min(limit,8))));
  url.searchParams.set('select','id,doi,title,publication_year,primary_location,abstract_inverted_index');
  const payload=await fetchJson(url,signal);
  return(Array.isArray(payload?.results)?payload.results:[]).map(item=>{
    const snippet=decodeOpenAlexAbstract(item?.abstract_inverted_index),doi=safeUrl(item?.doi),id=safeUrl(item?.id);
    return{title:clean(item?.title,260),url:doi||id,snippet,provider:'OpenAlex',year:Number(item?.publication_year)||null,source:clean(item?.primary_location?.source?.display_name||'OpenAlex',160)};
  }).filter(item=>item.title&&item.url&&item.snippet.length>=80);
}

async function searchEuropePmc(query,signal,limit=4){
  const url=new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.searchParams.set('query',query);
  url.searchParams.set('format','json');
  url.searchParams.set('resultType','core');
  url.searchParams.set('pageSize',String(Math.max(1,Math.min(limit,8))));
  const payload=await fetchJson(url,signal);
  return(Array.isArray(payload?.resultList?.result)?payload.resultList.result:[]).map(item=>{
    const source=clean(item?.source||'MED',24),id=clean(item?.id||item?.pmid||item?.pmcid||'',80),snippet=clean(item?.abstractText,2600);
    const url=id?`https://europepmc.org/article/${encodeURIComponent(source)}/${encodeURIComponent(id)}`:'';
    return{title:clean(item?.title,260),url,snippet,provider:'Europe PMC',year:Number(item?.pubYear)||null,source:clean(item?.journalTitle||'Europe PMC',160)};
  }).filter(item=>item.title&&item.url&&item.snippet.length>=80);
}

async function searchWikipedia(query,signal,language='vi',limit=2){
  const url=new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.searchParams.set('action','query');
  url.searchParams.set('generator','search');
  url.searchParams.set('gsrsearch',query);
  url.searchParams.set('gsrlimit',String(Math.max(1,Math.min(limit,3))));
  url.searchParams.set('prop','extracts|info');
  url.searchParams.set('exintro','1');
  url.searchParams.set('explaintext','1');
  url.searchParams.set('inprop','url');
  url.searchParams.set('format','json');
  url.searchParams.set('formatversion','2');
  const payload=await fetchJson(url,signal),pages=Array.isArray(payload?.query?.pages)?payload.query.pages:[];
  return pages.map(page=>({title:clean(page?.title,260),url:safeUrl(page?.fullurl),snippet:clean(page?.extract,2600),provider:language==='vi'?'Wikipedia VI':'Wikipedia EN',year:null,source:'Wikipedia'})).filter(item=>item.title&&item.url&&item.snippet.length>=120);
}

function dedupe(rows,limit=MAX_EVIDENCE){
  const seen=new Set(),out=[];
  for(const row of rows){
    const key=(row.url||row.title).toLowerCase();
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(row);
    if(out.length>=limit)break;
  }
  return out;
}

export async function retrievePublicMedicalEvidence(topic,{signal,limit=MAX_EVIDENCE}={}){
  const {original,english}=expandMedicalQuery(topic);
  if(!original)return[];
  const settled=await Promise.allSettled([
    searchOpenAlex(original,signal,4),
    searchEuropePmc(english,signal,4)
  ]);
  let rows=[];
  for(const result of settled)if(result.status==='fulfilled')rows.push(...result.value);
  rows=dedupe(rows,limit);
  if(rows.length>=Math.min(4,limit))return rows;
  const wiki=await Promise.allSettled([
    searchWikipedia(original,signal,'vi',2),
    ...(english!==original?[searchWikipedia(english,signal,'en',2)]:[])
  ]);
  for(const result of wiki)if(result.status==='fulfilled')rows.push(...result.value);
  return dedupe(rows,limit);
}

export function publicEvidencePacket(evidence){
  return evidence.map((item,index)=>[
    `[${index}] ${clean(item.title,260)}`,
    `Nguồn: ${clean(item.provider,80)}${item.year?` · ${item.year}`:''}${item.source?` · ${clean(item.source,120)}`:''}`,
    `URL: ${safeUrl(item.url)}`,
    `Trích yếu: ${clean(item.snippet,2400)}`
  ].join('\n')).join('\n\n').slice(0,17000);
}

export function publicEvidenceSources(evidence){
  return evidence.map(item=>({title:clean(item.title,260),url:safeUrl(item.url),provider:clean(item.provider,80),year:item.year||null})).filter(item=>item.title&&item.url).slice(0,MAX_EVIDENCE);
}
