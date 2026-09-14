import assert from 'node:assert/strict';
import {createGroundedQuiz,parseQuizJson} from '../api/_lib/study-assistant-handler.js';

const originalFetch=globalThis.fetch;
const envKeys=['GEMINI_API_KEY','ENABLE_GEMINI_AI','ENABLE_CLOUD_AI','OPENAI_API_KEY','OPENAI_MODEL'];
const originalEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
process.env.GEMINI_API_KEY='test-only';process.env.ENABLE_GEMINI_AI='true';
const questions=Array.from({length:5},(_,i)=>({stem:`Question ${i}`,options:['One','Two','Three','Four'],correctIndex:0,explanation:'Supported explanation',sourceIndexes:[0]}));
const quiz={title:'Test quiz',questions};
const response=()=>({statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(value){this.body=value;return this}});
const abstractIndex={Physiology:[0,5,10,15],evidence:[1,6,11,16],supports:[2,7,12,17],student:[3,8,13,18],learning:[4,9,14,19]};
const openAlexPayload={results:Array.from({length:4},(_,i)=>({id:`https://openalex.org/W${i+1}`,doi:`https://doi.org/10.1000/test${i+1}`,title:`Public physiology source ${i+1}`,publication_year:2024,primary_location:{source:{display_name:'Open academic journal'}},abstract_inverted_index:abstractIndex}))};
const europePayload={resultList:{result:[]}};
const sourceFetch=async url=>{
  const href=String(url);
  if(href.startsWith('https://api.openalex.org/works'))return{ok:true,status:200,json:async()=>openAlexPayload};
  if(href.startsWith('https://www.ebi.ac.uk/europepmc/'))return{ok:true,status:200,json:async()=>europePayload};
  throw new Error(`Unexpected public source URL ${href}`);
};
try{
  let calls=[];
  globalThis.fetch=async(url,options={})=>{
    const href=String(url);
    if(href.startsWith('https://api.openalex.org/works')||href.startsWith('https://www.ebi.ac.uk/europepmc/'))return sourceFetch(url);
    calls.push({url:href,body:options.body?JSON.parse(options.body):null,signal:options.signal});
    if(href.includes('generativelanguage.googleapis.com/v1beta/models/'))return{ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(quiz)}]}}]})};
    throw new Error(`Unexpected ${href}`);
  };
  const ok=response();
  await createGroundedQuiz({query:'Sinh lý',count:5,started:Date.now(),res:ok});
  assert.equal(ok.statusCode,200);assert.equal(ok.body.questions.length,5);assert.equal(ok.body.sources.length,4);assert.equal(ok.body.provider,'gemini-public-evidence');
  assert.ok(ok.body.sources.every(source=>source.url.startsWith('https://doi.org/')));assert.equal(ok.headers['X-AI-Evidence-Count'],'4');
  assert.equal(calls.length,1);assert.ok(calls[0].url.includes(':generateContent'));assert.equal(calls[0].body.generationConfig.responseMimeType,'application/json');
  assert.ok(calls[0].body.contents[0].parts[0].text.includes('GÓI BẰNG CHỨNG CÔNG KHAI'));
  assert.ok(!calls.some(call=>call.url.endsWith('/interactions')));assert.ok(!calls.some(call=>call.body?.tools?.[0]?.type==='web_search_preview'));

  for(const changed of [
    {...questions[0],options:['same','same','Third','Fourth']},
    {...questions[0],correctIndex:null},
    {...questions[0],sourceIndexes:[99]},
    {...questions[0],options:['One','','Three','Four']}
  ])assert.throws(()=>parseQuizJson(JSON.stringify({...quiz,questions:[changed,...questions.slice(1)]}),5,1));
  assert.throws(()=>parseQuizJson(JSON.stringify({...quiz,questions:questions.slice(0,4)}),5,1));

  process.env.ENABLE_CLOUD_AI='true';process.env.OPENAI_API_KEY='test-openai';process.env.OPENAI_MODEL='gpt-5.6-luna';
  calls=[];
  globalThis.fetch=async(url,options={})=>{
    const href=String(url);
    if(href.startsWith('https://api.openalex.org/works')||href.startsWith('https://www.ebi.ac.uk/europepmc/'))return sourceFetch(url);
    const body=options.body?JSON.parse(options.body):null;calls.push({url:href,body});
    if(href.includes('generativelanguage.googleapis.com/v1beta/models/'))return{ok:false,status:429,json:async()=>({error:{message:'Quota exhausted'}})};
    if(href==='https://api.openai.com/v1/responses')return{ok:true,status:200,json:async()=>({output_text:JSON.stringify(quiz)})};
    throw new Error(`Unexpected ${href}`);
  };
  const limited=response();await createGroundedQuiz({query:'Sinh lý',count:5,started:Date.now(),res:limited});
  assert.equal(limited.statusCode,200);assert.equal(limited.body.provider,'openai-public-evidence');assert.equal(limited.body.questions.length,5);assert.equal(limited.headers['X-AI-Failover'],'gemini');
  const openAiCall=calls.find(call=>call.url==='https://api.openai.com/v1/responses');assert.ok(openAiCall);assert.equal(openAiCall.body.tools,undefined);assert.ok(openAiCall.body.input.includes('GÓI BẰNG CHỨNG'));

  globalThis.fetch=async(url,options={})=>{
    const href=String(url);
    if(href.startsWith('https://api.openalex.org/works')||href.startsWith('https://www.ebi.ac.uk/europepmc/'))return sourceFetch(url);
    if(href.includes('generativelanguage.googleapis.com/v1beta/models/'))return{ok:false,status:429,json:async()=>({error:{message:'Quota exhausted'}})};
    if(href==='https://api.openai.com/v1/responses')return{ok:false,status:429,json:async()=>({error:{message:'Rate limit exceeded'}})};
    throw new Error(`Unexpected ${href}`);
  };
  const exhausted=response();await createGroundedQuiz({query:'Sinh lý',count:5,started:Date.now(),res:exhausted});
  assert.equal(exhausted.statusCode,503);assert.equal(exhausted.body.code,'QUIZ_MODEL_BUSY');assert.equal(exhausted.body.sources.length,4);assert.match(exhausted.body.error,/Đã truy xuất được nguồn công khai/);

  globalThis.fetch=async(url,options={})=>{
    const href=String(url);
    if(href.startsWith('https://api.openalex.org/works')||href.startsWith('https://www.ebi.ac.uk/europepmc/'))return sourceFetch(url);
    const error=new Error('aborted');error.name='AbortError';throw error;
  };
  const timed=response();await createGroundedQuiz({query:'Sinh lý',count:5,started:Date.now(),res:timed});assert.equal(timed.statusCode,504);assert.equal(timed.body.code,'QUIZ_TIMEOUT');
  console.log('Phase 18D grounded quiz runtime: PASS (quota-independent public evidence, Gemini generation, evidence failover, explicit model busy, timeout)');
}finally{
  globalThis.fetch=originalFetch;
  for(const key of envKeys){if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key]}
}
