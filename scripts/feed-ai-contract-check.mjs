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
const news=read('src/components/news/TcmNewsRotator.tsx');
const checks=[
  ['TCM news backend remains rollback-safe',news.includes("tcm_news_feed_v1")&&news.includes("p_limit:20")&&retention.includes('private.tcm_news_retention_v2()')],
  ['TCM news surface is no longer mounted in academic feed',!feed.includes("TcmNewsRotator")&&!feed.includes('news-rail')&&feed.includes('data-news-surface="hidden"')],
  ['desktop feed collapses the removed news row',homeFeedCss.includes('grid-template-areas:"main side"')&&homeFeedCss.includes('grid-template-areas:"widgets main side"')&&main.includes("import './home-feed-phase4.css'" )],
  ['Home wrapper has converged to StudyHubV2 only',home.includes("lazy(()=>import('./StudyHubV2'))")&&home.includes('<StudyHubV2 {...props}/></Suspense>')&&!home.includes('StudentHomeLegacy')&&!home.includes('studyOsV2CanaryEnabled')],
  ['Study Home uses learner journey focus and daily target',studyHub.includes('readStudentJourney')&&studyHub.includes('preferences?.focus')&&studyHub.includes('preferences?.dailyMinutes')],
  ['Study Home has one command surface with deterministic routing',studyHub.includes('routeStudyOsRequest')&&studyHub.includes('study-os-v2__command')&&studyHub.includes("onNavigate('ai')")&&studyHub.includes("onNavigate('research')")&&studyHub.includes("onNavigate('exam')")],
  ['Study Home delegates academic answering to Gemini Study instead of floating task assistant',studyHub.includes('Gemini phụ trách hỏi đáp theo ngữ cảnh')&&studyHub.includes('yhct-ai-center-pending-query-v1')&&!studyHub.includes('yhct:ai:open')],
  ['Study Home keeps three focused learning cards',studyHub.includes('HỌC TIẾP')&&studyHub.includes('QUIZ & ÔN LUYỆN')&&studyHub.includes('NGHIÊN CỨU')&&studyCss.includes('.study-os-v2__grid')],
  ['Home no longer owns install, sharing or performance controls',!studyHub.includes('getPwaInstallStatus')&&!studyHub.includes('requestPwaInstall')&&!studyHub.includes('getPerformancePreference')&&!studyHub.includes('setPerformancePreference')&&!studyHub.includes('<b>Chia sẻ</b>')&&!studyHub.includes('<b>Cài ứng dụng</b>')],
  ['Settings owns PWA install, sharing and performance preferences',settings.includes('requestPwaInstall')&&settings.includes('Chia sẻ ứng dụng')&&settings.includes('getPerformancePreference')&&settings.includes('setPerformancePreference')&&settings.includes('performance-mode-settings')],
  ['academic feed caps system AI cards to latest three',feed.includes('.filter(isSystemAiPost).sort((a,b)=>postTime(b)-postTime(a)).slice(0,3)')],
  ['academic center renders maximum three posts per page',feed.includes('const PAGE_SIZE=3')&&feed.includes('filtered.slice(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE)')&&feed.includes('Bài cũ hơn')],
  ['image posts receive bounded recency preference',feed.includes('MEDIA_PRIORITY_WINDOW_MS')&&feed.includes('hasMedia(a)!==hasMedia(b)')],
  ['system AI preface is separated from main content',post.includes('system-ai-preface')&&post.includes('SYSTEM_PREFACE')],
  ['system AI main content is clamped to five lines',post.includes('system-ai-main')&&css.includes('-webkit-line-clamp:5')],
  ['system AI warning is compact',css.includes('.system-ai-note')&&css.includes('font-size:.7rem')],
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
console.log('Converged Study Home + centralized Settings + Gemini Study handoff + feed/ACC/garden contract passed.');
