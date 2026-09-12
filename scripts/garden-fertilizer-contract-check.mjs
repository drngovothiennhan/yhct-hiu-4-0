import fs from 'node:fs';

// CI contract v8: the stable v7 care engine remains authoritative while the
// public facade adds the draggable Garden V8 world and HIU - Y - Quan hub.
const read=(path)=>fs.readFileSync(path,'utf8');
const migrationPath='supabase/migrations/202609091930_garden_care_engine_v7_and_constraint_repair.sql';
const migration=read(migrationPath);
const facade=read('src/components/game/HerbGardenGame.tsx');
const game=read('src/components/game/HerbGardenGameV7.tsx');

const checks=[
  ['canonical care engine exists',migration.includes('private.herb_garden_apply_care_v7')],
  ['fertilizer v4 structured RPC exists',migration.includes('public.herb_garden_fertilize_v4')&&migration.includes("'fertilize',false")],
  ['fertilizer v3 delegates to care engine',/herb_garden_fertilize_v3[\s\S]*herb_garden_apply_care_v7\(mid,mid,p_slot_no,'fertilize',false\)/.test(migration)],
  ['social helper delegates to same care engine',/herb_garden_help_v2[\s\S]*herb_garden_apply_care_v7\(p_owner_id,helper,p_slot_no,p_kind,true\)/.test(migration)],
  ['legacy social helper delegates to v2',/herb_garden_help_v1[\s\S]*herb_garden_help_v2\(p_owner_id,target_slot,p_kind\)/.test(migration)],
  ['event constraint permits fertilizer assistance',migration.includes("'assist_fertilize'::text")],
  ['event constraint permits care rewards',migration.includes("'care_reward'::text")],
  ['notification constraint permits garden help',migration.includes("'garden_help'::text")],
  ['reward events are keyed by achieved streak',/care_reward',new_streak/.test(migration)],
  ['garden v8 facade retains v7 engine',
    facade.includes("import HerbGardenGameV7 from './HerbGardenGameV7'")&&
    facade.includes('<HerbGardenGameV7 member={member}/>')&&
    facade.includes('garden-world-viewport')&&
    facade.includes('HiuYQuanGame')],
  ['UI uses structured fertilizer v4',game.includes("fertilize:'herb_garden_fertilize_v4'")],
  ['UI presents one 72-hour care timeline',game.includes('Lịch chăm 72 giờ')&&game.includes('Chăm chung cùng tiến độ')],
  ['UI shows twelve water and three fertilizer markers',game.includes('total={12}')&&game.includes('total={3}')],
  ['professional game stylesheet is loaded by lazy Garden facade',facade.includes("import '../../garden-professional-v7.css';")],
];

const failed=checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'}  ${name}`);
if(failed.length){console.error(`Garden fertilizer contract failed: ${failed.length} check(s)`);process.exit(1)}
console.log('PASS  Gia Vien fertilizer/gameplay has one authoritative care engine inside Garden V8.');
