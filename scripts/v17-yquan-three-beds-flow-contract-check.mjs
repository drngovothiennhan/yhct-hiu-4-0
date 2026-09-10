import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
let failed=false;
const ok=msg=>console.log(`V17 PASS ${msg}`);
const fail=msg=>{failed=true;console.error(`V17 FAIL ${msg}`)};
const has=(text,needle,msg)=>text.includes(needle)?ok(msg):fail(`${msg} (missing ${needle})`);
const no=(text,needle,msg)=>!text.includes(needle)?ok(msg):fail(`${msg} (forbidden ${needle})`);

const sql=read('supabase/migrations/202609101730_hiu_y_quan_three_beds_flow_v17.sql');
const core=read('src/components/game/HiuYQuanGame.tsx');
const css=read('src/yquan-v17-three-beds-flow.css');
const main=read('src/main.tsx');

has(sql,'add column if not exists bed_slot smallint','bed slot is persisted');
has(sql,'bed_slot between 1 and 3','bed slot is constrained to exactly three positions');
has(sql,'hiu_y_quan_active_bed_slot_uniq','active bed allocation has a uniqueness guard');
has(sql,"create or replace function public.hiu_y_quan_disposition_v17(p_case_key text,p_action text)",'doctor disposition RPC exists');
has(sql,'pg_advisory_xact_lock','bed allocation is transaction-serialized per member');
has(sql,'generate_series(1,3)','allocator scans exactly three beds');
has(sql,'Cả 3 giường Dưỡng Trị đang có bệnh nhân','full ward is rejected server-side');
has(sql,"action='discharge'",'doctor can choose direct discharge after diagnosis');
has(sql,"action='observe'",'doctor can choose observation bed after diagnosis');
has(sql,"create or replace function public.hiu_y_quan_hourly_cases_v4()",'V17 case RPC exists without replacing rollback V3');
has(sql,"c.care_status in ('awaiting_transfer','observing','recheck_due')",'new intake is paused while disposition or ward care remains');
has(sql,'c.recheck_count,c.bed_slot','case payload exposes assigned bed');
has(sql,'syndrome_count integer','V17 keeps dynamic syndrome pool sizing');
has(sql,'seed%syndrome_count','V17 keeps full dynamic syndrome sampling');
no(sql,'seed%20','V17 does not regress to the old 20-pattern sampler');
has(sql,"create or replace function public.hiu_y_quan_busy_shift_v15()",'busy shift is overridden compatibly');
has(sql,"Tạm dừng nhận ca: còn bệnh nhân tại Dưỡng Trị",'busy shift obeys ward intake pause');
has(sql,"set care_status='discharged',bed_slot=null",'recheck discharge releases the bed atomically');
has(sql,"then 'Bác sĩ chọn cho về sau chẩn thể",'records distinguish direct doctor discharge');
has(sql,'revoke all on function public.hiu_y_quan_disposition_v17(text,text) from public,anon','new disposition RPC is not anonymous');
has(sql,'grant execute on function public.hiu_y_quan_disposition_v17(text,text) to authenticated','new disposition RPC is authenticated-only');

has(core,'const bedSlots=[1,2,3] as const','frontend declares exactly three bed slots');
has(core,'function WardBed(','ward renders an independent reusable bed component');
has(core,'hyq-bed-bank-v17','ward uses the three-bed visual bank');
has(core,"supabase.rpc('hiu_y_quan_hourly_cases_v4')",'frontend prefers V17 case RPC');
if(core.indexOf("hiu_y_quan_hourly_cases_v4")<core.indexOf("hiu_y_quan_hourly_cases_v3"))ok('V17 case RPC falls back to V3 only after V4');else fail('V17 case RPC fallback order is wrong');
has(core,"supabase.rpc('hiu_y_quan_disposition_v17',{p_case_key:current.case_key,p_action:'observe'})",'transfer-to-bed action is wired');
has(core,"supabase.rpc('hiu_y_quan_disposition_v17',{p_case_key:current.case_key,p_action:'discharge'})",'send-home action is wired');
has(core,"wardCases.length>=3",'frontend blocks additional waiting intake when all beds are full');
has(core,"current?.care_status==='awaiting_transfer'",'frontend requires disposition before opening another waiting case');
has(core,'hyq-recheck-alert-v17','prominent recheck reminder is wired');
has(core,'role="alert" aria-live="assertive"','recheck reminder is announced accessibly');
has(core,"intakePaused=wardCases.length>0||transferCount>0",'HUD exposes intake pause state');
has(core,'Cho về · lưu hồ sơ','doctor sees explicit discharge action');
has(core,'Chuyển vào giường','doctor sees explicit observation action');

has(css,'.hyq-bed-bank-v17','three-bed CSS exists');
has(css,'grid-template-rows:repeat(3,minmax(0,1fr))','ward layout has exactly three separate bed rows');
has(css,'.hyq-recheck-alert-v17','recheck reminder has dedicated visual treatment');
has(css,'.hyq-disposition-actions-v17','post-diagnosis decision UI is bounded');
has(css,'.hyq-page--v17 .hyq-lab-shelf button','lab shelf typography is explicitly controlled');
has(css,'text-overflow:ellipsis!important','crowded world labels use bounded ellipsis where appropriate');
has(css,'overflow-wrap:anywhere!important','long Vietnamese text wraps inside UI bounds');
has(css,'min-width:0','flex/grid text children can shrink');
has(css,'html[data-desktop-on-phone="true"]','desktop-on-phone layout has an explicit guard');
has(css,'@media(prefers-reduced-motion:reduce)','reduced-motion behavior is preserved');
no(css,'100vh','V17 avoids viewport-height stretching');
no(css,'100dvh','V17 avoids dynamic viewport-height stretching');

has(main,"import './yquan-v17-three-beds-flow.css'",'V17 stylesheet is loaded');
if(main.indexOf("import './yquan-v17-three-beds-flow.css'")>main.indexOf("import './yquan-v16-character-content.css'"))ok('V17 overrides load after V16');else fail('V17 stylesheet must load after V16');

const routeCount=dir=>fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>e.isDirectory()?n+(e.name.startsWith('_')?0:routeCount(path.join(dir,e.name))):n+(/\.(?:js|ts)$/.test(e.name)?1:0),0);
const apiRoutes=routeCount(path.join(root,'api'));
if(apiRoutes<=12)ok(`Vercel Hobby function budget preserved (${apiRoutes}/12)`);else fail(`Vercel Hobby function budget exceeded (${apiRoutes}/12)`);

if(failed)process.exit(1);
console.log('V17 HIU Y Quan three-bed flow contract passed.');
