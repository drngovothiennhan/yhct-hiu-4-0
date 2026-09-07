import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const required=[
  'src/App.tsx','src/main.tsx','src/theme.ts','src/components/admin/SystemAdminCenter.tsx','src/components/admin/AdminControlCenter.tsx','src/components/admin/AdminThemeControl.tsx','src/components/admin/ModerationOpsPanel.tsx',
  'src/components/profile/ProfileCenter.tsx','src/services/authRuntimeService.ts','src/components/drl/DrlCenter.tsx','src/components/research/ResearchCenter.tsx','src/components/schedule/ScheduleCenter.tsx','src/components/notifications/NotificationsCenter.tsx',
  'src/components/ai/PersonalCopilotWidget.tsx','src/components/news/TcmNewsRotator.tsx','src/components/community/CommunitySidebar.tsx','src/components/branding/SystemBrandMark.tsx','src/components/branding/TcmCartoonDecor.tsx','src/components/system/ViewportModeToggle.tsx',
  'src/services/offlineCache.ts','src/services/socialService.ts','src/services/miniAiEngine.ts','src/services/geminiByok.ts','src/news-rotator.css','src/desktop-community.css','src/final4-v2.css','src/desktop-interaction-profile.css',
  'src/workers/drlParseWorker.ts','src/workers/docxParseWorker.ts','api/_lib/member-access.js','api/ai/diagnostics.js','api/research/drive.js','api/weather.js','scripts/role-ui-audit.mjs','public/service-worker.js','public/yhct-system-mark.svg',
  'ops/sql/community_sidebar_v1.sql','ops/sql/final_2_0_score_publication.sql'
];
const errors=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))errors.push(`${label} missing ${token}`)};
for(const file of required)if(!fs.existsSync(path.join(root,file)))errors.push(`missing ${file}`);
if(fs.existsSync(path.join(root,'src/components/news/TcmNewsCenter.tsx')))errors.push('retired TcmNewsCenter module must be deleted');

const packageJson=JSON.parse(read('package.json'));
if(String(packageJson.dependencies?.xlsx||'').includes('0.18.5'))errors.push('vulnerable xlsx 0.18.5 is forbidden');
if(!String(packageJson.scripts?.prebuild||'').includes('audit:roles'))errors.push('prebuild must run independent role audit');

