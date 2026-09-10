import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const main=read('src/main.tsx');
const hub=read('src/components/game/HerbGardenGame.tsx');
const game=read('src/components/game/HiuYQuanGameV20.tsx');
const adapter=read('src/components/game/yquan-v20/LegacyRuleAdapter.ts');
const story=read('src/components/game/yquan-v20/YQuanStoryController.ts');
const graph=read('src/components/game/yquan-v20/sceneGraph.ts');
const css=read('src/yquan-v20-unified.css');
const migration=read('supabase/migrations/202609101940_hiu_y_quan_v20_unified_runtime.sql');

const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message)};

check(hub.includes("import HiuYQuanGameV20 from './HiuYQuanGameV20'"),'game hub must import canonical HiuYQuanGameV20');
check(hub.includes("new URLSearchParams(window.location.search).get('game')"),'game hub must restore selected sub-game from URL');
check(hub.includes("url.searchParams.set('game','hiu-y-quan')"),'HIU Y Quan route marker must be persisted');
check(game.includes('<V20World/>'),'canonical game shell must render V20World directly');
check(!main.includes("./components/game/yquan-v20/bootstrap"),'DOM overlay bootstrap must not be loaded by production runtime');

const forbiddenRuntimeImports=[
  'hiu-y-quan-v2.css','yquan-v11-hotfix.css','yquan-v12-three-scene.css','yquan-v13-chibi.css',
  'yquan-v14-clinic-flow.css','yquan-v16-character-content.css','yquan-v17-three-beds-flow.css',
  'yquan-scale-harmony.css','yquan-display-fix.css','yquan-v18-visual-coherence.css',
  'yquan-v18-final-character-scene.css','yquan-v19-reference-art-direction.css'
];
for(const file of forbiddenRuntimeImports)check(!main.includes(file),`legacy runtime stylesheet still loaded: ${file}`);
check(main.includes("./yquan-v20-game-engine.css")&&main.includes("./yquan-v20-1-character-acting.css")&&main.includes("./yquan-v20-unified.css"),'V20 stylesheet stack incomplete');
check(main.indexOf("yquan-v20-unified.css")>main.indexOf("yquan-v20-1-character-acting.css"),'V20 unified stylesheet must load last');

check(game.includes('const bedsFull=wardCases.length>=3'),'ward fullness must be derived from exactly three active ward cases');
check(game.includes("if(action==='observe'&&bedsFull)"),'only observe/transfer action must be guarded by full ward');
check(game.includes("disabled={Boolean(busy)||bedsFull}"),'ward transfer button must disable at 3/3');
check(game.includes("onClick={()=>setActiveKey(item.case_key)}"),'queue cases must remain selectable');
check(!game.includes("disabled={bedsFull} onClick={()=>setActiveKey"),'bed fullness must not disable queue selection');
check(game.includes('Vẫn có thể chọn ca khác để tiếp tục khám'),'UI must explain continued intake/diagnosis when ward is full');

check(css.includes('rotate(-86deg) scale(.61)!important'),'ward patient must lie with head toward the left-side pillow/headboard');
check(css.includes('hyq-v20-steam'),'medicine cooking must have a contextual steam effect');
check(css.includes('hyq-v20-bed-ready'),'recheck-ready bed must have a restrained visual effect');

for(const scene of ["id:'clinic'","id:'pharmacy'","id:'ward'"])check(graph.includes(scene),`missing scene ${scene}`);
for(const bed of ['BED_01','BED_02','BED_03'])check(graph.includes(bed),`missing ward interaction ${bed}`);
check(!graph.includes('BED_04'),'ward must contain exactly three bed interactions');

for(const waypoint of ['P_CABINET','P_SCALE','P_MORTAR','P_POT','P_PACKAGE'])check(story.includes(`waypoint:'${waypoint}'`),`pharmacy story sequence missing ${waypoint}`);
for(const animation of ['open_drawer','take_herb','weigh_herb','grind_herb','mix_herb','cook_medicine','package_medicine'])check(story.includes(`animation:'${animation}'`),`pharmacy animation missing ${animation}`);

check(adapter.includes("hiu_y_quan_hourly_cases_v20"),'adapter must prefer canonical V20 hourly cases RPC');
check(adapter.includes("hiu_y_quan_disposition_v20"),'adapter must prefer canonical V20 disposition RPC');
check(migration.includes('create or replace function public.hiu_y_quan_hourly_cases_v20()'),'migration must expose canonical V20 case RPC');
check(migration.includes('create or replace function public.hiu_y_quan_disposition_v20'),'migration must expose canonical V20 disposition RPC');
check(!migration.includes('intake_paused boolean'),'V20 hourly intake must not be paused by ward occupancy');
check(migration.includes("source_code=excluded.source_code"),'new syndrome content must preserve explicit provenance');
check((migration.match(/'HIU-YQ-CORE-EDU'/g)||[]).length>=10,'expected at least ten new core educational patterns');

if(failures.length){
  console.error(`HIU Y Quan V20 unified contract: FAIL (${failures.length})`);
  failures.forEach(item=>console.error(` - ${item}`));
  process.exit(1);
}
console.log('HIU Y Quan V20 unified contract: PASS');
console.log('Single runtime · refresh persistence · 3-bed transfer-only capacity · pharmacy actor sequence · bedside orientation · effects · DB V20 contracts verified.');
