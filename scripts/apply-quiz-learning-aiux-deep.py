from pathlib import Path
import json

ROOT=Path('.')
def read(p): return (ROOT/p).read_text()
def write(p,s): (ROOT/p).write_text(s)
def rep(path,old,new,label):
    s=read(path)
    if old not in s: raise SystemExit(f'anchor missing: {label} in {path}')
    if s.count(old)!=1: raise SystemExit(f'anchor not unique: {label} in {path}: {s.count(old)}')
    write(path,s.replace(old,new,1))

# 1) ACC automatic answer repair from SOURCE, then full Gemini design only if no usable/repaired MCQ.
repair_js=r'''
const REPAIR_SCHEMA={type:'object',properties:{questions:{type:'array',maxItems:12,items:{type:'object',properties:{id:{type:'string'},correctIndex:{type:'integer',minimum:0,maximum:3},explanation:{type:'string'},evidenceText:{type:'string'}},required:['id','correctIndex','explanation','evidenceText'],additionalProperties:false}}},required:['questions'],additionalProperties:false};
async function repairQuizWithGemini(parsed,text,file){
 const candidates=(Array.isArray(parsed?.questions)?parsed.questions:[]).filter(q=>q?.correctIndex===null&&Array.isArray(q?.options)&&q.options.length===4&&q.options.every(Boolean)&&new Set(q.options.map(x=>String(x).toLowerCase())).size===4&&Array.isArray(q?.issues)&&q.issues.length===1&&q.issues[0]==='Chưa xác định đáp án').slice(0,12);
 if(!candidates.length||!geminiAiConfigured('research'))return parsed;
 const source=String(text||'').slice(0,18000),sourceEvidence=clean(source,18000).toLowerCase();if(source.trim().length<120)return parsed;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),22000);
 try{
  const output=await createGeminiJson({mode:'research',signal:controller.signal,maxOutputTokens:3200,schema:REPAIR_SCHEMA,systemInstruction:'Bạn là Gemini Quiz Designer. Chỉ dùng SOURCE. Với mỗi CANDIDATE, chỉ trả lời khi SOURCE có bằng chứng trực tiếp đủ xác định đúng duy nhất một đáp án A-D. Không đổi câu hỏi hoặc lựa chọn. evidenceText phải là đoạn nguyên văn có trong SOURCE. Nếu không đủ căn cứ thì bỏ candidate đó. Đây chỉ là bản nháp, admin vẫn phải đối chiếu.',prompt:`FILE=${clean(file.name,240)}\nCANDIDATES=${JSON.stringify(candidates.map(q=>({id:q.id,stem:q.stem,options:q.options})))}\nSOURCE:\n${source}`});
  const parsedRepair=JSON.parse(output.text),rows=Array.isArray(parsedRepair?.questions)?parsedRepair.questions:[],model=output.model||geminiAiModel('research'),byId=new Map();
  for(const row of rows){const id=clean(row?.id,80),correctIndex=Number(row?.correctIndex),explanation=clean(row?.explanation,4000),evidence=clean(row?.evidenceText,1200);if(!id||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3||!explanation||!evidence||!sourceEvidence.includes(evidence.toLowerCase()))continue;if(candidates.some(q=>q.id===id))byId.set(id,{correctIndex,explanation,evidence});}
  if(!byId.size)return parsed;
  const questions=parsed.questions.map(q=>{const fixed=byId.get(q.id);if(!fixed)return q;return{...q,correctIndex:fixed.correctIndex,explanation:fixed.explanation,answerEvidence:`Dẫn chứng từ tài liệu: ${fixed.evidence}`,raw:fixed.evidence,issues:['Câu có đáp án do Gemini suy ra từ SOURCE: admin phải đối chiếu dẫn chứng trước khi nhập.'],aiGenerated:true,generationProvider:'gemini',generationModel:model,topic:'Từ tài liệu gốc',subject:clean(file.parentName||file.name,160)||'Chưa phân loại'};});
  return{...parsed,questions,total:questions.length,ready:questions.filter(q=>!q.issues.length).length,needsReview:questions.filter(q=>q.issues.length).length,warnings:[...(parsed.warnings||[]),`Gemini ${model} đã bổ sung đáp án có dẫn chứng cho ${byId.size} câu chưa có đáp án. Admin vẫn phải đối chiếu trước khi cập nhật ngân hàng.`],parser:'gemini-answer-repair-v1',aiDesigner:{provider:'gemini',model}};
 }catch{return{...parsed,warnings:[...(parsed.warnings||[]),'Gemini chưa sửa được câu thiếu đáp án; giữ nguyên bản nháp để admin kiểm tra.']}}finally{clearTimeout(timer)}
}
'''.strip()
rep('api/_lib/quiz-workspace.js','\nfunction normalizeGeneratedQuestion(q,file){','\n'+repair_js+'\n\nfunction normalizeGeneratedQuestion(q,file){','insert Gemini answer repair')
rep('api/_lib/quiz-workspace.js',"const stem=clean(q?.stem,4000),options=Array.isArray(q?.options)?q.options.map(x=>clean(x,1500)):[],correctIndex=Number(q?.correctIndex),evidence=clean(q?.answerEvidence||q?.raw,1400);","const stem=clean(q?.stem,4000),options=Array.isArray(q?.options)?q.options.map(x=>clean(x,1500)):[],correctIndex=Number(q?.correctIndex),evidence=clean(q?.raw||q?.answerEvidence,1400);",'prefer literal evidence')
rep('api/_lib/quiz-workspace.js',"let parsed=parseMcqDocument(source.text);if(parsed.questions.length>1000)throw new Error('Tài liệu có hơn 1.000 câu; hãy chia nhỏ.');\n   if(conversionMode==='generate'||(conversionMode==='auto'&&!parsed.questions.length))parsed=await designQuizWithGemini(source.text,source.file);","let parsed=parseMcqDocument(source.text);if(parsed.questions.length>1000)throw new Error('Tài liệu có hơn 1.000 câu; hãy chia nhỏ.');\n   if(conversionMode==='generate')parsed=await designQuizWithGemini(source.text,source.file);\n   else if(conversionMode==='auto'){parsed=await repairQuizWithGemini(parsed,source.text,source.file);if(parsed.ready===0&&!parsed.questions.some(q=>q.aiGenerated))parsed=await designQuizWithGemini(source.text,source.file);}",'auto repair/fallback')

