from pathlib import Path
import re

def load(path):
    return Path(path).read_text(encoding="utf-8")

def save(path, text):
    Path(path).write_text(text, encoding="utf-8")

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing replacement anchor: {label}")
    return text.replace(old, new, 1)

def sub_once(text, pattern, repl, label, flags=0):
    text2, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"expected exactly one regex replacement for {label}, got {n}")
    return text2

# 1) App Assistant research routing: explicit/deep research only.
path = "src/components/ai/UnifiedAiMini.tsx"
s = load(path)
s = replace_once(
    s,
    "// Học thuật → Trung tâm nghiên cứu. A.I Mini chỉ giữ vai trò trợ lý ứng dụng và tra cứu công khai.",
    "// Chỉ nghiên cứu/y văn/lâm sàng chuyên sâu → Trung tâm nghiên cứu. Câu hỏi học tập thông thường vẫn do A.I Mini xử lý.",
    "mini routing comment",
)
mini_classifier = r"""const explicitResearchIntent=/\b(pubmed|openalex|doi|pmid|systematic|meta[- ]?analysis|clinical trials?|rct|cohort|case[- ]?control|guideline|evidence)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|tổng\s*quan\s*hệ\s*thống|phân\s*tích\s*tài\s*liệu|thử\s*nghiệm\s*lâm\s*sàng|bằng\s*chứng|trích\s*dẫn|tài\s*liệu\s*tham\s*khảo|đề\s*cương\s*nghiên\s*cứu/i;
const deepClinicalResearchIntent=/(?:phân\s*tích|đánh\s*giá|so\s*sánh|tổng\s*hợp).{0,80}(?:chẩn\s*đoán|điều\s*trị|dược\s*lý|bệnh\s*học|lâm\s*sàng)|(?:chẩn\s*đoán|điều\s*trị|dược\s*lý|bệnh\s*học|lâm\s*sàng).{0,80}(?:bằng\s*chứng|nghiên\s*cứu|guideline|khuyến\s*cáo|protocol)|phác\s*đồ\s*(?:điều\s*trị|lâm\s*sàng)/i;
const researchIntent=(value:string)=>explicitResearchIntent.test(value)||deepClinicalResearchIntent.test(value);
"""
s = sub_once(s, r"const academicIntent=.*?;\n", mini_classifier, "mini research classifier")
s = s.replace("if(academicIntent(text)){", "if(researchIntent(text)){")
save(path, s)

# 2) Server XiaoZhi uses the same deterministic boundary and exports it for contract tests.
path = "api/_lib/xiaozhi-mini-handler.js"
s = load(path)
server_classifier = r"""const explicitResearchIntent=/\b(pubmed|openalex|doi|pmid|systematic|meta[- ]?analysis|clinical trials?|rct|cohort|case[- ]?control|guideline|evidence)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|tổng\s*quan\s*hệ\s*thống|phân\s*tích\s*tài\s*liệu|thử\s*nghiệm\s*lâm\s*sàng|bằng\s*chứng|trích\s*dẫn|tài\s*liệu\s*tham\s*khảo|đề\s*cương\s*nghiên\s*cứu/i;
const deepClinicalResearchIntent=/(?:phân\s*tích|đánh\s*giá|so\s*sánh|tổng\s*hợp).{0,80}(?:chẩn\s*đoán|điều\s*trị|dược\s*lý|bệnh\s*học|lâm\s*sàng)|(?:chẩn\s*đoán|điều\s*trị|dược\s*lý|bệnh\s*học|lâm\s*sàng).{0,80}(?:bằng\s*chứng|nghiên\s*cứu|guideline|khuyến\s*cáo|protocol)|phác\s*đồ\s*(?:điều\s*trị|lâm\s*sàng)/i;
export const isResearchIntent=value=>{const text=clean(value,1600);return explicitResearchIntent.test(text)||deepClinicalResearchIntent.test(text)};
"""
s = sub_once(s, r"const researchIntent=.*?;\n", server_classifier, "server research classifier")
s = replace_once(s, "if(researchIntent.test(query))", "if(isResearchIntent(query))", "server research routing use")
save(path, s)

