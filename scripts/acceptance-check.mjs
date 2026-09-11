import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),errors=[];
const file=p=>path.join(root,p);
const read=p=>fs.readFileSync(file(p),'utf8');
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))errors.push(`${label} missing ${token}`)};

const required=[
  'src/App.tsx','src/main.tsx','src/theme.ts','src/types/index.ts',
  'src/modules/moduleContract.ts','src/modules/ModuleBoundary.tsx',
  'src/services/authService.ts','src/services/authRuntimeService.ts','src/services/socialService.ts','src/services/offlineCache.ts','src/services/pwaInstallService.ts',
  'src/services/academicTranslationService.ts','src/services/driveRagService.ts','src/services/examSessionService.ts','src/services/xiaozhiMiniService.ts',
  'src/components/feed/AcademicFeed.tsx','src/components/feed/AcademicPostComposer.tsx','src/components/feed/AcademicPostCard.tsx',
  'src/components/profile/ProfileCenter.tsx','src/components/profile/ProfileInbox.tsx','src/components/messages/MessagesCenter.tsx',
  'src/components/game/HerbGardenGame.tsx','src/components/game/HerbGardenSocialHub.tsx','src/components/game/HiuYQuanGame.tsx',
  'src/components/research/ResearchCenter.tsx','src/components/research/ResearchAiMini.tsx','src/components/research/ResearchProposalBuilder.tsx',
  'src/components/exam/ExamCenter.tsx','src/components/ai/UnifiedAiMini.tsx',
  'src/components/admin/AdminControlCenter.tsx','src/components/admin/SystemAdminCenter.tsx','src/components/admin/ModerationOpsPanel.tsx',
  'src/components/drl/DrlCenter.tsx','src/components/schedule/ScheduleCenter.tsx','src/components/notifications/NotificationsCenter.tsx',
  'src/components/system/AppSettingsDialog.tsx','src/components/system/ViewportModeToggle.tsx',
  'src/exam-v2.css','src/research-ai-upgrade.css','src/module-isolation.css','src/garden-v6.css','src/garden-sky-v8.css','src/hiu-y-quan.css','src/xiaozhi-mini.css',
  'api/_lib/drive-rag.js','api/_lib/xiaozhi-mini-handler.js','api/ai/drive-rag.js','api/ai/assistant.js','api/translate.js','api/manifest.js',
  'public/service-worker.js','public/manifest.webmanifest','public/pwa-icon-192.png','public/pwa-icon-512.png','public/pwa-maskable-512.png','public/garden-decor-sprite.svg',
  'vite.config.ts','vercel.json','scripts/role-ui-audit.mjs','scripts/module-isolation-check.mjs','scripts/platform-upgrade-check.mjs',
  'supabase/migrations/202609080630_admin_news_retention_and_garden_grid_v6.sql',
  'supabase/migrations/202609081640_ai_operations_core_v1.sql',
  'supabase/migrations/20260908165705_exam_sessions_v2_integrity.sql',
  'supabase/migrations/20260908171054_fix_exam_session_stratified_fill_v2.sql',
  'supabase/migrations/20260908171730_index_ai_exam_foreign_keys_v1.sql',
  'supabase/migrations/20260908171805_index_garden_trade_foreign_keys_v1.sql',
  'supabase/migrations/202609092248_hiu_y_quan_game_v1.sql'
];
for(const p of required)if(!fs.existsSync(file(p)))errors.push(`missing ${p}`);

