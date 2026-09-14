import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const datasetPath=path.resolve(root,process.env.AI_GOLDEN_DATASET||'evals/medical-golden-v1.json');
const runtime=process.argv.includes('--runtime');
const validateOnly=process.argv.includes('--validate-only')||!runtime;
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().replace(/\s+/g,' ').trim();
const fail=message=>{console.error(`GOLDEN MEDICAL EVAL FAIL: ${message}`);process.exitCode=1};
const ok=message=>console.log(`OK: ${message}`);
const load=()=>JSON.parse(fs.readFileSync(datasetPath,'utf8'));

function validateDataset(data){
  const errors=[];
  if(data?.version!=='medical-golden-v1')errors.push('version must be medical-golden-v1');
  const cases=Array.isArray(data?.cases)?data.cases:[];
  if(cases.length<30)errors.push(`dataset must contain at least 30 cases, got ${cases.length}`);
  const ids=new Set(),domains=new Set(),critical=[];
  for(const [index,item] of cases.entries()){
    const label=`case[${index}]`;
    if(!item?.id||typeof item.id!=='string')errors.push(`${label} missing id`);
    else if(ids.has(item.id))errors.push(`duplicate id ${item.id}`);else ids.add(item.id);
    if(!item?.domain||typeof item.domain!=='string')errors.push(`${item?.id||label} missing domain`);else domains.add(item.domain);
    if(!item?.prompt||String(item.prompt).trim().length<12)errors.push(`${item?.id||label} prompt too short`);
    if(!['study','research'].includes(item?.expectedRoute))errors.push(`${item?.id||label} invalid expectedRoute`);
    if(!Array.isArray(item?.mustIncludeAny)||!Array.isArray(item?.mustNotIncludeAny))errors.push(`${item?.id||label} concept gates must be arrays`);
    for(const group of [...(item?.mustIncludeAny||[]),...(item?.mustNotIncludeAny||[])])if(!Array.isArray(group)||!group.some(Boolean))errors.push(`${item?.id||label} has empty concept group`);
    if(item?.critical===true)critical.push(item.id);
  }
  for(const required of ['physiology','yhct','research','safety','evidence','reasoning'])if(!domains.has(required))errors.push(`missing required domain ${required}`);
  if(critical.length<8)errors.push(`dataset needs at least 8 critical safety/privacy/evidence cases, got ${critical.length}`);
  const thresholds=data?.thresholds||{};
  for(const key of ['runtimePassRate','criticalSafetyPassRate','citationPassRate','routePassRate']){
    const value=Number(thresholds[key]);if(!(value>0&&value<=1))errors.push(`invalid threshold ${key}`);
  }
  if(errors.length){errors.forEach(fail);return false}
  ok(`dataset ${data.version}: ${cases.length} cases, ${domains.size} domains, ${critical.length} critical`);
  return true;
}

const groupPass=(text,group)=>group.some(token=>text.includes(normalize(token)));
function scoreCase(item,payload){
  const answer=normalize(payload?.answer||'');
  const actualRoute=payload?.route==='research'?'research':'study';
  const includeGroups=item.mustIncludeAny||[],forbiddenGroups=item.mustNotIncludeAny||[];
  const includes=includeGroups.map(group=>groupPass(answer,group));
  const forbidden=forbiddenGroups.map(group=>groupPass(answer,group));
  const conceptPass=includes.every(Boolean)&&forbidden.every(hit=>!hit);
  const routePass=actualRoute===item.expectedRoute;
  const sources=Array.isArray(payload?.sources)?payload.sources.filter(source=>String(source?.url||'').startsWith('https://')):[];
  const citationPass=!item.citationRequired||sources.length>0;
  const pass=conceptPass&&routePass&&citationPass;
  return{pass,conceptPass,routePass,citationPass,missing:includeGroups.filter((_,i)=>!includes[i]),forbiddenHits:forbiddenGroups.filter((_,i)=>forbidden[i]),route:actualRoute,sourceCount:sources.length,provider:String(payload?.provider||''),latencyMs:Number(payload?.latencyMs||0)};
}

const requestBody=(item,index)=>JSON.stringify({mode:'study',query:item.prompt,conversationContext:'',pageContext:'AI Golden Medical Eval',variationMode:index%6});

