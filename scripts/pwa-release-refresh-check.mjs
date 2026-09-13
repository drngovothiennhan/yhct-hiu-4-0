import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[PWA release refresh] ${message}`)};
const need=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbid=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const vite=read('vite.config.ts');
const types=read('src/vite-env.d.ts');
const main=read('src/main.tsx');
const sw=read('public/service-worker.js');
const panel=read('src/components/admin/LearningContentManagerPanel.tsx');
const answerQueue=read('src/components/admin/AnswerReviewQueue.tsx');

need(vite,/VERCEL_GIT_COMMIT_SHA/,'Vercel commit SHA must feed the release fingerprint');
need(vite,/GITHUB_SHA/,'GitHub CI SHA must feed the release fingerprint');
need(vite,/__YHCT_RELEASE_ID__/,'release id must be injected at build time');
need(types,/declare const __YHCT_RELEASE_ID__: string/,'release id global type missing');

need(main,/service-worker\.js\?release=\$\{release\}/,'service worker URL must be release-fingerprinted');
need(main,/registration\.update\(\)/,'service worker update check missing');
need(main,/window\.addEventListener\('focus',checkForRelease/,'foreground focus update check missing');
need(main,/visibilitychange/,'foreground visibility update check missing');
need(main,/controllerchange[\s\S]*window\.location\.reload\(\)/,'controller change must reload the stale SPA exactly once');

need(sw,/pwa-v22-release-aware/,'service worker cache generation was not bumped');
need(sw,/skipWaiting\(\)/,'new service worker must activate without manual waiting');
need(sw,/clients\.claim\(\)/,'new service worker must take control of existing clients');
need(sw,/service-worker\.js/,'service worker script must be treated as freshness-sensitive');
need(sw,/cache:'no-store'/,'freshness-sensitive requests must bypass HTTP cache');

need(panel,/>Cập nhật<|:'Cập nhật'/,'new quiz-bank update button missing from source');
need(panel,/AnswerReviewQueue/,'learning manager must mount the wrong-answer inbox');
need(answerQueue,/Báo đáp án sai/,'wrong-answer inbox missing from its component');
need(answerQueue,/chờ xử lý/,'wrong-answer inbox pending count missing');
forbid(panel,/Làm mới bản nháp|Chọn một kho Drive ở trên|Bản nháp và lịch sử nhập/i,'obsolete quiz-bank UX returned to source');

console.log('PWA release-aware refresh + current quiz-bank UI contract: PASS');
