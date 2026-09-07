import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const required=[
  'src/components/admin/SystemAdminCenter.tsx','src/components/admin/AdminControlCenter.tsx','src/components/admin/ModerationOpsPanel.tsx',
  'src/components/drl/DrlCenter.tsx','src/components/research/ResearchCenter.tsx','src/components/schedule/ScheduleCenter.tsx',
  'src/components/notifications/NotificationsCenter.tsx','src/components/ai/PersonalCopilotWidget.tsx','src/components/news/TcmNewsRotator.tsx',
  'src/components/community/CommunitySidebar.tsx','src/components/branding/SystemBrandMark.tsx','src/components/system/ViewportModeToggle.tsx',
  'src/services/miniAiEngine.ts','src/services/geminiByok.ts','src/data/ai-kb/formulas.ts','src/data/ai-kb/herbs.ts','src/data/ai-kb/acupoints.ts',
  'src/mobile-audit.css','src/final-hotfix.css','src/mobile-social.css','src/mobile-social-compat.css','src/mini-ai.css',
  'src/viewport-news-final.css','src/viewport-native-hotfix.css','src/news-rotator.css','src/desktop-community.css',
  'src/workers/drlParseWorker.ts','src/workers/docxParseWorker.ts','api/_lib/member-access.js','api/ai/diagnostics.js','api/research/drive.js','api/weather.js',
  'scripts/role-ui-audit.mjs','public/service-worker.js','public/yhct-system-mark.svg','ops/sql/community_sidebar_v1.sql','ops/sql/final_2_0_score_publication.sql'
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

const widget=read('src/components/ai/PersonalCopilotWidget.tsx');
for(const token of ['localStorage','onPointerDown','visualViewport','Notification.requestPermission','Điểm kỳ này của tôi','Gemini BYOK','Tra cứu trực tiếp','Kho YHCT','API bảo mật','không mở liên kết/thư mục Drive trực tiếp'])if(!widget.includes(token))errors.push(`Mini AI gate missing ${token}`);
for(const token of ['window.open(','YHCT_RESEARCH_DRIVE_URL','drive.google.com/drive/folders/'])if(widget.includes(token))errors.push(`Mini AI must not open direct Drive resources: ${token}`);
const driveApi=read('api/research/drive.js');
for(const token of ["memberAccess(req,'admin')",'process.env.YHCT_DRIVE_FOLDER_ID','process.env.GOOGLE_DRIVE_API_KEY','Cache-Control','no-store'])if(!driveApi.includes(token))errors.push(`secure Drive API gate missing ${token}`);
for(const token of ['req.query?.folderId','webViewLink'])if(driveApi.includes(token))errors.push(`secure Drive API must not expose client-controlled/direct links: ${token}`);

const viewport=read('src/components/system/ViewportModeToggle.tsx');
for(const token of ["type ViewportMode='desktop'|'mobile'",'dataset.viewportMode','width=1280, viewport-fit=cover','width=device-width','localStorage.setItem(VIEWPORT_MODE_KEY','Xem bản Desktop','Xem bản Mobile'])if(!viewport.includes(token))errors.push(`viewport mode gate missing ${token}`);

const nativeCss=read('src/viewport-native-hotfix.css');
for(const token of ['data-viewport-mode="desktop"','--mobile-module-gap','clamp(34px,10vw,40px)','.auth-brand-mark'])if(!nativeCss.includes(token))errors.push(`viewport/mobile hardening gate missing ${token}`);
for(const token of ['touch-action:pan-y pinch-zoom','scroll-snap-stop:normal'])if(nativeCss.includes(token))errors.push(`retired horizontal-news gesture CSS remains: ${token}`);

const rotator=read('src/components/news/TcmNewsRotator.tsx');
for(const token of ['PAGE_SIZE=2','ROTATE_MS=8000','REFRESH_MS=5*60*1000','SWIPE_THRESHOLD=44','tcm_news_feed_v1','visibleItems','target="_blank"','news-rotator-text','Đọc nguồn','desktopViewport','pointerType','onPointerDown','onPointerMove','setPointerCapture','releasePointerCapture'])if(!rotator.includes(token))errors.push(`news rotator gate missing ${token}`);
for(const token of ['touchmove','touchstart','scrollLeft','scrollBy(','scrollTo(','onScroll='])if(rotator.includes(token))errors.push(`news rotator must not use legacy horizontal scrolling gestures: ${token}`);
const rotatorCss=read('src/news-rotator.css');
for(const token of ['.news-rotator-pair','-webkit-line-clamp:3','.news-rotator-text','html[data-viewport-mode="desktop"] .news-rotator-stage','touch-action:pan-y'])if(!rotatorCss.includes(token))errors.push(`news rotator CSS gate missing ${token}`);
if(/overflow-x\s*:\s*auto|scroll-snap-type/.test(rotatorCss))errors.push('news rotator CSS must not reintroduce a horizontal rail');
if(rotatorCss.includes('data-viewport-mode="mobile"'))errors.push('news rotator Final 2.0 touch override must not alter locked mobile viewport');

const community=read('src/components/community/CommunitySidebar.tsx');
for(const token of ["type GroupKey='leadership'|'management'|'active'",'PAGE_SIZE=3','ROTATE_MS=8000','ACTIVE_LIMIT=10',"supabase.rpc('community_sidebar_v1')",'managementPage','activePage','Ban chủ nhiệm','Ban quản lý','Thành viên tích cực'])if(!community.includes(token))errors.push(`community sidebar gate missing ${token}`);
for(const sensitive of ['student_code','studentCode','email','phone'])if(community.includes(sensitive))errors.push(`community sidebar must not expose ${sensitive}`);

const desktopCss=read('src/desktop-community.css');
for(const token of ['.community-sidebar{display:none}','grid-template-areas:"news side" "main side"','grid-template-columns:minmax(560px,740px) minmax(268px,292px)','grid-area:news','grid-area:main','grid-area:side','grid-template-columns:repeat(2,minmax(0,1fr))'])if(!desktopCss.includes(token))errors.push(`desktop community layout gate missing ${token}`);
if(desktopCss.includes('data-viewport-mode="mobile"'))errors.push('desktop community stylesheet must not change locked mobile layout');

const communitySql=read('ops/sql/community_sidebar_v1.sql');
for(const token of ['community_sidebar_v1','status=\'approved\'','role in (\'admin\',\'super_mod\')',"role='mod'","role='member'",'limit 10','sum(st.points)'])if(!communitySql.includes(token))errors.push(`community sidebar SQL gate missing ${token}`);

const worker=read('src/workers/drlParseWorker.ts');
for(const token of ['header:1','diem_de_xuat_drl','ten_hoat_dong','nam_hoc','suggested_semester_code','duplicateStudentCodes','header_row','hiu_drl_proposal'])if(!worker.includes(token))errors.push(`HIU DRL workbook recognition gate missing ${token}`);
const drl=read('src/components/drl/DrlCenter.tsx');
for(const token of ['drl_admin_import_v1','drl_admin_upsert_semester_v1','drl_admin_publish_semester_v1','is_published','published_at','Công bố điểm','Gỡ công bố','bản nháp','Đã nhận mẫu đề nghị ĐRL HIU','matchDetectedSemester','duplicateStudentCodes','structuredImport'])if(!drl.includes(token))errors.push(`DRL publication/import gate missing ${token}`);
const drlSql=read('ops/sql/final_2_0_score_publication.sql');
for(const token of ['published_at','published_by','drl_admin_publish_semester_v1','has_min_role(\'mod\')','drl_activities_publication_guard','where s.published_at is not null','drl_public_search_v1','drl_member_history_v1','drl_semester_list_v1'])if(!drlSql.includes(token))errors.push(`Final 2.0 DRL SQL gate missing ${token}`);

const feed=read('src/components/feed/AcademicFeed.tsx');
for(const token of ['composeNonce','TcmNewsRotator','CommunitySidebar','set_post_mod_verified'])if(!feed.includes(token))errors.push(`academic feed gate missing ${token}`);
if(feed.includes('TcmNewsCenter'))errors.push('academic feed still references retired news module');

const admin=read('src/components/admin/SystemAdminCenter.tsx');
for(const token of ['tcm_news_admin_list_v1','tcm_news_admin_update_v1','tcm_news_admin_set_pinned_v1','tcm_news_admin_delete_v1','diagnostic-output'])if(!admin.includes(token))errors.push(`admin privileged news/diagnostic gate missing ${token}`);
const moderation=read('src/components/admin/ModerationOpsPanel.tsx');
for(const token of ['super_mod','tcm_news_review_v1','moderation_recent_logs_v1','drl_semester_list_v1'])if(!moderation.includes(token))errors.push(`super mod gate missing ${token}`);

const weather=read('api/weather.js');
for(const token of ["new URL(req.url||'/'","searchParams.get('lat')","searchParams.get('lon')"])if(!weather.includes(token))errors.push(`WHATWG weather URL gate missing ${token}`);
if(weather.includes('req.query'))errors.push('weather route must not use legacy req.query parser');

const app=read('src/App.tsx');
for(const token of ['viewport-mode-${viewportMode}','ViewportModeToggle','applyViewportMode(viewportMode)','mobile-bottom-nav','Trang chủ','Khám phá','Đăng bài','Thông báo','Cá nhân','PersonalCopilotWidget member={member}'])if(!app.includes(token))errors.push(`application shell gate missing ${token}`);
if(/tab==='news'|setTab\('news'\)|\|'news'/.test(app)||app.includes("./components/news/TcmNewsCenter"))errors.push('separate/retired YHCT News route is exposed in App');

const main=read('src/main.tsx');
for(const token of ["import './viewport-native-hotfix.css';","import './news-rotator.css';","import './desktop-community.css';"])if(!main.includes(token))errors.push(`main CSS order gate missing ${token}`);
if(main.lastIndexOf('desktop-community.css')<main.lastIndexOf('news-rotator.css'))errors.push('desktop community CSS must load after news rotator CSS');

const sw=read('public/service-worker.js');
if(!sw.includes('ui12-final2-publication-touch-drive-lock'))errors.push('service worker cache version did not advance for Final 2.0');

if(errors.length){console.error('ACCEPTANCE CHECK FAILED');errors.forEach(error=>console.error(`- ${error}`));process.exit(1)}
console.log(`acceptance-ok: ${files.length} application source files scanned; Final 2.0 score publication gate + desktop touch news + server-only Drive lock + locked mobile + RBAC/security gates clean`);
