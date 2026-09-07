import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
const files={
  app:read('src/App.tsx'),boot:read('index.html'),viewport:read('src/components/system/ViewportModeToggle.tsx'),
  css:read('src/viewport-native-hotfix.css')+read('src/news-rotator.css'),desktop:read('src/desktop-community.css'),
  news:read('src/components/news/TcmNewsRotator.tsx'),community:read('src/components/community/CommunitySidebar.tsx'),
  admin:read('src/components/admin/SystemAdminCenter.tsx'),moderation:read('src/components/admin/ModerationOpsPanel.tsx'),
  drl:read('src/components/drl/DrlCenter.tsx'),worker:read('src/workers/drlParseWorker.ts'),feed:read('src/components/feed/AcademicFeed.tsx'),
  post:read('src/components/feed/AcademicPostCard.tsx'),mini:read('src/components/ai/PersonalCopilotWidget.tsx'),
  docx:read('src/components/feed/DocxImportPanel.tsx'),types:read('src/types/index.ts'),sql:read('ops/sql/community_sidebar_v1.sql')
};
const has=(file,...tokens)=>tokens.every(token=>file.includes(token));
const not=(file,...tokens)=>tokens.every(token=>!file.includes(token));
const checks=[
  ['ADMIN',[
    ['ACC admin gate',has(files.app,"canAcc=roleAtLeast(member?.role,'admin')")],
    ['viewport desktop/mobile toggle',has(files.viewport,'dataset.viewportMode','width=1280, viewport-fit=cover','Xem bản Desktop','Xem bản Mobile')&&has(files.boot,'yhct-viewport-mode-v1','width=1280,viewport-fit=cover')],
    ['news edit/delete/pin RPC',has(files.admin,'tcm_news_admin_update_v1','tcm_news_admin_delete_v1','tcm_news_admin_set_pinned_v1')],
    ['diagnostic terminal',has(files.admin,"fetch('/api/ai/diagnostics'",'diagnostic-output')],
    ['leadership fixed block',has(files.community,'Ban chủ nhiệm','Cố định · 3 thành viên')&&not(files.community,'leadershipPage')]
  ]],
  ['SUPER_MOD',[
    ['hierarchy super_mod > mod',has(files.types,'super_mod:3','mod:2')],
    ['post verification',has(files.feed,'set_post_mod_verified')&&has(files.post,'Gỡ xác minh','Xác minh')],
    ['news moderation',has(files.moderation,'tcm_news_review_v1','tcm_news_admin_list_v1')],
    ['limited moderation logs',has(files.moderation,'moderation_recent_logs_v1')],
    ['DRL overview',has(files.moderation,'drl_semester_list_v1')],
    ['management auto rotation',has(files.community,'managementPage','ROTATE_MS=8000','Tự động chuyển · 3 thành viên/lượt')]
  ]],
  ['MOD',[
    ['Excel worker upload',has(files.drl,'.xlsx','.xls','.csv','drlParseWorker','drl_admin_import_v1','SHA-256')],
    ['HIU DRL template auto-detect',has(files.worker,'header:1','diem_de_xuat_drl','hiu_drl_proposal','suggested_semester_code','duplicateStudentCodes')&&has(files.drl,'matchDetectedSemester','drl_admin_upsert_semester_v1','Đã nhận mẫu đề nghị ĐRL HIU')],
    ['post edit permission',has(files.post,"roleAtLeast(member.role,'mod')",'onEdit(post)')],
    ['Word summary import',has(files.feed,'DocxImportPanel')&&has(files.docx,'docx')],
    ['Mini AI present',has(files.app,'PersonalCopilotWidget member={member}')&&has(files.mini,'visualViewport')],
    ['management source restricted to mod',has(files.sql,"role='mod'","status='approved'")]
  ]],
  ['USER',[
    ['2-item auto news rotator',has(files.news,'PAGE_SIZE=2','ROTATE_MS=8000','visibleItems','tcm_news_feed_v1')&&not(files.news,'touchmove','scrollLeft','scrollBy(','scrollTo(','onScroll=')],
    ['3-line linked news cards',has(files.css,'-webkit-line-clamp:3')&&has(files.news,'target="_blank"','Đọc nguồn')],
    ['public community sidebar',has(files.community,"supabase.rpc('community_sidebar_v1')",'PAGE_SIZE=3','ACTIVE_LIMIT=10')&&not(files.community,'student_code','email','phone')],
    ['active members ranked by points',has(files.sql,"role='member'",'sum(st.points)','limit 10','total_points')],
    ['desktop three-zone layout',has(files.desktop,'grid-template-areas:"news side" "main side"','grid-area:news','grid-area:main','grid-area:side')&&not(files.desktop,'data-viewport-mode="mobile"')],
    ['locked mobile layout preserved',has(files.css,'--mobile-module-gap','clamp(34px,10vw,40px)','.auth-brand-mark')&&has(files.viewport,'localStorage.setItem(VIEWPORT_MODE_KEY','dataset.viewportMode')],
    ['Kho YHCT Drive link',has(files.mini,'Kho YHCT','Google Drive')],
    ['public DRL lookup',has(files.drl,'drl_public_search_v1','Tra cứu công khai')]
  ]]
];
let failed=0;
for(const [role,items] of checks){const bad=items.filter(([,ok])=>!ok);if(bad.length){failed++;console.error(`role-audit ${role} FAIL: ${bad.map(([name])=>name).join('; ')}`)}else console.log(`role-audit ${role} PASS: ${items.map(([name])=>name).join('; ')}`)}
if(failed)process.exit(1);
console.log('role-audit-ok: ADMIN, SUPER_MOD, MOD and USER independent source/permission/layout contract gates passed');