# 3) Research A.I: all three canonical public sources + one-request internal consent.
path = "src/components/research/ResearchAiMini.tsx"
s = load(path)
s = replace_once(
    s,
    "import {searchOpenAlex,type ResearchWork} from '../../services/researchService';",
    "import {searchClinicalTrials,searchOpenAlex,searchPubMed,type ResearchWork} from '../../services/researchService';",
    "research canonical source imports",
)
s = replace_once(s, "setInput('');try{", "setInput('');const internalEnabled=useInternal;setUseInternal(false);try{", "consume research internal consent")
s = sub_once(
    s,
    r"   const \[drive,liveOpenAlex,central\]=await Promise\.all\(\[.*?\]\);\n",
    "   const [drive,liveOpenAlex,livePubMed,liveTrials,central]=await Promise.all([internalEnabled?searchDriveRag(text,4,controller.signal):Promise.resolve({sources:[],degraded:false}),searchOpenAlex(text,6).catch(()=>[]),searchPubMed(text,6).catch(()=>[]),searchClinicalTrials(text,4).catch(()=>[]),internalEnabled?searchKnowledge(text,'all',5).catch(()=>[]):Promise.resolve([])]);\n",
    "research workers",
)
s = sub_once(
    s,
    r"   const evidence=dedupe\(\[\.\.\.liveOpenAlex,\.\.\.works\]\).*?;\n",
    "   const evidence=dedupe([...livePubMed,...liveOpenAlex,...liveTrials,...works]).slice(0,14),literature=asSources(evidence),knowledge=centralSources(central),sources=[...knowledge,...drive.sources,...literature].slice(0,6),publicCount=livePubMed.length+liveOpenAlex.length+liveTrials.length,internalCount=drive.sources.length+central.length,workers=[`Nguồn công khai ${publicCount}`,internalEnabled?`Tài liệu nội bộ ${internalCount}`:'Tài liệu nội bộ tắt'];\n",
    "research evidence aggregation",
)
s = replace_once(s, "{useInternal});if(controller.signal.aborted)return;", "{useInternal:internalEnabled});if(controller.signal.aborted)return;", "request-scoped internal consent")
replacements = {
    'aria-label="Gemini Research A.I"':'aria-label="Research A.I"',
    '<b><Bot/> Gemini Research · Leader</b>':'<b><Bot/> Research A.I</b>',
    '<b>Gemini điều phối toàn bộ Trung tâm nghiên cứu</b>':'<b>Research A.I điều phối toàn bộ Trung tâm nghiên cứu</b>',
    '<small>Gemini Leader → OpenAlex · Central RAG · Drive RAG · Translator · công cụ đề tài</small>':'<small>Nguồn học thuật công khai · tài liệu nội bộ chỉ khi bạn bật cho lượt hỏi hiện tại</small>',
    '<div className="research-worker-strip"><span className="active">Gemini Leader</span><span>OpenAlex</span><span>Central RAG</span><span>Drive RAG</span><span>Translator</span></div>':'<div className="research-worker-strip"><span className="active">Research A.I</span><span>Nguồn công khai</span><span>Nội bộ theo lượt</span></div>',
    "Mặc định chỉ dùng nguồn học thuật công khai/OpenAlex":"Mặc định chỉ dùng nguồn học thuật công khai",
    "Gemini giữ mạch hội thoại, điều phối các nguồn và gợi ý bước tiếp theo.":"Research A.I giữ mạch hội thoại, đối chiếu nguồn và gợi ý bước tiếp theo.",
    "Gemini Leader đang tổng hợp các worker…":"Research A.I đang tổng hợp bằng chứng…",
    "Gửi cho Gemini Leader":"Gửi cho Research A.I",
    "Gemini Leader · ${workers.join(' · ')}":"Research A.I · ${workers.join(' · ')}",
    "setNote(`Gemini Leader · ${workers.join(' · ')} · ${Math.round(result.latencyMs)} ms`);":"setNote(`Research A.I · ${workers.join(' · ')} · ${Math.round(result.latencyMs)} ms`);",
    "setNote('Gemini Leader → Translator worker');":"setNote('Research A.I đang dịch học thuật');",
    "setNote(`Gemini Leader đã nhận kết quả từ Translator · ${result.provider}`)":"setNote(`Research A.I · ${result.provider}`)",
    "Gemini Leader giao Translator worker xử lý bản dịch học thuật":"Research A.I xử lý bản dịch học thuật",
    "Gemini Leader dùng đề xuất này như worker gợi ý ban đầu; tính mới vẫn phải kiểm chứng bằng y văn.":"Research A.I dùng gợi ý ban đầu; tính mới vẫn phải kiểm chứng bằng y văn.",
    "Translator local: {capabilities.translator?'sẵn sàng':'fallback API miễn phí'} · Cloud + Drive RAG + Central RAG + OpenAlex":"Dịch học thuật: {capabilities.translator?'local sẵn sàng':'fallback'} · nguồn nội bộ chỉ theo opt-in từng lượt",
}
for old,new in replacements.items():
    if old not in s:
        raise SystemExit(f"missing ResearchAiMini UI anchor: {old}")
    s=s.replace(old,new,1)
