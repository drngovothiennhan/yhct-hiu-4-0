import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const need=(ok,msg)=>{if(!ok){console.error(`FAIL: ${msg}`);process.exitCode=1}else console.log(`OK: ${msg}`)};
const facade=read('src/components/game/HerbGardenGame.tsx');
const game=read('src/components/game/HerbGardenGameV7.tsx');
const waterMigration=read('supabase/migrations/202609091550_unify_herb_garden_water_cycle_v5.sql');
const fertilizerAliasMigration=read('supabase/migrations/202609091615_unify_fertilizer_and_member_year_alias.sql');
const viewport=read('src/viewport-native-hotfix.css');

need(
  facade.includes("import HerbGardenGameV7 from './HerbGardenGameV7'")&&
  facade.includes('<HerbGardenGameV7 member={member}/>')&&
  facade.includes('garden-world-viewport')&&
  facade.includes('HiuYQuanGame'),
  'stable garden facade wraps v7 care engine inside v8 world/game hub'
);
need(!game.includes('2 giờ đầu'),'garden UI no longer exposes the legacy two-hour watering rule');
need(game.includes('1 lần mỗi lượt 6 giờ')&&game.includes('12 lượt tưới'),'garden UI exposes one canonical 6-hour watering rule');
need(game.includes('busy||!selected.can_water'),'water control follows the authoritative can_water state');
need(game.includes('selected.required_water_count'),'water progress uses server-required count instead of a duplicated hardcoded denominator');
need(waterMigration.includes("'one-per-6h-slot'")&&waterMigration.includes('missed_between'),'server migration defines one 6-hour rule and streak reset on skipped slots');
need(!waterMigration.includes("interval '2 hours'"),'server migration contains no separate two-hour reward window');
need(waterMigration.includes('herb_garden_reward_care_v1(mid,pid,true)'),'each accepted watering uses the same validity result for care rewards');

need(!game.includes('8 giờ đầu'),'garden UI no longer exposes the legacy eight-hour fertilizer reward window');
need(game.includes('1 lần mỗi ngày sinh trưởng')&&game.includes('3 ngày bón phân'),'garden UI exposes one canonical daily fertilizer rule');
need(game.includes('selected.required_fertilizer_count'),'fertilizer progress uses server-required count');
need(fertilizerAliasMigration.includes("'one-per-growth-day'")&&fertilizerAliasMigration.includes('missed_days_before'),'server migration defines one fertilizer rule and streak reset on skipped days');
need(!fertilizerAliasMigration.includes("interval '8 hours'"),'server migration contains no separate eight-hour fertilizer reward window');
need(fertilizerAliasMigration.includes('herb_garden_reward_care_v1(mid,pid,true)'),'each accepted fertilizing action uses the same validity result for care rewards');

for(const pair of [["'21' then 'Y6'",'21->Y6'],["'22' then 'Y5'",'22->Y5'],["'23' then 'Y4'",'23->Y4'],["'24' then 'Y3'",'24->Y3'],["'25' then 'Y2'",'25->Y2'],["'26' then 'Y1'",'26->Y1']])need(fertilizerAliasMigration.includes(pair[0]),`member alias mapping ${pair[1]} is enforced`);
need(fertilizerAliasMigration.includes("' · #'||suffix"),'member aliases retain a short MSSV suffix for differentiation');
need(fertilizerAliasMigration.includes('club_members_sync_cohort_alias_v1'),'future imported/edited members receive the same cohort alias rule');

need(viewport.includes('Compact hashtag rail')&&viewport.includes('flex-wrap:nowrap!important')&&viewport.includes('height:30px!important'),'feed hashtag filters are compact and constrained to one horizontal row');
need(viewport.includes('Mobile top title must remain complete')&&viewport.includes('-webkit-line-clamp:2')&&viewport.includes('font-size:clamp(14px,4.1vw,18px)'),'mobile top title can fit complete module names without clipping');

if(process.exitCode)process.exit(process.exitCode);
console.log('Garden care + member alias + compact mobile/feed UI contract passed.');