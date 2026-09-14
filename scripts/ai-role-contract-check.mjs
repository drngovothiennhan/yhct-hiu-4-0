import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))fail.push(`${label} missing ${token}`)};
const forbid=(body,tokens,label)=>{for(const token of tokens)if(body.includes(token))fail.push(`${label} must not contain ${token}`)};

const mini=read('src/components/ai/UnifiedAiMini.tsx');
const app=read('src/App.tsx');
const research=read('src/components/research/ResearchAiMini.tsx');
const researchCenter=read('src/components/research/ResearchCenter.tsx');
const researchEvidence=read('src/services/researchEvidenceService.ts');
const researchResourceApi=read('api/knowledge/resources.js');
const proposal=read('api/ai/research-proposal.js');
const proposalUi=read('src/components/research/ResearchProposalBuilder.tsx');
const quotaMigration=read('supabase/migrations/202609132110_phase19_research_proposal_gemini_quota.sql');
const quizManager=read('src/components/admin/LearningContentManagerPanel.tsx');
const trustedIngest=read('api/_lib/trusted-quiz-ingest.js');
const bankMigration=read('supabase/migrations/202609132120_phase19_quiz_bank_data_first.sql');
const study=read('api/_lib/study-assistant-handler.js');
const publicEvidence=read('api/_lib/public-medical-evidence.js');
const studyClient=read('src/services/studyAiService.ts');
const aiCenter=read('src/components/ai/AiCenter.tsx');
const diversity=read('api/_lib/ai-response-diversity.js');
const xz=read('src/services/xiaozhiMiniService.ts');
const xzServer=read('api/_lib/xiaozhi-mini-handler.js');
const assistant=read('api/ai/assistant.js');
const geminiProvider=read('api/_lib/gemini-provider.js');
const vercel=JSON.parse(read('vercel.json'));

need(mini,['Trợ lý tác vụ','researchIntent','openResearch(text)','openStudyAi(text)'],'AI Mini task assistant');
forbid(mini,['askXiaoZhiMini','searchOpenAlex','searchPubMed','searchClinicalTrials','searchDriveRag','searchKnowledge'],'AI Mini academic boundary');
if((app.match(/<UnifiedAiMini\b/g)||[]).length!==1)fail.push('App must render exactly one global task assistant launcher');
need(xz,['hiu.vn','appAssistantQuery'],'official HIU task-assistant source policy');
need(xzServer,['isResearchIntent',"route:'research'"],'XiaoZhi research handoff');

need(research,['RESEARCH_ROLE=GEMINI_MEDICAL_RESEARCH_LEAD','searchResearchEvidence(text,14,controller.signal)','reusePublic','searchDriveRag','searchKnowledge','Dùng tài liệu nội bộ cho lượt này','setUseInternal(false)','Bằng chứng','PICO','Khoảng trống','Phương pháp','Không tạo câu trả lời local thay thế'],'Gemini medical research workbench');
forbid(research,['searchPubMed(text,8)','searchOpenAlex(text,8)','searchClinicalTrials(text,5)','buildAcademicFallback','A.I local 0đ','Fallback học thuật cục bộ'],'Research must not restore duplicate public fan-out or fake local AI answers');
need(researchCenter,['<ResearchAiMini','searchResearchEvidence(query,18)','Khách: không dùng Gemini','Trích xuất ý chính (không A.I)'],'Research Center evidence/AI separation');
need(researchEvidence,["/api/knowledge/resources?action=research",'requestDeadline(12000,signal)'],'Research evidence client uses bounded server retrieval');
need(researchResourceApi,["action==='research'",'retrievePublicResearchEvidence'],'existing knowledge function owns public Research retrieval');
forbid(researchCenter,['searchPubMed(query,12)','searchOpenAlex(query,12)','searchClinicalTrials(query,8)'],'Research Center must not restore browser provider fan-out');
if((researchCenter.match(/<ResearchAiMini\b/g)||[]).length!==1)fail.push('Research Center must render exactly one Research A.I surface');
forbid(researchCenter,['A.I OpenAlex','OpenAlex A.I','tổng hợp local 0đ','ragInternalConsent'],'Research UI duplicate orchestration');

need(proposal,['createGeminiJson','geminiAiConfigured','geminiAiModel',"mode:'research'",'research_proposal_quota_v1','quotaError(usage)','Không dùng bản nháp local thay thế'],'Gemini proposal + server quota');
forbid(proposal,['api.openai.com','OPENAI_API_KEY','localFallback'],'proposal must not fall back to OpenAI/local');
need(proposalUi,['Gemini tạo đề cương','Hạn mức theo vai trò · chu kỳ 6 giờ','quota.unlimited','quota.limit','quota.remaining','/api/ai/research-proposal'],'role-aware proposal quota UX');
forbid(proposalUi,['A.I local 0đ','Tinh chỉnh A.I cloud','buildLocalProposalSections'],'proposal UI must have one Gemini generation path');
need(quotaMigration,["v_role='admin'","'unlimited',true","v_role in('mod','super_mod','leader') then 5 else 3","interval '6 hours'",'v_used >= v_limit','Approved member required'],'server-authoritative proposal role quota');

