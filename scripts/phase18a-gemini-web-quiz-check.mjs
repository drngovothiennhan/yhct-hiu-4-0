import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Phase 18A Gemini web quiz] ${message}`)};
const need=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbid=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const bank=read('src/components/exam/PracticeBankQuiz.tsx');
const css=read('src/practice-bank-quiz.css');
const studyService=read('src/services/studyAiService.ts');
const studyRoute=read('api/ai/study-quiz.js');
const assistant=read('api/ai/assistant.js');

need(bank,/>Đề HIU</,'member UI must expose approved HIU bank as actionable source');
need(bank,/>Đề Gemini <em className="practice-bank__ai-label">A\.I<\/em></,'member UI must expose Gemini-first generated quiz as actionable A.I-labelled source');
need(bank,/A\.I tạo/,'AI-generated questions must carry explicit AI labeling');
need(bank,/generateStudyGeminiQuiz/,'quiz UI must use the Study quiz client');
need(bank,/submitPracticeQuiz\(questions as PracticeQuizQuestion\[\]/,'HIU bank must preserve server-authoritative grading');
need(bank,/QuestionReasoningGuide/,'generated and HIU free-practice questions must expose contextual reasoning');
forbid(bank,/eligibleCount/,'member quiz UI must not render or depend on global approved-question count');
forbid(bank,/câu đã duyệt/,'member quiz UI must not expose global approved-question count badge/copy');
need(bank,/aiSources\.map/,'generated quiz must show grounded web sources');
need(css,/practice-bank__source-switch/,'source chooser styling missing');
need(css,/practice-bank__ai-label/,'AI-generated label styling missing');

need(studyService,/fetch\('\/api\/ai\/study-quiz'/,'generated quiz client must use dedicated resilient Study quiz endpoint');
need(studyService,/generateStudyGeminiQuiz/,'public client API name remains stable');
need(studyService,/sources\.length/,'client must reject ungrounded AI quiz output');
need(studyRoute,/memberAccess\(req,'member'\)/,'generated quiz endpoint must require an approved member');
need(studyRoute,/runGemini\(topic,count,controller\.signal\)/,'Gemini must remain primary provider');
need(studyRoute,/runOpenAi\(topic,count,controller\.signal\)/,'one grounded provider failover must be available for quota/rate failures');
if(studyRoute.indexOf('runGemini(topic,count,controller.signal)')>=studyRoute.indexOf('runOpenAi(topic,count,controller.signal)'))fail('Gemini must be attempted before fallback provider');
need(studyRoute,/Gemini quiz has no grounded web source/,'Gemini path must fail closed without web citations');
need(studyRoute,/OpenAI quiz has no grounded web source/,'fallback path must fail closed without web citations');
need(studyRoute,/invalid_quiz_count/,'server must reject incomplete/invalid generated sets');
need(studyRoute,/MAX_COUNT=20/,'AI generation must stay bounded for serverless reliability');
need(assistant,/req\.body\?\.mode==='study'\)return handleStudyAssistant/,'existing assistant gateway must remain the Study chat entry point');
forbid(assistant,/study-quiz/,'Study chat router must not absorb the dedicated generated-quiz endpoint');

console.log('Phase 19.1 actionable quiz source + resilient grounded Gemini-first web quiz contract: PASS');
