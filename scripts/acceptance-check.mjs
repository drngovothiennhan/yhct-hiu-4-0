import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),errors=[];
const file=p=>path.join(root,p),read=p=>fs.readFileSync(file(p),'utf8');
const required=[
 'src/App.tsx','src/main.tsx','src/theme.ts','src/types/index.ts','src/services/authService.ts','src/services/authRuntimeService.ts','src/services/socialService.ts','src/services/offlineCache.ts',
 'src/components/feed/AcademicFeed.tsx','src/components/feed/AcademicPostComposer.tsx','src/components/feed/AcademicPostCard.tsx','src/components/admin/AdminControlCenter.tsx','src/components/admin/SystemAdminCenter.tsx','src/components/admin/AdminThemeControl.tsx','src/components/admin/ModerationOpsPanel.tsx',
 'src/components/profile/ProfileCenter.tsx','src/components/messages/MessagesCenter.tsx','src/components/game/HerbGardenGame.tsx','src/components/game/HerbGardenSocialHub.tsx','src/components/ai/UnifiedAiMini.tsx',
 'src/components/drl/DrlCenter.tsx','src/components/research/ResearchCenter.tsx','src/components/schedule/ScheduleCenter.tsx','src/components/notifications/NotificationsCenter.tsx','src/components/news/TcmNewsRotator.tsx','src/components/community/CommunitySidebar.tsx',
 'src/components/system/ViewportModeToggle.tsx','src/academic-production.css','src/social-v5.css','src/garden-personalization.css','src/news-rotator.css','src/desktop-community.css','src/desktop-interaction-profile.css','src/final4-v2.css','public/service-worker.js','public/manifest.webmanifest','vite.config.ts','vercel.json','scripts/role-ui-audit.mjs','supabase/migrations/202609080533_fix_garden_profile_decor_persistence_v1.sql'
];
for(const p of required)if(!fs.existsSync(file(p)))errors.push(`missing ${p}`);
const sourceFiles=[];const walk=dir=>{if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(?:ts|tsx|js|mjs|css)$/.test(entry.name))sourceFiles.push(p)}};walk(file('src'));walk(file('api'));
const forbidden=[[/sk-proj-[A-Za-z0-9_-]{20,}/,'raw OpenAI secret'],[/AIza[0-9A-Za-z_-]{20,}/,'raw Google/Gemini secret'],[/dangerouslySetInnerHTML/,'dangerous raw HTML rendering'],[/\bTODO\b|\bFIXME\b|implement later|code logic here/i,'unfinished implementation marker'],[/drive\.google\.com\/drive\/folders\//i,'direct Google Drive folder URL'],[/logo-clb-yhct-hiu/i,'obsolete club logo reference']];
for(const p of sourceFiles){const body=fs.readFileSync(p,'utf8');for(const [re,label] of forbidden)if(re.test(body))errors.push(`${label} in ${path.relative(root,p)}`)}
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))errors.push(`${label} missing ${token}`)};
const app=read('src/App.tsx'),types=read('src/types/index.ts'),composer=read('src/components/feed/AcademicPostComposer.tsx'),postCard=read('src/components/feed/AcademicPostCard.tsx'),academicCss=read('src/academic-production.css'),social=read('src/services/socialService.ts'),mini=read('src/components/ai/UnifiedAiMini.tsx'),socialCss=read('src/social-v5.css'),gardenCss=read('src/garden-personalization.css'),gardenMigration=read('supabase/migrations/202609080533_fix_garden_profile_decor_persistence_v1.sql'),profile=read('src/components/profile/ProfileCenter.tsx'),auth=read('src/services/authService.ts'),messages=read('src/components/messages/MessagesCenter.tsx'),moderation=read('src/components/admin/ModerationOpsPanel.tsx'),garden=read('src/components/game/HerbGardenGame.tsx'),gardenSocial=read('src/components/game/HerbGardenSocialHub.tsx');
need(app,['UnifiedAiMini member={member}','HerbGardenSocialHub member={member}',"lazy(()=>import('./components/messages/MessagesCenter'))","messages:'/messages'","garden:'/garden'",'authResolved'],'social v5 app shell');
for(const stale of ['AiMiniFeedbackDock member={member}','PersonalCopilotWidget member={member}'])if(app.includes(stale))errors.push(`retired duplicate AI surface remains mounted: ${stale}`);
need(types,["'news'|'reference'|'status'",'herbalAlias?:string','wallTheme?:string','wallMotto?:string'],'social v5 types');
need(composer,["['news','Tin tức']","['reference','Bài tham khảo']",'Nội dung YHCT chuyên sâu — tùy chọn','requiresSource','Tin tức, bài tham khảo và nghiên cứu cần ít nhất 1 nguồn'],'flexible composer');
need(postCard,["value==='news'?'Tin tức'","value==='reference'?'Bài tham khảo'","value==='status'?'Chia sẻ ngắn'",'fourEntries.length>0','post.eightPrinciples.length>0','citation-preview','citation-details','Xem đầy đủ'],'flexible homepage post rendering');
need(academicCss,['.citation-preview','-webkit-line-clamp:2','line-clamp:2','.citation-details'],'two-line homepage reference preview');
need(social,["postType:p.postType||'reference'",'create_academic_post','update_academic_post','enforceDebounce'],'social post service');
need(mini,["HISTORY_KEY='yhct-ai-mini-visible-history-v1'","timeZone:'Asia/Ho_Chi_Minh'","slice(0,3)",'localStorage.removeItem(HISTORY_KEY)',"Mode='assistant'|'feedback'",'feedback_submit_v1','greeting'],'unified AI Mini');
need(socialCss,['-webkit-line-clamp:2','.ai-mini-panel','.personal-wall','.moderation-work-grid','.garden-community-layout','@media(max-width:680px)'],'social v5 responsive CSS');
need(profile,['member_wall_feed_v1','member_wall_post_create_v1','member_wall_post_delete_v1','member_profile_update_v2',"storage.from('member-media')",'maxLength={500}','wall?.posts.map','Đổi mật khẩu'],'personal wall/avatar');
need(auth,['herbal_alias','herbalAlias','wall_theme','wall_motto','readSessionResilient','readCachedSession','auth_user_id','loadMemberFromSession','fetchMemberRow','3500,7000','member restore HTTP'],'refresh-safe herbal identity session restore');
need(messages,['messages_inbox_v1','messages_send_v1','message_recipients_v1','messages_mark_read_v1','member_messages'],'private inbox');
need(moderation,['moderation_workbench_v2','moderation_mark_seen_v1','p_on_date','Tối đa 5 nội dung','Đã xem','feedback_admin_resolve_v1','tcm_news_review_v1','moderate_academic_post_v1'],'admin/mod workbench');
need(gardenSocial,['herb_garden_directory_v1','herb_garden_visit_v1','herb_garden_help_v1','herb_garden_market_v1','herb_garden_market_create_v1','herb_garden_market_buy_v1','herb_garden_market_cancel_v1','herb_garden_profile_update_v1','herb_garden_inventory_v3','sameDecor','yhct:garden-profile-updated','garden-decor-live-preview'],'garden social/economy persistence');
need(garden,['herb_garden_visit_v1','garden-profile-strip','garden-scene-decor','yhct:garden-profile-updated'],'garden personalization rendering');
need(gardenCss,['.garden-profile-strip','.garden-decor-live-preview','.garden-scene-decor-item','.garden-scene-theme-lotus'],'garden personalization CSS');
need(gardenMigration,['with ordinality as x(value,ord)','group by x.value','persisted',"on conflict(member_id) do update"],'garden personalization durable RPC');
if(/openai|gemini|generateContent/i.test(garden)||/openai|gemini|generateContent/i.test(gardenSocial))errors.push('herb garden must not contain generative medical logic');

