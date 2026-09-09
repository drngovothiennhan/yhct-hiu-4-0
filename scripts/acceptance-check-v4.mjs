import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),errors=[];
const file=p=>path.join(root,p),read=p=>fs.readFileSync(file(p),'utf8');
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))errors.push(`${label} missing ${token}`)};

const mustExist=[
  'src/App.tsx','src/main.tsx','src/theme.ts','src/modules/moduleContract.ts','src/modules/ModuleBoundary.tsx','src/module-isolation.css',
  'src/components/news/TcmNewsRotator.tsx','src/news-rotator.css','src/components/drl/DrlCenter.tsx','src/workers/drlParseWorker.ts',
  'src/components/community/CommunitySidebar.tsx','src/components/profile/ProfileCenter.tsx','src/components/profile/ProfileInbox.tsx',
  'src/components/admin/AdminThemeControl.tsx','src/components/widgets/DesktopAcademicWidgets.tsx','src/components/feed/AcademicFeed.tsx',
  'src/services/authRuntimeService.ts','src/services/offlineCache.ts','src/services/pwaInstallService.ts','src/components/system/AppSettingsDialog.tsx',
  'src/components/research/ResearchAiMini.tsx','src/components/exam/ExamCenter.tsx','src/services/examSessionService.ts',
  'src/desktop-interaction-profile.css','src/desktop-community.css','src/exam-v2.css',
  'api/manifest.js','public/manifest.webmanifest','public/service-worker.js','public/pwa-icon-192.png','public/pwa-icon-512.png','public/pwa-maskable-512.png',
  'scripts/role-ui-audit.mjs','scripts/module-isolation-check.mjs','supabase/migrations/202609090020_academic_news_top3_archive_v1.sql'
];
for(const p of mustExist)if(!fs.existsSync(file(p)))errors.push(`missing ${p}`);

