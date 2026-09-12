import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))fail.push(`${label} missing ${token}`)};
const forbid=(body,tokens,label)=>{for(const token of tokens)if(body.includes(token))fail.push(`${label} must not contain ${token}`)};
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const app=read('src/App.tsx');
const research=read('src/components/research/ResearchAiMini.tsx');
const researchCenter=read('src/components/research/ResearchCenter.tsx');
const quiz=read('api/_lib/quiz-workspace.js');
const acc=read('src/components/admin/QuizImportCenter.tsx');
const xz=read('src/services/xiaozhiMiniService.ts');
const xzServer=read('api/_lib/xiaozhi-mini-handler.js');
const assistant=read('api/ai/assistant.js');
const geminiProvider=read('api/_lib/gemini-provider.js');
const aiOps=read('src/components/admin/AiOperationsPanel.tsx');
const systemOps=read('src/components/admin/AdminOpsAssistant.tsx');
const providerRegistry=read('src/modules/ai/providers/registry.ts');
const vercel=JSON.parse(read('vercel.json'));

need(mini,['Trợ lý ứng dụng','herb_garden_wallet_v1',"from('notifications')",'researchIntent','openResearch(text)','askXiaoZhiMini'],'AI Mini application assistant');
forbid(mini,['askAcademicUnified','searchOpenAlex','searchPubMed','searchClinicalTrials','searchDriveRag','searchKnowledge'],'AI Mini research boundary');
for(const basic of ['tạng\\s*tượng','bát\\s*cương','âm\\s*dương','ngũ\\s*hành','huyệt\\s*vị','vị\\s*thuốc'])forbid(mini,[basic],`AI Mini must not route ordinary study topic ${basic}`);
if((app.match(/<UnifiedAiMini\b/g)||[]).length!==1)fail.push('App must render exactly one global A.I Mini launcher');

need(xz,['hiu.vn','fanpage chính thức','appAssistantQuery'],'official HIU source policy');
need(xzServer,['isResearchIntent',"answer:'Học thuật → Trung tâm nghiên cứu'","route:'research'",'Gemini với Google Search','Nội dung nghiên cứu/y văn/lâm sàng chuyên sâu phải chuyển sang Trung tâm nghiên cứu'],'AI Mini server research handoff');

need(research,['RESEARCH_LEADER=GEMINI','searchOpenAlex(text,6)','searchPubMed(text,6)','searchClinicalTrials(text,4)','Dùng tài liệu nội bộ','internalEnabled?searchDriveRag','internalEnabled?searchKnowledge','setUseInternal(false)','{useInternal:internalEnabled}'],'Research A.I canonical workers and request-scoped consent');
need(researchCenter,['searchPubMed(query,12)','searchOpenAlex(query,12)','searchClinicalTrials(query,8)','ragInternalConsent','setRagInternalConsent(false)','Dùng tài liệu nội bộ cho lượt này','{useInternal:true}'],'Research Center public sources and one-shot internal consent');
if((researchCenter.match(/<ResearchAiMini\b/g)||[]).length!==1)fail.push('Research Center must render exactly one Research A.I surface');
forbid(researchCenter,['A.I OpenAlex','OpenAlex A.I','A.I Mini riêng tại Trung tâm nghiên cứu'],'Research UI provider/product sprawl');

need(assistant,['isInternalSource',"startsWith('drive:')","startsWith('central:')",'internalContextConsent',"sources.some(isInternalSource)&&!internalContextConsent",'chủ động bật Dùng tài liệu nội bộ'],'server private-context gate');
forbid(assistant,['GEMINI_ALLOW_PRIVATE_CONTEXT'],'server private-context gate');
need(geminiProvider,['geminiPrivateContextAllowed=()=>false','process.env.GEMINI_API_KEY'],'server-only Gemini provider');

need(quiz,['createGeminiJson','geminiAiConfigured','gemini-quiz-designer-v1','Chỉ được dùng thông tin nằm trong SOURCE',"reviewStatus:'expert_approved'",'adminConfirmed:true','sourceEvidence.includes(evidence.toLowerCase())','!explanation',"driveConfigured:credentialMode!=='none'",'clean(body.subjectName,160)'],'Gemini quiz designer and Drive readiness');
need(acc,['Tài liệu → Ngân hàng trắc nghiệm','conversionMode','Gemini thiết kế trắc nghiệm từ tài liệu','Tải tài liệu trực tiếp tại ACC','Tự chuyển đổi','Cập nhật vào ngân hàng','setChecked(new Set())','Tất cả kết quả chỉ ở trạng thái bản nháp','driveConfigured===false','manualSubject.trim()','subjectName','Drive tạm chưa khả dụng'],'ACC Drive-to-quiz UX with direct-upload fallback');
forbid(acc,['selection:ready','setChecked(new Set(d.questions'],'ACC explicit admin review');

need(aiOps,['fetchAiHealth','cấu hình · provider/model · live probe · privacy gate · contract','Cấu hình không được xem là bằng chứng liveness','Live probe Gemini',"?'CONFIG':'OFF'"],'Admin A.I Operations truthful observability');
forbid(aiOps,['readiness · model/provider · latency · degraded mode · privacy gate · contract','candidateZeroCostProviders','Adapter 0đ có thể tích hợp tiếp','GEMINI_ALLOW_PRIVATE_CONTEXT'],'Admin A.I Operations anti-sprawl and no false readiness');
need(systemOps,['Vận hành hệ thống · Quy tắc xác định'],'deterministic system operations naming');
forbid(systemOps,['A.I Ops · Quản trị giải thích được'],'system operations must not masquerade as another A.I product');
for(const dead of ["id:'gemini-byok'","id:'unpaywall'",'candidateZeroCostProviders'])forbid(providerRegistry,[dead],`provider registry dead adapter ${dead}`);
for(const core of ["id:'gemini-server'","id:'central-rag'","id:'drive-rag'","id:'openalex'","id:'pubmed'","id:'clinicaltrials'"])need(providerRegistry,[core],`provider registry core ${core}`);

if(vercel?.git?.deploymentEnabled!==false)fail.push('Vercel Git auto-deploy must be disabled so production is gated by Web CI');
if(fail.length){console.error('AI ROLE CONTRACT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('AI role contract PASS: one App Assistant, one Research A.I role, module capabilities, request-scoped internal consent, provenance/admin review, truthful configured-vs-live observability and anti-sprawl boundaries are enforced.');
