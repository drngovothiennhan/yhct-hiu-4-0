import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
const files={app:read('src/App.tsx'),boot:read('index.html'),viewport:read('src/components/system/ViewportModeToggle.tsx'),css:read('src/viewport-native-hotfix.css')+read('src/news-rotator.css')+read('src/final4-v2.css'),desktop:read('src/desktop-community.css')+read('src/desktop-interaction-profile.css'),news:read('src/components/news/TcmNewsRotator.tsx'),community:read('src/components/community/CommunitySidebar.tsx'),admin:read('src/components/admin/SystemAdminCenter.tsx'),adminTheme:read('src/components/admin/AdminThemeControl.tsx'),moderation:read('src/components/admin/ModerationOpsPanel.tsx'),drl:read('src/components/drl/DrlCenter.tsx'),worker:read('src/workers/drlParseWorker.ts'),feed:read('src/components/feed/AcademicFeed.tsx'),composer:read('src/components/feed/AcademicComposer.tsx'),post:read('src/components/feed/AcademicPostCard.tsx'),mini:read('src/components/ai/PersonalCopilotWidget.tsx'),driveApi:read('api/research/drive.js'),docx:read('src/components/feed/DocxImportPanel.tsx'),types:read('src/types/index.ts'),social:read('src/services/socialService.ts'),theme:read('src/theme.ts'),profile:read('src/components/profile/ProfileCenter.tsx'),authRuntime:read('src/services/authRuntimeService.ts'),vite:read('vite.config.ts'),main:read('src/main.tsx')};
const has=(file,...tokens)=>tokens.every(token=>file.includes(token)),not=(file,...tokens)=>tokens.every(token=>!file.includes(token));
const checks=[
['ADMIN',[
 ['ACC admin gate',has(files.app,"canAcc=roleAtLeast(member?.role,'admin')")],
 ['ACC-only 2D/3D control',has(files.app,'AdminThemeControl theme={theme}')&&has(files.adminTheme,'2D Flat','3D Isometric')&&not(files.app,'theme-quick-toggle','mobile-theme-action')],
 ['admin theme isolated from ordinary sessions',has(files.app,"applyTheme(canAcc?theme:'duoc-ngoc',canAcc)")&&has(files.theme,'persist=true')],
 ['viewport desktop/mobile toggle',has(files.viewport,'dataset.viewportMode','width=1280, viewport-fit=cover','Xem bản Desktop','Xem bản Mobile')&&has(files.boot,'yhct-viewport-mode-v1','width=1280,viewport-fit=cover')],
 ['news edit/delete/pin RPC',has(files.admin,'tcm_news_admin_update_v1','tcm_news_admin_delete_v1','tcm_news_admin_set_pinned_v1')],
 ['host-neutral diagnostic/weather edge routes',has(files.admin,"edgeUrl('acc-diagnostics')","edgeUrl('public-weather')",'SUPABASE_PUBLISHABLE_KEY','diagnostic-output')&&not(files.admin,"fetch('/api/ai/diagnostics'","fetch(`/api/weather")],
 ['admin-only DRL publication + lock',has(files.drl,"canPublish=roleAtLeast(member?.role,'admin')","canLock=roleAtLeast(member?.role,'admin')",'drl_admin_publish_semester_v1','Công bố điểm học kỳ','step:1|2','Xác nhận công bố')]
]],
['SUPER_MOD',[
 ['hierarchy super_mod > mod',has(files.types,'super_mod:3','mod:2')],
 ['academic moderation queue',has(files.moderation,'academic_moderation_queue_v1','moderate_academic_post_v1',"'approved'|'rejected'")&&has(files.social,'create_academic_post','update_academic_post')],
 ['RSS separated from user moderation',has(files.moderation,'tin RSS tự động không đi vào hàng đợi này','RSS/YHCT news','Tách queue')&&has(files.news,'tcm_news_feed_v1')],
 ['limited moderation logs',has(files.moderation,'moderation_recent_logs_v1')],
 ['DRL overview',has(files.moderation,'drl_semester_list_v1')],
 ['management auto rotation + touch swipe',has(files.community,'managementPage','ROTATE_MS=8000','Vuốt ngang để chuyển','onPointerDown','onPointerMove','onPointerCancel')],
 ['publication remains admin-only',has(files.drl,"canPublish=roleAtLeast(member?.role,'admin')")]
]],
['MOD',[
 ['Excel worker upload',has(files.drl,'.xlsx','.xls','.csv','drlParseWorker','drl_admin_import_v1','SHA-256')],
 ['HIU DRL template auto-detect',has(files.worker,'header:1','diem_de_xuat_drl','hiu_drl_proposal','suggested_semester_code','duplicateStudentCodes','logicalKey')&&has(files.drl,'matchDetectedSemester','drl_admin_upsert_semester_v1','Đã nhận mẫu đề nghị ĐRL HIU')],
 ['row-level DRL validation',has(files.worker,'RowError','Điểm cộng không được âm','Điểm cộng không được là số thập phân')&&has(files.drl,'rowErrors','Lỗi cần sửa trước khi commit','Bị chặn')],
 ['draft import allowed but publish not delegated',has(files.drl,"canManage=roleAtLeast(member?.role,'mod')","canPublish=roleAtLeast(member?.role,'admin')",'Commit bản nháp')],
 ['post edit permission',has(files.post,"roleAtLeast(member.role,'mod')",'onEdit(post)')],
 ['Word summary import remains available',has(files.docx,'docx')],
 ['Mini AI present',has(files.app,'PersonalCopilotWidget member={member}')&&has(files.mini,'visualViewport')]
]],
['USER',[
 ['PC news wheel + mouse drag + mobile-safe arrows',has(files.news,'ROTATE_MS=8000','tcm_news_feed_v1',"addEventListener('wheel'",'{passive:false}','pending+=delta','desktopInteractionEnabled','onMouseDown','onMouseMove','suppressClickRef')&&has(files.css,'overflow-x:auto','cursor:grab','touch-action:auto','.news-rotator-nav')],
 ['community pointer + keyboard interaction',has(files.community,'community-member-button','onClick={()=>onOpen(item)}','aria-label={`Xem thông tin','role="dialog"','onPointerDown','onPointerMove')&&has(files.desktop,'community-pointer-surface','touch-action:pan-y')],
 ['public community data remains safe',has(files.community,"supabase.rpc('community_sidebar_v2')",'ACTIVE_LIMIT=10','total_credits','credit_rank')&&not(files.community,'student_code','email','phone')],
 ['desktop/mobile-desktop canonical viewport',has(files.desktop,'@media screen and (min-width:1024px)','color-scheme:light','text-size-adjust:100%')&&has(files.desktop,'grid-template-areas:"news side" "main side"')],
 ['locked mobile layout preserved',has(files.css,'--mobile-module-gap','clamp(34px,10vw,40px)','.auth-brand-mark')&&has(files.viewport,'localStorage.setItem(VIEWPORT_MODE_KEY','dataset.viewportMode')],
 ['profile and password change',has(files.profile,'member_profile_summary_v1','Đổi mật khẩu','Mật khẩu hiện tại','Xác nhận mật khẩu mới')&&has(files.authRuntime,'member-change-password','AbortController')&&has(files.app,"window.location.pathname==='/profile'")],
 ['bounded login UX',has(files.authRuntime,'loginOptimized','8000')&&has(files.app,'auth-submit-spinner','Đang xác thực…')],
 ['portable static hosting contract',has(files.vite,'GITHUB_PAGES',"'/yhct-hiu-4-0/'")&&has(files.main,'import.meta.env.BASE_URL')],
 ['Mini AI direct Drive blocked',has(files.mini,'Kho YHCT','API bảo mật','không mở liên kết/thư mục Drive trực tiếp')&&not(files.mini,'window.open(','drive.google.com/drive/folders/','YHCT_RESEARCH_DRIVE_URL')&&has(files.driveApi,"memberAccess(req,'admin')",'process.env.YHCT_DRIVE_FOLDER_ID')&&not(files.driveApi,'req.query?.folderId','webViewLink')],
 ['DRL exact MSSV publication status',has(files.drl,'drl_public_lookup_v2','Đã chốt điểm','Đang tổng hợp / Chờ duyệt','total_points')]
]]];
let failed=0;for(const [role,items] of checks){const bad=items.filter(([,ok])=>!ok);if(bad.length){failed++;console.error(`role-audit ${role} FAIL: ${bad.map(([name])=>name).join('; ')}`)}else console.log(`role-audit ${role} PASS: ${items.map(([name])=>name).join('; ')}`)}if(failed)process.exit(1);console.log('role-audit-ok: academic moderation, frozen mobile, portable hosting, desktop pointer UX, profile/password, DRL RBAC and ACC-only 2D/3D contracts passed');
