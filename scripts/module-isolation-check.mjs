import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const errors=[];
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))errors.push(`${label} missing ${token}`)};
const forbid=(body,tokens,label)=>{for(const token of tokens)if(body.includes(token))errors.push(`${label} must not contain ${token}`)};

const app=read('src/App.tsx'),contract=read('src/modules/moduleContract.ts'),boundary=read('src/modules/ModuleBoundary.tsx'),profile=read('src/components/profile/ProfileCenter.tsx'),inbox=read('src/components/profile/ProfileInbox.tsx'),adminTheme=read('src/components/admin/AdminThemeControl.tsx'),research=read('src/components/research/ResearchCenter.tsx'),researchMini=read('src/components/research/ResearchAiMini.tsx'),researchEvidence=read('src/services/researchEvidenceService.ts'),mini=read('src/components/ai/UnifiedAiMini.tsx'),miniService=read('src/services/xiaozhiMiniService.ts'),aiCenter=read('src/components/ai/AiCenter.tsx'),studyService=read('src/services/studyAiService.ts'),vite=read('vite.config.ts'),manifest=read('api/manifest.js'),pwa=read('src/services/pwaInstallService.ts'),settings=read('src/components/system/AppSettingsDialog.tsx');

need(contract,["ModuleId='feed'|'ai'|'research'|'profile'|'garden'|'notifications'|'schedule'|'drl'|'exam'|'admin'|'acc'","path:'/ai'","path:'/research'","path:'/profile'","minRole:'mod'","minRole:'admin'","if(path==='/messages')return'profile'","HIUTMC_GATEWAY_PREFIX='/apps/study'"],'module contract');
need(boundary,['componentDidCatch','data-module-isolated="true"','module_boundary_error'],'module boundary');
need(app,['lazy(()=>import(\'./components/feed/AcademicFeed\'))','lazy(()=>import(\'./components/ai/AiCenter\'))','lazy(()=>import(\'./components/research/ResearchCenter\'))','lazy(()=>import(\'./components/profile/ProfileCenter\'))','lazy(()=>import(\'./components/game/HerbGardenGame\'))','lazy(()=>import(\'./components/notifications/NotificationsCenter\'))','lazy(()=>import(\'./components/schedule/ScheduleCenter\'))','lazy(()=>import(\'./components/drl/DrlCenter\'))','lazy(()=>import(\'./components/exam/ExamCenter\'))','lazy(()=>import(\'./components/admin/AdminControlCenter\'))','ModuleBoundary moduleId={tab}',"tab==='ai'&&member&&<AiCenter",'AdminThemeControl theme={theme} onChange={changeTheme}',"tab==='admin'&&canAdmin&&<AdminControlCenter","tab==='acc'&&canAcc&&<>",'<AppSettingsDialog','initPwaInstallCapture'],'app module host');
forbid(app,["tab==='messages'","go('messages')","Inbox cá nhân</button>","tab==='admin'&&canAdmin&&<>{canAcc&&<AdminThemeControl"],'app module host');
need(profile,['ProfileInbox','<ProfileInbox member={member}/>','Tường cá nhân'],'profile inbox merge');
need(inbox,['messages_inbox_v1','member_messages','MessagesCenter','role="dialog"','inboxBadge'],'profile inbox dialog');
need(adminTheme,['THEME_OPTIONS.length','Giao diện hệ thống','module khác chỉ nhận theme đồng bộ'],'ACC compact theme');
need(research,['searchResearchEvidence(query,18)','<ResearchAiMini','Khách: không dùng Gemini','Trích xuất ý chính (không A.I)'],'research public evidence surface');
need(researchEvidence,["/api/knowledge/resources?action=research",'requestDeadline(12000,signal)'],'research public evidence server boundary');
forbid(research,['searchPubMed(query,12)','searchOpenAlex(query,12)','searchClinicalTrials(query,8)','ragInternalConsent','Research A.I tổng hợp nguồn vừa tìm','summarizeOpenAlex','askServerAi'],'research public surface must not own provider fan-out or AI orchestration');
need(researchMini,['RESEARCH_ROLE=GEMINI_MEDICAL_RESEARCH_LEAD','searchResearchEvidence(text,14,controller.signal)','reusePublic','Dùng tài liệu nội bộ cho lượt này','translateAcademic','searchDriveRag',"searchKnowledge(text,'all',4)",'Bằng chứng','PICO','Khoảng trống','Phương pháp','Không tạo câu trả lời local thay thế','setUseInternal(false)'],'Research AI canonical orchestration');
forbid(researchMini,['searchPubMed(text,8)','searchOpenAlex(text,8)','searchClinicalTrials(text,5)','buildAcademicFallback','Fallback học thuật cục bộ','A.I local 0đ'],'Research AI duplicate retrieval or local pseudo-answer path');
need(mini,['researchIntent','VOICE_KEY','startListening','openResearch(text)','openStudyAi(text)','Trợ lý tác vụ'],'global task assistant routing');
forbid(mini,['askXiaoZhiMini','searchOpenAlex','searchPubMed','searchClinicalTrials','searchDriveRag','searchKnowledge','centralKnowledgeService','askAcademicUnified','feedback_submit_v1'],'global task assistant academic separation');
need(aiCenter,['askStudyGemini','AI STUDY OS · GEMINI','ai-center__conversation','ai-center__composer'],'dedicated Gemini Study workspace');
need(studyService,["fetch('/api/ai/assistant'",'conversationContext','Authorization:`Bearer ${token}`'],'Gemini Study authenticated client');
need(miniService,["fetch('/api/ai/assistant'","mode:'xiaozhi-mini'",'Authorization:`Bearer ${token}`','hiu.vn'],'legacy XiaoZhi gateway remains isolated');
need(vite,['manualChunks:productionChunk','vendor-react','vendor-supabase','vendor-icons','vendor-documents'],'vendor chunk boundaries');
forbid(vite,['module-feed','module-ai','module-research','module-profile','module-profile-inbox','module-garden','module-notifications','module-schedule','module-drl','module-exam','module-admin','module-acc'],'manual application chunks');
need(manifest,["id:'/'","start_url:'/'","scope:'/'","display:'standalone'","prefer_related_applications:false","shortcuts:",'Trung tâm nghiên cứu','Tường cá nhân'],'root PWA manifest');
need(pwa,['beforeinstallprompt','appinstalled','requestPwaInstall','display-mode: standalone'],'PWA install controller');
need(settings,['Cài ứng dụng mạng xã hội','PWA độc lập của Chrome','requestPwaInstall'],'app settings');

if(errors.length){console.error('MODULE ISOLATION CHECK FAILED');for(const error of errors)console.error(`- ${error}`);process.exit(1)}
console.log('module-isolation-ok: 11 final areas including dedicated Gemini Study AI Center, task-only floating assistant, native lazy route boundaries, vendor-only manual chunks, inbox embedded in profile, admin/ACC separation, root PWA install, and single server-bounded Gemini medical Research orchestration with request-scoped internal consent present');