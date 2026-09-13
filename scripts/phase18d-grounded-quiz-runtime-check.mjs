import assert from 'node:assert/strict';
import {createGroundedQuiz,parseQuizJson} from '../api/_lib/study-assistant-handler.js';

const originalFetch=globalThis.fetch,originalKey=process.env.GEMINI_API_KEY,originalEnabled=process.env.ENABLE_GEMINI_AI;
process.env.GEMINI_API_KEY='test-only';
process.env.ENABLE_GEMINI_AI='true';
const questions=Array.from({length:5},(_,i)=>({stem:`Question ${i}`,options:['One','Two','Three','Four'],correctIndex:0,explanation:'Supported explanation',sourceIndexes:[0]}));
const quiz={title:'Test quiz',questions};
const response=()=>({statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(value){this.body=value;return this}});
const grounded={steps:[{type:'model_output',content:[{type:'text',text:'Source-backed notes.',annotations:[{type:'url_citation',url:'https://example.edu/textbook',title:'Open textbook'}]}]}]};
try{
  let calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,body:JSON.parse(options.body),signal:options.signal});
    return {ok:true,json:async()=>url.endsWith('/interactions')?grounded:{candidates:[{content:{parts:[{text:JSON.stringify(quiz)}]}}]}};
  };
  const ok=response();
  await createGroundedQuiz({query:'Bát cương',count:5,started:Date.now(),res:ok});
  assert.equal(ok.statusCode,200);
  assert.equal(ok.body.questions.length,5);
  assert.equal(ok.body.sources[0].url,'https://example.edu/textbook');
  assert.equal(calls.length,2);
  assert.equal(calls[0].body.tools[0].type,'google_search');
  for(const domain of ['scholar.google.com','studocu.com','scribd.com','tailieu.vn'])assert.ok(calls[0].body.input.includes(domain));
  assert.equal(calls[1].body.generationConfig.responseMimeType,'application/json');
  assert.ok(calls[1].body.contents[0].parts[0].text.includes('Source-backed notes.'));
  assert.equal(calls[0].signal,calls[1].signal,'both stages share the request deadline');

  let requests=0;
  globalThis.fetch=async()=>{requests++;return{ok:true,json:async()=>({output_text:'No verified sources'})}};
  const missing=response();
  await createGroundedQuiz({query:'Bát cương',count:5,started:Date.now(),res:missing});
  assert.equal(missing.statusCode,502);
  assert.equal(missing.body.code,'QUIZ_SOURCES_MISSING');
  assert.equal(requests,1,'never generate questions without grounded evidence');

  for(const changed of [
    {...questions[0],options:['same','same','Third','Fourth']},
    {...questions[0],correctIndex:null},
    {...questions[0],sourceIndexes:[99]},
    {...questions[0],options:['One','','Three','Four']}
  ])assert.throws(()=>parseQuizJson(JSON.stringify({...quiz,questions:[changed,...questions.slice(1)]}),5,1));
  assert.throws(()=>parseQuizJson(JSON.stringify({...quiz,questions:questions.slice(0,4)}),5,1));

  globalThis.fetch=async()=>({ok:false,status:429,json:async()=>({error:{message:'Quota exhausted'}})});
  const limited=response();
  await createGroundedQuiz({query:'Bát cương',count:5,started:Date.now(),res:limited});
  assert.equal(limited.statusCode,429);
  assert.equal(limited.body.code,'QUIZ_RATE_LIMIT');
  assert.ok(!JSON.stringify(limited.body).includes('test-only'));

  globalThis.fetch=async()=>{const error=new Error('aborted');error.name='AbortError';throw error};
  const timed=response();
  await createGroundedQuiz({query:'Bát cương',count:5,started:Date.now(),res:timed});
  assert.equal(timed.statusCode,504);
  console.log('Phase 18D grounded quiz runtime: PASS (two stages, citations, exact count, invalid output, quota, timeout)');
}finally{
  globalThis.fetch=originalFetch;
  if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;
  if(originalEnabled===undefined)delete process.env.ENABLE_GEMINI_AI;else process.env.ENABLE_GEMINI_AI=originalEnabled;
}
