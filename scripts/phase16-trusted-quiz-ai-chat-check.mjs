import fs from 'node:fs';
import {parseTrustedMarkedDocx} from '../api/_lib/docx-marked-quiz.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Phase 16 trusted quiz / AI chat] ${message}`)};
const need=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbid=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const parser=read('api/_lib/docx-marked-quiz.js');
const ingest=read('api/_lib/trusted-quiz-ingest.js');
const route=read('api/ai/drive-rag.js');
const migration=read('supabase/migrations/202609122055_phase16_quiz_answer_review_v1.sql');
const panel=read('src/components/admin/LearningContentManagerPanel.tsx');
const bank=read('src/components/exam/PracticeBankQuiz.tsx');
const service=read('src/services/dailyPracticeService.ts');
const app=read('src/App.tsx');
const modules=read('src/modules/moduleContract.ts');
const aiCenter=read('src/components/ai/AiCenter.tsx');
const aiMiniCss=read('src/app-assistant-ai.css');

for(const pattern of [/FF0000/,/word-font-color-red-v1/,/uniqueMarked\.length!==1/,/trustedApprovedSource:true/,/reviewStatus='source_verified'/])need(parser,pattern,`DOCX parser missing ${pattern}`);
forbid(parser,/gemini|openai|createGemini|fetch\(/i,'trusted DOCX parser must not use AI or network inference');
need(ingest,/YHCT_DRIVE_APPROVED_OUTLINE_FOLDER_ID/,'approved Drive folder must be configurable');
need(ingest,/createdTime desc/,'approved Drive sync must order by createdTime');
need(ingest,/practice_source_sync_state_v1/,'sync must consult server-side source registry');
need(ingest,/pending\.slice\(0,maxFiles\)/,'sync must process a bounded batch');
need(ingest,/parseTrustedMarkedDocx/,'trusted ingest must use deterministic marker parser');
need(route,/trusted-quiz-upload/,'trusted upload route missing');
need(route,/trusted-quiz-sync/,'trusted Drive sync route missing');

for(const pattern of [/security definer/gi,/set search_path=''/gi,/private\.is_learning_content_manager\(\)/,/private\.is_approved\(\)/,/revoke all on table public\.practice_answer_review_requests from public,anon,authenticated/])need(migration,pattern,`secure migration contract missing ${pattern}`);
need(migration,/practice_answer_review_request_v1/,'member answer-check RPC missing');
need(migration,/practice_answer_review_queue_v1/,'manager answer-review queue missing');
need(migration,/practice_answer_review_resolve_v1/,'manager answer-review resolve RPC missing');
const requestBody=migration.match(/create or replace function public\.practice_answer_review_request_v1[\s\S]*?\$\$;/i)?.[0]||'';
forbid(requestBody,/update\s+public\.practice_questions/i,'student answer-check request must not mutate canonical questions');

need(panel,/Cập nhật đề cương đã duyệt/,'admin approved-outline update action missing');
need(panel,/tryTrustedQuizUpload/,'admin direct trusted upload missing');
need(panel,/AnswerReviewQueue/,'admin answer review queue missing');
need(bank,/Yêu cầu kiểm tra đáp án/,'student answer verification action missing');
need(service,/practice_answer_review_request_v1/,'student answer-check service missing');
need(bank,/submitPracticeQuiz/,'server-authoritative grading path must remain in quiz UI');

need(modules,/ai:\{id:'ai',title:'Trợ lý A\.I',path:'\/ai'/,'dedicated AI module missing');
need(app,/const AiCenter=lazy/,'AI Center must remain lazy-loaded');
need(app,/openAssistant=\(\)=>requestMemberAction\(\(\)=>go\('ai'\)\)/,'primary AI icon must open dedicated AI Center');
need(app,/tab==='ai'&&member&&<AiCenter/,'AI Center route render missing');
need(aiCenter,/ai-center__conversation/,'AI Center must prioritize transcript');
need(aiCenter,/ai-center__suggestions/,'AI Center compact suggestion row missing');
need(aiCenter,/ai-center__composer/,'AI Center composer missing');
need(aiCenter,/askXiaoZhiMini/,'AI Center must reuse canonical XiaoZhi backend');
need(aiMiniCss,/app-assistant-role,.app-assistant-guide-toggle\{display:none!important\}/,'AI Mini intro must be hidden');
need(aiMiniCss,/app-assistant-shortcuts\{display:flex!important/,'AI Mini suggestions must be a one-row scroller');

const good=Buffer.from('UEsDBBQAAAAIAKRxLF0KymDdBAEAAJACAAARAAAAd29yZC9kb2N1bWVudC54bWyNkk1OxCAUx/ee4oW90HZhTNOPzEcaNyaz0AMgZWaaAI8AM3WO4tZruPQk3kSo40qTlsWDB3/+jx9Qta9awVk6P6CpSU4zAtII7AdzqMnzU3d7T8AHbnqu0MiaXKQnbXNTjWWP4qSlCRAdjC/HmhxDsCVjXhyl5p6ilSau7dFpHmLqDmxE11uHQnofC2jFiiy7Y5oPhjTR8gX7y+RtU+ZSCM3m8/0EOYXHr4+30FYszaXopmj/6FcUVvmczO2mTqBCB2N55qomXZfFRtjPtt3Vbk1hPWsXT0lhs0C2pbBd4paYCwoPfJglXo6SbqaYL56IF8gS8QJZIv5Xxq7vnQa/f6n5BlBLAQIUAxQAAAAIAKRxLF0KymDdBAEAAJACAAARAAAAAAAAAAAAAACAAQAAAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAQABAD8AAAAzAQAAAAA=','base64');
const goodResult=parseTrustedMarkedDocx(good,{id:'fixture-good',name:'fixture.docx',parentName:'Thuốc YHCT'},'fixture-hash');
if(!goodResult.trusted||goodResult.total!==2||goodResult.valid!==2||goodResult.invalid.length)fail(`valid marked DOCX fixture rejected: ${JSON.stringify(goodResult)}`);
if(goodResult.questions[0]?.correctIndex!==1||goodResult.questions[1]?.correctIndex!==0)fail('red answer mapping from DOCX fixture is incorrect');

const bad=Buffer.from('UEsDBBQAAAAIAKpxLF3yhyFZ6QAAAMYBAAARAAAAd29yZC9kb2N1bWVudC54bWytkU1OBCEQhfeeosJ+oNvFxHSa7sxPemcyCz0AAs50AhQBZto5iluv4dKTeBOhHTfGRBfW4hUFj49Q1fZP1sBJhzii46SmFQHtJKrR7Tm5vxsWNwRiEk4Jg05zctaR9N1VOzUK5dFqlyATXGwmTg4p+YaxKA/aikjRa5fPHjFYkXIZ9mzCoHxAqWPMD1jDrqtqyawYHeky8gHVeWb7UoUiqdu8vRyhpnD7/vqc+paVvaJhVv/NH3ZzkmgwwNSchOFkGKochH1e2124Kwqr+v9wawrrX3H5NxQ2f7BtKWx/tLFLl8riawLdB1BLAQIUAxQAAAAIAKpxLF3yhyFZ6QAAAMYBAAARAAAAAAAAAAAAAACAAQAAAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAQABAD8AAAAYAQAAAAA=','base64');
const badResult=parseTrustedMarkedDocx(bad,{id:'fixture-bad',name:'fixture.docx',parentName:'Thuốc YHCT'},'fixture-hash');
if(badResult.trusted||badResult.invalid[0]?.reason!=='multiple_red_answers')fail('ambiguous multiple-red DOCX fixture must be rejected without inference');

console.log('Phase 16 trusted quiz ingestion + answer review + AI Center contract: PASS');
