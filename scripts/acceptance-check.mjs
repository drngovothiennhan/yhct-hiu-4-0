import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const required=[
  'src/App.tsx','src/main.tsx','src/theme.ts','src/components/admin/SystemAdminCenter.tsx','src/components/admin/AdminControlCenter.tsx','src/components/admin/ModerationOpsPanel.tsx',
  'src/components/drl/DrlCenter.tsx','src/components/research/ResearchCenter.tsx','src/components/schedule/ScheduleCenter.tsx','src/components/notifications/NotificationsCenter.tsx',
  'src/components/ai/PersonalCopilotWidget.tsx','src/components/news/TcmNewsRotator.tsx','src/components/community/CommunitySidebar.tsx','src/components/branding/SystemBrandMark.tsx',
  'src/components/branding/TcmCartoonDecor.tsx','src/components/system/ViewportModeToggle.tsx','src/services/offlineCache.ts','src/services/socialService.ts','src/services/miniAiEngine.ts','src/services/geminiByok.ts',
  'src/mobile-audit.css','src/final-hotfix.css','src/mobile-social.css','src/mobile-social-compat.css','src/mini-ai.css','src/viewport-news-final.css','src/viewport-native-hotfix.css',
  'src/news-rotator.css','src/desktop-community.css','src/final4-v2.css','src/workers/drlParseWorker.ts','src/workers/docxParseWorker.ts',
  'api/_lib/member-access.js','api/ai/diagnostics.js','api/research/drive.js','api/weather.js','scripts/role-ui-audit.mjs','public/service-worker.js','public/yhct-system-mark.svg',
  'ops/sql/community_sidebar_v1.sql','ops/sql/final_2_0_score_publication.sql'
];
const errors=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
for(const file of required)if(!fs.existsSync(path.join(root,file)))errors.push(`missing ${file}`);
if(fs.existsSync(path.join(root,'src/components/news/TcmNewsCenter.tsx')))errors.push('retired TcmNewsCenter module must be deleted');

const packageJson=JSON.parse(read('package.json'));
if(String(packageJson.dependencies?.xlsx||'').includes('0.18.5'))errors.push('vulnerable xlsx 0.18.5 is forbidden');
if(!String(packageJson.scripts?.prebuild||'').includes('audit:roles'))errors.push('prebuild must run independent role audit');

