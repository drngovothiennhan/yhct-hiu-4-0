import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd(),errors=[];
const file=p=>path.join(root,p);
const read=p=>fs.readFileSync(file(p),'utf8');
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))errors.push(`${label} missing ${token}`)};
const forbid=(body,tokens,label)=>{for(const token of tokens)if(body.includes(token))errors.push(`${label} must not contain ${token}`)};

const required=[
  'src/App.tsx','src/main.tsx','src/theme.ts','src/types/index.ts','src/modules/moduleContract.ts','src/modules/ModuleBoundary.tsx',
  'src/services/authService.ts','src/services/studyAiService.ts','src/services/practiceQuizService.ts','src/services/driveRagService.ts','src/services/academicTranslationService.ts',
  'src/components/ai/UnifiedAiMini.tsx','src/components/ai/AiCenter.tsx','src/components/ai/AssistantMascot.tsx',
  'src/components/research/ResearchCenter.tsx','src/components/research/ResearchAiMini.tsx','src/components/research/ResearchProposalBuilder.tsx',
  'src/components/exam/ExamCenter.tsx','src/components/exam/AdaptiveReview.tsx','src/components/exam/PracticeBankQuiz.tsx','src/components/exam/DailyDrivePractice.tsx','src/components/exam/QuestionReasoningGuide.tsx',
  'src/components/admin/LearningContentManagerPanel.tsx','src/components/admin/QuizImportCenter.tsx',
  'src/components/game/HerbGardenGame.tsx','src/components/game/HiuYQuanGame.tsx',
  'api/ai/assistant.js','api/_lib/study-assistant-handler.js','api/_lib/public-medical-evidence.js','api/_lib/trusted-quiz-ingest.js','api/_lib/docx-marked-quiz.js','api/ai/research-proposal.js','api/ai/health.js','api/manifest.js',
  'public/service-worker.js','public/manifest.webmanifest','vite.config.ts','vercel.json',
  'supabase/migrations/202609132110_phase19_research_proposal_gemini_quota.sql','supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql','supabase/migrations/202609132145_phase19_quiz_source_sync_revision.sql',
  'docs/PHASE19_STUDY_OS_RESEARCH_AI_ARCHITECTURE.md'
];
for(const p of required)if(!fs.existsSync(file(p)))errors.push(`missing ${p}`);
if(fs.existsSync(file('api/ai/study-quiz.js')))errors.push('duplicate api/ai/study-quiz.js must remain removed');
if(fs.existsSync(file('api/ai/study-assistant.js')))errors.push('duplicate api/ai/study-assistant.js must remain removed');

