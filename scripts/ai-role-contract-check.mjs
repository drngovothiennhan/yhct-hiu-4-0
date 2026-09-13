import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))fail.push(`${label} missing ${token}`)};
const forbid=(body,tokens,label)=>{for(const token of tokens)if(body.includes(token))fail.push(`${label} must not contain ${token}`)};
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const app=read('src/App.tsx');
const research=read('src/components/research/ResearchAiMini.tsx');
const researchCenter=read('src/components/research/ResearchCenter.tsx');
const proposal=read('api/ai/research-proposal.js');
const proposalUi=read('src/components/research/ResearchProposalBuilder.tsx');
const quizManager=read('src/components/admin/LearningContentManagerPanel.tsx');
const trustedIngest=read('api/_lib/trusted-quiz-ingest.js');
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

need(research,['RESEARCH_ROLE=GEMINI_MEDICAL_RESEARCH_LEAD','searchPubMed(text,8)','searchOpenAlex(text,8)','searchClinicalTrials(text,5)','searchDriveRag','searchKnowledge','Dùng tài liệu nội bộ cho lượt này','Bằng chứng','PICO','Khoảng trống','Phương pháp','Không tạo câu trả lời local thay thế'],'Gemini medical research workbench');
forbid(research,['buildAcademicFallback','A.I local 0đ','Fallback học thuật cục bộ'],'Research must not synthesize fake local AI answers');
need(researchCenter,['<ResearchAiMini','searchPubMed(query,12)','searchOpenAlex(query,12)','searchClinicalTrials(query,8)','Khách: không dùng Gemini','Trích xuất ý chính (không A.I)'],'Research Center evidence/AI separation');
if((researchCenter.match(/<ResearchAiMini\b/g)||[]).length!==1)fail.push('Research Center must render exactly one Research A.I surface');
forbid(researchCenter,['A.I OpenAlex','OpenAlex A.I','tổng hợp local 0đ'],'Research UI duplicate/fake AI');

need(proposal,['createGeminiJson','geminiAiConfigured','geminiAiModel',"mode:'research'",'research_proposal_quota_v1','3 lượt tạo đề cương Gemini','Không dùng bản nháp local thay thế'],'Gemini proposal + server quota');
forbid(proposal,['api.openai.com','OPENAI_API_KEY','localFallback'],'proposal must not fall back to OpenAI/local');
need(proposalUi,['Gemini tạo đề cương','3','6 giờ','quota.remaining','/api/ai/research-proposal'],'proposal quota UX');
forbid(proposalUi,['A.I local 0đ','Tinh chỉnh A.I cloud','buildLocalProposalSections'],'proposal UI must have one Gemini generation path');

need(assistant,['isInternalSource',"startsWith('drive:')","startsWith('central:')",'internalContextConsent',"sources.some(isInternalSource)&&!internalContextConsent"],'server private-context gate');
need(geminiProvider,['geminiPrivateContextAllowed=()=>false','process.env.GEMINI_API_KEY'],'server-only Gemini provider');
forbid(assistant,['GEMINI_ALLOW_PRIVATE_CONTEXT'],'private context bypass');

need(quizManager,['Ngân hàng đề thi','syncQuizBank','Thêm thủ công','Cập nhật','đáp án tô đỏ','Tên tệp không dùng để đặt môn'],'canonical one-step quiz bank manager');
forbid(quizManager,['sourceFileBase64','tryTrustedQuizUpload','startQuizPipeline','publishQuizDraft','Xử lý nâng cao','Duyệt Drive thủ công','File từ ACC'],'quiz manager must not expose alternate ingestion workflows');
need(trustedIngest,["MANUAL_INTAKE_FOLDER='Thêm thủ công'","MEMBER_SUBJECT='Ngân hàng HIU'",'parseTrustedMarkedDocx','practice_source_sync_state_v1','practice_trusted_quiz_ingest_v1','!knownIds.has','rows.filter(isDocx)'],'new direct DOCX intake contract');
forbid(trustedIngest,['parseMcqDocument','explicit-answer-key-v1','trusted-quiz-upload','subjectFromName'],'fast path must require Word red answer and ignore filenames');

if(vercel?.git?.deploymentEnabled!==false)fail.push('Vercel Git auto-deploy must remain disabled so production is gated by Web CI');
if(fail.length){console.error('AI ROLE CONTRACT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('AI role contract PASS: task assistant, Gemini Study, Gemini medical Research workbench, quota-governed proposal generation and one canonical red-answer quiz-bank Update are isolated and enforced.');
