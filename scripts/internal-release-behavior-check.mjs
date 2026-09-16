import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Deterministic component harness: real component handlers, isolated service fixtures.
// Does not replace browser/member/provider acceptance.
function harness(file,mocks,props={}){
 let slots=[],cursor=0,effects=[],cleanups=[],tree,initialized=false;
 const react={
  useState(initial){const at=cursor++;if(!(at in slots))slots[at]=typeof initial==='function'?initial():initial;return[slots[at],value=>{slots[at]=typeof value==='function'?value(slots[at]):value}]},
  useRef(initial){const at=cursor++;if(!(at in slots))slots[at]={current:initial};return slots[at]},
  useMemo(fn){cursor++;return fn()},
  useEffect(fn){cursor++;if(!initialized)effects.push(fn)}
 };
 const jsx=(type,props)=>({type,props:props||{}});
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const require=name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx,Fragment:'fragment'}:name==='lucide-react'?new Proxy({},{get:(_,key)=>key}):mocks[name]||{};
 vm.runInNewContext(code,{exports,require,crypto,AbortController,queueMicrotask,location:{pathname:'/ai',search:''},localStorage:{getItem:()=>null,removeItem(){}},console,Date,Set,Map,window:{addEventListener(){},removeEventListener(){}},setInterval:()=>0,clearInterval(){}});
 function render(){cursor=0;tree=exports.default(props);if(!initialized){initialized=true;for(const effect of effects){const cleanup=effect();if(cleanup)cleanups.push(cleanup)}}return tree}
 const nodes=()=>{const result=[];function visit(node){if(Array.isArray(node)){node.forEach(visit);return}if(!node||typeof node!=='object')return;result.push(node);visit(node.props?.children)}visit(tree);return result};
 const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):node==null||typeof node==='boolean'?'':String(node);
 render();return{render,nodes,text:()=>text(tree),find:(type,label)=>{const node=nodes().find(node=>node.type===type&&text(node).includes(label));assert.ok(node,`${type}: ${label}`);return node},flush:async()=>{await new Promise(resolve=>setImmediate(resolve));render()},unmount:()=>cleanups.forEach(fn=>fn())};
}
const fixture=Array.from({length:53},(_,i)=>({id:`q${i}`,subject:'Sinh lý',topic:'Test',stem:`Câu ${i}`,options:['A','B','C','D']}));
const calls=[];let failNext=false,gradeCalls=0;
const bank=harness('src/components/exam/PracticeBankQuiz.tsx',{
 '../../services/authService':{readCachedMember:()=>({id:'test-member'})},
 '../../services/adaptiveReview':{recordReview(){}},
 '../../services/practiceQuizService':{
  getPracticeQuizConfig:async()=>({authenticated:true,ready:true,subjects:['Sinh lý']}),
  getPracticeQuizPage:async(subject,offset,seed,limit)=>{calls.push({subject,offset,seed,limit});if(failNext){failNext=false;throw Error('network failed')}return{questions:fixture.slice(offset,offset+limit),total:53,hasMore:offset+limit<53}},
  submitPracticeQuiz:async(questions)=>{gradeCalls++;return{score:100,correctCount:questions.length,total:questions.length,review:[]}}
 }
},{initialSubject:'Sinh lý',initialCount:0});
await bank.flush();const start=bank.find('button','Học đề HIU');start.props.onClick();start.props.onClick();await bank.flush();assert.equal(calls.length,1);assert.equal(calls[0].limit,25);
for(let page=0;page<3;page++){
 const radio=bank.nodes().find(node=>node.type==='input'&&node.props.type==='radio');radio.props.onChange();bank.render();
 const submit=bank.find('button','Nộp bài');submit.props.onClick();submit.props.onClick();await bank.flush();assert.equal(gradeCalls,page+1);
 if(page===0){failNext=true;bank.find('button','Học đợt tiếp theo').props.onClick();await bank.flush();assert.match(bank.text(),/network failed/);assert.match(bank.text(),/25 câu trong lượt này/)}
 if(page<2){bank.find('button','Học đợt tiếp theo').props.onClick();await bank.flush()}
}
assert.match(bank.text(),/Đã chấm 53 câu, đúng 53/);assert.ok(!bank.nodes().some(node=>node.type==='button'&&String(node.props.children).includes('Học đợt tiếp theo')));
assert.deepEqual(calls.map(call=>call.offset),[0,25,25,50]);assert.equal(new Set(calls.map(call=>call.seed)).size,1);assert.ok(calls.every(call=>call.subject==='Sinh lý'));
console.log('PASS all-bank practice: 53 questions over 25/25/3; stable seed and subject; duplicate start/submit blocked; failed next page retains result and retries same offset.');
let pending,aiCalls=0,capturedSignal;
const ai=harness('src/components/ai/AiCenter.tsx',{
 '../../services/studentJourneyService':{readStudentJourney:()=>({}),recordAiUse(){}},
 '../../services/studyAiService':{askStudyGemini:(_q,_context,_page,signal)=>{aiCalls++;capturedSignal=signal;return new Promise(resolve=>pending=resolve)}}
},{member:{id:'fixture-member',fullName:'Test'},onOpenResearch(){}});
await ai.flush();ai.nodes().find(node=>node.type==='textarea').props.onChange({target:{value:'Giải thích một khái niệm'}});ai.render();const form=ai.nodes().find(node=>node.type==='form');form.props.onSubmit({preventDefault(){}});form.props.onSubmit({preventDefault(){}});assert.equal(aiCalls,1);ai.unmount();assert.ok(capturedSignal.aborted);pending({answer:'Late answer',sources:[]});await ai.flush();assert.ok(!ai.text().includes('Late answer'));
console.log('PASS AI: duplicate submissions blocked, unmount aborts request, late response ignored.');
const resourceExports={};let capturedArgs;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/learningResourceService.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
 exports:resourceExports,require:()=>({supabase:{rpc:(_name,args)=>{capturedArgs=args;return Promise.resolve({data:[
  {resourceKey:'hiu_res_0123456789abcdef0123',title:'Published',status:'published',audience:'members',sourceId:'must-not-leak'},
  {resourceKey:'hiu_res_1123456789abcdef0123',title:'Draft',status:'draft',audience:'members'},
  {resourceKey:'hiu_res_2123456789abcdef0123',title:'Private',status:'published',audience:'private'},
  {resourceKey:'unsafe',title:'Invalid',status:'published',audience:'members'}
 ]})}}})
});
const resources=await resourceExports.listPublishedLearningResources();assert.equal(resources.length,1);assert.equal(resources[0].title,'Published');assert.ok(!('sourceId' in resources[0]));assert.equal(capturedArgs.p_include_drafts,false);
console.log('PASS library: excludes drafts/private/invalid resources and strips source locator metadata.');
