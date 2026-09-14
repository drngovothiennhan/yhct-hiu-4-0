import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Phase 18A Gemini web quiz] ${message}`)};
const need=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbid=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const bank=read('src/components/exam/PracticeBankQuiz.tsx');
const css=read('src/practice-bank-quiz.css');
const studyService=read('src/services/studyAiService.ts');
const studyRoute=read('api/_lib/study-assistant-handler.js');
const evidence=read('api/_lib/public-medical-evidence.js');
const assistant=read('api/ai/assistant.js');

need(bank,/>Đề HIU</,'member UI must expose approved HIU bank');
need(bank,/>Đề Gemini <em className="practice-bank__ai-label">A\.I<\/em></,'member UI must expose Gemini-first generated quiz');
need(bank,/A\.I tạo/,'AI-generated questions must carry explicit AI labeling');
need(bank,/generateStudyGeminiQuiz/,'quiz UI must use Study quiz client');
need(bank,/submitPracticeQuiz\(questions as PracticeQuizQuestion\[\]/,'HIU bank preserves server-authoritative grading');
need(bank,/QuestionReasoningGuide/,'free-practice questions expose contextual reasoning');
forbid(bank,/eligibleCount/,'member quiz UI must not depend on global approved-question count');
forbid(bank,/câu đã duyệt/,'member quiz UI must not expose global approved-question count');
need(bank,/aiSources\.map/,'generated quiz must show grounded public sources');
need(css,/practice-bank__source-switch/,'source chooser styling missing');
need(css,/practice-bank__ai-label/,'AI-generated label styling missing');

need(studyService,/fetch\('\/api\/ai\/assistant'/,'generated quiz client must reuse shared assistant endpoint');
need(studyService,/task:'quiz'/,'generated quiz client must select Study quiz task');
forbid(studyService,/\/api\/ai\/study-quiz/,'duplicate dedicated quiz endpoint must stay removed');
need(studyService,/generateStudyGeminiQuiz/,'public client API name remains stable');
need(studyService,/sources\.length/,'client rejects ungrounded AI quiz output');
need(studyRoute,/memberAccess\(req,'member'\)/,'shared Study handler requires approved member');
need(studyRoute,/task==='quiz'/,'shared Study handler routes generated quiz task');
need(studyRoute,/retrievePublicMedicalEvidence/,'quiz must retrieve public evidence independently of model quota');
need(studyRoute,/createGeminiJson/,'Gemini remains the primary quiz generator');
need(studyRoute,/runOpenAiEvidenceQuiz/,'one evidence-grounded generator failover must remain available');
need(studyRoute,/gemini-public-evidence/,'primary generated quiz must disclose evidence-grounded provider');
need(studyRoute,/openai-public-evidence/,'fallback must reuse the same retrieved evidence packet');
need(studyRoute,/sourceIndexes/,'every generated question must bind to supporting source indexes');
need(studyRoute,/QUIZ_MODEL_BUSY/,'provider exhaustion must be distinguished from source retrieval failure');
need(studyRoute,/MAX_QUIZ_COUNT=20/,'AI generation stays bounded');
need(studyRoute,/X-AI-Failover/,'provider failover remains transparent');
forbid(studyRoute,/web_search_preview/,'quiz failover must not consume a second paid web-search tool quota');
need(evidence,/api\.openalex\.org\/works/,'OpenAlex public evidence retrieval missing');
need(evidence,/ebi\.ac\.uk\/europepmc/,'Europe PMC public evidence retrieval missing');
need(evidence,/wikipedia\.org\/w\/api\.php/,'public general-knowledge fallback missing');
need(evidence,/physiology/,'Vietnamese medical query expansion for physiology missing');
need(evidence,/FETCH_TIMEOUT_MS/,'public evidence requests must be time bounded');
need(assistant,/req\.body\?\.mode==='study'\)return handleStudyAssistant/,'assistant gateway remains single Study entrypoint');

console.log('Phase 19.2 quota-independent public evidence + shared Gemini-first quiz contract: PASS');
