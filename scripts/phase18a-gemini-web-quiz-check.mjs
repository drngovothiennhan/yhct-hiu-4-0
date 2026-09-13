import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Phase 18A Gemini web quiz] ${message}`)};
const need=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbid=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const bank=read('src/components/exam/PracticeBankQuiz.tsx');
const css=read('src/practice-bank-quiz.css');
const studyService=read('src/services/studyAiService.ts');
const studyRoute=read('api/_lib/study-assistant-handler.js');
const assistant=read('api/ai/assistant.js');

need(bank,/Ngân hàng đề HIU/,'member UI must expose HIU approved bank as a source');
need(bank,/Đề do Gemini tạo/,'member UI must expose Gemini-generated quiz source');
need(bank,/A\.I tạo/,'AI-generated questions must carry an explicit AI label');
need(bank,/generateStudyGeminiQuiz/,'quiz UI must use the shared Gemini Study client');
need(bank,/submitPracticeQuiz\(questions as PracticeQuizQuestion\[\]/,'HIU bank must preserve server-authoritative grading');
forbid(bank,/eligibleCount/,'member quiz UI must not render or depend on the global approved-question count');
forbid(bank,/câu đã duyệt/,'member quiz UI must not expose the global approved-question count badge/copy');
need(bank,/aiSources\.map/,'Gemini quiz must show grounded web sources');
need(css,/practice-bank__source-switch/,'source chooser styling missing');
need(css,/practice-bank__ai-label/,'AI-generated label styling missing');

need(studyService,/task:'quiz'/,'Gemini quiz client must reuse study mode on the existing assistant gateway');
need(studyService,/\/api\/ai\/assistant/,'Gemini quiz must not create a new serverless endpoint');
need(studyService,/sources\.length/,'client must reject ungrounded AI quiz output');
need(studyRoute,/task==='quiz'/,'shared Study handler must route quiz generation');
need(studyRoute,/createGeminiWebSearch/,'Gemini quiz must use Google Search grounding');
need(studyRoute,/Gemini quiz has no grounded web source/,'server must fail closed when no web citation is returned');
need(studyRoute,/aiGenerated:true/,'server response must label generated quiz content');
need(studyRoute,/MAX_QUIZ_COUNT=20/,'AI generation must stay bounded for serverless reliability');
need(assistant,/req\.body\?\.mode==='study'\)return handleStudyAssistant/,'existing shared assistant gateway must remain the Study entry point');

console.log('Phase 18A simplified quiz source + grounded Gemini web quiz contract: PASS');
