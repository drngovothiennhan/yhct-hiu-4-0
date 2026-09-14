import assert from 'node:assert/strict';
import {createGroundedQuiz,parseQuizJson} from '../api/_lib/study-assistant-handler.js';

const originalFetch=globalThis.fetch;
const envKeys=['GEMINI_API_KEY','ENABLE_GEMINI_AI','ENABLE_CLOUD_AI','OPENAI_API_KEY','OPENAI_MODEL'];
const originalEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
process.env.GEMINI_API_KEY='test-only';process.env.ENABLE_GEMINI_AI='true';
const questions=Array.from({length:5},(_,i)=>({stem:`Question ${i}`,options:['One','Two','Three','Four'],correctIndex:0,explanation:'Supported explanation',sourceIndexes:[0]}));
const quiz={title:'Test quiz',questions};
const fallbackQuiz={topic:'Bát cương',title:'Fallback quiz',questions:questions.map(({sourceIndexes,...rest})=>rest)};
const response=()=>({statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(value){this.body=value;return this}});
const grounded={steps:[{type:'model_output',content:[{type:'text',text:'Source-backed notes.',annotations:[{type:'url_citation',url:'https://example.edu/textbook',title:'Open textbook'}]}]}]};
try{
  let calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url:String(url),body:JSON.parse(options.body),signal:options.signal});
    return {ok:true,json:async()=>String(url).endsWith('/interactions')?grounded:{candidates:[{content:{parts:[{text:JSON.stringify(quiz)}]}}]}};
  };
  const ok=response();
  await createGroundedQuiz({query:'Bát cương',count:5,started:Date.now(),res:ok});
  assert.equal(ok.statusCode,200);assert.equal(ok.body.questions.length,5);assert.equal(ok.body.sources[0].url,'https://example.edu/textbook');assert.equal(ok.body.provider,'gemini-google-search');
  assert.equal(calls.length,2);assert.equal(calls[0].body.tools[0].type,'google_search');
  for(const domain of ['scholar.google.com','studocu.com','scribd.com','tailieu.vn'])assert.ok(calls[0].body.input.includes(domain));
  assert.equal(calls[1].body.generationConfig.responseMimeType,'application/json');assert.equal(calls[0].signal,calls[1].signal);

  for(const changed of [
    {...questions[0],options:['same','same','Third','Fourth']},
    {...questions[0],correctIndex:null},
    {...questions[0],sourceIndexes:[99]},
    {...questions[0],options:['One','','Three','Four']}
  ])assert.throws(()=>parseQuizJson(JSON.stringify({...quiz,questions:[changed,...questions.slice(1)]}),5,1));
  assert.throws(()=>parseQuizJson(JSON.stringify({...quiz,questions:questions.slice(0,4)}),5,1));

  delete process.env.ENABLE_CLOUD_AI;delete process.env.OPENAI_API_KEY;
  globalThis.fetch=async()=>({ok:true,json:async()=>({output_text:'No verified sources'})});
  const missing=response();await createGroundedQuiz({query:'Bát cương',count:5,started:Date.now(),res:missing});
  assert.equal(missing.statusCode,503);assert.equal(missing.body.code,'QUIZ_PROVIDER_ERROR');

  process.env.ENABLE_CLOUD_AI='true';process.env.OPENAI_API_KEY='test-openai';process.env.OPENAI_MODEL='gpt-5.6-luna';
  calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url:String(url),body:JSON.parse(options.body)});
    if(String(url).endsWith('/interactions'))return{ok:false,status:429,json:async()=>({error:{message:'Quota exhausted'}})};
    if(String(url)==='https://api.openai.com/v1/responses')return{ok:true,json:async()=>({output_text:JSON.stringify(fallbackQuiz),output:[{type:'web_search_call',action:{sources:[{title:'Public medical source',url:'https://example.org/medical'}]}}]})};
    throw new Error(`Unexpected ${url}`);
  };
  const limited=response();await createGroundedQuiz({query:'Bát cương',count:5,started:Date.now(),res:limited});
  assert.equal(limited.statusCode,200);assert.equal(limited.body.provider,'openai-web-fallback');assert.equal(limited.body.questions.length,5);assert.equal(limited.headers['X-AI-Failover'],'gemini');assert.equal(limited.body.sources[0].url,'https://example.org/medical');
  assert.ok(calls.some(call=>call.body?.tools?.[0]?.type==='web_search_preview'));

  globalThis.fetch=async()=>{const error=new Error('aborted');error.name='AbortError';throw error};
  const timed=response();await createGroundedQuiz({query:'Bát cương',count:5,started:Date.now(),res:timed});assert.equal(timed.statusCode,504);
  console.log('Phase 18D grounded quiz runtime: PASS (Gemini grounding, exact count, source validation, grounded failover, timeout)');
}finally{
  globalThis.fetch=originalFetch;
  for(const key of envKeys){if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key]}
}
