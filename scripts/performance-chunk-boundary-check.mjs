import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

const root=process.cwd();
const mode=process.argv.includes('--dist')?'dist':'source';
const failures=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>failures.push(message);
const ok=message=>console.log(`PERF OK: ${message}`);

function sourceCheck(){
  const vite=read('vite.config.ts');
  const app=read('src/App.tsx');
  const requiredVendorChunks=["return 'vendor-react'","return 'vendor-supabase'","return 'vendor-icons'","return 'vendor-documents'",'return undefined'];
  for(const token of requiredVendorChunks)vite.includes(token)?ok(`Vite vendor boundary contains ${token}`):fail(`Vite vendor boundary missing ${token}`);
  if(vite.includes("normalized.includes('/src/components/"))fail('Vite must not manually chunk src/components application modules');
  else ok('Application modules are not forced into manual chunks');

  const lazyRoutes=[
    "lazy(()=>import('./components/feed/AcademicFeed'))",
    "lazy(()=>import('./components/research/ResearchCenter'))",
    "lazy(()=>import('./components/profile/ProfileCenter'))",
    "lazy(()=>import('./components/game/HerbGardenGame'))",
    "lazy(()=>import('./components/notifications/NotificationsCenter'))",
    "lazy(()=>import('./components/schedule/ScheduleCenter'))",
    "lazy(()=>import('./components/drl/DrlCenter'))",
    "lazy(()=>import('./components/exam/ExamCenter'))",
    "lazy(()=>import('./components/admin/AdminControlCenter'))",
    "lazy(()=>import('./components/admin/SystemAdminCenter'))"
  ];
  for(const token of lazyRoutes)app.includes(token)?ok(`Route boundary remains lazy: ${token.match(/components\/(.+?)'\)/)?.[1]||token}`):fail(`Missing lazy route boundary ${token}`);
}

function assetPath(href){
  const clean=href.split('?')[0].split('#')[0].replace(/^https?:\/\/[^/]+/,'').replace(/^\//,'');
  return path.join(root,'dist',clean);
}

function distCheck(){
  const htmlPath=path.join(root,'dist/index.html');
  if(!fs.existsSync(htmlPath)){fail('dist/index.html is missing; run npm run build first');return}
  const html=fs.readFileSync(htmlPath,'utf8');
  const preloads=[...html.matchAll(/<link\b[^>]*rel=["']modulepreload["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map(match=>match[1]);
  const styles=[...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi)].map(match=>match[1]);
  const script=html.match(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/i)?.[1]||'';
  const preloadNames=preloads.map(value=>path.basename(value));

  console.log(`PERF METRIC: initial modulepreload count=${preloads.length}`);
  console.log(`PERF METRIC: initial modulepreloads=${preloadNames.join(', ')||'(none)'}`);

  const forbiddenPreloadTokens=[
    'vendor-documents',
    'module-research','module-profile','module-garden','module-notifications','module-schedule','module-drl','module-exam','module-admin','module-acc',
    'ResearchCenter','ProfileCenter','HerbGardenGame','HerbGardenSocialHub','NotificationsCenter','ScheduleCenter','DrlCenter','ExamCenter','AdminControlCenter','LearningContentManagerPanel','SystemAdminCenter','AdminThemeControl','AdminOpsAssistant'
  ];
  for(const token of forbiddenPreloadTokens){
    const hit=preloadNames.find(name=>name.includes(token));
    if(hit)fail(`Initial HTML must not preload lazy-only asset ${hit}`);
  }
  if(!preloadNames.some(name=>name.includes('vendor-react')))fail('Initial HTML should preload vendor-react for the app shell');
  if(!preloadNames.some(name=>name.includes('vendor-supabase')))fail('Initial HTML should preload vendor-supabase for auth/session shell');

  if(script){
    const entryFile=assetPath(script);
    if(!fs.existsSync(entryFile))fail(`Entry script is missing from dist: ${script}`);
    else{
      const entry=fs.readFileSync(entryFile,'utf8');
      const staticImports=[...entry.matchAll(/(?:\bfrom|\bimport)\s*["']([^"']+)["']/g)].map(match=>path.basename(match[1]));
      const forbiddenStatic=staticImports.filter(name=>name.includes('vendor-documents')||/module-(?:research|profile|garden|notifications|schedule|drl|exam|admin|acc)/.test(name));
      if(forbiddenStatic.length)fail(`Entry script statically imports lazy-only chunks: ${[...new Set(forbiddenStatic)].join(', ')}`);
      else ok('Entry script has no static import of vendor-documents or protected lazy route chunks');
    }
  }else fail('dist/index.html does not contain a module entry script');

  let rawCss=0,gzipCss=0,missingCss=0;
  for(const href of styles){
    const file=assetPath(href);
    if(!fs.existsSync(file)){missingCss++;continue}
    const bytes=fs.readFileSync(file);rawCss+=bytes.length;gzipCss+=gzipSync(bytes).length;
  }
  if(missingCss)fail(`${missingCss} initial stylesheet asset(s) referenced by index.html are missing`);
  console.log(`PERF METRIC: initial stylesheet count=${styles.length}`);
  console.log(`PERF METRIC: initial CSS raw=${rawCss} bytes gzip=${gzipCss} bytes`);
  console.log(`PERF METRIC: initial styles=${styles.map(value=>path.basename(value)).join(', ')||'(none)'}`);

  if(!preloadNames.some(name=>name.includes('vendor-documents')))ok('vendor-documents is not on the initial HTML preload path');
}

if(mode==='dist')distCheck();else sourceCheck();
if(failures.length){
  console.error(`PERFORMANCE CHUNK BOUNDARY FAILED (${mode})`);
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Performance chunk boundary PASS (${mode}).`);