# 2) ACC explicit button flow.
rep('src/components/admin/QuizImportCenter.tsx',"[driveConfigured,setDriveConfigured]=useState<boolean|null>(null),[manualSubject,setManualSubject]=useState('');","[driveConfigured,setDriveConfigured]=useState<boolean|null>(null),[manualSubject,setManualSubject]=useState(''),[pendingUpload,setPendingUpload]=useState<File|null>(null);",'pending upload state')
rep('src/components/admin/QuizImportCenter.tsx','<div className="qi-flow" aria-label="Quy trình chuyển đổi"><span><b>1</b><FolderOpen/>Chọn Drive / chủ đề</span><span><b>2</b><Bot/>Chọn cách chuyển đổi</span><span><b>3</b><CheckCircle2/>Xem trước & duyệt</span></div>','<div className="qi-flow" aria-label="Quy trình chuyển đổi"><span><b>1</b><FolderOpen/>Chọn nguồn</span><span><b>2</b><Bot/>Tự chuyển đổi</span><span><b>3</b><CheckCircle2/>Xem & đối chiếu</span><span><b>4</b><CheckCircle2/>Cập nhật ngân hàng</span></div>','ACC four-step flow')
rep('src/components/admin/QuizImportCenter.tsx','>Đồng bộ & chuyển đổi {Object.keys(selected).length} mục đã chọn</button>','>Tự chuyển đổi {Object.keys(selected).length} mục đã chọn</button>','Drive convert CTA')
old_upload='''<input type="file" accept=".docx" disabled={busy||!(category||manualSubject.trim())} onChange={e=>{const file=e.target.files?.[0];e.currentTarget.value='';if(file)void run(()=>upload(file))}}/></label><small>Tệp tải lên chỉ được đọc để tạo bản nháp; không ghi đè tài liệu Drive.</small>'''
new_upload='''<input key={pendingUpload?.name||'empty'} type="file" accept=".docx" disabled={busy||!(category||manualSubject.trim())} onChange={e=>setPendingUpload(e.target.files?.[0]||null)}/></label><div className="qi-actions"><button className="qi-primary-convert" disabled={busy||!pendingUpload||!(category||manualSubject.trim())} onClick={()=>void run(async()=>{const file=pendingUpload;if(!file)return;await upload(file);setPendingUpload(null)})}><Sparkles/>Tự chuyển đổi</button>{pendingUpload&&<small>Đã chọn: {pendingUpload.name}</small>}</div><small>Tệp tải lên chỉ được đọc để tạo bản nháp; không ghi đè tài liệu Drive.</small>'''
rep('src/components/admin/QuizImportCenter.tsx',old_upload,new_upload,'manual upload convert button')
rep('src/components/admin/QuizImportCenter.tsx','>Nhập {checked.size} câu đã đối chiếu</button>','>Cập nhật vào ngân hàng ({checked.size} câu)</button>','publish CTA')
rep('src/components/admin/QuizImportCenter.tsx','setMessage(`Đã nhập ${selection.length} câu được admin chủ động xác nhận sau đối chiếu.`)','setMessage(`Đã cập nhật ${selection.length} câu đã được admin đối chiếu vào ngân hàng dùng chung.`)','publish confirmation')

