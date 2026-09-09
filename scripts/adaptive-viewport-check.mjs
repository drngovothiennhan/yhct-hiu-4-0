import {spawn,spawnSync} from 'node:child_process';
import {mkdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=process.env.CHROME_BIN?.trim()||spawnSync('bash',['-lc','command -v google-chrome'],{encoding:'utf8'}).stdout.trim();
if(!chrome)throw new Error('Google Chrome is required for adaptive viewport QA.');
const outDir=path.resolve('adaptive-viewport-artifacts');await mkdir(outDir,{recursive:true});
const target=(process.env.CHROME_SMOKE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
let preview=null;
const watchdog=setTimeout(()=>{console.error('Adaptive viewport watchdog exceeded 90 seconds.');try{preview?.kill('SIGKILL')}catch{}process.exit(124)},90000);
if(!process.env.CHROME_SMOKE_URL){
  const vite=path.resolve('node_modules/vite/bin/vite.js');
  preview=spawn(process.execPath,[vite,'preview','--host','127.0.0.1','--port','4173'],{stdio:'ignore',env:process.env});
  let ready=false;for(let i=0;i<60;i++){try{const r=await fetch(`${target}/`);if(r.ok){ready=true;break}}catch{}await sleep(250)}
  if(!ready)throw new Error('Vite preview did not become ready.');
}
async function openCdp(port){for(let i=0;i<160;i++){try{const list=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();const page=list.find(x=>x.type==='page');if(page?.webSocketDebuggerUrl)return page.webSocketDebuggerUrl}catch{}await sleep(100)}throw new Error(`Chrome CDP ${port} not ready`)}
async function stopChrome(proc,profile){try{if(proc.exitCode===null)proc.kill('SIGTERM')}catch{}await sleep(200);try{if(proc.exitCode===null)proc.kill('SIGKILL')}catch{}await rm(profile,{recursive:true,force:true}).catch(()=>{})}
async function runCase(c,index){
  const port=9340+index,profile=path.join(os.tmpdir(),`yhct-adaptive-${c.name}-${process.pid}`);await rm(profile,{recursive:true,force:true});
  const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});let ws=null;
  try{
    ws=new WebSocket(await openCdp(port));await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error(`${c.name}: websocket timeout`)),5000);ws.addEventListener('open',()=>{clearTimeout(t);resolve()},{once:true});ws.addEventListener('error',e=>{clearTimeout(t);reject(e)},{once:true})});
    let seq=0;const pending=new Map();const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,t=setTimeout(()=>{pending.delete(id);reject(new Error(`${c.name}: CDP timeout ${method}`))},7000);pending.set(id,{resolve,reject,t});ws.send(JSON.stringify({id,method,params}))});
    ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id&&pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.t);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}});
    await send('Page.enable');await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:c.width,height:c.height,deviceScaleFactor:c.dpr,mobile:c.mobile,screenWidth:c.width,screenHeight:c.height,dontSetVisibleSize:false});
    if(c.mobile)await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    if(c.forceDesktop){
      await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('yhct-viewport-contract-v3','1');localStorage.setItem('yhct-force-desktop-on-mobile-v1','1');localStorage.setItem('yhct-viewport-mode-v1','desktop');localStorage.setItem('yhct-mobile-ui-v2','pc')}catch{}`});
    }
    await send('Page.navigate',{url:`${target}/`});
    let complete=false;for(let i=0;i<70;i++){const r=await send('Runtime.evaluate',{expression:'document.readyState',returnByValue:true});if(r.result?.value==='complete'){complete=true;break}await sleep(150)}if(!complete)throw new Error(`${c.name}: page not complete`);await sleep(1100);
    const r=await send('Runtime.evaluate',{expression:`(()=>{const html=document.documentElement,body=document.body,app=document.querySelector('.app'),main=document.querySelector('main'),aside=document.querySelector('.app>aside'),bottom=document.querySelector('.mobile-bottom-nav'),post=document.querySelector('.post-card'),news=document.querySelector('.news-card'),rect=e=>{const x=e?.getBoundingClientRect();return x?{left:x.left,right:x.right,width:x.width,top:x.top,bottom:x.bottom}:null};return{innerWidth,innerHeight,devicePixelRatio,mode:html.dataset.viewportMode||'',displayClass:html.dataset.displayClass||'',reportedWidth:Number(html.dataset.viewportWidth||0),reportedDpr:Number(html.dataset.devicePixelRatio||0),appReady:html.dataset.appReady||'',docScrollWidth:html.scrollWidth,bodyScrollWidth:body.scrollWidth,app:rect(app),main:rect(main),aside:rect(aside),post:rect(post),news:rect(news),asideScrollWidth:aside?.scrollWidth||0,asideClientWidth:aside?.clientWidth||0,mainScrollWidth:main?.scrollWidth||0,mainClientWidth:main?.clientWidth||0,asideVisible:!!aside&&getComputedStyle(aside).display!=='none',bottomVisible:!!bottom&&getComputedStyle(bottom).display!=='none'}})()`,returnByValue:true});
    const s=r.result.value,expectedMode=c.forceDesktop?'desktop':c.mobile?'mobile':'desktop';
    if(s.appReady!=='1')throw new Error(`${c.name}: app not ready ${JSON.stringify(s)}`);
    if(s.mode!==expectedMode)throw new Error(`${c.name}: expected ${expectedMode}, got ${s.mode}`);
    if(Math.abs(s.innerWidth-c.width)>1)throw new Error(`${c.name}: viewport width mismatch ${s.innerWidth}/${c.width}`);
    if(Math.abs(s.devicePixelRatio-c.dpr)>.05)throw new Error(`${c.name}: DPR mismatch ${s.devicePixelRatio}/${c.dpr}`);
    if(Math.abs(s.reportedWidth-c.width)>2||Math.abs(s.reportedDpr-c.dpr)>.05)throw new Error(`${c.name}: device capability dataset stale ${JSON.stringify(s)}`);
    if(s.docScrollWidth>s.innerWidth+2||s.bodyScrollWidth>s.innerWidth+2)throw new Error(`${c.name}: horizontal page overflow ${JSON.stringify(s)}`);
    for(const [label,x] of [['app',s.app],['main',s.main]])if(!x||x.left<-2||x.right>s.innerWidth+2)throw new Error(`${c.name}: ${label} outside viewport ${JSON.stringify(s)}`);
    if(expectedMode==='mobile'&&(!s.bottomVisible||s.asideVisible))throw new Error(`${c.name}: mobile chrome mismatch ${JSON.stringify(s)}`);
    if(expectedMode==='desktop'&&(!s.asideVisible||s.bottomVisible))throw new Error(`${c.name}: desktop chrome mismatch ${JSON.stringify(s)}`);
    if(c.forceDesktop){
      if(!s.aside||s.aside.width>s.innerWidth*.32+2)throw new Error(`${c.name}: compact desktop sidebar still consumes too much phone width ${JSON.stringify(s)}`);
      if(!s.main||s.main.width<s.innerWidth*.68-2)throw new Error(`${c.name}: compact desktop main column is still crushed ${JSON.stringify(s)}`);
      if(s.asideScrollWidth>s.asideClientWidth+2)throw new Error(`${c.name}: compact desktop sidebar overflows horizontally ${JSON.stringify(s)}`);
      if(s.mainScrollWidth>s.mainClientWidth+2)throw new Error(`${c.name}: compact desktop main overflows horizontally ${JSON.stringify(s)}`);
      for(const [label,x] of [['post',s.post],['news',s.news]])if(x&&(x.left<s.main.left-2||x.right>s.main.right+2))throw new Error(`${c.name}: ${label} escapes compact desktop main column ${JSON.stringify(s)}`);
    }
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(outDir,`${c.name}.png`),Buffer.from(shot.data,'base64'));await writeFile(path.join(outDir,`${c.name}.json`),JSON.stringify(s,null,2));console.log('ADAPTIVE VIEWPORT PASS',c.name,JSON.stringify(s));
  }finally{if(ws)try{ws.close()}catch{}await stopChrome(proc,profile)}
}
const cases=[
  {name:'mobile-390x844-dpr3',width:390,height:844,dpr:3,mobile:true},
  {name:'mobile-desktop-mode-390x844-dpr3',width:390,height:844,dpr:3,mobile:true,forceDesktop:true},
  {name:'mobile-desktop-mode-430x932-dpr3',width:430,height:932,dpr:3,mobile:true,forceDesktop:true},
  {name:'win11-1024x768-dpr1',width:1024,height:768,dpr:1,mobile:false},
  {name:'win11-1366x768-dpr125',width:1366,height:768,dpr:1.25,mobile:false},
  {name:'win11-1920x1080-dpr1',width:1920,height:1080,dpr:1,mobile:false}
];
let exit=0;try{for(let i=0;i<cases.length;i++)await runCase(cases[i],i);console.log(`Adaptive mobile/desktop-on-phone/Win11 viewport matrix passed against ${target}`)}catch(e){exit=1;console.error(e instanceof Error?e.stack||e.message:String(e))}finally{clearTimeout(watchdog);try{if(preview?.exitCode===null)preview.kill('SIGTERM')}catch{}await sleep(200);try{if(preview?.exitCode===null)preview.kill('SIGKILL')}catch{}}process.exit(exit);
