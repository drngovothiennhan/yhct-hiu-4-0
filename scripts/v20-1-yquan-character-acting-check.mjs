import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sprites=read('src/components/game/yquan-v20/ActorSprites.tsx');
const graph=read('src/components/game/yquan-v20/sceneGraph.ts');
const story=read('src/components/game/yquan-v20/YQuanStoryController.ts');
const world=read('src/components/game/yquan-v20/V20World.tsx');
const css=read('src/yquan-v20-1-character-acting.css');
const gardenHub=read('src/components/game/HerbGardenGame.tsx');

const checks=[];
const check=(label,ok)=>checks.push({label,ok:Boolean(ok)});
const count=(text,needle)=>text.split(needle).length-1;

check('doctor mouth rig exists',sprites.includes('doctor-mouth-rig'));
check('patient mouth rig exists',sprites.includes('patient-mouth-rig'));
for(const pose of ['mouth-closed','mouth-small','mouth-wide','mouth-o'])check(`mouth pose ${pose} exists for both actors`,count(sprites,pose)>=2);
check('open mouth includes visible teeth detail',count(sprites,'#fff8ed')+count(sprites,'#fff7eb')>=4);
check('open mouth includes tongue detail',sprites.includes('#e88484')&&sprites.includes('#df7b7d'));
check('mouth animation uses closed pose timing',css.includes('@keyframes hyq-v201-mouth-closed'));
check('mouth animation uses small-open pose timing',css.includes('@keyframes hyq-v201-mouth-small'));
check('mouth animation uses wide-open pose timing',css.includes('@keyframes hyq-v201-mouth-wide'));
check('mouth animation uses O pose timing',css.includes('@keyframes hyq-v201-mouth-o'));
check('speech includes jaw motion',css.includes('@keyframes hyq-v201-jaw-bob'));
check('doctor greeting drives mouth rig',css.includes('[data-animation="greet"] .doctor-mouth-rig'));
check('doctor questioning drives mouth rig',css.includes('[data-animation="talk_patient"] .doctor-mouth-rig'));
check('patient talking drives mouth rig',css.includes('[data-animation="talk"] .patient-mouth-rig'));
check('LISTENING hard-stops doctor mouth motion',css.includes('[data-state="LISTENING"] .doctor-mouth-rig .mouth-pose')&&story.includes("LISTENING:'observe_patient'"));
check('listening sequence lets patient speak instead',story.includes("state:'LISTENING',animation:'observe_patient'")&&count(story,"state:'CONSULTING',animation:'talk'")>=3);
check('three dedicated doctor bedside waypoints exist',['W_BED1_DOCTOR','W_BED2_DOCTOR','W_BED3_DOCTOR'].every(x=>graph.includes(x)));
check('bedside doctor waypoint map is exported',graph.includes('export const BED_DOCTOR_WAYPOINTS'));
check('ward flow routes doctor separately from patient',story.includes('doctorPoint=BED_DOCTOR_WAYPOINTS[slot]')&&story.includes('patientPoint=BED_WAYPOINTS[slot]'));
check('ward exam performs visual observation',story.includes("state:'CHECKING_BED',animation:'observe_patient'"));
check('ward exam performs pulse examination',story.includes("state:'CHECKING_BED',animation:'pulse_check'"));
check('ward exam includes doctor-patient communication',story.includes("state:'CARING_PATIENT',animation:'talk_patient'"));
check('old persisted overlap is repaired',story.includes('repairLegacyWardOverlap')&&story.includes('separation<220'));
check('lying patient remains lying while speaking in follow-up',css.includes('[data-state="FOLLOW_UP"][data-animation="talk"] .hyq-v20-patient-svg'));
check('active patient avoids duplicate generic bed occupant',world.includes('item&&!active')&&world.includes("data-active={active?'true':'false'}"));
check('active bed styling suppresses placeholder occupant',css.includes('.hyq-v20-bed[data-active="true"] .bed-occupant{display:none}'));
const engineImport="import '../../yquan-v20-game-engine.css'";
const actingImport="import '../../yquan-v20-1-character-acting.css'";
check('V20.1 acting CSS is owned by lazy Garden/Y Quan hub',gardenHub.includes(actingImport));
check('V20.1 CSS is loaded after V20 CSS',gardenHub.includes(engineImport)&&gardenHub.indexOf(actingImport)>gardenHub.indexOf(engineImport));
check('reduced-motion fallback keeps a stable closed mouth',css.includes('@media(prefers-reduced-motion:reduce)')&&css.includes('mouth-closed'));
check('acting layer avoids viewport-height hacks',!/(?:^|[;:{\s])(?:min-|max-)?height\s*:\s*\d+(?:d?vh|svh|lvh)/i.test(css));

const failed=checks.filter(item=>!item.ok);
for(const item of checks)console.log(`${item.ok?'PASS':'FAIL'} ${item.label}`);
if(failed.length){
  console.error(`V20.1 character acting gate failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`V20.1 CHARACTER ACTING GATE PASS: ${checks.length}/${checks.length} checks.`);