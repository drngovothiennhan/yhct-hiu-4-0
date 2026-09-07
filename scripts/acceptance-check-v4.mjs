import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const errors=[];
const file=(p)=>path.join(root,p);
const read=(p)=>fs.readFileSync(file(p),'utf8');
const mustExist=[
  'src/components/news/TcmNewsRotator.tsx','src/news-rotator.css',
  'src/components/drl/DrlCenter.tsx','src/workers/drlParseWorker.ts',
  'src/components/community/CommunitySidebar.tsx','src/services/offlineCache.ts',
  'src/components/branding/TcmCartoonDecor.tsx','src/theme.ts','src/App.tsx',
  'public/service-worker.js','scripts/role-ui-audit.mjs'
];
for(const p of mustExist)if(!fs.existsSync(file(p)))errors.push(`missing ${p}`);

const sourceFiles=[];
const walk=(dir)=>{if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(?:ts|tsx|js|mjs|css)$/.test(entry.name))sourceFiles.push(p)}};
walk(file('src'));walk(file('api'));
const forbidden=[
  [/sk-proj-[A-Za-z0-9_-]{20,}/,'raw OpenAI secret'],
  [/AIza[0-9A-Za-z_-]{20,}/,'raw Google/Gemini secret'],
  [/dangerouslySetInnerHTML/,'dangerous raw HTML rendering'],
  [/\bTODO\b|\bFIXME\b|implement later|code logic here/i,'unfinished implementation marker'],
  [/drive\.google\.com\/drive\/folders\//i,'direct Google Drive folder URL']
];
for(const p of sourceFiles){const body=fs.readFileSync(p,'utf8');for(const [re,label] of forbidden)if(re.test(body))errors.push(`${label} in ${path.relative(root,p)}`)}

const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))errors.push(`${label} missing ${token}`)};

const rotator=read('src/components/news/TcmNewsRotator.tsx');
need(rotator,["tcm_news_feed_v1","addEventListener('wheel'","passive:false","scrollLeft","onMouseDown","onMouseMove","onMouseUp","suppressClickRef","target=\"_blank\"","news-rotator-prev","news-rotator-next"],'PC news rotator');
const rotatorCss=read('src/news-rotator.css');
need(rotatorCss,['overflow-x:auto','scroll-snap-type:x mandatory','cursor:grab','cursor:grabbing','.news-rotator-nav','.news-rotator-prev','.news-rotator-next','@media(max-width:760px)','.news-rotator-nav{display:none}'],'PC news CSS');
if(/touch-action\s*:\s*none/.test(rotatorCss))errors.push('news rotator must not use touch-action:none');

const worker=read('src/workers/drlParseWorker.ts');
need(worker,['mssv','ho_ten','ten_hoat_dong','hoc_ky','diem_cong','ghi_chu','logicalKey','seenLogical','duplicateRows','toUpperCase()'],'DRL parser');
const drl=read('src/components/drl/DrlCenter.tsx');
need(drl,['drl_public_lookup_v2','drl_public_search_v1','drl_admin_import_v1','drl_admin_publish_semester_v1','cacheGet','cachePut','PublishDialog','step:1|2','canPublish','is_published','Đang tổng hợp / Chờ duyệt','Đã chốt điểm'],'DRL center');
if(!drl.includes("roleAtLeast(member?.role,'admin')"))errors.push('DRL publication must require admin role in UI');

const community=read('src/components/community/CommunitySidebar.tsx');
need(community,["supabase.rpc('community_sidebar_v2')",'total_credits','credit_rank','creditLevel','ACTIVE_LIMIT=10','Top 10 Tín dụng Cộng đồng'],'community credits UI');
for(const token of ['student_code','email','phone'])if(community.includes(token))errors.push(`community sidebar exposes sensitive field ${token}`);

const theme=read('src/theme.ts');
need(theme,["'tcm-cartoon-2d'",'#159A84','#F5C453','#C8554F','#D9824A','localStorage','dataset.theme'],'2D theme tokens');
const app=read('src/App.tsx');
need(app,['toggleCartoonTheme','TcmCartoonDecor','theme-quick-toggle','2D YHCT'],'2D one-click toggle');

const cache=read('src/services/offlineCache.ts');
need(cache,['indexedDB','cacheGet','cachePut'],'offline IndexedDB cache');
const sw=read('public/service-worker.js');
need(sw,["CACHE='yhct-hiu-4-final4-v2-offline'",'navigationResponse','staticResponse','AbortController','caches.match'],'service worker offline-first');

const pkg=JSON.parse(read('package.json'));
if(String(pkg.dependencies?.xlsx||'').includes('0.18.5'))errors.push('vulnerable xlsx 0.18.5 is forbidden');
if(!String(pkg.scripts?.prebuild||'').includes('audit:roles'))errors.push('prebuild must retain independent role audit');

if(errors.length){console.error('FINAL 4 ACCEPTANCE CHECK FAILED');for(const error of errors)console.error(`- ${error}`);process.exit(1)}
console.log(`final4-acceptance-ok: ${sourceFiles.length} source files scanned; PC news, DRL publication, lifetime credits, 2D theme and offline resilience gates passed`);