need(assistant,['isInternalSource',"startsWith('drive:')","startsWith('central:')",'internalContextConsent',"sources.some(isInternalSource)&&!internalContextConsent", "req.body?.mode==='study'",'handleStudyAssistant','responseDiversityInstruction','normalizeAiVariation','X-AI-Variation'],'shared AI gateway + private-context + response-diversity gate');
need(diversity,['QUY TẮC ĐA DẠNG PHẢN HỒI TOÀN HỆ THỐNG','Giữ nguyên sự thật, đáp án đúng, số liệu, nguồn','studySuggestionInstruction','[[NEXT_ACTIONS]]','parseStudyResponse'],'canonical non-repeating response contract');
need(geminiProvider,['geminiPrivateContextAllowed=()=>false','process.env.GEMINI_API_KEY','geminiModelCandidates','GEMINI_RESEARCH_FALLBACK_MODEL'],'server-only Gemini provider with bounded research failover');
forbid(assistant,['GEMINI_ALLOW_PRIVATE_CONTEXT'],'private context bypass');
need(studyClient,["fetch('/api/ai/assistant'","task:'quiz'",'variationMode','suggestions:Array.isArray'],'Study client reuses shared gateway and rotates response variation');
forbid(studyClient,['/api/ai/study-quiz'],'duplicate Study quiz endpoint');
need(study,["memberAccess(req,'member')","task==='quiz'",'createGroundedQuiz','retrievePublicMedicalEvidence','createGeminiJson','runOpenAiEvidenceQuiz',"provider:'openai-public-evidence'",'sourceIndexes','QUIZ_MODEL_BUSY','X-AI-Evidence-Count','responseDiversityInstruction','studySuggestionInstruction','parseStudyResponse','suggestions:parsed.suggestions'],'transparent resilient and context-diverse Study inside shared gateway');
need(aiCenter,['suggestions?:string[]','suggestions:reply.suggestions','aria-label="Gợi ý học tiếp theo"','continueWith(action)'],'contextual Study follow-up UX');
forbid(aiCenter,["continueWith('Tóm tắt câu trả lời ngay trước", "continueWith('Giải thích lại đúng nội dung ngay trước"],'retired fixed repeated Study follow-ups');
need(publicEvidence,['api.openalex.org/works','ebi.ac.uk/europepmc','wikipedia.org/w/api.php','publicEvidencePacket','publicEvidenceSources','retrievePublicResearchEvidence','Panax vietnamensis Ngoc Linh ginseng'],'quota-independent public evidence layer and Research query expansion');
if(fs.existsSync('api/ai/study-quiz.js'))fail.push('dedicated Study quiz serverless function must remain removed');

need(quizManager,['Ngân hàng đề thi','syncQuizBank','Thêm thủ công → Cập nhật → dùng ngay','thư mục môn','Tên thư mục môn là nội dung người học nhìn thấy','tên tệp DOCX chỉ là dấu vết quản trị','đáp án tô đỏ'],'canonical one-step subject-folder quiz bank manager');
forbid(quizManager,['sourceFileBase64','tryTrustedQuizUpload','startQuizPipeline','publishQuizDraft','Xử lý nâng cao','Duyệt Drive thủ công','File từ ACC'],'quiz manager must not expose alternate ingestion workflows');
need(trustedIngest,["MANUAL_INTAKE_FOLDER='Thêm thủ công'","MEMBER_SUBJECT='Ngân hàng HIU'",'subjectFolders','nestedGroups','sourceSubject','parseTrustedMarkedDocx','practice_source_sync_state_v1','practice_trusted_quiz_ingest_v1','needsProcessing','rows.filter(isDocx)','PARSER_REVISION'],'direct + one-level subject-folder DOCX intake with parser-revision retry');
forbid(trustedIngest,['parseMcqDocument','explicit-answer-key-v1','trusted-quiz-upload','subjectFromName'],'canonical path requires Word red answer and folder taxonomy');
need(bankMigration,['practice_quiz_config_v1','practice_quiz_page_v1','practice_subject_folders_sync_admin_v1','where active is true',"q.review_status in('source_verified','expert_approved')"],'data-first member bank and safe-update folder sync');
forbid(bankMigration,['sourceFileName'],'member quiz RPC must not expose source filename');

if(vercel?.git?.deploymentEnabled!==false)fail.push('Vercel Git auto-deploy must remain disabled so production is gated by Web CI');
if(fail.length){console.error('AI ROLE CONTRACT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('AI role contract PASS: task assistant, contextual non-repeating AI responses, shared evidence-first Gemini Study quiz, server-bounded Gemini medical Research, role-aware proposal quota and one canonical red-answer bank are isolated and enforced.');