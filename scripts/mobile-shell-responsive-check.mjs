import {spawn,spawnSync} from 'node:child_process';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const chrome=process.env.CHROME_BIN?.trim()||spawnSync('bash',['-lc','command -v google-chrome'],{encoding:'utf8'}).stdout.trim();
if(!chrome)throw new Error('Google Chrome is required for mobile shell QA.');

const target=(process.env.CHROME_SMOKE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const outDir=path.resolve('browser-artifacts');
await mkdir(outDir,{recursive:true});
let preview=null;
let browser=null;
let ws=null;
let profile='';
const watchdog=setTimeout(()=>{console.error('Mobile shell watchdog exceeded 90 seconds.');try{browser?.kill('SIGKILL')}catch{}try{preview?.kill('SIGKILL')}catch{}process.exit(124)},90000);

async function waitPreview(){
  if(process.env.CHROME_SMOKE_URL)return;
  const vite=path.resolve('node_modules/vite/bin/vite.js');
  preview=spawn(process.execPath,[vite,'preview','--host','127.0.0.1','--port','4173'],{stdio:'ignore',env:process.env});
  for(let i=0;i<80;i++){
    try{const response=await fetch(`${target}/`);if(response.ok)return}catch{}
    await sleep(250);
  }
  throw new Error('Vite preview did not become ready.');
}

async function cdpUrl(port,tries=90){
  for(let i=0;i<tries;i++){
    try{
      const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page=pages.find(item=>item.type==='page');
      if(page?.webSocketDebuggerUrl)return page.webSocketDebuggerUrl;
    }catch{}
    await sleep(100);
  }
  return'';
}

async function stopBrowser(){
  try{ws?.close()}catch{}
  ws=null;
  try{if(browser?.exitCode===null)browser.kill('SIGTERM')}catch{}
  await sleep(150);
  try{if(browser?.exitCode===null)browser.kill('SIGKILL')}catch{}
  browser=null;
  if(profile)await rm(profile,{recursive:true,force:true}).catch(()=>{});
  profile='';
}

async function startBrowser(){
  for(let attempt=1;attempt<=3;attempt++){
    const port=9566+attempt;
    profile=path.join(os.tmpdir(),`yhct-mobile-shell-${process.pid}-${attempt}`);
    await rm(profile,{recursive:true,force:true});
    browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
    const url=await cdpUrl(port);
    if(url)return url;
    console.warn(`Mobile shell Chrome CDP startup attempt ${attempt}/3 failed; retrying with isolated profile.`);
    await stopBrowser();
  }
  throw new Error('Chrome CDP did not become ready after 3 isolated attempts.');
}

try{
  await waitPreview();
  ws=new WebSocket(await startBrowser());
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Chrome websocket timeout')),5000);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});
    ws.addEventListener('error',error=>{clearTimeout(timer);reject(error)},{once:true});
  });

  let seq=0;
  const pending=new Map();
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`))},8000);
    pending.set(id,{resolve,reject,timer});
    ws.send(JSON.stringify({id,method,params}));
  });
  ws.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(!message.id||!pending.has(message.id))return;
    const item=pending.get(message.id);clearTimeout(item.timer);pending.delete(message.id);
    message.error?item.reject(new Error(message.error.message)):item.resolve(message.result);
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844,dontSetVisibleSize:false});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await send('Page.navigate',{url:`${target}/`});

  let ready=false;
  for(let i=0;i<240;i++){
    const result=await send('Runtime.evaluate',{expression:`document.readyState==='complete'&&document.documentElement.dataset.appReady==='1'`,returnByValue:true});
    if(result.result?.value===true){ready=true;break}
    await sleep(150);
  }
  if(!ready)throw new Error('Mobile app did not become ready.');

  let shellReady=false;
  let mountState=null;
  for(let i=0;i<80;i++){
    const result=await send('Runtime.evaluate',{expression:`(()=>({nav:Boolean(document.querySelector('.mobile-bottom-nav')),more:Boolean(document.querySelector('.mobile-more-button')),aiRoot:Boolean(document.querySelector('.xz-mini')),aiOrb:Boolean(document.querySelector('.xz-orb')),top:Boolean(document.querySelector('.top'))}))()`,returnByValue:true});
    mountState=result.result?.value||null;
    if(mountState?.nav&&mountState?.more&&mountState?.aiRoot&&mountState?.aiOrb&&mountState?.top){shellReady=true;break}
    await sleep(125);
  }
  if(!shellReady)throw new Error(`Mobile shell controls did not mount: ${JSON.stringify(mountState)}`);
  await sleep(500);

  const result=await send('Runtime.evaluate',{expression:`(()=>{const rect=element=>{const value=element?.getBoundingClientRect();return value?{left:value.left,right:value.right,top:value.top,bottom:value.bottom,width:value.width,height:value.height}:null};const visible=element=>Boolean(element&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).visibility!=='hidden');const intersects=(a,b)=>Boolean(a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);const html=document.documentElement,main=document.querySelector('main'),top=document.querySelector('.top'),title=document.querySelector('.top-title'),nav=document.querySelector('.mobile-bottom-nav'),more=document.querySelector('.mobile-more-button'),fab=document.querySelector('.xz-orb'),label=document.querySelector('.xz-orb>b'),aiRoot=document.querySelector('.xz-mini'),buttons=[...document.querySelectorAll('.mobile-bottom-nav>button')],topRect=rect(top),titleRect=rect(title),mainRect=rect(main),fabRect=rect(fab),labelRect=rect(label);return{mode:html.dataset.viewportMode||'',mobileUi:html.dataset.mobileUi||'',innerWidth,docScrollWidth:html.scrollWidth,bodyScrollWidth:document.body.scrollWidth,mainPaddingBottom:main?parseFloat(getComputedStyle(main).paddingBottom)||0:0,main:mainRect,top:topRect,topVisible:visible(top),title:titleRect,nav:rect(nav),navVisible:visible(nav),navButtonRects:buttons.map(rect),more:rect(more),moreVisible:visible(more),fab:fabRect,fabVisible:visible(fab),label:labelRect,labelVisible:visible(label),aiRootBottom:aiRoot?getComputedStyle(aiRoot).bottom:null,fabTitleOverlap:intersects(fabRect,titleRect),labelTitleOverlap:intersects(labelRect,titleRect),fabMainOverlap:intersects(fabRect,mainRect),labelMainOverlap:intersects(labelRect,mainRect)}})()`,returnByValue:true});
  const state=result.result.value;

  if(state.mode!=='mobile'||state.mobileUi!=='social')throw new Error(`Unexpected mobile shell mode: ${JSON.stringify(state)}`);
  if(state.docScrollWidth>state.innerWidth+3||state.bodyScrollWidth>state.innerWidth+3)throw new Error(`Horizontal overflow: ${JSON.stringify(state)}`);
  if(!state.topVisible||!state.top||state.top.height<60)throw new Error(`Top app bar not usable: ${JSON.stringify(state)}`);
  if(!state.navVisible||!state.nav||state.nav.height<70)throw new Error(`Bottom navigation not usable: ${JSON.stringify(state)}`);
  if(state.navButtonRects.length!==5||state.navButtonRects.some(item=>!item||item.height<44||item.width<44))throw new Error(`Bottom navigation touch target below 44px: ${JSON.stringify(state)}`);
  if(!state.moreVisible||!state.more||state.more.width<44||state.more.height<44)throw new Error(`More button touch target below 44px: ${JSON.stringify(state)}`);
  if(state.mainPaddingBottom<state.nav.height+20)throw new Error(`Main content lacks bottom-navigation clearance: ${JSON.stringify(state)}`);
  if(!state.fabVisible||!state.fab||state.fab.width<44||state.fab.height<44)throw new Error(`Unified AI Mini orb missing or touch target below 44px: ${JSON.stringify(state)}`);
  if(state.fab.bottom>state.nav.top-6)throw new Error(`Unified AI Mini orb overlaps/touches bottom navigation: ${JSON.stringify(state)}`);
  if(state.fab.top<state.top.top-3||state.fab.bottom>state.top.bottom+3)throw new Error(`Unified AI Mini orb escapes top app-bar safe zone: ${JSON.stringify(state)}`);
  if(state.labelVisible&&state.label&&(state.label.top<state.top.top-3||state.label.bottom>state.top.bottom+3))throw new Error(`Unified AI Mini label escapes top app-bar safe zone: ${JSON.stringify(state)}`);
  if(state.fabTitleOverlap||state.labelTitleOverlap)throw new Error(`Unified AI Mini overlaps top title: ${JSON.stringify(state)}`);
  if(state.fabMainOverlap||state.labelMainOverlap)throw new Error(`Unified AI Mini overlaps main study content: ${JSON.stringify(state)}`);

  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(path.join(outDir,'phase7-mobile-shell.png'),Buffer.from(screenshot.data,'base64'));
  await writeFile(path.join(outDir,'phase7-mobile-shell.json'),JSON.stringify(state,null,2));
  console.log('MOBILE SHELL RESPONSIVE PASS',JSON.stringify(state));
}finally{
  clearTimeout(watchdog);
  await stopBrowser();
  try{if(preview?.exitCode===null)preview.kill('SIGTERM')}catch{}
  await sleep(100);
  try{if(preview?.exitCode===null)preview.kill('SIGKILL')}catch{}
}
