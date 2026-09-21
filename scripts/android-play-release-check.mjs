import {loadImage,createCanvas} from '@napi-rs/canvas';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd(),failures=[];
const ok=(condition,message)=>condition?console.log(`PASS ${message}`):failures.push(message);
const read=(rel)=>readFile(path.join(root,rel),'utf8');
const exists=async(rel)=>{try{await access(path.join(root,rel));return true}catch{return false}};

const config=JSON.parse(await read('capacitor.config.json'));
ok(config.appId==='edu.hiu.yhct40','Capacitor appId');
ok(config.webDir==='dist','bundled dist matches PWA build');
ok(!config.server?.url,'no production server.url');
ok(config.android?.allowMixedContent===false,'mixed content disabled');
ok(config.android?.captureInput===true,'existing captureInput preserved');

const gradle=await read('android/app/build.gradle');
ok(/applicationId\s+["']edu\.hiu\.yhct40["']/.test(gradle),'Play applicationId');
ok(/versionCode\s+6\b/.test(gradle),'versionCode 6');
ok(/versionName\s+["']1\.0\.4["']/.test(gradle),'versionName 1.0.4');

const vars=await read('android/variables.gradle');
ok(/compileSdkVersion\s*=\s*36\b/.test(vars),'compileSdk 36');
ok(/targetSdkVersion\s*=\s*36\b/.test(vars),'targetSdk 36');

const manifest=await read('android/app/src/main/AndroidManifest.xml');
ok(/android:name=["']\.MainActivity["'][\s\S]*?android:windowSoftInputMode=["']adjustResize["']/.test(manifest),'keyboard adjustResize');

for(const f of ['dist/index.html','dist/manifest.webmanifest','dist/service-worker.js','release-assets/play-icon-512.png'])ok(await exists(f),`${f} exists`);

const iconRel='android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png';
if(await exists(iconRel)){
  const img=await loadImage(path.join(root,iconRel)),canvas=createCanvas(img.width,img.height),ctx=canvas.getContext('2d');
  ctx.drawImage(img,0,0);
  const corners=[[0,0],[img.width-1,0],[0,img.height-1],[img.width-1,img.height-1]];
  ok(corners.every(([x,y])=>ctx.getImageData(x,y,1,1).data[3]===0),'launcher corners transparent; white plate removed');
}else failures.push('xxxhdpi launcher icon missing');

const bg=await read('android/app/src/main/res/values/ic_launcher_background.xml');
ok(!/#fff(?:fff)?\b/i.test(bg),'adaptive launcher background not white');

if(failures.length){
  console.error('\nAndroid Play release checks failed:');
  failures.forEach(f=>console.error(`- ${f}`));
  process.exit(1);
}
console.log('\nAndroid Play release contract passed.');
