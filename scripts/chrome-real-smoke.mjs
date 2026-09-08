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
const productionSmoke=Boolean(process.env.CHROME_SMOKE_URL);
const watchdog=setTimeout(()=>{console.error('Chrome smoke watchdog exceeded 90 seconds.');try{preview?.kill('SIGKILL')}catch{}process.exit(124)},90000);
const THEME_COLORS={'duoc-ngoc':'#174c3c','muc-tuyen':'#202824','ngu-y':'#651f24','tcm-cartoon-2d':'#159a84','tcm-isometric-3d':'#176b5a','tcm-spring-2d':'#147d67','tcm-cloud-2d':'#376f9f','tcm-mint-modern':'#0f766e'};
if(!process.env.CHROME_SMOKE_URL){
  const vite=path.resolve('node_modules/vite/bin/vite.js');
  preview=spawn(process.execPath,[vite,'preview','--host','127.0.0.1','--port','4173'],{stdio:'ignore',env:process.env});
  let ready=false;
  for(let i=0;i<60;i++){try{const r=await fetch(target);if(r.ok){ready=true;break}}catch{}await sleep(250)}
  if(!ready){preview.kill('SIGTERM');throw new Error('Vite preview did not become ready for Chrome QA.');}
}

async function openCdp(port){
  for(let i=0;i<160;i++){
    try{
      const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page=list.find(x=>x.type==='page');
      if(page?.webSocketDebuggerUrl)return page.webSocketDebuggerUrl;
    }catch{}
    await sleep(100);
  }
  throw new Error(`Chrome DevTools endpoint ${port} did not become ready within 16 seconds.`);
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
    let seq=0;const pending=new Map();const runtimeErrors=[];const consoleErrors=[];
    ws.addEventListener('message',event=>{
      const m=JSON.parse(String(event.data));
      if(m.id&&pending.has(m.id)){const {resolve,reject,timer}=pending.get(m.id);clearTimeout(timer);pending.delete(m.id);m.error?reject(new Error(m.error.message)):resolve(m.result)}
      if(m.method==='Runtime.exceptionThrown')runtimeErrors.push(m.params?.exceptionDetails?.text||'Runtime exception');
      if(m.method==='Runtime.consoleAPICalled'&&['error','assert'].includes(m.params?.type))consoleErrors.push((m.params?.args||[]).map(arg=>arg.value??arg.description??arg.type).join(' ').slice(0,1000)||`console.${m.params?.type}`);
    });
    const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${name}: CDP timeout on ${method}`))},7000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
    const waitReady=async()=>{let loaded=false;const start=Date.now();while(Date.now()-start<15000){const r=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(r?.result?.value==='complete'){loaded=true;break}await sleep(200)}if(!loaded)throw new Error(`${name}: page did not reach complete readyState.`);await sleep(1800)};
    const inspect=async()=>{const r=await send('Runtime.evaluate',{expression:`(()=>({title:document.title,innerWidth:window.innerWidth,innerHeight:window.innerHeight,devicePixelRatio:window.devicePixelRatio,pathname:location.pathname,mode:document.documentElement.dataset.viewportMode||'',mobileUi:document.documentElement.dataset.mobileUi||'',theme:document.documentElement.dataset.theme||'',themeColor:(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')||'').toLowerCase(),manifestHref:document.querySelector('link[rel="manifest"]')?.href||'',legacyTheme:localStorage.getItem('yhct-hiu-ui-theme-v1'),heading:document.querySelector('.top-title h1')?.textContent||'',activeModule:document.querySelector('.app')?.getAttribute('data-active-module')||'',bottomNav:!!document.querySelector('.mobile-bottom-nav')&&getComputedStyle(document.querySelector('.mobile-bottom-nav')).display!=='none',aside:!!document.querySelector('aside')&&getComputedStyle(document.querySelector('aside')).display!=='none',bodyText:(document.body.innerText||'').slice(0,700)}))()`,returnByValue:true});return r.result.value};
    const auditMobileOverlays=async()=>{
      const r=await send('Runtime.evaluate',{expression:`(()=>{const rectOf=el=>{const r=el?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};const intersects=(a,b)=>!!a&&!!b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;const visible=el=>!!el&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';const search=document.querySelector('.research-search');const title=document.querySelector('.top-title');const selectors=['.copilot-fab','.ai-feedback-trigger','.mobile-more-button'];const controls=selectors.map(selector=>{const el=document.querySelector(selector);return{selector,visible:visible(el),rect:visible(el)?rectOf(el):null}});const searchRect=rectOf(search),titleRect=rectOf(title);return{searchRect,titleRect,controls,searchOverlaps:controls.filter(x=>x.visible&&intersects(searchRect,x.rect)).map(x=>x.selector),titleOverlaps:controls.filter(x=>x.visible&&intersects(titleRect,x.rect)).map(x=>x.selector),outOfViewport:controls.filter(x=>x.visible&&x.rect&&(x.rect.left<0||x.rect.top<0||x.rect.right>innerWidth||x.rect.bottom>innerHeight)).map(x=>x.selector)}})()`,returnByValue:true});return r.result.value;
    };
    const auditThemeRecovery=async initial=>{
      if(!THEME_COLORS[initial.theme])throw new Error(`${name}: unknown initial system theme ${initial.theme}`);
      const stale=initial.theme==='ngu-y'?'tcm-cloud-2d':'ngu-y';
      await send('Runtime.evaluate',{expression:`localStorage.setItem('yhct-hiu-ui-theme-v1',${JSON.stringify(stale)})`});
      await send('Page.reload',{ignoreCache:true});await waitReady();await sleep(1200);
      const recovered=await inspect();
      if(recovered.legacyTheme!==null)throw new Error(`${name}: legacy local theme storage was not purged: ${JSON.stringify({stale,legacyTheme:recovered.legacyTheme})}`);
      if(!THEME_COLORS[recovered.theme])throw new Error(`${name}: recovered unknown system theme ${recovered.theme}`);
      if(recovered.theme===stale)throw new Error(`${name}: stale local theme still controls the UI: ${JSON.stringify({initial:initial.theme,stale,recovered:recovered.theme})}`);
      const expectedColor=THEME_COLORS[recovered.theme];
      if(recovered.themeColor!==expectedColor)throw new Error(`${name}: meta theme-color mismatch for recovered system theme ${recovered.theme}: expected ${expectedColor}, got ${recovered.themeColor}`);
      if(productionSmoke&&!recovered.manifestHref.includes('/api/manifest'))throw new Error(`${name}: browser manifest link is not dynamic: ${recovered.manifestHref}`);
      let manifest=null;
      if(productionSmoke){
        const result=await send('Runtime.evaluate',{expression:`fetch('/api/manifest?qa=theme-${Date.now()}',{cache:'no-store'}).then(async r=>({ok:r.ok,status:r.status,cache:r.headers.get('cache-control')||'',serverTheme:r.headers.get('x-yhct-system-theme')||'',body:await r.json()}))`,awaitPromise:true,returnByValue:true});
        manifest=result.result.value;
        if(!manifest?.ok)throw new Error(`${name}: dynamic manifest request failed: ${JSON.stringify(manifest)}`);
        if(!THEME_COLORS[manifest.serverTheme])throw new Error(`${name}: manifest returned unknown backend theme: ${JSON.stringify(manifest)}`);
        const manifestExpected=THEME_COLORS[manifest.serverTheme];
        if(String(manifest.body?.theme_color||'').toLowerCase()!==manifestExpected)throw new Error(`${name}: manifest theme_color does not match its backend theme: ${JSON.stringify(manifest)}`);
        if(!String(manifest.cache).includes('no-store'))throw new Error(`${name}: manifest must be no-store: ${JSON.stringify(manifest)}`);
        if(manifest.body?.display!=='standalone'||manifest.body?.id!=='./'||manifest.body?.prefer_related_applications!==false)throw new Error(`${name}: installable PWA manifest contract failed: ${JSON.stringify(manifest.body)}`);
        if(!Array.isArray(manifest.body?.icons)||manifest.body.icons.length<2)throw new Error(`${name}: PWA manifest requires regular + maskable icons.`);
        if(!Array.isArray(manifest.body?.shortcuts)||!manifest.body.shortcuts.some(x=>String(x?.url||'').includes('research'))||!manifest.body.shortcuts.some(x=>String(x?.url||'').includes('profile')))throw new Error(`${name}: PWA manifest shortcuts contract failed.`);
      }
      return {initialTheme:initial.theme,staleTheme:stale,recoveredTheme:recovered.theme,themeColor:recovered.themeColor,legacyTheme:recovered.legacyTheme,manifestHref:recovered.manifestHref,manifest};
    };
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    if(name==='mobile'){
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true,screenWidth:width,screenHeight:height,positionX:0,positionY:0,dontSetVisibleSize:false});
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    }
    const version=await send('Browser.getVersion');
    await send('Page.navigate',{url:target});await waitReady();
    const state=await inspect();
    if(!String(version.product||'').startsWith('Chrome/'))throw new Error(`${name}: browser is not Chrome: ${version.product}`);
    if(!state.title.includes('YHCT HIU 4.0'))throw new Error(`${name}: unexpected title ${state.title}`);
    if(name==='mobile'&&(state.innerWidth!==width||state.innerWidth>980||state.mode!=='mobile'||!state.bottomNav||state.aside))throw new Error(`mobile: responsive contract failed: ${JSON.stringify(state)}`);
    if(name==='desktop'&&(state.innerWidth<981||state.mode!=='desktop'||!state.aside||state.bottomNav))throw new Error(`desktop: responsive contract failed: ${JSON.stringify(state)}`);
    const themeAudit=await auditThemeRecovery(state);
    let routeRefresh=null;let overlayAudit=null;
    if(name==='mobile'){
      await send('Page.navigate',{url:`${baseTarget}/research`});await waitReady();
      const before=await inspect();overlayAudit=await auditMobileOverlays();
      if(overlayAudit.searchOverlaps.length||overlayAudit.titleOverlaps.length||overlayAudit.outOfViewport.length)throw new Error(`mobile: overlay contract failed: ${JSON.stringify(overlayAudit)}`);
      await send('Page.reload',{ignoreCache:true});await waitReady();const after=await inspect();routeRefresh={before,after};
      if(before.pathname!=='/research'||after.pathname!=='/research'||before.activeModule!=='research'||after.activeModule!=='research'||!before.heading.includes('Trung tâm nghiên cứu')||!after.heading.includes('Trung tâm nghiên cứu'))throw new Error(`mobile: modular research refresh route persistence failed: ${JSON.stringify(routeRefresh)}`);
      if(!before.bodyText.includes('OpenAlex')||!before.bodyText.includes('A.I LÀ TRỌNG TÂM'))throw new Error(`mobile: research OpenAlex AI surface missing: ${before.bodyText}`);
    }
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outDir,`chrome-${name}.png`),Buffer.from(shot.data,'base64'));
    await writeFile(path.join(outDir,`chrome-${name}.json`),JSON.stringify({target,browser:version.product,state,themeAudit,routeRefresh,overlayAudit,runtimeErrors,consoleErrors},null,2));
    if(runtimeErrors.length)throw new Error(`${name}: runtime exceptions: ${runtimeErrors.join(' | ')}`);
    if(consoleErrors.length)throw new Error(`${name}: console errors: ${consoleErrors.join(' | ')}`);
    console.log(`Chrome ${name} PASS`,version.product,JSON.stringify({state,themeAudit,routeRefresh,overlayAudit}));
  }finally{if(ws)try{ws.close()}catch{}await stopChrome(proc,profile)}
}

let exitCode=0;
try{await runCase('mobile',390,844,9222);await runCase('desktop',1440,1000,9223);console.log(`Real Google Chrome smoke passed against ${target}`)}catch(error){exitCode=1;console.error(error instanceof Error?error.stack||error.message:String(error))}finally{clearTimeout(watchdog);try{if(preview?.exitCode===null)preview.kill('SIGTERM')}catch{}await sleep(250);try{if(preview?.exitCode===null)preview.kill('SIGKILL')}catch{}}
process.exit(exitCode);
