import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const feed=read('src/components/feed/AcademicFeed.tsx');
const home=read('src/components/home/StudentHome.tsx');
const studyHub=read('src/components/home/StudyHubV2.tsx');
const studyCss=read('src/components/home/study-hub-v2.css');
const settings=read('src/components/system/AppSettingsDialog.tsx');
const homeFeedCss=read('src/home-feed-phase4.css');
const main=read('src/main.tsx');
const post=read('src/components/feed/AcademicPostCard.tsx');
const css=read('src/feed-academic-ai.css');
const adminControl=read('src/components/admin/AdminControlCenter.tsx');
const acc=read('src/components/admin/SystemAdminCenter.tsx');
const aiOps=read('src/components/admin/AiOperationsPanel.tsx');
const garden=read('src/components/game/HerbGardenGame.tsx');
const gardenMigration=read('supabase/migrations/202609090940_fix_herb_garden_water_v4_transaction.sql');
const retention=read('supabase/migrations/202609090135_academic_feed_ai_top3_and_news_rotator_restore_v1.sql');
const dailyPipeline=read('supabase/migrations/20260919145830_academic_daily_ai_pipeline_v2.sql');
const dailyHandler=read('api/_lib/academic-daily-post-handler.js');
const assistant=read('api/ai/assistant.js');
const news=read('src/components/news/TcmNewsRotator.tsx');
const checks=[
  ['TCM news backend remains rollback-safe',news.includes("tcm_news_feed_v1")&&news.includes("p_limit:20")&&retention.includes('private.tcm_news_retention_v2()')],
  ['TCM news surface is no longer mounted in academic feed',!feed.includes("TcmNewsRotator")&&!feed.includes('news-rail')&&feed.includes('data-news-surface="hidden"')],
  ['desktop feed collapses the removed news row',homeFeedCss.includes('grid-template-areas:"main side"')&&homeFeedCss.includes('grid-template-areas:"widgets main side"')&&main.includes("import './home-feed-phase4.css'" )],
  ['Home wrapper has converged to StudyHubV2 only',home.includes("lazy(()=>import('./StudyHubV2'))")&&home.includes('<StudyHubV2 {...props}/></Suspense>')&&!home.includes('StudentHomeLegacy')&&!home.includes('studyOsV2CanaryEnabled')],
  ['Study Home uses learner journey focus and daily target',studyHub.includes('readStudentJourney')&&studyHub.includes('subscribeStudentJourney')&&studyHub.includes('preferences?.focus')&&studyHub.includes('preferences?.dailyMinutes')],
  ['Study Home has one command surface with deterministic routing',studyHub.includes('routeStudyOsRequest')&&studyHub.includes('study-os-v2__command')&&studyHub.includes("onNavigate('ai')")&&studyHub.includes("onNavigate('research')")&&studyHub.includes("onNavigate('exam')")],
  ['Study Home delegates academic answering to the dedicated Gemini Study surface',studyHub.includes('yhct-ai-center-pending-query-v1')&&studyHub.includes("onNavigate('ai')")&&!studyHub.includes('yhct:ai:open')],
  ['Study Home converges to Focus Command, Daily Mission and one Continue Learning surface',studyHub.includes('DAILY MISSION')&&studyHub.includes('TIẾP TỤC HỌC')&&studyHub.includes('study-os-v2__focus-layout')&&studyCss.includes('.study-os-v2__focus-layout')&&studyCss.includes('.study-os-v2__continue')&&!studyCss.includes('.study-os-v2__grid')],
  ['Home no longer owns install, sharing or performance controls',!studyHub.includes('getPwaInstallStatus')&&!studyHub.includes('requestPwaInstall')&&!studyHub.includes('getPerformancePreference')&&!studyHub.includes('setPerformancePreference')&&!studyHub.includes('<b>Chia sẻ</b>')&&!studyHub.includes('<b>Cài ứng dụng</b>')],
  ['Settings owns PWA install, sharing and performance preferences',settings.includes('requestPwaInstall')&&settings.includes('Chia sẻ ứng dụng')&&settings.includes('getPerformancePreference')&&settings.includes('setPerformancePreference')&&settings.includes('performance-mode-settings')],
  ['academic feed caps system AI cards to latest three',feed.includes('.filter(isSystemAiPost).sort((a,b)=>postTime(b)-postTime(a)).slice(0,3)')],
  ['academic center renders maximum three posts per page',feed.includes('const PAGE_SIZE=3')&&feed.includes('filtered.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE)')&&feed.includes('Bài cũ hơn')],
  ['image posts receive bounded recency preference',feed.includes('MEDIA_PRIORITY_WINDOW_MS')&&feed.includes('hasMedia(a)!==hasMedia(b)')],
  ['system AI preface is separated from main content',post.includes('system-ai-preface')&&post.includes('SYSTEM_PREFACE')],
  ['system AI main content is clamped to six lines',post.includes('system-ai-main')&&css.includes('-webkit-line-clamp:6')],
  ['system AI warning is compact, typographically even and placed below citations',css.includes('.system-ai-note')&&css.includes('font-size:.68rem!important')&&css.includes('.system-ai-note>b{font-size:inherit;line-height:inherit')&&post.indexOf('system-ai-citation-block')<post.indexOf('system-ai-note')],
  ['daily academic pipeline discovers and verifies fresh PubMed sources before Gemini',dailyHandler.includes('europepmc')&&dailyHandler.includes('eutils.ncbi.nlm.nih.gov')&&dailyHandler.includes('createGeminiJson')&&dailyHandler.includes('academic_ai_seen_sources_v2')],
  ['daily academic pipeline is isolated inside the existing assistant function',assistant.includes("mode==='academic-daily-post'")&&assistant.includes('handleAcademicDailyPost')],
  ['daily academic publishing is max one HCM-day with retries and old 180m cron removed',dailyPipeline.includes('one_post_per_day_uidx')&&dailyPipeline.includes("yhct-academic-auto-post-180m")&&dailyPipeline.includes("yhct-academic-daily-ai-v2")&&dailyPipeline.includes("17 0,6,12 * * *")],
  ['daily academic post persists verified citation and Gemini provenance',dailyPipeline.includes("'gemini_generated'")&&dailyPipeline.includes("'verified_by','NCBI ESummary'")&&dailyPipeline.includes('academic_ai_publish_daily_v2')],
  ['system AI references are compact and expose direct source links',post.includes('system-ai-citation-block')&&post.includes('Truy cập nguồn')&&post.includes('target="_blank"')&&css.includes('.system-ai-citation-block')],
  ['system AI illustration is positioned before body when present',post.indexOf('{systemAi&&mediaBlock}')<post.indexOf('system-ai-content')],
  ['database archives superseded AI academic posts before deleting',retention.includes('private.ai_academic_post_archive')&&retention.includes('academic_ai_post_retention_v1')],
  ['AI Operations removed from Điều hành',!adminControl.includes("import AiOperationsPanel from './AiOperationsPanel'")&&!adminControl.includes('<AiOperationsPanel/>')],
  ['AI Operations lives inside ACC',acc.includes("import AiOperationsPanel from './AiOperationsPanel'")&&acc.includes('<AiOperationsPanel/>')],
  ['AI Operations has auto refresh and safe status export',aiOps.includes('setInterval(()=>void load(),60000)')&&aiOps.includes('Sao chép trạng thái')&&aiOps.includes('data-ai-ops-surface="acc"')],
  ['garden frontend uses v4 water RPC',garden.includes("water:'herb_garden_water_v4'")],
  ['garden v4 casts integer slot to smallint',gardenMigration.includes('herb_garden_water_v3(p_slot_no::smallint)')],
  ['garden v4 serializes set-returning state safely',gardenMigration.includes('jsonb_agg(to_jsonb(s) order by s.slot_no)')],
  ['garden v4 treats already-watered cycle idempotently',gardenMigration.includes('Chưa đến lượt tưới tiếp theo')&&gardenMigration.includes("'already_watered'")],
];
const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length){console.error(`Study Home/Feed/Settings/ACC/Garden contract failed: ${failed.map(([name])=>name).join(', ')}`);process.exit(1)}
console.log('Focus Command Study Home + centralized Settings + Gemini Study handoff + feed/ACC/garden contract passed.');