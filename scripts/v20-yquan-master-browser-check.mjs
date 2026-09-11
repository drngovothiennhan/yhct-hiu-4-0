import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import ts from 'typescript';

const chrome=process.env.CHROME_BIN||spawnSync('bash',['-lc','command -v google-chrome'],{encoding:'utf8'}).stdout.trim();
if(!chrome)throw new Error('Chrome required for master character rendering QA');
const compiled=ts.transpileModule(fs.readFileSync('src/components/game/yquan-v20/DoctorMasterRig.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#ddd4bc;color:#203e35;font-family:Arial}h1{font-size:18px;padding:12px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:12px}section{text-align:center;min-width:0;border:1px solid #aaae9e;border-radius:12px;background:#e8e1cd}svg{width:100%;height:340px;overflow:visible}h2{font-size:13px}@media(max-width:600px){main{grid-template-columns:repeat(2,1fr)}svg{height:240px}}
</style></head><body><h1>HIU Y QUÁN · Original master animation QA</h1><main></main><script type="module">
import {DOCTOR_MASTERS,renderDoctorMaster,doctorMasterPose} from '/rig.js';
try{
 const clips=['idle','walk_front','pulse_check','cook_medicine'];
 for(const gender of ['male','female']){
  const master=DOCTOR_MASTERS[gender];const image=new Image();image.src=master.source;await image.decode();
  for(const animation of clips){
   const id=gender+'-'+animation;const card=document.createElement('section');
   card.innerHTML='<h2>'+gender+' · '+animation+'</h2><svg xmlns="http://www.w3.org/2000/svg" viewBox="'+master.viewBox+'" data-master-gender="'+gender+'"><defs>'+master.layers.map(l=>'<clipPath id="'+id+'-'+l.part+'"><path d="'+l.outline+'"/></clipPath>').join('')+'</defs><g data-master-body>'+master.layers.map(l=>'<g data-master-part="'+l.part+'"><image href="'+master.source+'" width="1536" height="1536" clip-path="url(#'+id+'-'+l.part+')"/></g>').join('')+'</g></svg>';
   document.querySelector('main').append(card);renderDoctorMaster(card,animation,2);
   if(card.querySelectorAll('image').length!==master.layers.length)throw new Error('Missing original image layer');
   if([...card.querySelectorAll('[data-master-part]')].some(g=>!g.getAttribute('transform')||/NaN|undefined/.test(g.getAttribute('transform'))))throw new Error('Invalid pose transform');
  }
 }
 if(document.documentElement.scrollWidth>innerWidth)throw new Error('Horizontal overflow');
 document.body.dataset.qa='pass';
}catch(error){document.body.dataset.qa='fail';document.body.append(String(error));}
</script></body></html>`;
const server=createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}
 if(req.url==='/rig.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled);return}
 const match=/^\/assets\/hiu-y-quan\/characters\/master\/doctor-(male|female)-original\.jpg$/.exec(req.url||'');
 if(match){res.setHeader('Content-Type','image/jpeg');res.end(fs.readFileSync('public'+req.url));return}
 res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;const out=path.resolve('browser-artifacts');fs.mkdirSync(out,{recursive:true});
try{
 for(const [name,width,height] of [['desktop',1440,900],['mobile',390,1250]]){
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'yquan-master-'));
  try{
   await new Promise((resolve,reject)=>{
    const proc=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars',`--user-data-dir=${profile}`,`--window-size=${width},${height}`,'--virtual-time-budget=5000',`--screenshot=${out}/yquan-master-${name}.png`,'--dump-dom',`http://127.0.0.1:${port}/`]);
    let stdout='',stderr='';proc.stdout.on('data',d=>stdout+=d);proc.stderr.on('data',d=>stderr+=d);
    const timer=setTimeout(()=>{proc.kill('SIGKILL');reject(new Error('Character browser QA timeout'))},30000);
    proc.on('error',error=>{clearTimeout(timer);reject(error)});
    proc.on('close',code=>{clearTimeout(timer);code===0&&stdout.includes('data-qa="pass"')?resolve():reject(new Error(`${name}: character render failed (${code}) ${stdout.slice(-1500)} ${stderr.slice(-600)}`))});
   });
   console.log(`PASS ${name}: original image layers, rendered poses and viewport bounds`);
  }finally{fs.rmSync(profile,{recursive:true,force:true})}
 }
}finally{server.close()}