save(path,s)

# 4) Research Center: generic Research A.I UX; internal synthesis requires one-shot explicit consent.
path = "src/components/research/ResearchCenter.tsx"
s = load(path)
s = replace_once(
    s,
    "import {askServerAi,renderAiAnswer,type AiRuntimeAnswer} from '../../services/aiRuntimeService';",
    "import {askServerAi,renderAiAnswer,type AiRuntimeAnswer} from '../../modules/ai';",
    "research center shared gateway facade",
)
anchor = "  const [openAlexSummary,setOpenAlexSummary]=useState(''),[openAlexBusy,setOpenAlexBusy]=useState(false),[quota,setQuota]=useState(()=>readGuestSearchQuota()),[now,setNow]=useState(Date.now());"
s = replace_once(s, anchor, anchor+"\n  const [ragInternalConsent,setRagInternalConsent]=useState(false);", "RAG request consent state")
s = sub_once(
    s,
    r"  const synthesize=async\(\)=>\{.*?\};\n",
    "  const synthesize=async()=>{const query=ragQ.trim();if(!member){login();return}if(!query||!ragResults.length)return;if(!ragInternalConsent){setErr('Bật “Dùng tài liệu nội bộ cho lượt này” trước khi gửi tài liệu vào Research A.I.');return}setRagInternalConsent(false);setAiBusy(true);setErr('');setAiAnswer(null);try{const sources=ragResults.slice(0,6).map(r=>({id:`drive:${r.document.id}`,title:r.document.name,text:(r.document.text||r.snippet).slice(0,4200),url:r.document.url||null}));setAiAnswer(await askServerAi(query,'research',sources,undefined,{useInternal:true}))}catch(e){setErr((e as Error).message)}finally{setAiBusy(false)}};\n",
    "RAG synthesis consent gate",
)
s = replace_once(
    s,
    '<div className="schedule-actions"><button onClick={summarize}',
    '<label className="research-internal-toggle"><Database/><span><b>Dùng tài liệu nội bộ cho lượt này</b><small>Tắt mặc định; quyền được dùng một lần cho yêu cầu Research A.I hiện tại.</small></span><input type="checkbox" checked={ragInternalConsent} disabled={aiBusy} onChange={e=>setRagInternalConsent(e.target.checked)}/><i aria-hidden="true"/></label><div className="schedule-actions"><button onClick={summarize}',
    "RAG consent control",
)
s = replace_once(s, "disabled={aiBusy||!ragQ.trim()||!ragResults.length}", "disabled={aiBusy||!ragQ.trim()||!ragResults.length||!ragInternalConsent}", "disable internal AI without consent")
ui_replacements = {
    "<h3><Bot/> Trợ lý A.I học thuật</h3>":"<h3><Bot/> Research A.I</h3>",
    "Thành viên có A.I Mini riêng tại Trung tâm nghiên cứu: hỏi y văn có nguồn, tra OpenAlex trực tiếp, dịch local 0đ, gợi ý đề tài và tạo Word Mẫu 01-SV.":"Research A.I là trợ lý duy nhất cho y văn và học thuật chuyên sâu tại Trung tâm nghiên cứu; mọi nguồn đều giữ provenance.",
    "Research A.I Mini nằm ở góc dưới màn hình.":"Research A.I nằm ở góc dưới màn hình.",
    "A.I OpenAlex tổng hợp":"Research A.I tổng hợp nguồn vừa tìm",
    "<b>OpenAlex A.I</b>":"<b>Tổng hợp bằng Research A.I</b>",
    "A.I tổng hợp có nguồn":"Phân tích bằng Research A.I",
    "<b>A.I tổng hợp · {aiAnswer.provider}{aiAnswer.degraded?' · fallback local':''}</b>":"<b>Research A.I · {aiAnswer.degraded?'fallback có nguồn':'đã kiểm chứng nguồn'}</b>",
}
for old,new in ui_replacements.items():
    if old not in s:
        raise SystemExit(f"missing ResearchCenter UI anchor: {old}")
    s=s.replace(old,new,1)
