import {spawn,spawnSync} from 'node:child_process';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const explicit=process.env.CHROME_BIN?.trim();
const chrome=explicit||spawnSync('bash',['-lc','command -v google-chrome'],{encoding:'utf8'}).stdout.trim();
if(!chrome)throw new Error('Google Chrome is required for browser QA; google-chrome was not found on the runner.');
const outDir=path.resolve('browser-artifacts');await mkdir(outDir,{recursive:true});
let preview=null;
const target=process.env.CHROME_SMOKE_URL||'http://127.0.0.1:4173/';
const baseTarget=target.replace(/\/$/,'');
const watchdog=setTimeout(()=>{console.error('Chrome smoke watchdog exceeded 90 seconds.');try{preview?.kill('SIGKILL')}catch{}process.exit(124)},90000);
if(!process.env.CHROME_SMOKE_URL){
  const vite=path.resolve('node_modules/vite/bin/vite.js');
  preview=spawn(process.execPath,[vite,'preview','--host','127.0.0.1','--port','4173'],{stdio:'ignore',env:process.env});
  let ready=false;
  for(let i=0;i<60;i++){try{const r=await fetch(target);if(r.ok){ready=true;break}}catch{}await sleep(250)}
  if(!ready){preview.kill('SIGTERM');throw new Error('Vite preview did not become ready for Chrome QA.');}
}

async function openCdp(port){
  for(let i=0;i<80;i++){
    try{
      const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page=list.find(x=>x.type==='page');
      if(page?.webSocketDebuggerUrl)return page.webSocketDebuggerUrl;
    }catch{}
    await sleep(100);
  }
  throw new Error(`Chrome DevTools endpoint ${port} did not become ready.`);
}

async function stopChrome(proc,profile){
  try{if(proc.exitCode===null)proc.kill('SIGTERM')}catch{}
  await sleep(300);
  try{if(proc.exitCode===null)proc.kill('SIGKILL')}catch{}
  await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100}).catch(()=>{});
}

async function runCase(name,width,height,port){
  const profile=path.join(os.tmpdir(),`yhct-chrome-${name}-${process.pid}`);await rm(profile,{recursive:true,force:true});
  const proc=spawn(chrome,[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',
    `--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,`--window-size=${width},${height}`,'about:blank'
  ],{stdio:'ignore'});
  let ws=null;
  try{
    const wsUrl=await openCdp(port);
    ws=new WebSocket(wsUrl);await Promise.race([
      new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})}),
      sleep(5000).then(()=>{throw new Error(`${name}: Chrome WebSocket open timeout`)})
    ]);
    let seq=0;const pending=new Map();const runtimeErrors=[];
    ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id&&pending.has(m.id)){const {resolve,reject,timer}=pending.get(m.id);clearTimeout(timer);pending.delete(m.id);m.error?reject(new Error(m.error.message)):resolve(m.result)}if(m.method==='Runtime.exceptionThrown')runtimeErrors.push(m.params?.exceptionDetails?.text||'Runtime exception')});
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${name}: CDP timeout on ${method}`))},7000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
    const waitReady=async()=>{let loaded=false;const start=Date.now();while(Date.now()-start<15000){const r=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(r?.result?.value==='complete'){loaded=true;break}await sleep(200)}if(!loaded)throw new Error(`${name}: page did not reach complete readyState.`);await sleep(1500)};
    const inspect=async()=>{const r=await send('Runtime.evaluate',{expression:`(()=>({title:document.title,innerWidth:window.innerWidth,pathname:location.pathname,mode:document.documentElement.dataset.viewportMode||'',mobileUi:document.documentElement.dataset.mobileUi||'',heading:document.querySelector('.top-title h1')?.textContent||'',bottomNav:!!document.querySelector('.mobile-bottom-nav')&&getComputedStyle(document.querySelector('.mobile-bottom-nav')).display!=='none',aside:!!document.querySelector('aside')&&getComputedStyle(document.querySelector('aside')).display!=='none',bodyText:(document.body.innerText||'').slice(0,500)}))()`,returnByValue:true});return r.result.value};
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    const version=await send('Browser.getVersion');
    await send('Page.navigate',{url:target});await waitReady();
    const state=await inspect();
    if(!String(version.product||'').startsWith('Chrome/'))throw new Error(`${name}: browser is not Chrome: ${version.product}`);
    if(!state.title.includes('YHCT HIU 4.0'))throw new Error(`${name}: unexpected title ${state.title}`);
    if(name==='mobile'&&(state.innerWidth>980||state.mode!=='mobile'||!state.bottomNav||state.aside))throw new Error(`mobile: responsive contract failed: ${JSON.stringify(state)}`);
    if(name==='desktop'&&(state.innerWidth<981||state.mode!=='desktop'||!state.aside||state.bottomNav))throw new Error(`desktop: responsive contract failed: ${JSON.stringify(state)}`);

    let routeRefresh=null;
    if(name==='mobile'){
      await send('Page.navigate',{url:`${baseTarget}/research`});await waitReady();
      const before=await inspect();
      await send('Page.reload',{ignoreCache:true});await waitReady();
      const after=await inspect();
      routeRefresh={before,after};
      if(before.pathname!=='/research'||after.pathname!=='/research'||!before.heading.includes('Khám phá học thuật')||!after.heading.includes('Khám phá học thuật'))throw new Error(`mobile: refresh route persistence failed: ${JSON.stringify(routeRefresh)}`);
    }
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outDir,`chrome-${name}.png`),Buffer.from(shot.data,'base64'));
    await writeFile(path.join(outDir,`chrome-${name}.json`),JSON.stringify({target,browser:version.product,state,routeRefresh,runtimeErrors},null,2));
    if(runtimeErrors.length)throw new Error(`${name}: runtime exceptions: ${runtimeErrors.join(' | ')}`);
    console.log(`Chrome ${name} PASS`,version.product,JSON.stringify({state,routeRefresh}));
  }finally{
    if(ws)try{ws.close()}catch{}
    await stopChrome(proc,profile);
  }
}

let exitCode=0;
try{
  await runCase('mobile',390,844,9222);
  await runCase('desktop',1440,1000,9223);
  console.log(`Real Google Chrome smoke passed against ${target}`);
}catch(error){
  exitCode=1;console.error(error instanceof Error?error.stack||error.message:String(error));
}finally{
  clearTimeout(watchdog);
  try{if(preview?.exitCode===null)preview.kill('SIGTERM')}catch{}
  await sleep(250);
  try{if(preview?.exitCode===null)preview.kill('SIGKILL')}catch{}
}
process.exit(exitCode);
