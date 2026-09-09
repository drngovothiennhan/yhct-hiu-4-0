import {spawn,spawnSync} from 'node:child_process';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const target=(process.env.FEED_SYNC_URL||'https://yhct-hiu-final4-stage.vercel.app').replace(/\/$/,'');
const chrome=process.env.CHROME_BIN?.trim()||spawnSync('bash',['-lc','command -v google-chrome'],{encoding:'utf8'}).stdout.trim();
if(!chrome)throw new Error('Google Chrome is required for feed device sync QA.');
const outDir=path.resolve('feed-sync-artifacts');
await mkdir(outDir,{recursive:true});

async function readAuthoritativeFeed(){
  const response=await fetch(`${target}/api/health?resource=academic-feed&limit=3`,{cache:'no-store',headers:{accept:'application/json'}});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!Array.isArray(payload)||payload.length===0)throw new Error(`Authoritative feed gateway failed: HTTP ${response.status}`);
  const top=payload[0];
  if(!top?.id||!top?.title)throw new Error('Authoritative feed has no usable top post.');
  return {id:String(top.id),title:String(top.title),count:payload.length};
}

async function openCdp(port){
  for(let i=0;i<180;i++){
    try{
      const pages=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page=pages.find(item=>item.type==='page');
      if(page?.webSocketDebuggerUrl)return page.webSocketDebuggerUrl;
    }catch{}
    await sleep(100);
  }
  throw new Error(`Chrome DevTools endpoint ${port} did not become ready.`);
}

async function stopChrome(proc,profile){
  try{if(proc.exitCode===null)proc.kill('SIGTERM')}catch{}
  await sleep(250);
  try{if(proc.exitCode===null)proc.kill('SIGKILL')}catch{}
  await rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100}).catch(()=>{});
}

async function runDevice(name,width,height,port,expected){
  const profile=path.join(os.tmpdir(),`yhct-feed-sync-${name}-${process.pid}`);
  await rm(profile,{recursive:true,force:true});
  const proc=spawn(chrome,[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',
    `--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,`--window-size=${width},${height}`,'about:blank'
  ],{stdio:'ignore'});
  let ws=null;
  try{
    ws=new WebSocket(await openCdp(port));
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(`${name}: WebSocket timeout`)),5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});ws.addEventListener('error',error=>{clearTimeout(timer);reject(error)},{once:true})});
    let seq=0;const pending=new Map();const runtimeErrors=[];const consoleErrors=[];
    ws.addEventListener('message',event=>{
      const message=JSON.parse(String(event.data));
      if(message.id&&pending.has(message.id)){
        const item=pending.get(message.id);clearTimeout(item.timer);pending.delete(message.id);
        message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);
      }
      if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params?.exceptionDetails?.text||'Runtime exception');
      if(message.method==='Runtime.consoleAPICalled'&&['error','assert'].includes(message.params?.type))consoleErrors.push((message.params?.args||[]).map(arg=>arg.value??arg.description??arg.type).join(' ').slice(0,1000));
    });
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${name}: CDP timeout on ${method}`))},8000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
    await send('Page.enable');await send('Runtime.enable');
    if(name==='mobile'){
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height,dontSetVisibleSize:false});
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    }
    await send('Page.navigate',{url:`${target}/`});
    let ready=false;
    for(let i=0;i<80;i++){
      const result=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});
      if(result?.result?.value==='complete'){ready=true;break}
      await sleep(150);
    }
    if(!ready)throw new Error(`${name}: page did not finish loading.`);

    let state=null;
    for(let i=0;i<60;i++){
      const evaluated=await send('Runtime.evaluate',{expression:`(()=>{const text=document.body?.innerText||'';const aside=document.querySelector('aside');const bottom=document.querySelector('.mobile-bottom-nav');const cards=[...document.querySelectorAll('[data-post-id]')];const renderedIds=cards.map(card=>card.getAttribute('data-post-id')).filter(Boolean);return{pathname:location.pathname,innerWidth:innerWidth,mode:document.documentElement.dataset.viewportMode||'',appReady:document.documentElement.dataset.appReady||'',heading:document.querySelector('.top-title h1')?.textContent||'',hasExpected:renderedIds.includes(${JSON.stringify(expected.id)}),renderedIds:renderedIds.slice(0,6),hasLegacyDemo:text.includes('Trần An Nhiên')||text.includes('Đau thắt lưng do hàn thấp'),hasSyncError:text.includes('Không thể đồng bộ bảng tin'),asideVisible:!!aside&&getComputedStyle(aside).display!=='none',bottomNavVisible:!!bottom&&getComputedStyle(bottom).display!=='none'}})()`,returnByValue:true});
      state=evaluated.result.value;
      if(state?.hasExpected||state?.hasSyncError||state?.hasLegacyDemo)break;
      await sleep(250);
    }
    if(!state?.hasExpected)throw new Error(`${name}: authoritative top post id was not rendered: ${expected.id}; title=${expected.title}; state=${JSON.stringify(state)}`);
    if(state.hasLegacyDemo)throw new Error(`${name}: synthetic legacy demo content is still visible.`);
    if(state.hasSyncError)throw new Error(`${name}: feed sync error is visible.`);
    if(state.appReady!=='1'||!state.heading.includes('Bảng tin học thuật'))throw new Error(`${name}: app shell was not ready: ${JSON.stringify(state)}`);
    if(name==='mobile'&&(state.mode!=='mobile'||state.innerWidth!==width||state.asideVisible||!state.bottomNavVisible))throw new Error(`mobile: responsive/data contract failed: ${JSON.stringify(state)}`);
    if(name==='desktop'&&(state.mode!=='desktop'||state.innerWidth<981||!state.asideVisible||state.bottomNavVisible))throw new Error(`desktop: responsive/data contract failed: ${JSON.stringify(state)}`);
    if(runtimeErrors.length)throw new Error(`${name}: runtime exceptions: ${runtimeErrors.join(' | ')}`);
    if(consoleErrors.length)throw new Error(`${name}: console errors: ${consoleErrors.join(' | ')}`);
    const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(path.join(outDir,`feed-sync-${name}.png`),Buffer.from(screenshot.data,'base64'));
    return {device:name,width:state.innerWidth,mode:state.mode,topPostId:expected.id,topPostTitle:expected.title,rendered:true,legacyDemoVisible:false,syncErrorVisible:false};
  }finally{
    if(ws)try{ws.close()}catch{}
    await stopChrome(proc,profile);
  }
}

const before=await readAuthoritativeFeed();
const mobile=await runDevice('mobile',390,844,9332,before);
const desktop=await runDevice('desktop',1440,1000,9333,before);
const after=await readAuthoritativeFeed();
if(after.id!==before.id||after.title!==before.title)throw new Error(`Authoritative feed changed during device audit; retry required. Before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
const report={target,authoritative:before,mobile,desktop,verifiedAt:new Date().toISOString()};
await writeFile(path.join(outDir,'feed-sync-report.json'),JSON.stringify(report,null,2));
console.log('FEED DEVICE SYNC PASS',JSON.stringify(report));