save(path,s)

# 5) Admin AI Operations: observe readiness/privacy, never advertise future-provider sprawl or obsolete bypass flags.
path = "src/components/admin/AiOperationsPanel.tsx"
s = load(path)
s = replace_once(
    s,
    "import {activeAiProviders,candidateZeroCostProviders,checkGeminiProvider,fetchAiHealth,type AiHealth,type GeminiProviderCheck} from '../../modules/ai';",
    "import {activeAiProviders,checkGeminiProvider,fetchAiHealth,type AiHealth,type GeminiProviderCheck} from '../../modules/ai';",
    "remove candidate provider import",
)
s = replace_once(s, "  const active=useMemo(()=>activeAiProviders(),[]),candidates=useMemo(()=>candidateZeroCostProviders(),[]);", "  const active=useMemo(()=>activeAiProviders(),[]);", "remove candidate provider state")
s = replace_once(s, "ACC quản trị tập trung: Gateway · Provider Router · RAG · Copilot · readiness.", "ACC theo dõi tập trung: readiness · model/provider · latency · degraded mode · privacy gate · contract.", "AI ops canonical scope")
s = sub_once(s, r'\n    <details><summary><Search/> Adapter 0đ có thể tích hợp tiếp</summary>.*?</details>', "", "remove provider-sprawl UI")
s = sub_once(s, r'<article><div><b>GEMINI_ALLOW_PRIVATE_CONTEXT</b>.*?</article>', "", "remove obsolete privacy bypass env")
save(path,s)

# 6) Deterministic system operations is not a second A.I product.
path = "src/components/admin/AdminOpsAssistant.tsx"
s = load(path)
s = replace_once(s, "A.I Ops · Quản trị giải thích được", "Vận hành hệ thống · Quy tắc xác định", "rename non-AI system ops")
save(path,s)

# 7) Provider registry: keep implemented providers, remove dead BYOK/unpaywall/candidate expansion hooks.
path = "src/modules/ai/providers/registry.ts"
s = load(path)
s = s.replace("|'byok-llm'","")
s = s.replace("|'candidate'","")
s = sub_once(s, r"\n  \{id:'gemini-byok'.*?\},", "", "remove dead Gemini BYOK registry")
s = sub_once(s, r"\n  \{id:'unpaywall'.*?\}", "", "remove dead Unpaywall registry")
s = sub_once(s, r"\nexport const candidateZeroCostProviders=.*?\n", "\n", "remove candidate expansion API")
save(path,s)