const sourceFiles=[];
const walk=dir=>{if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(?:ts|tsx|js|mjs|css)$/.test(entry.name))sourceFiles.push(p)}};
walk(file('src'));walk(file('api'));
const forbidden=[
  [/sk-proj-[A-Za-z0-9_-]{20,}/,'raw OpenAI secret'],[/AIza[0-9A-Za-z_-]{20,}/,'raw Google/Gemini secret'],[/dangerouslySetInnerHTML/,'dangerous raw HTML rendering'],[/\bTODO\b|\bFIXME\b|implement later|code logic here/i,'unfinished implementation marker'],[/drive\.google\.com\/drive\/folders\//i,'direct Google Drive folder URL']
];
for(const p of sourceFiles){const body=fs.readFileSync(p,'utf8');for(const [re,label] of forbidden)if(re.test(body))errors.push(`${label} in ${path.relative(root,p)}`)}

const app=read('src/App.tsx'),main=read('src/main.tsx'),contract=read('src/modules/moduleContract.ts');
need(app,['UnifiedAiMini member={member}',"lazy(()=>import('./components/research/ResearchCenter'))",'ModuleBoundary moduleId={tab}',"tab==='admin'&&canAdmin&&<AdminControlCenter","tab==='acc'&&canAcc&&<>",'authResolved'],'modular app shell');
need(contract,["ModuleId='feed'|'research'|'profile'|'garden'|'notifications'|'schedule'|'drl'|'exam'|'admin'|'acc'", "if(path==='/messages')return'profile'"],'frozen module contract');
need(main,['requestAnimationFrame(()=>requestAnimationFrame(revealStableApp))','delete root.dataset.appBooting','yhct-prepaint'],'stable first paint');

const mini=read('src/components/ai/UnifiedAiMini.tsx'),assistant=read('api/ai/assistant.js'),studyClient=read('src/services/studyAiService.ts'),study=read('api/_lib/study-assistant-handler.js'),publicEvidence=read('api/_lib/public-medical-evidence.js'),aiCenter=read('src/components/ai/AiCenter.tsx');
need(mini,['researchIntent','openResearch(text)','openStudyAi(text)','Trợ lý tác vụ'],'task-only assistant routing');
forbid(mini,['askXiaoZhiMini','searchOpenAlex','searchDriveRag','searchKnowledge'],'task assistant academic retrieval');
need(assistant,["req.body?.mode==='study'",'handleStudyAssistant',"req.body?.mode==='xiaozhi-mini'"],'shared assistant routing');
need(studyClient,["fetch('/api/ai/assistant'","mode:'study'","task:'quiz'",'A.I chưa tạo đủ số câu hợp lệ','Đề A.I chưa có nguồn web xác minh'],'shared Study client');
forbid(studyClient,['/api/ai/study-quiz'],'duplicate Study client endpoint');
need(study,['createGeminiWebSearch','createGeminiText',"task==='quiz'",'createGroundedQuiz','retrievePublicMedicalEvidence','runOpenAiEvidenceQuiz',"provider:'openai-public-evidence'",'X-AI-Evidence-Count','QUIZ_MODEL_BUSY','sourceIndexes'],'shared resilient Gemini-first Study gateway');
forbid(study,['web_search_preview','runOpenAiQuiz',"provider:'openai-web-fallback'"],'retired duplicate quota-sensitive quiz search');
need(publicEvidence,['api.openalex.org/works','ebi.ac.uk/europepmc','wikipedia.org/w/api.php','physiology','publicEvidencePacket','publicEvidenceSources'],'quota-independent public evidence retrieval');
need(aiCenter,['askStudyGemini','AI STUDY OS · GEMINI','ai-center__conversation'],'dedicated Gemini Study workspace');

const research=read('src/components/research/ResearchCenter.tsx'),researchMini=read('src/components/research/ResearchAiMini.tsx'),proposal=read('src/components/research/ResearchProposalBuilder.tsx'),proposalApi=read('api/ai/research-proposal.js'),proposalQuota=read('supabase/migrations/202609132110_phase19_research_proposal_gemini_quota.sql');
need(research,['searchPubMed(query,12)','searchOpenAlex(query,12)','searchClinicalTrials(query,8)','<ResearchAiMini','Khách: không dùng Gemini'],'Research Center evidence/AI separation');
forbid(research,['summarizeOpenAlex','Research A.I tổng hợp nguồn vừa tìm','ragInternalConsent'],'retired Research surfaces');
need(researchMini,['RESEARCH_ROLE=GEMINI_MEDICAL_RESEARCH_LEAD','searchPubMed(text,8)','searchOpenAlex(text,8)','searchClinicalTrials(text,5)','Dùng tài liệu nội bộ cho lượt này','setUseInternal(false)','PUBLIC_SOURCE_BUDGET=2','CENTRAL_SOURCE_BUDGET=2','DRIVE_SOURCE_BUDGET=2','Không tạo câu trả lời local thay thế'],'Gemini medical Research workbench');
need(proposal,['Gemini tạo đề cương','quota.remaining','6 giờ','unlimited'],'role-aware proposal quota UX');
need(proposalApi,['research_proposal_quota_v1','createGeminiJson','Không dùng bản nháp local thay thế'],'Gemini proposal gateway');
need(proposalQuota,["interval '6 hours'","v_role='admin'","v_role in('mod','super_mod','leader')",'then 5 else 3'],'server-authoritative proposal quota');

const manager=read('src/components/admin/LearningContentManagerPanel.tsx'),trusted=read('api/_lib/trusted-quiz-ingest.js'),parser=read('api/_lib/docx-marked-quiz.js'),bank=read('supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql');
need(manager,['Ngân hàng đề thi','syncQuizBank','Thêm thủ công → Cập nhật → dùng ngay','đáp án tô đỏ','Tên thư mục môn là nội dung người học nhìn thấy'],'one-step bank UX');
forbid(manager,['sourceFileBase64','startQuizPipeline','publishQuizDraft','Duyệt Drive thủ công','File từ ACC'],'alternate bank workflows');
need(trusted,["MANUAL_INTAKE_FOLDER='Thêm thủ công'",'subjectFolders','nestedGroups','parseTrustedMarkedDocx','practice_source_sync_state_v1','practice_trusted_quiz_ingest_v1','needsProcessing','PARSER_REVISION'],'trusted Drive intake');
need(parser,['labeled-abcd-v1','numbered-unlabeled-options-v1','sourceMarkColor','FF0000','invalid_option_count'],'deterministic red-answer parser layouts');
need(bank,['practice_quiz_config_v1','practice_quiz_page_v1',"q.review_status in('source_verified','expert_approved')",'practice_subject_folders_sync_admin_v1','where active is true'],'data-first quiz bank SQL');
forbid(bank,['sourceFileName'],'member-facing source filename leakage');

const practice=read('src/components/exam/PracticeBankQuiz.tsx'),adaptive=read('src/components/exam/AdaptiveReview.tsx'),reasoning=read('src/components/exam/QuestionReasoningGuide.tsx');
need(practice,['Đề HIU','Đề Gemini','generateStudyGeminiQuiz','QuestionReasoningGuide','recordReview'],'source-first practice experience');
need(adaptive,['REVIEW_COUNTS=[5,10,20]','getPracticeQuizConfig','QuestionReasoningGuide'],'subject-aware spaced review');
need(reasoning,['KHÔNG tiết lộ đáp án đúng','Dữ kiện quyết định','Loại trừ','Điểm cần nhớ',"askServerAi(prompt,'exam'"],'contextual non-answer-leaking reasoning');

const sw=read('public/service-worker.js'),pkg=JSON.parse(read('package.json'));
need(sw,["url.pathname.startsWith('/api/')","startsWith('yhct-hiu-4-')"],'PWA cache safety');
if(!String(pkg.scripts?.prebuild||'').includes('audit:modules'))errors.push('prebuild must run module audit');
if(!String(pkg.scripts?.prebuild||'').includes('audit:phase17'))errors.push('prebuild must run shared Study audit');
if(!String(pkg.scripts?.prebuild||'').includes('audit:quiz-pipeline'))errors.push('prebuild must run quiz pipeline audit');

const entries=[];function walkApi(dir,relative=''){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name.startsWith('_')||entry.name.startsWith('.'))continue;const name=relative+entry.name;if(entry.isDirectory())walkApi(path.join(dir,entry.name),`${name}/`);else if(/\.(?:js|mjs|cjs|ts|tsx|py|go|rb)$/.test(name)&&!name.endsWith('.d.ts'))entries.push(`api/${name}`)}}walkApi(file('api'));
if(entries.length>12)errors.push(`Vercel Hobby function budget exceeded: ${entries.length}`);

if(errors.length){console.error('ACCEPTANCE CHECK FAILED');errors.forEach(e=>console.error(`- ${e}`));process.exit(1)}
console.log(`acceptance-ok: ${sourceFiles.length} application source files scanned; quota-independent public evidence + shared Gemini Study gateway + deterministic red-answer bank + Gemini Research + contextual reasoning + PWA/RBAC gates clean · ${entries.length}/12 functions`);