const sourceFiles=[];
const walk=dir=>{if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(?:ts|tsx|js|mjs|css)$/.test(entry.name))sourceFiles.push(p)}};
walk(file('src'));walk(file('api'));
const forbidden=[
  [/sk-proj-[A-Za-z0-9_-]{20,}/,'raw OpenAI secret'],
  [/AIza[0-9A-Za-z_-]{20,}/,'raw Google/Gemini secret'],
  [/dangerouslySetInnerHTML/,'dangerous raw HTML rendering'],
  [/\bTODO\b|\bFIXME\b|implement later|code logic here/i,'unfinished implementation marker'],
  [/drive\.google\.com\/drive\/folders\//i,'direct Google Drive folder URL'],
  [/logo-clb-yhct-hiu/i,'obsolete club logo reference']
];
for(const p of sourceFiles){const body=fs.readFileSync(p,'utf8');for(const [re,label] of forbidden)if(re.test(body))errors.push(`${label} in ${path.relative(root,p)}`)}

const app=read('src/App.tsx'),main=read('src/main.tsx'),theme=read('src/theme.ts'),contract=read('src/modules/moduleContract.ts');
need(app,['UnifiedAiMini member={member}','HerbGardenSocialHub member={member}',"lazy(()=>import('./components/feed/AcademicFeed'))","lazy(()=>import('./components/research/ResearchCenter'))","lazy(()=>import('./components/profile/ProfileCenter'))",'ModuleBoundary moduleId={tab}',"tab==='admin'&&canAdmin&&<AdminControlCenter","tab==='acc'&&canAcc&&<>",'authResolved'],'modular app shell');
need(contract,["ModuleId='feed'|'research'|'profile'|'garden'|'notifications'|'schedule'|'drl'|'exam'|'admin'|'acc'","if(path==='/messages')return'profile'"],'frozen module contract');
for(const stale of ['AiMiniFeedbackDock member={member}','PersonalCopilotWidget member={member}',"tab==='messages'","go('messages')"])if(app.includes(stale))errors.push(`retired top-level surface remains mounted: ${stale}`);
need(main,['requestAnimationFrame(()=>requestAnimationFrame(revealStableApp))','delete root.dataset.appBooting','yhct-prepaint','./exam-v2.css'],'stable first paint');
need(theme,["link.setAttribute('href','/api/manifest')",'system_theme_get_v1','theme-color'],'system theme + root manifest');

const mini=read('src/components/ai/UnifiedAiMini.tsx'),xiaozhiService=read('src/services/xiaozhiMiniService.ts'),xiaozhiHandler=read('api/_lib/xiaozhi-mini-handler.js'),assistantGateway=read('api/ai/assistant.js'),research=read('src/components/research/ResearchCenter.tsx'),researchMini=read('src/components/research/ResearchAiMini.tsx'),proposal=read('src/components/research/ResearchProposalBuilder.tsx'),translation=read('src/services/academicTranslationService.ts'),driveRag=read('src/services/driveRagService.ts');
need(mini,['checkDrlConversation','fetchSchedules','askXiaoZhiMini','academicIntent','SpeechSynthesisUtterance','SpeechRecognition','Giọng nữ: bật','Học thuật → Trung tâm nghiên cứu'],'XiaoZhi AI Mini voice/system routing');
need(xiaozhiService,["fetch('/api/ai/assistant'","mode:'xiaozhi-mini'",'Authorization:`Bearer ${token}`'],'XiaoZhi shared gateway client');
need(xiaozhiHandler,['createGeminiWebSearch','geminiAiConfigured','web_search_preview','handleXiaoZhiMini','Trợ lý ứng dụng HIU YHCT 4.0','researchIntent',"answer:'Học thuật → Trung tâm nghiên cứu'","route:'research'",'tuyệt đối không tự giả định rằng kho Drive/tài liệu nội bộ đã được bật'],'XiaoZhi application-assistant Gemini-first public search + research handoff policy');
need(assistantGateway,["req.body?.mode==='xiaozhi-mini'",'handleXiaoZhiMini'],'shared AI function routing');
for(const stale of ['searchOpenAlex','searchDriveRag','searchKnowledge','buildResearchLinks'])if(mini.includes(stale))errors.push(`academic retrieval must not remain in UnifiedAiMini: ${stale}`);
need(research,['searchOpenAlex(query,12)','A.I OpenAlex tổng hợp','summarizeOpenAlex'],'research OpenAlex AI');
need(researchMini,['searchOpenAlex(text,6)','Cloud + Drive RAG + Central RAG + OpenAlex','translateAcademic','searchDriveRag',"searchKnowledge(text,'all',5)"],'research mini shared AI retrieval');
need(proposal,['Lưu ý trước khi chốt đề cương','PubMed/OpenAlex','CONSORT extension/STRICTA','PMID, DOI'],'research proposal methodology guardrails');
need(translation,['translateAcademic','/api/translate'],'academic translation gateway');
need(driveRag,['searchDriveRag','/api/ai/drive-rag'],'shared Drive RAG client');

const garden=read('src/components/game/HerbGardenGame.tsx'),clinic=read('src/components/game/HiuYQuanGame.tsx'),clinicMigration=read('supabase/migrations/202609092248_hiu_y_quan_game_v1.sql'),gardenSocial=read('src/components/game/HerbGardenSocialHub.tsx'),gardenMigration=read('supabase/migrations/202609080630_admin_news_retention_and_garden_grid_v6.sql');
need(garden,['herb_garden_state_v3','herb_garden_select_initial_plots_v3','herb_garden_plant_v3','herb_garden_water_v4','herb_garden_fertilize_v3','herb_garden_harvest_v3','garden-nine-grid','Đã mở {unlockedCount}/9 ô','garden-world-viewport','HiuYQuanGame'],'garden v8 world + stable v7 contracts');
need(clinic,['hiu_y_quan_state_v1','hiu_y_quan_activate_v1','hiu_y_quan_hourly_cases_v1','hiu_y_quan_submit_v1','VỌNG','VĂN','VẤN','THIẾT','+1 tín dụng'],'HIU Y Quan game client');
need(clinicMigration,['hiu_y_quan_syndrome_catalog','hiu_y_quan_cases','hiu_y_quan_attempts','balance=balance+1','unique(member_id,case_id)','from public,anon','to authenticated'],'HIU Y Quan server integrity');
need(gardenSocial,['herb_garden_directory_v2','herb_garden_visit_v2','herb_garden_help_v2','herb_garden_market_buy_v1','herb_garden_market_create_v1'],'garden social');
need(gardenMigration,['herb_garden_plots','slot_no between 1 and 9','herb_garden_maintenance_v3','tcm-news-retention-hourly'],'garden/news server contracts');
if(/openai|gemini|generateContent/i.test(garden)||/openai|gemini|generateContent/i.test(gardenSocial))errors.push('herb garden must not contain generative medical logic');

const exam=read('src/components/exam/ExamCenter.tsx'),examService=read('src/services/examSessionService.ts'),examMigration=read('supabase/migrations/20260908165705_exam_sessions_v2_integrity.sql'),examFix=read('supabase/migrations/20260908171054_fix_exam_session_stratified_fill_v2.sql');
need(exam,['getExamConfigV2','startExamSessionV2','saveExamAnswerV2','submitExamSessionV2','Thi thử 50 câu','A.I hướng dẫn suy luận','server integrity'],'exam v2 integrity UI');
need(examService,['exam_config_v2','exam_session_start_v2','exam_session_answer_v2','exam_session_submit_v2'],'exam server RPC client');
need(examMigration,["questionCount',50","durationMinutes',60",'review_status','legacy_validated','expert_approved','revoke all on public.exam_questions_v2 from anon,authenticated','revoke all on public.exam_sessions_v2 from anon,authenticated'],'exam database integrity');
need(examFix,['remaining as(','combined as(','cardinality(v_ids)','limit 50'],'stratified exam selection fix');

const boot=read('index.html'),viewport=read('src/components/system/ViewportModeToggle.tsx'),pwa=read('src/services/pwaInstallService.ts'),settings=read('src/components/system/AppSettingsDialog.tsx'),manifest=read('public/manifest.webmanifest'),manifestApi=read('api/manifest.js'),sw=read('public/service-worker.js'),vercel=read('vercel.json'),vite=read('vite.config.ts');
need(boot,['yhct-viewport-mode-v1','dataset.viewportMode','width=device-width,initial-scale=1','href="/api/manifest"','data-app-booting="1"','yhct-prepaint','background:#f6f1e7'],'viewport/PWA + anti-flash bootstrap');
need(viewport,['dataset.viewportMode','Xem bản Desktop','Xem bản Mobile','FORCE_DESKTOP_MOBILE_KEY'],'viewport mode control');
need(pwa,['beforeinstallprompt','appinstalled','requestPwaInstall','display-mode: standalone'],'PWA install controller');
need(settings,['Cài ứng dụng mạng xã hội','PWA độc lập của Chrome','requestPwaInstall'],'PWA settings surface');
need(manifest,['"id":"/"','"start_url":"/"','"scope":"/"','"display":"standalone"','/pwa-icon-192.png','/pwa-icon-512.png','maskable'],'root static fallback manifest');
need(manifestApi,['system_theme_get_v1','theme_color','Cache-Control','no-store','X-YHCT-System-Theme',"display:'standalone'","id:'/'","start_url:'/'","scope:'/'",'shortcuts','prefer_related_applications:false','/pwa-icon-192.png','/pwa-maskable-512.png'],'dynamic installable production manifest');
need(sw,['navigationResponse','staticResponse','self.registration.scope'],'offline service worker');
need(vite,['GITHUB_PAGES',"'/yhct-hiu-4-0/'",'base:githubPages','module-feed','module-research','module-profile','module-garden','module-admin','module-acc'],'portable modular Vite base');
for(const route of ['/research','/profile','/schedule','/exam','/drl','/notifications','/garden','/messages','/admin','/acc'])if(!vercel.includes(`"source": "${route}"`))errors.push(`Vercel rewrite missing ${route}`);

const social=read('src/services/socialService.ts'),profile=read('src/components/profile/ProfileCenter.tsx'),profileInbox=read('src/components/profile/ProfileInbox.tsx'),messages=read('src/components/messages/MessagesCenter.tsx'),drl=read('src/components/drl/DrlCenter.tsx'),worker=read('src/workers/drlParseWorker.ts');
need(social,['create_academic_post','update_academic_post','enforceDebounce'],'social post service');
need(profile,['member_wall_feed_v1','member_wall_post_create_v1','member_wall_post_delete_v1','member_profile_update_v2','ProfileInbox'],'personal wall + inbox');
need(profileInbox,['messages_inbox_v1','MessagesCenter','role="dialog"','inboxBadge'],'embedded inbox');
need(messages,['messages_inbox_v1','messages_send_v1','message_recipients_v1','messages_mark_read_v1'],'private messaging');
need(worker,['diem_de_xuat_drl','duplicateStudentCodes','logicalKey','toUpperCase()'],'DRL parser');
need(drl,['drl_public_lookup_v2','drl_admin_import_v1','drl_admin_publish_semester_v1',"canPublish=roleAtLeast(member?.role,'admin')"],'DRL governance');

const pkg=JSON.parse(read('package.json'));
if(String(pkg.dependencies?.xlsx||'').includes('0.18.5'))errors.push('vulnerable xlsx 0.18.5 is forbidden');
if(!String(pkg.scripts?.prebuild||'').includes('audit:roles'))errors.push('prebuild must run independent role audit');
if(!String(pkg.scripts?.prebuild||'').includes('audit:modules'))errors.push('prebuild must run module isolation audit');

if(errors.length){console.error('ACCEPTANCE CHECK FAILED');errors.forEach(e=>console.error(`- ${e}`));process.exit(1)}
console.log(`acceptance-ok: ${sourceFiles.length} application source files scanned; modular shell + Gemini-first application assistant + explicit Research handoff + opt-in internal research AI + garden v8/HIU Y Quan + exam integrity + root PWA + anti-flash boot gates clean`);