# 3) Integrate continuous approved-bank practice in Exam Center.
rep('src/components/exam/ExamCenter.tsx',"import DailyDrivePractice from './DailyDrivePractice';","import DailyDrivePractice from './DailyDrivePractice';\nimport PracticeBankQuiz from './PracticeBankQuiz';",'PracticeBankQuiz import')
rep('src/components/exam/ExamCenter.tsx','return <><DailyDrivePractice/><AdaptiveReview','return <><DailyDrivePractice/><PracticeBankQuiz/><AdaptiveReview','result integration')
rep('src/components/exam/ExamCenter.tsx',"return <><DailyDrivePractice/>{mode==='practice'&&<AdaptiveReview", "return <><DailyDrivePractice/><PracticeBankQuiz/>{mode==='practice'&&<AdaptiveReview",'active integration')

# 4) Compact/collapsible A.I Mini + presentation-only selectable mascot.
rep('src/components/ai/UnifiedAiMini.tsx',"import '../../app-assistant-ai.css';","import '../../app-assistant-ai.css';\nimport AssistantMascot,{type AssistantAvatarStyle} from './AssistantMascot';",'mascot import')
rep('src/components/ai/UnifiedAiMini.tsx',"const VOICE_KEY='yhct-xiaozhi-voice-v1',POS_KEY='yhct-xiaozhi-pos-v1',ORBIT_KEY='yhct-xiaozhi-orbit-v1',RESEARCH_PENDING_KEY='yhct-research-pending-query-v1';","const VOICE_KEY='yhct-xiaozhi-voice-v1',POS_KEY='yhct-xiaozhi-pos-v1',ORBIT_KEY='yhct-xiaozhi-orbit-v1',RESEARCH_PENDING_KEY='yhct-research-pending-query-v1',GUIDE_KEY='yhct-ai-guide-v1',AVATAR_KEY='yhct-ai-avatar-v1';",'AI Mini preference keys')
rep('src/components/ai/UnifiedAiMini.tsx',"const readOrbit=()=>{try{return localStorage.getItem(ORBIT_KEY)==='1'}catch{return true}};","const readOrbit=()=>{try{return localStorage.getItem(ORBIT_KEY)==='1'}catch{return true}};\nconst readGuide=()=>{try{return localStorage.getItem(GUIDE_KEY)!=='0'}catch{return true}};\nconst readAvatar=():AssistantAvatarStyle=>{try{const value=localStorage.getItem(AVATAR_KEY)||'default';return value==='eagle'||value==='viet'||value==='minimal'?value:'default'}catch{return'default'}};",'read AI Mini preferences')
rep('src/components/ai/UnifiedAiMini.tsx',"[moduleContext,setModuleContext]=useState(''),[handsFree,setHandsFree]=useState(false);","[moduleContext,setModuleContext]=useState(''),[handsFree,setHandsFree]=useState(false),[guideOpen,setGuideOpen]=useState(readGuide),[avatarStyle,setAvatarStyle]=useState<AssistantAvatarStyle>(readAvatar);",'AI Mini preference state')
rep('src/components/ai/UnifiedAiMini.tsx',"const persistOrbit=(next:boolean)=>{setOrbitOn(next);try{localStorage.setItem(ORBIT_KEY,next?'1':'0')}catch{}if(!next)persistPos(position)};","const persistOrbit=(next:boolean)=>{setOrbitOn(next);try{localStorage.setItem(ORBIT_KEY,next?'1':'0')}catch{}if(!next)persistPos(position)};\n const persistGuide=(next:boolean)=>{setGuideOpen(next);try{localStorage.setItem(GUIDE_KEY,next?'1':'0')}catch{}};\n const persistAvatar=(next:AssistantAvatarStyle)=>{setAvatarStyle(next);try{localStorage.setItem(AVATAR_KEY,next)}catch{}};",'persist AI Mini preferences')
rep('src/components/ai/UnifiedAiMini.tsx','<span className="xz-avatar"><Bot/></span>','<span className="xz-avatar"><AssistantMascot variant={avatarStyle}/></span>','header mascot')
rep('src/components/ai/UnifiedAiMini.tsx','<small>Gemini tra cứu · XiaoZhi thực thi tác vụ hệ thống</small>','<small>Hỏi nhanh · tìm tin · mở tính năng</small>','compact header')
old_guide='''<div className="app-assistant-role"><Sparkles/><div><b>{greeting}</b><small>Không xử lý học thuật chuyên sâu tại đây để tránh trùng Research A.I.</small></div></div><div className="app-assistant-capabilities"><span><Navigation/>Hệ thống</span><span><ExternalLink/>HIU & CLB YHCT</span><span><Sparkles/>Tin hằng ngày</span></div>'''
new_guide='''<div className="app-assistant-guide-toggle"><button type="button" onClick={()=>persistGuide(!guideOpen)}><Sparkles/>{guideOpen?'Ẩn gợi ý':'Hiện gợi ý'}</button></div>{guideOpen&&messages.length===0?<div className="app-assistant-role"><Sparkles/><div><b>{greeting}</b><small>Hỏi nhanh, tìm tin hoặc mở tính năng.</small></div></div>:null}'''
rep('src/components/ai/UnifiedAiMini.tsx',old_guide,new_guide,'compact guide')
rep('src/components/ai/UnifiedAiMini.tsx','<div className="xz-empty"><Bot/><p>Hỏi tôi về dữ liệu tài khoản, thông báo, lịch, cách dùng ứng dụng hoặc tin công khai. Câu hỏi học thuật chuyên sâu sẽ tự chuyển sang Research A.I.</p></div>','<div className="xz-empty"><Bot/><p>Hỏi nhanh, tìm tin hoặc mở tính năng.</p></div>','compact empty state')
rep('src/components/ai/UnifiedAiMini.tsx','<button onClick={()=>openResearch()}>Research A.I</button></footer>','<label className="assistant-avatar-picker"><span>Hình trợ lý</span><select value={avatarStyle} onChange={e=>persistAvatar(e.target.value as AssistantAvatarStyle)}><option value="default">Mặc định</option><option value="eagle">Đại bàng Hồng Bàng</option><option value="viet">Việt truyền thống</option><option value="minimal">Tối giản</option></select></label><button onClick={()=>openResearch()}>Research A.I</button></footer>','avatar selector')
rep('src/components/ai/UnifiedAiMini.tsx','<span><Bot/></span><i className={listening?\'listening\':\'\'}/>','<span><AssistantMascot variant={avatarStyle}/></span><i className={listening?\'listening\':\'\'}/>','orb mascot')