async function requestCase(baseUrl,memberToken,gateKey,bypassSecret,item,index){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
    const headers={'Content-Type':'application/json'};
    if(memberToken)headers.Authorization=`Bearer ${memberToken}`;
    if(gateKey)headers['x-yhct-golden-eval']=gateKey;
    if(bypassSecret){headers['x-vercel-protection-bypass']=bypassSecret;headers['x-vercel-set-bypass-cookie']='true'}
    const response=await fetch(`${baseUrl.replace(/\/$/,'')}/api/ai/assistant`,{method:'POST',signal:controller.signal,headers,body:requestBody(item,index)});
    const payload=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(`${response.status} ${String(payload?.error||payload?.message||'request failed').slice(0,180)}`);
    return payload;
  }finally{clearTimeout(timer)}
}

async function runRuntime(data){
  const baseUrl=String(process.env.AI_GOLDEN_TARGET||'').trim(),memberToken=String(process.env.AI_GOLDEN_MEMBER_TOKEN||'').trim(),gateKey=String(process.env.AI_GOLDEN_EPHEMERAL_KEY||'').trim(),bypassSecret=String(process.env.AI_GOLDEN_VERCEL_BYPASS||process.env.VERCEL_AUTOMATION_BYPASS_SECRET||'').trim();
  if(!baseUrl){fail('runtime mode requires AI_GOLDEN_TARGET');return}
  if(!memberToken&&!gateKey){fail('runtime mode requires AI_GOLDEN_MEMBER_TOKEN or deployment-scoped AI_GOLDEN_EPHEMERAL_KEY');return}
  if(gateKey&&gateKey.length<32){fail('AI_GOLDEN_EPHEMERAL_KEY must contain at least 32 characters');return}
  if(bypassSecret&&bypassSecret.length<32){fail('Vercel automation bypass secret must contain at least 32 characters');return}
  const results=[];
  for(let index=0;index<data.cases.length;index++){
    const item=data.cases[index];
    try{
      const payload=await requestCase(baseUrl,memberToken,gateKey,bypassSecret,item,index),score=scoreCase(item,payload);
      results.push({id:item.id,domain:item.domain,critical:Boolean(item.critical),...score});
      console.log(`${score.pass?'PASS':'FAIL'} ${item.id} route=${score.route} provider=${score.provider||'unknown'} latency=${score.latencyMs}ms`);
    }catch(error){results.push({id:item.id,domain:item.domain,critical:Boolean(item.critical),pass:false,requestError:String(error?.message||error)});console.error(`FAIL ${item.id}: ${error?.message||error}`)}
  }
  const ratio=(rows,predicate)=>rows.length?rows.filter(predicate).length/rows.length:1;
  const critical=results.filter(result=>result.critical),citationCases=data.cases.map((item,index)=>({item,result:results[index]})).filter(row=>row.item.citationRequired),routeRows=results.filter(result=>typeof result.routePass==='boolean');
  const summary={
    version:data.version,total:results.length,
    passRate:ratio(results,result=>result.pass===true),
    criticalSafetyPassRate:ratio(critical,result=>result.pass===true),
    citationPassRate:ratio(citationCases,row=>row.result?.citationPass===true),
    routePassRate:ratio(routeRows,result=>result.routePass===true),
    generatedAt:new Date().toISOString(),results
  };
  const reportPath=path.resolve(root,process.env.AI_GOLDEN_REPORT||'ai-golden-medical-report.json');
  fs.writeFileSync(reportPath,JSON.stringify(summary,null,2));
  console.log(JSON.stringify({...summary,results:undefined},null,2));
  const threshold=data.thresholds;
  if(summary.passRate<threshold.runtimePassRate)fail(`runtime pass rate ${summary.passRate.toFixed(3)} < ${threshold.runtimePassRate}`);
  if(summary.criticalSafetyPassRate<threshold.criticalSafetyPassRate)fail(`critical pass rate ${summary.criticalSafetyPassRate.toFixed(3)} < ${threshold.criticalSafetyPassRate}`);
  if(summary.citationPassRate<threshold.citationPassRate)fail(`citation pass rate ${summary.citationPassRate.toFixed(3)} < ${threshold.citationPassRate}`);
  if(summary.routePassRate<threshold.routePassRate)fail(`route pass rate ${summary.routePassRate.toFixed(3)} < ${threshold.routePassRate}`);
  if(!process.exitCode)ok(`runtime benchmark passed; report=${path.relative(root,reportPath)}`);
}

const data=load();
if(validateDataset(data)&&!validateOnly)await runRuntime(data);
if(!process.exitCode&&validateOnly)ok('Golden Medical Eval contract validation passed. Use --runtime against a staged deployment for the live release gate.');
