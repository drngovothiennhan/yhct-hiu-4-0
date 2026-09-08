import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
const files={app:read('src/App.tsx'),boot:read('index.html'),viewport:read('src/components/system/ViewportModeToggle.tsx'),css:read('src/viewport-native-hotfix.css')+read('src/news-rotator.css')+read('src/final4-v2.css')+read('src/social-v5.css'),desktop:read('src/desktop-community.css')+read('src/desktop-interaction-profile.css'),news:read('src/components/news/TcmNewsRotator.tsx'),community:read('src/components/community/CommunitySidebar.tsx'),admin:read('src/components/admin/SystemAdminCenter.tsx'),adminTheme:read('src/components/admin/AdminThemeControl.tsx'),moderation:read('src/components/admin/ModerationOpsPanel.tsx'),drl:read('src/components/drl/DrlCenter.tsx'),worker:read('src/workers/drlParseWorker.ts'),feed:read('src/components/feed/AcademicFeed.tsx'),post:read('src/components/feed/AcademicPostCard.tsx'),mini:read('src/components/ai/UnifiedAiMini.tsx'),driveApi:read('api/research/drive.js'),docx:read('src/components/feed/DocxImportPanel.tsx'),types:read('src/types/index.ts'),social:read('src/services/socialService.ts'),theme:read('src/theme.ts'),profile:read('src/components/profile/ProfileCenter.tsx'),auth:read('src/services/authService.ts'),authRuntime:read('src/services/authRuntimeService.ts'),gardenSocial:read('src/components/game/HerbGardenSocialHub.tsx'),messages:read('src/components/messages/MessagesCenter.tsx'),composer:read('src/components/feed/AcademicPostComposer.tsx'),vite:read('vite.config.ts'),main:read('src/main.tsx')};
const has=(file,...tokens)=>tokens.every(token=>file.includes(token)),not=(file,...tokens)=>tokens.every(token=>!file.includes(token));
const checks=[
['ADMIN',[
 ['ACC admin gate',has(files.app,"canAcc=roleAtLeast(member?.role,'admin')")],
 ['ACC-only theme control',has(files.app,'AdminThemeControl theme={theme}')&&has(files.adminTheme,'2D Flat','3D Isometric')&&not(files.app,'theme-quick-toggle','mobile-theme-action')],
 ['admin theme isolated',has(files.app,"applyTheme(canAcc?theme:'duoc-ngoc',canAcc)")],
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
 ['Unified A.I Mini present',has(files.app,'UnifiedAiMini member={member}')&&has(files.mini,"slice(0,3)",'HISTORY_KEY','feedback_submit_v1')]
]],
['USER',[
 ['news interactions preserved',has(files.news,'ROTATE_MS=8000','tcm_news_feed_v1',"addEventListener('wheel'",'{passive:false}','onMouseDown','onMouseMove')],
 ['community public data safe',has(files.community,"supabase.rpc('community_sidebar_v2')",'ACTIVE_LIMIT=10')&&not(files.community,'student_code','email','phone')],
 ['profile wall + avatar + three-post server feed',has(files.profile,'member_wall_feed_v1','member_wall_post_create_v1','member_profile_update_v2',"storage.from('member-media')",'maxLength={500}')],
 ['herbal alias restored into session',has(files.auth,'herbal_alias','herbalAlias','wall_theme','wall_motto')],
 ['private inbox retained',has(files.messages,'messages_inbox_v1','messages_send_v1','message_recipients_v1','member_messages')],
 ['social garden visit/help/market/decor',has(files.gardenSocial,'herb_garden_directory_v1','herb_garden_visit_v1','herb_garden_help_v1','herb_garden_market_buy_v1','herb_garden_profile_update_v1')],
 ['AI history daily reset and two-line UI',has(files.mini,"timeZone:'Asia/Ho_Chi_Minh'",'localStorage.removeItem(HISTORY_KEY)',"slice(0,3)")&&has(files.css,'-webkit-line-clamp:2')],
 ['feedback is part of A.I Mini',has(files.mini,"Mode='assistant'|'feedback'",'Góp ý','feedback_submit_v1')&&not(files.app,'AiMiniFeedbackDock','PersonalCopilotWidget')],
 ['profile/password preserved',has(files.profile,'Đổi mật khẩu','Mật khẩu hiện tại','Xác nhận mật khẩu mới')&&has(files.authRuntime,'member-change-password','AbortController')],
 ['portable static hosting',has(files.vite,'GITHUB_PAGES',"'/yhct-hiu-4-0/'")&&has(files.main,'import.meta.env.BASE_URL')],
 ['DRL exact publication status',has(files.drl,'drl_public_lookup_v2','Đã chốt điểm','Đang tổng hợp / Chờ duyệt','total_points')]
]]];
let failed=0;for(const [role,items] of checks){const bad=items.filter(([,ok])=>!ok);if(bad.length){failed++;console.error(`role-audit ${role} FAIL: ${bad.map(([name])=>name).join('; ')}`)}else console.log(`role-audit ${role} PASS: ${items.map(([name])=>name).join('; ')}`)}if(failed)process.exit(1);console.log('role-audit-ok: social v5, frozen mobile, portable hosting, private inbox, wall identity, moderation queues, garden economy, DRL and RBAC contracts passed');
