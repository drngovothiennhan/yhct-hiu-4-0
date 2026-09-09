import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const checks=[
  ['news rotator loads a rolling pool',read('src/components/news/TcmNewsRotator.tsx').includes("p_limit:20")],
  ['news rotator auto-advances',read('src/components/news/TcmNewsRotator.tsx').includes('ROTATE_MS=8000')],
  ['desktop news displays two cards per viewport',read('src/news-rotator.css').includes('flex:0 0 calc((100% - var(--news-gap))/2)')],
  ['academic feed caps system AI cards to latest three',read('src/components/feed/AcademicFeed.tsx').includes('.filter(isSystemAiPost).sort((a,b)=>postTime(b)-postTime(a)).slice(0,3)')],
  ['system AI preface is separated from main content',read('src/components/feed/AcademicPostCard.tsx').includes('system-ai-preface')&&read('src/components/feed/AcademicPostCard.tsx').includes('SYSTEM_PREFACE')],
  ['references expose direct source links',read('src/components/feed/AcademicPostCard.tsx').includes('Truy cập nguồn')&&read('src/components/feed/AcademicPostCard.tsx').includes('target="_blank"')],
  ['database archives superseded AI academic posts',read('supabase/migrations/202609090135_academic_feed_ai_top3_and_news_rotator_restore_v1.sql').includes('private.ai_academic_post_archive')],
  ['TCM news retention restored independently',read('supabase/migrations/202609090135_academic_feed_ai_top3_and_news_rotator_restore_v1.sql').includes("private.tcm_news_retention_v2()")],
];
const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(failed.length){console.error(`Feed AI contract failed: ${failed.map(([name])=>name).join(', ')}`);process.exit(1)}
console.log('Academic feed AI + TCM news contract passed.');
