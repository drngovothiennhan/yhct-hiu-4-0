import {createCanvas,loadImage} from '@napi-rs/canvas';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';

const VERSION_CODE=6;
const VERSION_NAME='1.0.4';
const TARGET_SDK=36;
const APP_ID='edu.hiu.yhct40';
const ADAPTIVE_BG='#F6F1E7';
const root=process.cwd();

async function mustRead(rel){
  try{return await readFile(path.join(root,rel),'utf8')}
  catch(error){throw new Error(`Missing required file: ${rel} (${error.message})`)}
}
async function writeText(rel,value){await writeFile(path.join(root,rel),value,'utf8')}
function replaceOrFail(source,re,replacement,label){
  if(!re.test(source))throw new Error(`Cannot locate ${label}`);
  return source.replace(re,replacement);
}

let appGradle=await mustRead('android/app/build.gradle');
if(!appGradle.includes(`applicationId "${APP_ID}"`)&&!appGradle.includes(`applicationId '${APP_ID}'`))throw new Error(`Unexpected applicationId; expected ${APP_ID}`);
appGradle=replaceOrFail(appGradle,/versionCode\s+\d+/, `versionCode ${VERSION_CODE}`,'versionCode');
appGradle=replaceOrFail(appGradle,/versionName\s+["'][^"']+["']/, `versionName "${VERSION_NAME}"`,'versionName');
await writeText('android/app/build.gradle',appGradle);

let variables=await mustRead('android/variables.gradle');
variables=replaceOrFail(variables,/compileSdkVersion\s*=\s*\d+/, `compileSdkVersion = ${TARGET_SDK}`,'compileSdkVersion');
variables=replaceOrFail(variables,/targetSdkVersion\s*=\s*\d+/, `targetSdkVersion = ${TARGET_SDK}`,'targetSdkVersion');
await writeText('android/variables.gradle',variables);

let manifest=await mustRead('android/app/src/main/AndroidManifest.xml');
const mainActivity=/<activity\b[^>]*android:name=["']\.MainActivity["'][^>]*>/m;
const activityMatch=manifest.match(mainActivity)?.[0];
if(!activityMatch)throw new Error('MainActivity declaration not found in AndroidManifest.xml');
let patchedActivity=activityMatch;
if(/android:windowSoftInputMode=["'][^"']*["']/.test(patchedActivity))patchedActivity=patchedActivity.replace(/android:windowSoftInputMode=["'][^"']*["']/,'android:windowSoftInputMode="adjustResize"');
else patchedActivity=patchedActivity.replace(/>$/,' android:windowSoftInputMode="adjustResize">');
manifest=manifest.replace(activityMatch,patchedActivity);
await writeText('android/app/src/main/AndroidManifest.xml',manifest);

const svgRaw=await mustRead('public/club-yhct-logo.svg');
const transparentSvg=svgRaw
  .replace(/<rect\b[^>]*width=["']512["'][^>]*height=["']512["'][^>]*fill=["']#fff(?:fff)?["'][^>]*\/>/i,'')
  .replace(/<rect\b[^>]*fill=["']#fff(?:fff)?["'][^>]*width=["']512["'][^>]*height=["']512["'][^>]*\/>/i,'');
if(transparentSvg===svgRaw)throw new Error('White logo background rectangle was not found; refusing ambiguous launcher icon generation.');
const logo=await loadImage(Buffer.from(transparentSvg));

async function renderPng(outPath,size,{inset=0,background=null}={}){
  const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,size,size);
  if(background){ctx.fillStyle=background;ctx.fillRect(0,0,size,size)}
  const drawSize=size-inset*2;
  ctx.drawImage(logo,inset,inset,drawSize,drawSize);
  await mkdir(path.dirname(outPath),{recursive:true});
  await writeFile(outPath,canvas.toBuffer('image/png'));
}

const density={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
for(const [name,size] of Object.entries(density)){
  const dir=path.join(root,`android/app/src/main/res/mipmap-${name}`);
  await renderPng(path.join(dir,'ic_launcher.png'),size);
  await renderPng(path.join(dir,'ic_launcher_round.png'),size);
  const adaptiveSize=Math.round(size*2.25);
  const inset=Math.round(adaptiveSize*0.15);
  await renderPng(path.join(dir,'ic_launcher_foreground.png'),adaptiveSize,{inset});
}

await mkdir(path.join(root,'android/app/src/main/res/values'),{recursive:true});
await writeText('android/app/src/main/res/values/ic_launcher_background.xml',
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ADAPTIVE_BG}</color>\n</resources>\n`);

const adaptiveXml=`<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n`;
for(const rel of ['android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml','android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml']){
  await mkdir(path.dirname(path.join(root,rel)),{recursive:true});
  await writeText(rel,adaptiveXml);
}

await renderPng(path.join(root,'release-assets','play-icon-512.png'),512,{inset:12});
await writeText('release-assets/android-release.json',JSON.stringify({
  appId:APP_ID,versionCode:VERSION_CODE,versionName:VERSION_NAME,compileSdk:TARGET_SDK,targetSdk:TARGET_SDK,
  webDir:'dist',keyboard:'adjustResize',nativeOrigin:'https://localhost',
  launcherBackground:'transparent legacy / #F6F1E7 adaptive',generatedAt:new Date().toISOString()
},null,2)+'\n');

console.log(`Prepared Android Play release ${APP_ID} ${VERSION_NAME} (${VERSION_CODE}), target API ${TARGET_SDK}.`);