# 5) Styling.
rep('src/components/admin/quiz-import.css','grid-template-columns:repeat(3,minmax(0,1fr))','grid-template-columns:repeat(4,minmax(0,1fr))','four-step flow CSS')
with open('src/components/admin/quiz-import.css','a') as f:f.write('\n.qi-primary-convert{background:var(--accent,#0f766e)!important;color:#fff!important;border-color:var(--accent,#0f766e)!important;display:inline-flex;align-items:center;gap:7px}.qi-primary-convert svg{width:17px;height:17px}\n')
with open('src/app-assistant-ai.css','a') as f:f.write(r'''
.app-assistant-guide-toggle{display:flex;justify-content:flex-end;padding:6px 12px 0}.app-assistant-guide-toggle button{min-height:30px;padding:5px 8px;border-radius:999px;font-size:10px;display:inline-flex;align-items:center;gap:5px}.app-assistant-guide-toggle svg{width:13px}.assistant-avatar-picker{display:flex!important;align-items:center!important;gap:6px!important;margin:0!important;font-size:10px}.assistant-avatar-picker select{min-height:32px;max-width:150px;padding:4px 7px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text)}.assistant-mascot{width:100%;height:100%;display:block}.assistant-mascot__halo{fill:#e7f4f1;stroke:#3f8f82;stroke-width:2}.assistant-mascot__head{fill:#fff;stroke:#315d55;stroke-width:2}.assistant-mascot__brow{fill:#315d55}.assistant-mascot__eye{fill:#173d37}.assistant-mascot__beak{fill:#e1a11c;stroke:#9a6210;stroke-width:1}.assistant-mascot__chest{fill:#dfeeea}.assistant-mascot__scarf{fill:#a92e2e;stroke:#7b1d1d;stroke-width:1}.assistant-mascot__gold{fill:#e2b43d}.assistant-mascot__ai-dot{fill:#0f766e}.assistant-mascot__ai-line,.assistant-mascot__hatline,.assistant-mascot__wingline{fill:none;stroke:#fff;stroke-width:1.5;stroke-linecap:round}.assistant-mascot__hat{fill:#d9a547;stroke:#8d6322;stroke-width:1.4}.assistant-mascot__hatline{stroke:#8d6322}.assistant-mascot--minimal .assistant-mascot__halo{fill:transparent}.assistant-mascot--minimal .assistant-mascot__head{fill:transparent}.assistant-mascot--minimal .assistant-mascot__wingline{stroke:#315d55}.xz-avatar .assistant-mascot{width:34px;height:34px}.xz-orb .assistant-mascot{width:34px;height:34px}@media(max-width:600px){.assistant-avatar-picker{width:100%;justify-content:space-between}.assistant-avatar-picker select{flex:1;max-width:none}}
''')

# 6) Make the new contract part of every production build.
pkg=json.loads(read('package.json'))
pkg['scripts']['audit:quiz-pipeline']='node scripts/quiz-learning-pipeline-check.mjs'
pre=pkg['scripts']['prebuild']
if 'audit:quiz-pipeline' not in pre: pre=pre.replace('npm run audit:rag','npm run audit:rag && npm run audit:quiz-pipeline')
pkg['scripts']['prebuild']=pre
write('package.json',json.dumps(pkg,ensure_ascii=False,indent=2)+'\n')

# Remove this one-shot patcher/workflow from the product commit.
Path('scripts/apply-quiz-learning-aiux-deep.py').unlink(missing_ok=True)
Path('.github/workflows/apply-quiz-learning-aiux-deep.yml').unlink(missing_ok=True)
print('deep quiz-learning-aiux patch applied')
