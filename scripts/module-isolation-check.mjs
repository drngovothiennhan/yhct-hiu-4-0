import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const errors=[];
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))errors.push(`${label} missing ${token}`)};
const forbid=(body,tokens,label)=>{for(const token of tokens)if(body.includes(token))errors.push(`${label} must not contain ${token}`)};

const app=read('src/App.tsx'),contract=read('src/modules/moduleContract.ts'),boundary=read('src/modules/ModuleBoundary.tsx'),profile=read('src/components/profile/ProfileCenter.tsx'),inbox=read('src/components/profile/ProfileInbox.tsx'),adminTheme=read('src/components/admin/AdminThemeControl.tsx'),research=read('src/components/research/ResearchCenter.tsx'),researchMini=read('src/components/research/ResearchAiMini.tsx'),mini=read('src/components/ai/UnifiedAiMini.tsx'),miniService=read('src/services/xiaozhiMiniService.ts'),vite=read('vite.config.ts'),manifest=read('api/manifest.js'),pwa=read('src/services/pwaInstallService.ts'),settings=read('src/components/system/AppSettingsDialog.tsx');

need(contract,["ModuleId='feed'|'research'|'profile'|'garden'|'notifications'|'schedule'|'drl'|'exam'|'admin'|'acc'","path:'/research'","path:'/profile'","minRole:'mod'","minRole:'admin'","if(path==='/messages')return'profile'"],'module contract');
need(boundary,['componentDidCatch','data-module-isolated="true"','module_boundary_error'],'module boundary');
need(app,['lazy(()=>import(\'./components/feed/AcademicFeed\'))','lazy(()=>import(\'./components/research/ResearchCenter\'))','lazy(()=>import(\'./components/profile/ProfileCenter\'))','lazy(()=>import(\'./components/game/HerbGardenGame\'))','lazy(()=>import(\'./components/notifications/NotificationsCenter\'))','lazy(()=>import(\'./components/schedule/ScheduleCenter\'))','lazy(()=>import(\'./components/drl/DrlCenter\'))','lazy(()=>import(\'./components/exam/ExamCenter\'))','lazy(()=>import(\'./components/admin/AdminControlCenter\'))','ModuleBoundary moduleId={tab}','AdminThemeControl theme={theme} onChange={changeTheme}','tab===\'admin\'&&canAdmin&&<AdminControlCenter','tab===\'acc\'&&canAcc&&<>','<AppSettingsDialog','initPwaInstallCapture'],'app module host');
forbid(app,["tab==='messages'","go('messages')","Inbox cá nhân</button>","tab==='admin'&&canAdmin&&<>{canAcc&&<AdminThemeControl"],'app module host');
need(profile,['ProfileInbox','<ProfileInbox member={member}/>','Tường cá nhân'],'profile inbox merge');
need(inbox,['messages_inbox_v1','member_messages','MessagesCenter','role="dialog"','inboxBadge'],'profile inbox dialog');
need(adminTheme,['THEME_OPTIONS.length','Giao diện hệ thống','module khác chỉ nhận theme đồng bộ'],'ACC compact theme');
need(research,['searchOpenAlex(query,12)','A.I OpenAlex tổng hợp','summarizeOpenAlex','askServerAi'],'research OpenAlex AI');
need(researchMini,['searchOpenAlex(text,6)','searchDriveRag(text,4)','askServerAi(text,\'research\'','Cloud + Drive RAG + OpenAlex','searchKnowledge'],'Research AI mini shared academic retrieval');
need(mini,['academicIntent','askXiaoZhiMini','VOICE_KEY','startListening','Học thuật → Trung tâm nghiên cứu'],'global XiaoZhi AI mini system/voice routing');
forbid(mini,['searchOpenAlex','searchDriveRag','searchKnowledge','centralKnowledgeService','feedback_submit_v1'],'global XiaoZhi AI mini academic separation');
need(miniService,["fetch('/api/ai/assistant'","mode:'xiaozhi-mini'",'Authorization:`Bearer ${token}`'],'global XiaoZhi shared gateway client');
need(vite,['module-feed','module-research','module-profile','module-profile-inbox','module-garden','module-notifications','module-schedule','module-drl','module-exam','module-admin','module-acc'],'module chunks');
need(manifest,["id:'/'","start_url:'/'","scope:'/'","display:'standalone'","prefer_related_applications:false","shortcuts:",'Trung tâm nghiên cứu','Tường cá nhân'],'root PWA manifest');
need(pwa,['beforeinstallprompt','appinstalled','requestPwaInstall','display-mode: standalone'],'PWA install controller');
need(settings,['Cài ứng dụng mạng xã hội','PWA độc lập của Chrome','requestPwaInstall'],'app settings');

if(errors.length){console.error('MODULE ISOLATION CHECK FAILED');for(const error of errors)console.error(`- ${error}`);process.exit(1)}
console.log('module-isolation-ok: 10 final areas frozen, inbox embedded in profile, admin/ACC separation, root PWA install, research academic AI and global XiaoZhi separation present');
