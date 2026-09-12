import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const fail=message=>{throw new Error(`[Phase 14 UI/UX cutover] ${message}`)};
const need=(text,pattern,message)=>{if(!pattern.test(text))fail(message)};
const forbid=(text,pattern,message)=>{if(pattern.test(text))fail(message)};

const app=read('src/App.tsx');
const canary=read('src/v2/study-os/canary.ts');
const hub=read('src/components/home/StudyHubV2.tsx');
const css=read('src/phase14-uiux-v2.css');

need(canary,/if\(!raw\)return true/,'Study OS V2 must be default-on');
need(canary,/studyos.*legacy/s,'legacy rollback must remain explicit');
need(hub,/MY HIU YHCT · AI STUDY OS/,'Home must expose the production Study OS identity');
forbid(hub,/CANARY/,'canary wording must not ship in production UI');

need(app,/phase14-shell/,'Phase 14 shell class must be active');
need(app,/primary-nav-v2/,'desktop shell must use the reduced primary navigation');
for(const label of ['Trang chủ','Học','AI','Thư viện','Tôi'])need(app,new RegExp(`>${label}<`),`primary navigation missing ${label}`);
need(app,/mobile-bottom-nav--study-os/,'mobile shell must use Study OS navigation');
need(app,/mobile-ai-primary/,'AI must be the primary mobile center action');
need(app,/openAssistant/,'shell must route AI through the canonical assistant launcher');
need(app,/Công cụ khác/,'secondary functions must remain reachable outside primary navigation');
need(app,/Cộng đồng học thuật/,'community must remain reachable as a secondary surface');
need(app,/communityOpen&&<AcademicFeed/,'academic feed must lazy-render only when the secondary community surface is opened');
need(app,/Game YHCT/,'game must remain reachable in secondary tools');
need(app,/Lịch hoạt động/,'schedule must remain reachable in secondary tools');
need(app,/Điểm hoạt động/,'DRL must remain reachable in secondary tools');
need(app,/adminLabel/,'admin/learning management access must remain reachable');
need(app,/AI STUDY OS · PRODUCTION/,'production header must identify the new shell');
forbid(app,/Khám phá<|Đăng bài<\/span><\/button><button className=\{tab==='notifications'/,'old social-first bottom navigation must not remain the primary shell');

need(css,/\.phase14-shell/,'Phase 14 styles must be namespace-scoped');
need(css,/mobile-bottom-nav--study-os/,'mobile navigation styles must be present');
need(css,/home-community-secondary/,'secondary community surface styles must be present');

console.log('Phase 14 UI/UX production cutover contract: PASS');