const boot=read('index.html'),viewport=read('src/components/system/ViewportModeToggle.tsx'),vite=read('vite.config.ts'),manifest=read('public/manifest.webmanifest'),sw=read('public/service-worker.js'),vercel=read('vercel.json');
need(boot,['yhct-viewport-mode-v1','dataset.viewportMode','width=device-width,initial-scale=1','href="./manifest.webmanifest"'],'viewport/PWA bootstrap');
need(viewport,['dataset.viewportMode','Xem bản Desktop','Xem bản Mobile'],'viewport mode control');
need(vite,['GITHUB_PAGES',"'/yhct-hiu-4-0/'",'base:githubPages'],'portable Vite base');
need(manifest,['"start_url":"./"','"scope":"./"'],'portable manifest');
need(sw,['navigationResponse','staticResponse','self.registration.scope'],'offline service worker');
for(const route of ['/research','/profile','/schedule','/exam','/drl','/notifications','/garden','/messages','/admin','/acc'])if(!vercel.includes(`"source": "${route}"`))errors.push(`Vercel rewrite missing ${route}`);

const news=read('src/components/news/TcmNewsRotator.tsx'),newsCss=read('src/news-rotator.css'),community=read('src/components/community/CommunitySidebar.tsx'),desktop=read('src/desktop-interaction-profile.css'),drl=read('src/components/drl/DrlCenter.tsx'),worker=read('src/workers/drlParseWorker.ts');
need(news,['ROTATE_MS=8000','tcm_news_feed_v1',"addEventListener('wheel'",'{passive:false}','onMouseDown','onMouseMove','target="_blank"'],'news interaction preserved');
need(newsCss,['overflow-x:auto','scroll-snap-type:x mandatory','cursor:grab','@media(max-width:760px)'],'news CSS preserved');
need(community,["supabase.rpc('community_sidebar_v2')",'ACTIVE_LIMIT=10','Top 10 Tín dụng Cộng đồng'],'community safe feed');for(const sensitive of ['student_code','email','phone'])if(community.includes(sensitive))errors.push(`community sidebar exposes ${sensitive}`);
need(desktop,['pointer-events:auto!important','community-member-button:hover','community-member-button:focus-visible'],'desktop pointer UX');
need(worker,['diem_de_xuat_drl','duplicateStudentCodes','logicalKey','toUpperCase()'],'DRL parser');
need(drl,['drl_public_lookup_v2','drl_admin_import_v1','drl_admin_publish_semester_v1',"canPublish=roleAtLeast(member?.role,'admin')",'Đã chốt điểm','Đang tổng hợp / Chờ duyệt'],'DRL governance');

const pkg=JSON.parse(read('package.json'));if(String(pkg.dependencies?.xlsx||'').includes('0.18.5'))errors.push('vulnerable xlsx 0.18.5 is forbidden');if(!String(pkg.scripts?.prebuild||'').includes('audit:roles'))errors.push('prebuild must run independent role audit');
if(errors.length){console.error('ACCEPTANCE CHECK FAILED');errors.forEach(e=>console.error(`- ${e}`));process.exit(1)}
console.log(`acceptance-ok: ${sourceFiles.length} application source files scanned; refresh-safe auth + durable garden personalization + social v5 + two-line references + mobile + inbox + wall + moderation + DRL + PWA gates clean`);
