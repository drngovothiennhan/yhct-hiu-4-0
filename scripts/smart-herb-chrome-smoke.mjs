import {spawn,spawnSync} from 'node:child_process';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=process.env.CHROME_BIN?.trim()||spawnSync('bash',['-lc','command -v google-chrome'],{encoding:'utf8'}).stdout.trim();
if(!chrome)throw new Error('Google Chrome is required for Smart Herb QA.');
const outDir=path.resolve('browser-artifacts');await mkdir(outDir,{recursive:true});
const origin=(process.env.CHROME_SMOKE_URL||'http://127.0.0.1:4174/').replace(/\/$/,'');
let preview=null;
const watchdog=setTimeout(()=>{try{preview?.kill('SIGKILL')}catch{};console.error('Smart Herb smoke watchdog exceeded 75 seconds.');process.exit(124)},75000);

if(!process.env.CHROME_SMOKE_URL){
  const vite=path.resolve('node_modules/vite/bin/vite.js');
  preview=spawn(process.execPath,[vite,'preview','--host','127.0.0.1','--port','4174'],{stdio:'ignore',env:process.env});
  let ready=false;
  for(let i=0;i<60;i++){try{const r=await fetch(`${origin}/smart-herb?herb=duong-quy`);if(r.ok){ready=true;break}}catch{}await sleep(250)}
  if(!ready)throw new Error('Smart Herb preview did not become ready.');
}

async function openCdp(port){
  for(let i=0;i<120;i++){
    try{const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();const page=list.find(x=>x.type==='page');if(page?.webSocketDebuggerUrl)return page.webSocketDebuggerUrl}catch{}
    await sleep(100);
  }
  throw new Error(`Chrome DevTools endpoint ${port} unavailable.`);
}

async function runCase(name,width,height,port,mobile){
  const profile=path.join(os.tmpdir(),`yhct-smart-herb-${name}-${process.pid}`);await rm(profile,{recursive:true,force:true});
  const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,`--window-size=${width},${height}`,'about:blank'],{stdio:'ignore'});
  let ws;
  try{
    ws=new WebSocket(await openCdp(port));await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
    let seq=0;const pending=new Map();const runtimeErrors=[];const consoleErrors=[];
    ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')runtimeErrors.push(m.params?.exceptionDetails?.text||'Runtime exception');if(m.method==='Runtime.consoleAPICalled'&&['error','assert'].includes(m.params?.type))consoleErrors.push((m.params?.args||[]).map(x=>x.value??x.description??x.type).join(' ').slice(0,800))});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${name}: CDP timeout ${method}`))},7000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
    await send('Page.enable');await send('Runtime.enable');
    if(mobile){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5})}
    await send('Page.navigate',{url:`${origin}/smart-herb?herb=duong-quy`});
    let loaded=false;for(let i=0;i<70;i++){const r=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(r?.result?.value==='complete'){loaded=true;break}await sleep(200)}if(!loaded)throw new Error(`${name}: document did not load.`);await sleep(1800);
    const result=await send('Runtime.evaluate',{expression:`(()=>({pathname:location.pathname,heading:document.querySelector('.smart-herb-hero h1')?.textContent||'',herb:document.querySelector('.smart-herb-profile h2')?.textContent||'',safety:(document.querySelector('.smart-herb-safety')?.textContent||''),source:document.querySelector('.smart-herb-sources a')?.getAttribute('href')||'',innerWidth,scrollWidth:document.documentElement.scrollWidth,body:(document.body.innerText||'').slice(0,1600)}))()`,returnByValue:true});
    const state=result.result.value;
    if(state.pathname!=='/smart-herb')throw new Error(`${name}: wrong route ${state.pathname}`);
    if(!state.heading.includes('Quét mẫu thật'))throw new Error(`${name}: Smart Herb heading missing.`);
    if(!state.herb.includes('Đương quy'))throw new Error(`${name}: deep-link herb not selected.`);
    if(!state.safety.includes('An toàn trước tiên')||!state.body.includes('không thay thế chẩn đoán'))throw new Error(`${name}: medical safety copy missing.`);
    if(!String(state.source).includes('pubmed.ncbi.nlm.nih.gov'))throw new Error(`${name}: PubMed source link missing.`);
    if(state.scrollWidth>state.innerWidth+2)throw new Error(`${name}: horizontal overflow ${state.scrollWidth}>${state.innerWidth}`);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outDir,`smart-herb-${name}.png`),Buffer.from(shot.data,'base64'));await writeFile(path.join(outDir,`smart-herb-${name}.json`),JSON.stringify({origin,state,runtimeErrors,consoleErrors},null,2));
    if(runtimeErrors.length)throw new Error(`${name}: runtime errors: ${runtimeErrors.join(' | ')}`);
    if(consoleErrors.length)throw new Error(`${name}: console errors: ${consoleErrors.join(' | ')}`);
    console.log(`Smart Herb ${name} PASS`,JSON.stringify(state));
  }finally{
    try{ws?.close()}catch{};try{proc.kill('SIGTERM')}catch{};await sleep(200);try{if(proc.exitCode===null)proc.kill('SIGKILL')}catch{};await rm(profile,{recursive:true,force:true}).catch(()=>{});
  }
}

let code=0;
try{await runCase('mobile',390,844,9332,true);await runCase('desktop',1440,1000,9333,false);console.log('Smart Herb Chrome smoke passed.')}catch(error){code=1;console.error(error instanceof Error?error.stack||error.message:String(error))}finally{clearTimeout(watchdog);try{preview?.kill('SIGTERM')}catch{};await sleep(200);try{if(preview?.exitCode===null)preview.kill('SIGKILL')}catch{}}
process.exit(code);