const sourceFiles=[];const walk=dir=>{if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(?:ts|tsx|js|mjs|css)$/.test(entry.name))sourceFiles.push(p)}};walk(file('src'));walk(file('api'));
const forbidden=[[/sk-proj-[A-Za-z0-9_-]{20,}/,'raw OpenAI secret'],[/AIza[0-9A-Za-z_-]{20,}/,'raw Google/Gemini secret'],[/dangerouslySetInnerHTML/,'dangerous raw HTML rendering'],[/\bTODO\b|\bFIXME\b|implement later|code logic here/i,'unfinished implementation marker'],[/drive\.google\.com\/drive\/folders\//i,'direct Google Drive folder URL']];
for(const p of sourceFiles){const body=fs.readFileSync(p,'utf8');for(const [re,label] of forbidden)if(re.test(body))errors.push(`${label} in ${path.relative(root,p)}`)}

const app=read('src/App.tsx'),moduleContract=read('src/modules/moduleContract.ts'),theme=read('src/theme.ts'),adminTheme=read('src/components/admin/AdminThemeControl.tsx');
need(app,["canAcc=roleAtLeast(member?.role,'admin')",'AdminThemeControl theme={theme}','fetchSystemTheme()','saveSystemTheme(next)','watchSystemTheme(next=>','moduleFromPath','ModuleBoundary moduleId={tab}','auth-submit-spinner'],'system theme + module route');
need(moduleContract,["ModuleId='feed'|'research'|'profile'|'garden'|'notifications'|'schedule'|'drl'|'exam'|'admin'|'acc'","if(path==='/messages')return'profile'"],'final module contract');
need(theme,['LEGACY_THEME_KEY','localStorage.removeItem(LEGACY_THEME_KEY)','system_theme_get_v1','system_theme_set_v1','watchSystemTheme',"link.setAttribute('href','/api/manifest')",'--system-status-color'],'single-source system theme');
need(adminTheme,['Giao diện hệ thống','THEME_OPTIONS.length','acc-theme-compact-grid'],'ACC theme control');
if(app.includes('theme-quick-toggle')||app.includes('mobile-theme-action'))errors.push('public theme controls must be removed');
if(app.includes("tab==='messages'")||app.includes("go('messages')"))errors.push('Inbox must not remain a top-level module');
if(app.includes("tab==='admin'&&canAdmin&&<>{canAcc&&<AdminThemeControl"))errors.push('Điều hành must not expose theme selector');

const rotator=read('src/components/news/TcmNewsRotator.tsx'),rotatorCss=read('src/news-rotator.css');
need(rotator,['ROTATE_MS=8000',"tcm_news_feed_v1',{p_limit:20}",'news-rotator-track','scrollByPage','onMouseDown','onMouseMove','news-rotator-prev','news-rotator-next','target="_blank"'],'rolling TCM news carousel');
need(rotatorCss,['news-rotator-track','overflow-x:auto','scroll-snap-type:x mandatory','flex:0 0 calc((100% - var(--news-gap))/2)','@media(max-width:760px)','flex-basis:100%'],'two-up desktop / one-up mobile news carousel CSS');
if(rotator.includes('MAX_NEWS=3')||rotator.includes('news-rotator-top3')||rotator.includes('data-ai-news-count'))errors.push('TCM news carousel must not be constrained to fixed top-three AI news');

const worker=read('src/workers/drlParseWorker.ts'),drl=read('src/components/drl/DrlCenter.tsx');
need(worker,['mssv','ho_ten','ten_hoat_dong','hoc_ky','diem_cong','logicalKey','duplicateRows','toUpperCase()'],'DRL parser');
need(drl,['drl_public_lookup_v2','drl_admin_import_v1','drl_admin_publish_semester_v1','PublishDialog','canPublish','is_published'],'DRL center');
if(!drl.includes("roleAtLeast(member?.role,'admin')"))errors.push('DRL publication must require admin role in UI');

const community=read('src/components/community/CommunitySidebar.tsx'),desktop=read('src/desktop-interaction-profile.css');
need(community,["supabase.rpc('community_sidebar_v2')",'community-member-button','role="dialog"','ACTIVE_LIMIT=10','Top 10 Tín dụng Cộng đồng'],'community interaction');
need(desktop,['@media screen and (min-width:1024px)','pointer-events:auto!important','community-member-button:hover','community-member-button:focus-visible'],'desktop interaction hardening');
for(const token of ['student_code','email','phone'])if(community.includes(token))errors.push(`community sidebar exposes sensitive field ${token}`);

const profile=read('src/components/profile/ProfileCenter.tsx'),profileInbox=read('src/components/profile/ProfileInbox.tsx'),authRuntime=read('src/services/authRuntimeService.ts');
need(profile,['member_profile_summary_v1','Đổi mật khẩu','changeMemberPassword','ProfileInbox'],'profile center');
need(profileInbox,['messages_inbox_v1','MessagesCenter','member_messages','inboxBadge'],'profile inbox');
need(authRuntime,['loginOptimized','member-change-password','Authorization:`Bearer ${session.access_token}`','AbortController'],'auth runtime');

const feed=read('src/components/feed/AcademicFeed.tsx'),widgets=read('src/components/widgets/DesktopAcademicWidgets.tsx'),desktopCommunity=read('src/desktop-community.css');
need(feed,["lazy(()=>import('../widgets/DesktopAcademicWidgets'))","window.matchMedia('(min-width:1600px)')","root.dataset.viewportMode==='desktop'",'<Suspense fallback={null}><DesktopAcademicWidgets member={member}/></Suspense>'],'desktop widget lazy gate');
need(desktopCommunity,['.desktop-academic-widgets{display:none}','@media (min-width:1600px)','.feed-layout.has-desktop-widgets','content-visibility:auto'],'wide desktop widget layout');
need(widgets,['apparentSolarLongitude','drl_deadline_public_v1','member_profile_summary_v1','herb_drug_interactions','verified_at','source_title','research_opportunities_feed_v1','research_apply_v1','member_upcoming_schedule_v2','schedule_checkin_v1','safeHttpUrl'],'desktop academic widgets');
if(/openai|gemini|generateContent|chat\.completions/i.test(widgets))errors.push('medical interaction widget must not call generative AI');

const researchMini=read('src/components/research/ResearchAiMini.tsx'),exam=read('src/components/exam/ExamCenter.tsx'),examService=read('src/services/examSessionService.ts');
need(researchMini,['Cloud + Drive RAG + Central RAG + OpenAlex','searchOpenAlex(text,6)','searchDriveRag',"searchKnowledge(text,'all',5)",'translateAcademic'],'Research AI shared retrieval');
need(exam,['Thi thử 50 câu','A.I hướng dẫn suy luận','server integrity','getExamConfigV2'],'exam v2 UI');
need(examService,['exam_config_v2','exam_session_start_v2','exam_session_answer_v2','exam_session_submit_v2'],'exam v2 RPC client');

const boot=read('index.html'),main=read('src/main.tsx'),manifest=read('public/manifest.webmanifest'),manifestApi=read('api/manifest.js'),pwa=read('src/services/pwaInstallService.ts'),settings=read('src/components/system/AppSettingsDialog.tsx'),sw=read('public/service-worker.js');
need(boot,['data-app-booting="1"','yhct-prepaint','background:#f6f1e7','href="/api/manifest"'],'anti-flash bootstrap');
need(main,['revealStableApp','requestAnimationFrame(()=>requestAnimationFrame(revealStableApp))','delete root.dataset.appBooting'],'stable first-paint reveal');
need(manifest,['"id":"/"','"start_url":"/"','"scope":"/"','"display":"standalone"','pwa-icon-192.png','pwa-icon-512.png','pwa-maskable-512.png'],'static installable manifest');
need(manifestApi,['system_theme_get_v1','theme_color','Cache-Control','no-store','X-YHCT-System-Theme',"display:'standalone'","id:'/'","start_url:'/'","scope:'/'",'shortcuts','prefer_related_applications:false','pwa-maskable-512.png'],'dynamic installable manifest');
need(pwa,['beforeinstallprompt','appinstalled','requestPwaInstall','display-mode: standalone'],'PWA install controller');
need(settings,['Cài ứng dụng mạng xã hội','PWA độc lập của Chrome','requestPwaInstall'],'PWA settings surface');
need(sw,['navigationResponse','staticResponse','AbortController','caches.match','cache:\'no-store\''],'offline service worker');
if(boot.includes('yhct-hiu-ui-theme-v1'))errors.push('document head must not bootstrap theme from legacy localStorage');
if(theme.includes('localStorage.setItem(LEGACY_THEME_KEY'))errors.push('system theme must not persist a competing client-side source');
try{const cfg=JSON.parse(read('vercel.json'));if(!Array.isArray(cfg.rewrites)||!cfg.rewrites.some(r=>r?.source==='/manifest.webmanifest'&&r?.destination==='/api/manifest'))errors.push('manifest rewrite semantic contract missing')}catch{errors.push('vercel.json must be valid JSON')}

const pkg=JSON.parse(read('package.json'));
if(String(pkg.dependencies?.xlsx||'').includes('0.18.5'))errors.push('vulnerable xlsx 0.18.5 is forbidden');
if(!String(pkg.scripts?.prebuild||'').includes('audit:roles'))errors.push('prebuild must retain independent role audit');
if(!String(pkg.scripts?.prebuild||'').includes('audit:modules'))errors.push('prebuild must enforce module isolation');

if(errors.length){console.error('FINAL 4 ACCEPTANCE CHECK FAILED');for(const error of errors)console.error(`- ${error}`);process.exit(1)}
console.log(`final4-acceptance-ok: ${sourceFiles.length} source files scanned; modular routing, rolling two-up TCM news carousel, embedded inbox, ACC-only theme, root installable PWA, anti-flash boot, offline and RBAC gates passed`);
