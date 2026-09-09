import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
const files={
 app:read('src/App.tsx'),boot:read('index.html'),viewport:read('src/components/system/ViewportModeToggle.tsx'),
 css:read('src/viewport-native-hotfix.css')+read('src/news-rotator.css')+read('src/final4-v2.css')+read('src/social-v5.css')+read('src/garden-v6.css')+read('src/module-isolation.css')+read('src/xiaozhi-mini.css'),
 news:read('src/components/news/TcmNewsRotator.tsx'),community:read('src/components/community/CommunitySidebar.tsx'),admin:read('src/components/admin/SystemAdminCenter.tsx'),adminControl:read('src/components/admin/AdminControlCenter.tsx'),adminTheme:read('src/components/admin/AdminThemeControl.tsx'),moderation:read('src/components/admin/ModerationOpsPanel.tsx'),drl:read('src/components/drl/DrlCenter.tsx'),worker:read('src/workers/drlParseWorker.ts'),feed:read('src/components/feed/AcademicFeed.tsx'),post:read('src/components/feed/AcademicPostCard.tsx'),mini:read('src/components/ai/UnifiedAiMini.tsx'),miniService:read('src/services/xiaozhiMiniService.ts'),docx:read('src/components/feed/DocxImportPanel.tsx'),types:read('src/types/index.ts'),theme:read('src/theme.ts'),profile:read('src/components/profile/ProfileCenter.tsx'),profileInbox:read('src/components/profile/ProfileInbox.tsx'),auth:read('src/services/authService.ts'),authRuntime:read('src/services/authRuntimeService.ts'),garden:read('src/components/game/HerbGardenGame.tsx'),gardenSocial:read('src/components/game/HerbGardenSocialHub.tsx'),messages:read('src/components/messages/MessagesCenter.tsx'),composer:read('src/components/feed/AcademicPostComposer.tsx'),vite:read('vite.config.ts'),main:read('src/main.tsx'),contract:read('src/modules/moduleContract.ts'),pwa:read('src/services/pwaInstallService.ts'),settings:read('src/components/system/AppSettingsDialog.tsx'),research:read('src/components/research/ResearchCenter.tsx'),researchMini:read('src/components/research/ResearchAiMini.tsx')
};
const has=(file,...tokens)=>tokens.every(token=>file.includes(token));
const not=(file,...tokens)=>tokens.every(token=>!file.includes(token));
const checks=[
 ['ADMIN',[
  ['ACC admin gate',has(files.app,"canAcc=roleAtLeast(member?.role,'admin')")],
  ['ACC-only theme selector',has(files.app,"tab==='acc'&&canAcc&&<>",'AdminThemeControl theme={theme} onChange={changeTheme}')&&has(files.adminTheme,'Giao diện hệ thống','THEME_OPTIONS.length','acc-theme-compact-grid')&&not(files.app,'theme-quick-toggle','mobile-theme-action')],
  ['Điều hành has no theme selector',has(files.app,"tab==='admin'&&canAdmin&&<AdminControlCenter")&&not(files.adminControl,'AdminThemeControl','saveSystemTheme')],
  ['admin-only theme mutation',has(files.app,'const changeTheme=(next:ThemeName)=>{if(!canAcc)return','saveSystemTheme(next)')&&has(files.theme,"supabase.rpc('system_theme_set_v1'",'p_theme:target','pendingSaveTheme','desiredSystemTheme')],
  ['global system theme application',has(files.app,'applyTheme(theme)','fetchSystemTheme()','watchSystemTheme(next=>')&&has(files.theme,"supabase.rpc('system_theme_get_v1')",'watchSystemTheme')],
  ['legacy theme override removed + atomic bootstrap',not(files.boot,'yhct-hiu-ui-theme-v1','data-theme="duoc-ngoc"')&&has(files.main,'bootstrapThemeState()')&&has(files.theme,'localStorage.removeItem(LEGACY_THEME_KEY)','normalizeManifestLink','SYSTEM_THEME_HINT_KEY','dataset.themeSwitching')],
  ['moderation workbench includes feedback only for admin',has(files.moderation,"moderation_workbench_v2","canAdmin=roleAtLeast(member?.role,'admin')",'feedback_admin_resolve_v1','p_on_date')],
  ['host-neutral diagnostics',has(files.admin,"edgeUrl('acc-diagnostics')","edgeUrl('public-weather')",'SUPABASE_PUBLISHABLE_KEY')],
  ['admin-only DRL publication',has(files.drl,"canPublish=roleAtLeast(member?.role,'admin')",'drl_admin_publish_semester_v1','drl_admin_lock_semester_v1')]
 ]],
 ['SUPER_MOD',[
  ['hierarchy super_mod > mod',has(files.types,'super_mod:3','mod:2')],
  ['post verification preserved',has(files.feed,'set_post_mod_verified')&&has(files.post,'Xác minh')],
  ['moderation queue supports academic and news',has(files.moderation,"academic:'Bài thành viên chờ duyệt'","news:'Tin tức cần xử lý'",'tcm_news_review_v1','moderate_academic_post_v1')],
  ['reviewed items disappear after reload',has(files.moderation,'await load()','Đã xem','moderation_mark_seen_v1')],
  ['publication remains admin-only',has(files.drl,"canPublish=roleAtLeast(member?.role,'admin')")]
 ]],
 ['MOD',[
  ['Excel DRL import preserved',has(files.drl,'.xlsx','.xls','.csv','drlParseWorker','drl_admin_import_v1')],
  ['HIU DRL template required',has(files.worker,'diem_de_xuat_drl','hiu_drl_proposal','duplicateStudentCodes','logicalKey')],
  ['composer allows non-clinical post types',has(files.composer,"['news','Tin tức']","['reference','Bài tham khảo']",'Nội dung YHCT chuyên sâu — tùy chọn')],
  ['work blocks max-five contract surfaced',has(files.moderation,'Tối đa 5 nội dung','moderation_workbench_v2','p_on_date')],
  ['Word summary import preserved',has(files.feed,'DocxImportPanel')&&has(files.docx,'docx')],
  ['Unified XiaoZhi A.I Mini present',has(files.app,'UnifiedAiMini member={member}')&&has(files.mini,'askXiaoZhiMini','VOICE_KEY','startListening')&&has(files.miniService,"mode:'xiaozhi-mini'")]
 ]],
 ['USER',[
  ['frozen module contract',has(files.contract,"ModuleId='feed'|'research'|'profile'|'garden'|'notifications'|'schedule'|'drl'|'exam'|'admin'|'acc'","if(path==='/messages')return'profile'")&&not(files.app,"tab==='messages'","go('messages')")],
  ['system theme received without selector',has(files.app,'fetchSystemTheme()','applyTheme(theme)','watchSystemTheme(next=>')&&not(files.app,'theme-quick-toggle','mobile-theme-action')],
  ['TCM news carousel + latest-three AI academic posts',has(files.news,'ROTATE_MS=8000',"tcm_news_feed_v1',{p_limit:20}",'news-rotator-track','scrollByPage','news-rotator-prev','news-rotator-next')&&not(files.news,'MAX_NEWS=3','news-rotator-top3','data-ai-news-count')&&has(files.feed,"SYSTEM_AI_CODE='AI-YHCT-SYSTEM'",'visibleSystemAiIds','slice(0,3)','data-system-ai-visible')],
  ['community public data safe',has(files.community,"supabase.rpc('community_sidebar_v2')",'ACTIVE_LIMIT=10')&&not(files.community,'student_code','email','phone')],
  ['profile wall + avatar + three-post server feed',has(files.profile,'member_wall_feed_v1','member_wall_post_create_v1','member_profile_update_v2',"storage.from('member-media')",'maxLength={500}','ProfileInbox')],
  ['private inbox embedded in profile',has(files.profileInbox,'messages_inbox_v1','MessagesCenter','member_messages','role="dialog"')&&has(files.messages,'messages_send_v1','message_recipients_v1')],
  ['herbal alias restored into session',has(files.auth,'herbal_alias','herbalAlias','wall_theme','wall_motto')],
  ['social garden visit/help/market/decor',has(files.gardenSocial,'herb_garden_directory_v2','herb_garden_visit_v2','herb_garden_help_v2','herb_garden_market_buy_v1','herb_garden_profile_update_v1','visited-grid-v3')&&has(files.garden,'herb_garden_state_v3','garden-nine-grid')],
  ['AI Mini voice defaults on and mobile remains fixed',has(files.mini,'VOICE_KEY','speechSynthesis','startListening','askXiaoZhiMini')&&has(files.css,'@media(max-width:760px)','.xz-mini','position:fixed')],
  ['OpenAlex remains research-only',has(files.research,'searchOpenAlex(query,12)','A.I OpenAlex tổng hợp')&&has(files.researchMini,'searchOpenAlex(text,6)')&&has(files.mini,'academicIntent')&&not(files.mini,'searchOpenAlex','searchDriveRag','searchKnowledge')],
  ['AI Mini is system/club/web focused without feedback mode',has(files.mini,'Điểm của tôi','Lịch CLB','Học thuật → Trung tâm nghiên cứu')&&has(files.miniService,"mode:'xiaozhi-mini'")&&not(files.mini,'feedback_submit_v1',"Mode='assistant'|'feedback'")&&not(files.app,'AiMiniFeedbackDock','PersonalCopilotWidget')],
  ['installable PWA settings',has(files.settings,'Cài ứng dụng mạng xã hội','requestPwaInstall')&&has(files.pwa,'beforeinstallprompt','appinstalled','display-mode: standalone')],
  ['profile/password preserved',has(files.profile,'Đổi mật khẩu','Mật khẩu hiện tại','Xác nhận mật khẩu mới')&&has(files.authRuntime,'member-change-password','AbortController')],
  ['portable static hosting',has(files.vite,'GITHUB_PAGES',"'/yhct-hiu-4-0/'")&&has(files.main,'import.meta.env.BASE_URL')],
  ['module build chunks',has(files.vite,'module-feed','module-research','module-profile','module-garden','module-admin','module-acc')],
  ['DRL exact publication status',has(files.drl,'drl_public_lookup_v2','Đã chốt điểm','Đang tổng hợp / Chờ duyệt','total_points')]
 ]]
];
let failed=0;
for(const [role,items] of checks){
 const bad=items.filter(([,ok])=>!ok);
 if(bad.length){failed++;console.error(`role-audit ${role} FAIL: ${bad.map(([name])=>name).join('; ')}`)}
 else console.log(`role-audit ${role} PASS: ${items.map(([name])=>name).join('; ')}`);
}
if(failed)process.exit(1);
console.log('role-audit-ok: modular roles, atomic theme, rolling TCM news carousel, latest-three AI academic posts, private inbox, research-only academic AI, XiaoZhi Mini, PWA, wall identity, moderation, garden, DRL and RBAC contracts passed');
