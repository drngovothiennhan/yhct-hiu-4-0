import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),read=f=>fs.readFileSync(path.join(root,f),'utf8');let failed=false;
const ok=m=>console.log(`V16 PASS ${m}`),fail=m=>{failed=true;console.error(`V16 FAIL ${m}`)},has=(t,n,m)=>t.includes(n)?ok(m):fail(`${m} (missing ${n})`),no=(t,n,m)=>!t.includes(n)?ok(m):fail(`${m} (forbidden ${n})`);
const sql=read('supabase/migrations/202609101645_hiu_y_quan_v16_character_content.sql');
const css=read('src/yquan-v16-character-content.css');
const svg=read('public/assets/hiu-y-quan/characters/hiu-y-quan-v16-characters.svg');
const main=read('src/main.tsx');
const core=read('src/components/game/HiuYQuanGame.tsx');

has(svg,'viewBox="0 0 2304 270"','local lightweight character atlas exists');
for(const slot of ['doctor male classic','doctor female classic','doctor male academy','doctor female academy','doctor male master','doctor female master','male child','male adult','male senior','female child','female adult','female senior'])has(svg,`<!-- ${slot} -->`,`sprite slot ${slot} exists`);
if(Buffer.byteLength(svg,'utf8')<50000)ok(`character atlas is lightweight (${Buffer.byteLength(svg,'utf8')} bytes)`);else fail('character atlas exceeds 50 KB vector budget');
no(css,'http://','V16 character CSS has no HTTP CDN');no(css,'https://','V16 character CSS has no HTTPS CDN');
has(css,"url('/assets/hiu-y-quan/characters/hiu-y-quan-v16-characters.svg')",'game uses local generated character atlas');
has(css,'.hyq-doctor--male.hyq-outfit--classic','male doctor classic is mapped');has(css,'.hyq-doctor--female.hyq-outfit--master','female doctor master is mapped');
for(const gender of ['male','female'])for(const band of ['child','adult','senior'])has(css,`.hyq-patient--${gender}.hyq-patient--${band}`,`${gender} ${band} patient sprite is mapped`);
has(css,'.hyq-bed-patient','treatment bed reuses new patient art');

has(css,'.hyq-record-book-v14','record book has V16 override');has(css,'max-height:600px!important','record book outer height is bounded');has(css,'height:460px!important','desktop record workspace is bounded');has(css,'overflow:auto!important','record content scrolls internally');has(css,'overflow-wrap:anywhere','long Vietnamese labels wrap safely');has(css,'min-width:0','grid/flex children can shrink');
no(css,'100vh','V16 avoids viewport-height stretching');no(css,'100dvh','V16 avoids dynamic viewport-height stretching');has(css,'html[data-desktop-on-phone="true"]','desktop-on-phone guard exists');has(css,'@media(prefers-reduced-motion:reduce)','reduced-motion guard exists');

has(sql,"g.source_code='QD4664-2014'",'pharmacy reuses official QD4664 catalog');has(sql,'limit 12','pharmacy loads a bounded 12-card random view');has(sql,'order by random()','pharmacy rotation is randomized on refresh');has(sql,'private.hiu_y_quan_learning_herbs_v16','V15 detailed herb challenge is isolated from rotating pharmacy');
has(sql,"''::text","missing nature/flavor and meridian values are left blank rather than fabricated");no(sql,"g.dosage",'game pharmacy does not expose dosage');no(sql,"g.caution",'game pharmacy does not expose cautions as pseudo-treatment');
has(sql,"if n<>50 then raise exception",'migration enforces exactly 50 syndrome patterns');has(sql,"source_code=excluded.source_code",'new syndrome provenance is stored privately');has(sql,"'QD3991-2025'",'new clinical patterns carry MOH QD3991 provenance');
const newPatternRows=(sql.match(/'QD3991-2025','Tập II/g)||[]).length;if(newPatternRows===30)ok('exactly 30 Ministry-backed pattern rows are added to the 20 legacy rows');else fail(`expected 30 new pattern rows, found ${newPatternRows}`);
has(sql,'syndrome_count integer','case generation reads dynamic catalog count');has(sql,'seed%syndrome_count','hourly cases sample the full 50-pattern catalog');no(sql,'seed%20','V16 migration contains no hard-coded 20-pattern sampler');
has(sql,'create or replace function public.hiu_y_quan_busy_shift_v15()','busy shift is upgraded compatibly');
has(sql,'create or replace function public.hiu_y_quan_hourly_cases_v3()','V14 case API is upgraded in place without a new frontend API');

has(core,"c.archived_at is null",'active-screen lifecycle remains separate from archived records');has(core,'hiu_y_quan_records_v14','record book persistence remains wired');
has(main,"import './yquan-v16-character-content.css'",'V16 CSS is loaded');if(main.indexOf("import './yquan-v16-character-content.css'")>main.indexOf("import './yquan-v15-engagement.css'"))ok('V16 overrides load after V15');else fail('V16 stylesheet must load after V15');
const routeCount=dir=>fs.readdirSync(dir,{withFileTypes:true}).reduce((n,e)=>e.isDirectory()?n+(e.name.startsWith('_')?0:routeCount(path.join(dir,e.name))):n+(/\.(?:js|ts)$/.test(e.name)?1:0),0);const apiRoutes=routeCount(path.join(root,'api'));if(apiRoutes<=12)ok(`Vercel Hobby function budget preserved (${apiRoutes}/12)`);else fail(`Vercel Hobby function budget exceeded (${apiRoutes}/12)`);
if(failed)process.exit(1);console.log('V16 HIU Y Quan character/content contract passed.');