# 8) Canonical role contract.
path = "scripts/ai-role-contract-check.mjs"
role_contract = """import fs from 'node:fs';
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
for(const basic of ['tạng\\\\s*tượng','bát\\\\s*cương','âm\\\\s*dương','ngũ\\\\s*hành','huyệt\\\\s*vị','vị\\\\s*thuốc'])forbid(mini,[basic],`AI Mini must not route ordinary study topic ${basic}`);
if((app.match(/<UnifiedAiMini\\b/g)||[]).length!==1)fail.push('App must render exactly one global A.I Mini launcher');

need(xz,['hiu.vn','fanpage chính thức','appAssistantQuery'],'official HIU source policy');
need(xzServer,['isResearchIntent',"answer:'Học thuật → Trung tâm nghiên cứu'","route:'research'",'Gemini với Google Search','Nội dung nghiên cứu/y văn/lâm sàng chuyên sâu phải chuyển sang Trung tâm nghiên cứu'],'AI Mini server research handoff');

need(research,['RESEARCH_LEADER=GEMINI','searchOpenAlex(text,6)','searchPubMed(text,6)','searchClinicalTrials(text,4)','Dùng tài liệu nội bộ','internalEnabled?searchDriveRag','internalEnabled?searchKnowledge','setUseInternal(false)','{useInternal:internalEnabled}'],'Research A.I canonical workers and request-scoped consent');
need(researchCenter,['searchPubMed(query,12)','searchOpenAlex(query,12)','searchClinicalTrials(query,8)','ragInternalConsent','setRagInternalConsent(false)','Dùng tài liệu nội bộ cho lượt này','{useInternal:true}'],'Research Center public sources and one-shot internal consent');
if((researchCenter.match(/<ResearchAiMini\\b/g)||[]).length!==1)fail.push('Research Center must render exactly one Research A.I surface');
forbid(researchCenter,['A.I OpenAlex','OpenAlex A.I','A.I Mini riêng tại Trung tâm nghiên cứu'],'Research UI provider/product sprawl');

need(assistant,['isInternalSource',"startsWith('drive:')","startsWith('central:')",'internalContextConsent',"sources.some(isInternalSource)&&!internalContextConsent",'chủ động bật Dùng tài liệu nội bộ'],'server private-context gate');
forbid(assistant,['GEMINI_ALLOW_PRIVATE_CONTEXT'],'server private-context gate');
need(geminiProvider,['geminiPrivateContextAllowed=()=>false','process.env.GEMINI_API_KEY'],'server-only Gemini provider');

need(quiz,['createGeminiJson','geminiAiConfigured','gemini-quiz-designer-v1','Chỉ được dùng thông tin nằm trong SOURCE',"reviewStatus:'expert_approved'",'adminConfirmed:true','sourceEvidence.includes(evidence.toLowerCase())','!explanation'],'Gemini quiz designer');
need(acc,['Tài liệu → Ngân hàng trắc nghiệm','conversionMode','Gemini thiết kế trắc nghiệm từ tài liệu','Tải tài liệu trực tiếp tại ACC','Đồng bộ & chuyển đổi','setChecked(new Set())','Tất cả kết quả chỉ ở trạng thái bản nháp'],'ACC Drive-to-quiz UX');
forbid(acc,['selection:ready','setChecked(new Set(d.questions'],'ACC explicit admin review');

need(aiOps,['fetchAiHealth','readiness · model/provider · latency · degraded mode · privacy gate · contract'],'Admin A.I Operations observability');
forbid(aiOps,['candidateZeroCostProviders','Adapter 0đ có thể tích hợp tiếp','GEMINI_ALLOW_PRIVATE_CONTEXT'],'Admin A.I Operations anti-sprawl');
need(systemOps,['Vận hành hệ thống · Quy tắc xác định'],'deterministic system operations naming');
forbid(systemOps,['A.I Ops · Quản trị giải thích được'],'system operations must not masquerade as another A.I product');
for(const dead of ["id:'gemini-byok'","id:'unpaywall'",'candidateZeroCostProviders'])forbid(providerRegistry,[dead],`provider registry dead adapter ${dead}`);
for(const core of ["id:'gemini-server'","id:'central-rag'","id:'drive-rag'","id:'openalex'","id:'pubmed'","id:'clinicaltrials'"])need(providerRegistry,[core],`provider registry core ${core}`);

if(vercel?.git?.deploymentEnabled!==false)fail.push('Vercel Git auto-deploy must be disabled so production is gated by Web CI');
if(fail.length){console.error('AI ROLE CONTRACT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('AI role contract PASS: one App Assistant, one Research A.I role, module capabilities, request-scoped internal consent, provenance/admin review and anti-sprawl boundaries are enforced.');
"""
save(path, role_contract)