const files=[];
const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);entry.isDirectory()?walk(p):/\.(?:ts|tsx|js|css)$/.test(entry.name)&&files.push(p)}};
for(const scope of ['src','api'])walk(path.join(root,scope));
const forbidden=[
  [/sk-proj-[A-Za-z0-9_-]{20,}/,'raw OpenAI secret'],[/AIza[0-9A-Za-z_-]{20,}/,'raw Google/Gemini secret'],[/dangerouslySetInnerHTML/,'dangerous raw HTML rendering'],[/\bTODO\b|\bFIXME\b|implement later|code logic here/i,'unfinished implementation marker'],[/logo-clb-yhct-hiu/i,'obsolete club logo reference'],[/drive\.google\.com\/drive\/folders\//i,'direct Google Drive folder URL'],[/1IjoX3TwCz-mp4g6tE72OnWv2rH00m1NX/,'retired client-visible YHCT Drive folder id']
];
for(const file of files){const body=fs.readFileSync(file,'utf8');for(const [re,label] of forbidden)if(re.test(body))errors.push(`${label} in ${path.relative(root,file)}`)}

const boot=read('index.html');
need(boot,['yhct-viewport-mode-v1','dataset.viewportMode','width=1280,viewport-fit=cover','width=device-width,initial-scale=1'],'early viewport bootstrap');
if(boot.includes('width=1280,initial-scale=1')||boot.includes('width=1280, initial-scale=1'))errors.push('desktop viewport must not force initial-scale=1 on narrow phones');

const rotator=read('src/components/news/TcmNewsRotator.tsx'),rotatorCss=read('src/news-rotator.css');
need(rotator,['ROTATE_MS=8000','REFRESH_MS=5*60*1000','tcm_news_feed_v1','target="_blank"','desktopInteractionEnabled',"addEventListener('wheel'",'{passive:false}','pending+=delta','onMouseDown','onMouseMove','finishMouseDrag','suppressClickRef','news-rotator-nav','cachePut','cacheGet'],'Final 4 news');
need(rotatorCss,['overflow-x:auto','scroll-snap-type:x mandatory','cursor:grab','touch-action:auto','.news-rotator-nav','@media(max-width:760px)'],'Final 4 news CSS');
if(!/\.news-rotator-nav\{display:none\}/.test(rotatorCss.replace(/\s+/g,'')))errors.push('desktop news arrows must be hidden on mobile');

const community=read('src/components/community/CommunitySidebar.tsx'),desktop=read('src/desktop-interaction-profile.css');
need(community,["type GroupKey='leadership'|'management'|'active'",'PAGE_SIZE=3','ROTATE_MS=8000','ACTIVE_LIMIT=10',"supabase.rpc('community_sidebar_v2')",'community-member-button','onClick={()=>onOpen(item)}','role="dialog"','Top 10 Tín dụng Cộng đồng'],'community interaction');
for(const sensitive of ['student_code','studentCode','email','phone'])if(community.includes(sensitive))errors.push(`community sidebar must not expose ${sensitive}`);
need(desktop,['@media screen and (min-width:1024px)','html[data-viewport-mode="desktop"]','pointer-events:auto!important','community-member-button:hover','community-member-button:focus-visible','color-scheme:light','text-size-adjust:100%'],'desktop canonical interaction');

const worker=read('src/workers/drlParseWorker.ts'),drl=read('src/components/drl/DrlCenter.tsx');
need(worker,['header:1','diem_de_xuat_drl','ten_hoat_dong','suggested_semester_code','duplicateStudentCodes','duplicateRows','logicalKey','toUpperCase()','hiu_drl_proposal'],'DRL parser');
need(drl,['drl_admin_import_v1','drl_admin_upsert_semester_v1','drl_admin_publish_semester_v1','drl_public_lookup_v2','is_published','Đã chốt điểm','Đang tổng hợp / Chờ duyệt',"canPublish=roleAtLeast(member?.role,'admin')",'step:1|2','Tiếp tục xác nhận','Xác nhận công bố','cachePut','cacheGet'],'DRL publication/import');

const theme=read('src/theme.ts'),adminTheme=read('src/components/admin/AdminThemeControl.tsx'),adminOps=read('src/components/admin/AdminControlCenter.tsx'),app=read('src/App.tsx');
need(theme,["'tcm-cartoon-2d'","'tcm-isometric-3d'",'localStorage.setItem(KEY,theme)','dataset.theme'],'theme tokens');
need(adminTheme,['2D Flat','3D Isometric',"onChange('tcm-cartoon-2d')","onChange('tcm-isometric-3d')"],'ACC theme control');
need(app,['TcmCartoonDecor','AdminThemeControl theme={theme}',"canAcc=roleAtLeast(member?.role,'admin')","applyTheme(canAcc?theme:'duoc-ngoc',canAcc)",'ViewportModeToggle','mobile-bottom-nav','PersonalCopilotWidget member={member}',"window.location.pathname==='/profile'",'auth-submit-spinner'],'application shell');
for(const stale of ['theme-quick-toggle','mobile-theme-action','toggleCartoonTheme'])if(app.includes(stale))errors.push(`public theme control must be absent: ${stale}`);
for(const stale of ['THEME_OPTIONS','onThemeChange','theme-settings'])if(adminOps.includes(stale))errors.push(`member operations must not expose theme control: ${stale}`);

const profile=read('src/components/profile/ProfileCenter.tsx'),authRuntime=read('src/services/authRuntimeService.ts');
need(profile,['member_profile_summary_v1','community_credits','drl_semesters','Đổi mật khẩu','Mật khẩu hiện tại','Mật khẩu mới','Xác nhận mật khẩu mới','changeMemberPassword'],'profile/password');
need(authRuntime,['loginOptimized','8000','AbortController','member-change-password','Authorization:`Bearer ${session.access_token}`'],'bounded auth runtime');

const featureCss=read('src/final4-v2.css');
need(featureCss,["html[data-theme='tcm-cartoon-2d']",'--cartoon-jade','--cartoon-apricot','--cartoon-cinnabar','--cartoon-cinnamon','.tcm-cartoon-decor','.drl-publish-dialog','.community-credit-badge'],'Final 4 V2 CSS');
const social=read('src/services/socialService.ts');need(social,['enforceDebounce','create-post','comment:${me.id}:${postId}'],'community anti-spam debounce');
const offline=read('src/services/offlineCache.ts');need(offline,['indexedDB.open','cachePut','cacheGet','expiresAt'],'offline IndexedDB');

const driveApi=read('api/research/drive.js');need(driveApi,["memberAccess(req,'admin')",'process.env.YHCT_DRIVE_FOLDER_ID','process.env.GOOGLE_DRIVE_API_KEY','Cache-Control','no-store'],'secure Drive API');for(const token of ['req.query?.folderId','webViewLink'])if(driveApi.includes(token))errors.push(`secure Drive API must not expose ${token}`);
const weather=read('api/weather.js');need(weather,["new URL(req.url||'/'","searchParams.get('lat')","searchParams.get('lon')"],'WHATWG weather URL');if(weather.includes('req.query'))errors.push('weather route must not use legacy req.query parser');

const main=read('src/main.tsx');need(main,["import './viewport-native-hotfix.css';","import './news-rotator.css';","import './desktop-community.css';","import './final4-v2.css';","import './desktop-interaction-profile.css';"],'main CSS order');if(main.lastIndexOf('desktop-interaction-profile.css')<main.lastIndexOf('final4-v2.css'))errors.push('desktop interaction/profile CSS must load after frozen Final 4 CSS');
const sw=read('public/service-worker.js');need(sw,['final4-v2-offline','NAV_TIMEOUT_MS=4500','navigationResponse','staticResponse'],'service worker Final 4 offline');

if(errors.length){console.error('ACCEPTANCE CHECK FAILED');errors.forEach(error=>console.error(`- ${error}`));process.exit(1)}
console.log(`acceptance-ok: ${files.length} application source files scanned; frozen mobile + desktop interaction + ACC theme + profile/password + DRL + offline gates clean`);
