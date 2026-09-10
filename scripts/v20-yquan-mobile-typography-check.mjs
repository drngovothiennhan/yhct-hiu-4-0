import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const main=read('src/main.tsx');
const css=read('src/yquan-v20-mobile-typography.css');
const world=read('src/components/game/yquan-v20/V20World.tsx');
const sprites=read('src/components/game/yquan-v20/ActorSprites.tsx');

const failures=[];
const check=(ok,message)=>{if(!ok)failures.push(message)};

check(main.includes("import './yquan-v20-mobile-typography.css'"),'mobile typography layer must be imported');
check(main.indexOf("yquan-v20-mobile-typography.css")<main.indexOf("yquan-v20-unified.css"),'canonical unified CSS must remain last');
check(css.includes('.hyq-v20-host .hyq-v15-tabs>button'),'engagement buttons need scoped anti-card sizing');
check(css.includes('min-height:52px!important')&&css.includes('max-height:66px!important'),'engagement buttons need bounded height');
check(css.includes('grid-auto-flow:column!important')&&css.includes('overflow-x:auto!important'),'mobile engagement navigation must stay one compact scroll row');
check(css.includes('.hyq-v20-host .hyq-v20-patient-title b'),'patient heading typography must be scoped');
check(css.includes('.hyq-v20-host .hyq-v20-four-exams p'),'four-exam body typography must be scoped');
check(css.includes('overflow-wrap:anywhere!important'),'long Vietnamese/case text must wrap safely');
check(css.includes('.hyq-v20-host .hyq-v20-bed .bed-occupant::before'),'secondary ward occupant must no longer be a floating-head placeholder');
check(world.includes("import {DoctorSprite,PatientSprite} from './ActorSprites'"),'V20 world must use canonical patient sprite module');
check(world.includes('<PatientSprite'),'active patient must use canonical PatientSprite');
check(sprites.includes('export function PatientSprite'),'latest canonical PatientSprite must remain exported');
check(sprites.includes('PatientMouthRig'),'latest patient mouth rig must remain part of canonical sprite');

if(failures.length){
  console.error('HIU Y Quan V20 mobile typography/patient visual gate FAILED');
  failures.forEach(item=>console.error(`- ${item}`));
  process.exit(1);
}
console.log('HIU Y Quan V20 mobile typography/patient visual gate PASS');
console.log('Compact mobile engagement tabs · bounded Vietnamese typography · V20 patient visual language verified.');