# 9) Runtime audit aligns with canonical role lock and tests router behavior, not provider expansion.
path = "scripts/ai-runtime-check.mjs"
s = load(path)
s = s.replace("const gemini=read('src/services/geminiByok.ts');\n","")
s = s.replace("requireText(xiaozhiHandler,'researchIntent','XiaoZhi detects deep research intent for explicit handoff');","requireText(xiaozhiHandler,'isResearchIntent','XiaoZhi detects deep research intent for explicit handoff');")
s = s.replace("requireText(mini,'academicIntent','global A.I Mini detects research intent for explicit handoff');","requireText(mini,'researchIntent','global A.I Mini detects research intent for explicit handoff');")
s = replace_once(
    s,
    "requireText(xiaozhiHandler,\"route:'research'\",'XiaoZhi server returns an explicit Research route without doing research retrieval');",
    """requireText(xiaozhiHandler,"route:'research'",'XiaoZhi server returns an explicit Research route without doing research retrieval');
const {isResearchIntent}=await import('../api/_lib/xiaozhi-mini-handler.js');
for(const query of ['Tạng tượng là gì?','Giải thích âm dương ngũ hành đơn giản','Vitamin C tan trong nước hay dầu?'])isResearchIntent(query)?fail(`ordinary education query incorrectly routed to Research: ${query}`):ok(`ordinary education stays in App Assistant: ${query}`);
for(const query of ['Tìm y văn PubMed về châm cứu mất ngủ','Phân tích meta-analysis về acupuncture insomnia','So sánh bằng chứng lâm sàng và guideline điều trị tăng huyết áp'])isResearchIntent(query)?ok(`research query routes to Research: ${query}`):fail(`research query missed Research handoff: ${query}`);""",
    "runtime intent examples",
)
s = s.replace("requireText(researchMini,'searchDriveRag','Research A.I Mini retains Drive RAG worker');","requireText(researchMini,'searchDriveRag','Research A.I retains Drive RAG worker');")
s = replace_once(
    s,
    "requireText(researchMini,'searchOpenAlex','Research A.I Mini retains OpenAlex worker');",
    """requireText(researchMini,'searchOpenAlex','Research A.I retains OpenAlex worker');
requireText(researchMini,'searchPubMed','Research A.I retains PubMed worker');
requireText(researchMini,'searchClinicalTrials','Research A.I retains ClinicalTrials worker');""",
    "canonical research sources runtime test",
)
s = s.replace("requireText(researchMini,\"useInternal?searchDriveRag\",'Research A.I skips Drive retrieval until the user opts in');","requireText(researchMini,\"internalEnabled?searchDriveRag\",'Research A.I skips Drive retrieval until the user opts in');")
s = s.replace("requireText(researchMini,\"useInternal?searchKnowledge\",'Research A.I skips Central RAG until the user opts in');","requireText(researchMini,\"internalEnabled?searchKnowledge\",'Research A.I skips Central RAG until the user opts in');")
s = replace_once(
    s,
    "requireText(researchMini,'Dùng tài liệu nội bộ','Research A.I exposes the internal-document opt-in; global Mini does not');",
    """requireText(researchMini,'Dùng tài liệu nội bộ','Research A.I exposes the internal-document opt-in; global Mini does not');
requireText(researchMini,'setUseInternal(false)','Research A.I consumes internal-document consent after each request');
requireText(researchMini,'{useInternal:internalEnabled}','Research A.I sends request-scoped consent to the shared gateway');
requireText(research,'ragInternalConsent','Research Center RAG synthesis has an explicit request consent gate');
requireText(research,'setRagInternalConsent(false)','Research Center consumes RAG consent after each synthesis');""",
    "request-scoped research consent runtime tests",
)
old_registry = """for(const candidate of ['semantic-scholar','europe-pmc','crossref','opencitations','unpaywall'])requireText(providerRegistry,`id:'${candidate}'`,`AI provider registry includes ${candidate}`);
requireText(aiOps,'fetchAiHealth','Admin A.I Operations reads non-secret readiness');
requireText(aiOps,'candidateZeroCostProviders','Admin A.I Operations exposes zero-cost candidate adapters');
"""
new_registry = """for(const core of ['gemini-server','central-rag','drive-rag','openalex','pubmed','clinicaltrials'])requireText(providerRegistry,`id:'${core}'`,`AI provider registry contains implemented core ${core}`);
for(const dead of ['gemini-byok','unpaywall','candidateZeroCostProviders'])forbidText(providerRegistry,dead,`AI provider registry excludes dead/expansion adapter ${dead}`);
requireText(aiOps,'fetchAiHealth','Admin A.I Operations reads non-secret readiness');
forbidText(aiOps,'candidateZeroCostProviders','Admin A.I Operations does not advertise provider expansion');
forbidText(aiOps,'Adapter 0đ có thể tích hợp tiếp','Admin A.I Operations has no provider-sprawl catalog');
forbidText(aiOps,'GEMINI_ALLOW_PRIVATE_CONTEXT','Admin A.I Operations has no obsolete privacy bypass');
"""
s = replace_once(s, old_registry, new_registry, "runtime provider registry policy")
old_gemini = """for(const forbidden of ['localStorage','sessionStorage','x-goog-api-key','generativelanguage.googleapis.com'])forbidText(gemini,forbidden,`browser Gemini compatibility layer excludes ${forbidden}`);
requireText(gemini,"import {askServerAi} from './aiRuntimeService'",'browser Gemini compatibility layer routes through server gateway');
requireText(gemini,'Vercel Environment Variables','browser Gemini compatibility layer documents server-side secret ownership');
"""
s = replace_once(s, old_gemini, "", "remove legacy Gemini BYOK compatibility audit")
save(path,s)

# 10) Delete dead browser AI surfaces only when there are no runtime imports.
def src_refs(token, exclude):
    refs=[]
    for ext in ('*.ts','*.tsx','*.js','*.jsx'):
        for p in Path('src').rglob(ext):
            if str(p)==exclude:
                continue
            try:
                if token in p.read_text(encoding='utf-8'):
                    refs.append(str(p))
            except UnicodeDecodeError:
                pass
    return refs

for dead_path,token in [
    ('src/components/ai/PersonalCopilotWidget.tsx','PersonalCopilotWidget'),
    ('src/services/geminiByok.ts','geminiByok'),
]:
    p=Path(dead_path)
    if p.exists():
        refs=src_refs(token,dead_path)
        if refs:
            raise SystemExit(f"refusing to delete {dead_path}; runtime refs: {refs}")
        p.unlink()

print("canonical AI architecture patch applied")
