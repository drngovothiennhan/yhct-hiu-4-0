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
const answerQueue=read('src/components/admin/AnswerReviewQueue.tsx');
const themeControl=read('src/components/admin/AdminThemeControl.tsx');
const bank=read('src/components/exam/PracticeBankQuiz.tsx');
const workspaceService=read('src/services/quizWorkspaceService.ts');
const service=read('src/services/dailyPracticeService.ts');
const app=read('src/App.tsx');
const modules=read('src/modules/moduleContract.ts');
const aiCenter=read('src/components/ai/AiCenter.tsx');
const aiMini=read('src/components/ai/UnifiedAiMini.tsx');
const aiMiniCss=read('src/app-assistant-ai.css');
const studyService=read('src/services/studyAiService.ts');
const studyRoute=read('api/ai/study-assistant.js');

for(const pattern of [/FF0000/,/word-font-color-red-v1/,/uniqueMarked\.length!==1/,/trustedApprovedSource:true/,/reviewStatus='source_verified'/])need(parser,pattern,`DOCX parser missing ${pattern}`);
forbid(parser,/gemini|openai|createGemini|fetch\(/i,'trusted DOCX parser must not use AI or network inference');
need(ingest,/YHCT_DRIVE_QUIZ_BANK_FOLDER_ID/,'quiz bank Drive folder must be configurable');
need(ingest,/DEFAULT_QUIZ_BANK_FOLDER='1_VvupTkvHvWKLLehVQt_JNA15qfKnIvO'/,'canonical NGAN HANG TRAC NGHIEM folder must be the safe default');
need(ingest,/NGÂN HÀNG TRẮC NGHIỆM/,'quiz bank sync response must identify the canonical folder');
need(ingest,/createdTime desc/,'quiz bank sync must order by createdTime');
need(ingest,/practice_source_sync_state_v1/,'sync must consult server-side source registry');
need(ingest,/practice_trusted_quiz_ingest_v1/,'trusted ingest must use capability-scoped RPC');
forbid(ingest,/practice_drive_ingest_admin_v1/,'trusted ingest must not depend on admin-only generic ingest');
need(ingest,/pending\.slice\(0,maxFiles\)/,'sync must process a bounded batch');
need(ingest,/parseTrustedMarkedDocx/,'trusted ingest must use deterministic marker parser');
need(route,/trusted-quiz-upload/,'trusted upload route missing');
need(route,/trusted-quiz-sync/,'trusted Drive sync route missing');

for(const pattern of [/security definer/gi,/set search_path=''/gi,/private\.is_learning_content_manager\(\)/,/private\.is_approved\(\)/,/revoke all on table public\.practice_answer_review_requests from public,anon,authenticated/])need(migration,pattern,`secure migration contract missing ${pattern}`);
need(migration,/practice_trusted_quiz_ingest_v1/,'trusted quiz ingest RPC missing');
need(migration,/sourceMark[^\n]*word-font-color-red-v1/,'trusted RPC must validate deterministic source marker');
need(migration,/sourceMarkColor/,'trusted RPC must validate marker color');
need(migration,/trustedApprovedSource/,'trusted RPC must require approved-source provenance');
need(migration,/extensions\.digest/,'answer correction hash must use schema-qualified digest');
need(migration,/where question_id=row_request\.question_id and status='open'/,'resolving one answer review must close all open reports for that question');
need(migration,/group by r\.question_id/,'answer review queue must group duplicate reports by question');
need(migration,/practice_answer_review_request_v1/,'member answer-check RPC missing');
need(migration,/practice_answer_review_queue_v1/,'manager answer-review queue missing');
need(migration,/practice_answer_review_resolve_v1/,'manager answer-review resolve RPC missing');
const requestBody=migration.match(/create or replace function public\.practice_answer_review_request_v1[\s\S]*?\$\$;/i)?.[0]||'';
forbid(requestBody,/update\s+public\.practice_questions/i,'student answer-check request must not mutate canonical questions');

need(workspaceService,/syncQuizBank/,'canonical quiz bank update service missing');
need(panel,/syncQuizBank/,'ACC must use canonical quiz bank update action');
need(panel,/NGÂN HÀNG TRẮC NGHIỆM/,'ACC must expose the canonical quiz bank');
need(panel,/>Cập nhật<|:'Cập nhật'/,'ACC primary update button missing');
need(panel,/AnswerReviewQueue/,'admin answer review inbox missing');
forbid(panel,/Làm mới bản nháp|Chọn một kho Drive ở trên|Admin có thể duyệt thư mục|bản nháp/i,'obsolete draft / Drive instructional UX must stay removed');
need(answerQueue,/Báo đáp án sai/,'wrong-answer inbox title missing');
need(answerQueue,/chờ xử lý/,'wrong-answer inbox count missing');
forbid(answerQueue,/<details/,'wrong-answer inbox must be visible as a compact box, not hidden in details');
need(themeControl,/Giao diện hệ thống/,'system appearance control missing');
need(themeControl,/module khác chỉ nhận theme đồng bộ/,'theme isolation marker must remain in source');
forbid(themeControl,/option\.description|<p[^>]*>[^<]*(?:Chỉ ACC\/Admin thay đổi|module khác chỉ nhận theme)/,'system appearance control must stay compact without rendered explanatory copy');
need(panel,/tryTrustedQuizUpload/,'admin direct trusted upload missing');
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
need(aiCenter,/askStudyGemini/,'AI Center must use dedicated Gemini Study service');
forbid(aiCenter,/askXiaoZhiMini/,'AI Center must not reuse XiaoZhi Q&A after the Study OS split');
need(studyService,/\/api\/ai\/study-assistant/,'Gemini Study client route missing');
need(studyRoute,/createGeminiWebSearch/,'Gemini Study must use Gemini grounded search as primary answer path');
need(studyRoute,/conversationContext/,'Gemini Study must receive conversational context');
forbid(aiMini,/askXiaoZhiMini/,'floating assistant must remain task/navigation-only');
need(aiMini,/AI_PENDING_KEY/,'task assistant must hand ordinary questions to the AI Center');
need(aiMiniCss,/app-assistant-role,.app-assistant-guide-toggle\{display:none!important\}/,'AI Mini intro must be hidden');
need(aiMiniCss,/app-assistant-shortcuts\{display:flex!important/,'AI Mini suggestions must be a one-row scroller');
need(aiMiniCss,/data-active-module="ai"[^\n]*app-assistant/,'floating task assistant must be hidden inside the dedicated AI workspace');

const good=Buffer.from('UEsDBBQAAAAIAKRxLF0KymDdBAEAAJACAAARAAAAd29yZC9kb2N1bWVudC54bWyNkk1OxCAUx/ee4oW90HZhTNOPzEcaNyaz0AMgZWaaAI8AM3WO4tZruPQk3kSo40qTlsWDB3/+jx9Qta9awVk6P6CpSU4zAtII7AdzqMnzU3d7T8AHbnqu0MiaXKQnbXNTjWWP4qSlCRAdjC/HmhxDsCVjXhyl5p6ilSau7dFpHmLqDmxE11uHQnofC2jFiiy7Y5oPhjTR8gX7y+RtU+ZSCM3m8/0EOYXHr4+30FYszaXopmj/6FcUVvmczO2mTqBCB2N55qomXZfFRtjPtt3Vbk1hPWsXT0lhs0C2pbBd4paYCwoPfJglXo6SbqaYL56IF8gS8QJZIv5Xxq7vnQa/f6n5BlBLAQIUAxQAAAAIAKRxLF0KymDdBAEAAJACAAARAAAAAAAAAAAAAACAAQAAAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAQABAD8AAAAzAQAAAAA=','base64');
const goodResult=parseTrustedMarkedDocx(good,{id:'fixture-good',name:'fixture.docx',parentName:'Thuốc YHCT'},'fixture-hash');
if(!goodResult.trusted||goodResult.total!==2||goodResult.valid!==2||goodResult.invalid.length)fail(`valid marked DOCX fixture rejected: ${JSON.stringify(goodResult)}`);
if(goodResult.questions[0]?.correctIndex!==1||goodResult.questions[1]?.correctIndex!==0)fail('red answer mapping from DOCX fixture is incorrect');

const bad=Buffer.from('UEsDBBQAAAAIAKpxLF3yhyFZ6QAAAMYBAAARAAAAd29yZC9kb2N1bWVudC54bWytkU1OBCEQhfeeosJ+oNvFxHSa7sxPemcyCz0AAs50AhQBZto5iluv4dKTeBOhHTfGRBfW4hUFj49Q1fZP1sBJhzii46SmFQHtJKrR7Tm5vxsWNwRiEk4Jg05zctaR9N1VOzUK5dFqlyATXGwmTg4p+YaxKA/aikjRa5fPHjFYkXIZ9mzCoHxAqWPMD1jDrqtqyawYHeky8gHVeWb7UoUiqdu8vRyhpnD7/vqc+paVvaJhVv/NH3ZzkmgwwNSchOFkGKochH1e2124Kwqr+v9wawrrX3H5NxQ2f7BtKWx/tLFLl8riawLdB1BLAQIUAxQAAAAIAKpxLF3yhyFZ6QAAAMYBAAARAAAAAAAAAAAAAACAAQAAAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAQABAD8AAAAYAQAAAAA=','base64');
const badResult=parseTrustedMarkedDocx(bad,{id:'fixture-bad',name:'fixture.docx',parentName:'Thuốc YHCT'},'fixture-hash');
if(badResult.trusted||badResult.invalid[0]?.reason!=='multiple_red_answers')fail('ambiguous multiple-red DOCX fixture must be rejected without inference');

console.log('Phase 16 trusted quiz bank update + answer review + Gemini Study split contract: PASS');