const files=[];
const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);entry.isDirectory()?walk(p):/\.(?:ts|tsx|js|css)$/.test(entry.name)&&files.push(p)}};
for(const scope of ['src','api'])walk(path.join(root,scope));
const forbidden=[
  [/sk-proj-[A-Za-z0-9_-]{20,}/,'raw OpenAI secret'],[/AIza[0-9A-Za-z0-9_-]{20,}/,'raw Google/Gemini secret'],
  [/dangerouslySetInnerHTML/,'dangerous raw HTML rendering'],[/\bTODO\b|\bFIXME\b|implement later|code logic here/i,'unfinished implementation marker'],
  [/logo-clb-yhct-hiu/i,'obsolete club logo reference'],[/drive\.google\.com\/drive\/folders\//i,'direct Google Drive folder URL'],
  [/1IjoX3TwCz-mp4g6tE72OnWv2rH00m1NX/,'retired client-visible YHCT Drive folder id']
];
for(const file of files){const body=fs.readFileSync(file,'utf8');for(const [re,label] of forbidden)if(re.test(body))errors.push(`${label} in ${path.relative(root,file)}`)}

for(const file of ['index.html','public/manifest.webmanifest','public/service-worker.js']){const body=read(file);if(/logo-clb-yhct-hiu/i.test(body))errors.push(`obsolete club logo reference in ${file}`);if(!/yhct-system-mark\.svg/i.test(body))errors.push(`system SVG mark missing from ${file}`)}

const boot=read('index.html');
for(const token of ['yhct-viewport-mode-v1','dataset.viewportMode','width=1280,viewport-fit=cover','width=device-width,initial-scale=1'])if(!boot.includes(token))errors.push(`early viewport bootstrap gate missing ${token}`);
if(boot.includes('width=1280,initial-scale=1')||boot.includes('width=1280, initial-scale=1'))errors.push('desktop viewport must not force initial-scale=1 on narrow phones');

const rotator=read('src/components/news/TcmNewsRotator.tsx');
for(const token of ['ROTATE_MS=8000','REFRESH_MS=5*60*1000','tcm_news_feed_v1','target="_blank"','desktopViewport',"addEventListener('wheel'",'{passive:false}','scrollLeft+=dominant','onMouseDown','onMouseMove','finishMouseDrag','suppressClickRef','news-rotator-nav','cachePut','cacheGet'])if(!rotator.includes(token))errors.push(`Final 4 news gate missing ${token}`);
for(const forbiddenToken of ['pointerType!','setPointerCapture','releasePointerCapture'])if(rotator.includes(forbiddenToken))errors.push(`Final 4 PC news must not be touch/pen-only: ${forbiddenToken}`);
const rotatorCss=read('src/news-rotator.css');
for(const token of ['overflow-x:auto','scroll-snap-type:x mandatory','cursor:grab','touch-action:pan-x pan-y','.news-rotator-nav','@media(max-width:760px)'])if(!rotatorCss.includes(token))errors.push(`Final 4 news CSS gate missing ${token}`);
if(!/\.news-rotator-nav\{display:none\}/.test(rotatorCss.replace(/\s+/g,'')))errors.push('desktop news arrows must be hidden on mobile');

const community=read('src/components/community/CommunitySidebar.tsx');
for(const token of ["type GroupKey='leadership'|'management'|'active'",'PAGE_SIZE=3','ROTATE_MS=8000','ACTIVE_LIMIT=10',"supabase.rpc('community_sidebar_v2')",'total_credits','credit_rank','Top 10 Tín dụng Cộng đồng','community-credit-badge'])if(!community.includes(token))errors.push(`community credits UI gate missing ${token}`);
for(const sensitive of ['student_code','studentCode','email','phone'])if(community.includes(sensitive))errors.push(`community sidebar must not expose ${sensitive}`);

const worker=read('src/workers/drlParseWorker.ts');
for(const token of ['header:1','diem_de_xuat_drl','ten_hoat_dong','suggested_semester_code','duplicateStudentCodes','duplicateRows','logicalKey','toUpperCase()','hiu_drl_proposal'])if(!worker.includes(token))errors.push(`DRL parser gate missing ${token}`);
const drl=read('src/components/drl/DrlCenter.tsx');
for(const token of ['drl_admin_import_v1','drl_admin_upsert_semester_v1','drl_admin_publish_semester_v1','drl_public_lookup_v2','is_published','Đã chốt điểm','Đang tổng hợp / Chờ duyệt',"canPublish=roleAtLeast(member?.role,'admin')",'step:1|2','Tiếp tục xác nhận','Xác nhận công bố','cachePut','cacheGet'])if(!drl.includes(token))errors.push(`DRL publication/import gate missing ${token}`);

const theme=read('src/theme.ts');
for(const token of ["'tcm-cartoon-2d'",'localStorage.setItem(KEY,theme)','YHCT Hoạt hình 2D'])if(!theme.includes(token))errors.push(`2D theme gate missing ${token}`);
const app=read('src/App.tsx');
for(const token of ['TcmCartoonDecor','toggleCartoonTheme','theme-quick-toggle',"setTheme('tcm-cartoon-2d')",'ViewportModeToggle','mobile-bottom-nav','PersonalCopilotWidget member={member}'])if(!app.includes(token))errors.push(`application shell/theme gate missing ${token}`);
const featureCss=read('src/final4-v2.css');
for(const token of ["html[data-theme='tcm-cartoon-2d']",'--cartoon-jade','--cartoon-apricot','--cartoon-cinnabar','--cartoon-cinnamon','.tcm-cartoon-decor','.drl-publish-dialog','.community-credit-badge'])if(!featureCss.includes(token))errors.push(`Final 4 V2 CSS gate missing ${token}`);

const social=read('src/services/socialService.ts');
for(const token of ['enforceDebounce','create-post','comment:${me.id}:${postId}'])if(!social.includes(token))errors.push(`community anti-spam debounce gate missing ${token}`);
const offline=read('src/services/offlineCache.ts');
for(const token of ['indexedDB.open','cachePut','cacheGet','expiresAt'])if(!offline.includes(token))errors.push(`offline IndexedDB gate missing ${token}`);

const driveApi=read('api/research/drive.js');
for(const token of ["memberAccess(req,'admin')",'process.env.YHCT_DRIVE_FOLDER_ID','process.env.GOOGLE_DRIVE_API_KEY','Cache-Control','no-store'])if(!driveApi.includes(token))errors.push(`secure Drive API gate missing ${token}`);
for(const token of ['req.query?.folderId','webViewLink'])if(driveApi.includes(token))errors.push(`secure Drive API must not expose client-controlled/direct links: ${token}`);
const weather=read('api/weather.js');
for(const token of ["new URL(req.url||'/'","searchParams.get('lat')","searchParams.get('lon')"])if(!weather.includes(token))errors.push(`WHATWG weather URL gate missing ${token}`);
if(weather.includes('req.query'))errors.push('weather route must not use legacy req.query parser');

const main=read('src/main.tsx');
for(const token of ["import './viewport-native-hotfix.css';","import './news-rotator.css';","import './desktop-community.css';","import './final4-v2.css';"])if(!main.includes(token))errors.push(`main CSS order gate missing ${token}`);
if(main.lastIndexOf('final4-v2.css')<main.lastIndexOf('desktop-community.css'))errors.push('Final 4 V2 CSS must load after desktop community CSS');

const sw=read('public/service-worker.js');
for(const token of ['final4-v2-offline','NAV_TIMEOUT_MS=4500','navigationResponse','staticResponse'])if(!sw.includes(token))errors.push(`service worker Final 4 offline gate missing ${token}`);

if(errors.length){console.error('ACCEPTANCE CHECK FAILED');errors.forEach(error=>console.error(`- ${error}`));process.exit(1)}
console.log(`acceptance-ok: ${files.length} application source files scanned; Final 4 PC news + explicit DRL publication + lifetime community credits + 2D theme + offline cache gates clean`);
