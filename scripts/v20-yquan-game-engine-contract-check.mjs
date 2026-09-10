import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const types=read('src/components/game/yquan-v20/types.ts');
const bus=read('src/components/game/yquan-v20/GameEventBus.ts');
const graph=read('src/components/game/yquan-v20/sceneGraph.ts');
const pathing=read('src/components/game/yquan-v20/PathSystem.ts');
const animation=read('src/components/game/yquan-v20/AnimationController.ts');
const actor=read('src/components/game/yquan-v20/CharacterActor.ts');
const story=read('src/components/game/yquan-v20/YQuanStoryController.ts');
const adapter=read('src/components/game/yquan-v20/LegacyRuleAdapter.ts');
const world=read('src/components/game/yquan-v20/V20World.tsx');
const sprites=read('src/components/game/yquan-v20/ActorSprites.tsx');
const bootstrap=read('src/components/game/yquan-v20/bootstrap.tsx');
const css=read('src/yquan-v20-game-engine.css');
const main=read('src/main.tsx');
const legacy=read('src/components/game/HiuYQuanGame.tsx');

const groups=[];
const group=(name,points,checks)=>{const failed=checks.filter(([,ok])=>!ok).map(([label])=>label);groups.push({name,points,earned:failed.length?0:points,failed})};
const has=(text,needle)=>text.includes(needle);

const doctorStates=['IDLE','WALKING','WAITING_PATIENT','GREETING','OBSERVING','LISTENING','QUESTIONING','PULSE_CHECK','WRITING','THINKING','DIAGNOSING','PRESCRIBING','WALK_TO_PHARMACY','SELECTING_HERBS','WEIGHING_HERBS','GRINDING_HERBS','COOKING_MEDICINE','PACKING_MEDICINE','WALK_TO_WARD','CHECKING_BED','CARING_PATIENT','RETURNING','RESTING'];
const patientStates=['SPAWNING','ENTERING_CLINIC','WAITING','WALKING_TO_DESK','SITTING','CONSULTING','BEING_EXAMINED','WAITING_DIAGNOSIS','WAITING_MEDICINE','WALKING_TO_WARD','IN_TREATMENT','RECOVERING','FOLLOW_UP','LEAVING','COMPLETED'];
const events=['PATIENT_ARRIVED','PATIENT_READY_FOR_EXAM','EXAM_STARTED','INSPECTION_COMPLETED','LISTENING_COMPLETED','INQUIRY_COMPLETED','PALPATION_COMPLETED','DIAGNOSIS_SUBMITTED','DIAGNOSIS_CORRECT','DIAGNOSIS_INCORRECT','PRESCRIPTION_CREATED','MEDICINE_PREPARATION_STARTED','MEDICINE_READY','INPATIENT_REQUIRED','BED_ASSIGNED','TREATMENT_STARTED','TREATMENT_COMPLETED','PATIENT_DISCHARGED','FOLLOWUP_REQUIRED','ANIMATION_COMPLETED','ACTOR_ARRIVED'];
const doctorAnimations=['idle','blink','look_left','look_right','walk_front','walk_back','walk_left','walk_right','greet','sit','stand','observe_patient','pulse_check','write_record','think','open_drawer','take_herb','weigh_herb','grind_herb','mix_herb','cook_medicine','package_medicine','check_bed','talk_patient'];
const patientAnimations=['idle','walk','sit','talk','pain','being_examined','lying','sleeping','recovering','happy','leave'];

group('State machines',15,[
  ['All DoctorState values',doctorStates.every(x=>has(types,`'${x}'`))],
  ['All PatientState values',patientStates.every(x=>has(types,`'${x}'`))],
  ['Story controller owns actors',has(story,'readonly doctor:CharacterActor<DoctorState>')&&has(story,'readonly patient:CharacterActor<PatientState>')],
  ['No random story animation',!has(story,'Math.random')]
]);

group('Event bus',10,[
  ['Typed GameEventBus exists',has(bus,'class GameEventBus')&&has(bus,'gameEventBus')],
  ['Required events declared',events.every(x=>has(types,x))],
  ['Actors emit arrival/animation completion',has(actor,'onAnimationComplete')&&has(story,"'ACTOR_ARRIVED'")&&has(story,"'ANIMATION_COMPLETED'")]
]);

group('Three real scenes',15,[
  ['ClinicScene definition',has(graph,"id:'clinic',width:1600,height:900")&&has(world,'aria-label="ClinicScene"')],
  ['PharmacyScene definition',has(graph,"id:'pharmacy',width:1600,height:900")&&has(world,'aria-label="PharmacyScene"')],
  ['WardScene definition',has(graph,"id:'ward',width:1600,height:900")&&has(world,'aria-label="WardScene"')],
  ['Interaction points',has(graph,'clinicEntrance')&&has(graph,'pulseDeskDoctorPoint')&&has(graph,'herbCabinet')&&has(graph,'medicineScale')&&has(graph,'medicinePot')],
  ['Exactly three bed interaction ids',['BED_01','BED_02','BED_03'].every(x=>has(graph,x))&&!has(graph,'BED_04')],
  ['Original vector room artwork',has(world,'function ClinicBackdrop')&&has(world,'function PharmacyBackdrop')&&has(world,'function WardBackdrop')]
]);

group('Movement / animation',15,[
  ['Waypoint path calculation',has(pathing,'static calculate')&&has(pathing,'No path')],
  ['Actor requestMove path',has(actor,'requestMove(targetWaypoint:string)')&&has(actor,'this.position.x+dx*ratio')],
  ['RAF game loop',has(world,'requestAnimationFrame(tick)')&&has(world,'controller.update(delta)')],
  ['React not updated per frame',!(/tick\s*=.*setStory/s.test(world))],
  ['All doctor animation clips',doctorAnimations.every(x=>has(animation,`${x}:clip(`)||has(animation,`'${x}'`))],
  ['All patient animation clips',patientAnimations.every(x=>has(animation,`${x}:clip(`)||has(animation,`'${x}'`))],
  ['Identity-stable single doctor model',has(sprites,'function DoctorSprite')&&has(sprites,'head-group')&&has(sprites,'body-group')]
]);

group('Story orchestration',15,[
  ['Exam sequence',has(story,'examSequence()')&&has(story,"state:'PULSE_CHECK'")],
  ['Pharmacy sequence',has(story,'medicineSequence()')&&has(story,"state:'SELECTING_HERBS'")&&has(story,"state:'WEIGHING_HERBS'")&&has(story,"state:'GRINDING_HERBS'")&&has(story,"state:'COOKING_MEDICINE'")&&has(story,"state:'PACKING_MEDICINE'")],
  ['Ward transition sequence',has(story,'wardSequence(item:VisualCase)')&&has(story,'BED_WAYPOINTS[slot]')],
  ['Follow-up sequence',has(story,'followupSequence(item:VisualCase)')],
  ['Deterministic idle patrol',has(story,'enqueueIdlePatrol()')&&!has(story,'Math.random')]
]);

const requiredRpcs=['hiu_y_quan_state_v1','hiu_y_quan_hourly_cases_v4','hiu_y_quan_hourly_cases_v3','hiu_y_quan_hourly_cases_v2','hiu_y_quan_hourly_cases_v1','hiu_y_quan_herbs_v14','hiu_y_quan_records_v14','hiu_y_quan_customize_v1','hiu_y_quan_activate_v1','hiu_y_quan_submit_v1','hiu_y_quan_disposition_v17','hiu_y_quan_start_treatment_v14','hiu_y_quan_recheck_v14','hiu_y_quan_appointment_decide_v2'];
group('Legacy rule preservation',10,[
  ['LegacyRuleAdapter calls all existing RPC contracts',requiredRpcs.every(x=>has(adapter,x))],
  ['Legacy game remains present',has(legacy,"const bedSlots=[1,2,3] as const")&&has(legacy,'hiu_y_quan_submit_v1')&&has(legacy,'hiu_y_quan_disposition_v17')],
  ['V20 visual engine does not replace scoring',!has(world,'wallet_balance')&&!has(story,'credits_awarded')]
]);

group('Persistence / drawers / responsive',10,[
  ['Save restore versioned story state',has(story,'localStorage.setItem')&&has(story,'localStorage.getItem')&&has(types,'version:20')],
  ['Hydration checks case key',has(story,'restored.caseKey===next.case_key')],
  ['MedicineDrawer is independent component',has(world,'function MedicineDrawer')&&has(world,'drawer-label')&&has(world,'drawer-handle')],
  ['Drawer text centered and bounded',has(css,'place-items:center')&&has(css,'overflow:hidden')&&has(css,'.very-compact .drawer-label')],
  ['Mobile uses same 1600x900 world',has(css,'@media(max-width:760px)')&&has(world,'scale=Math.min(box.width/1600,box.height/900)')],
  ['Reduced motion',has(css,'@media(prefers-reduced-motion:reduce)')]
]);

group('Integration',10,[
  ['V20 CSS imported after V19',main.indexOf("yquan-v20-game-engine.css")>main.indexOf("yquan-v19-reference-art-direction.css")],
  ['Bootstrap imported',has(main,"./components/game/yquan-v20/bootstrap")],
  ['Legacy world hidden only after mount',has(css,'data-v20-mounted')&&has(bootstrap,"shell.setAttribute('data-v20-mounted','1')")],
  ['Sync is event-driven plus low-frequency safety refresh',has(bootstrap,"SYNC_REQUESTED")&&has(world,'20000')]
]);

const score=groups.reduce((sum,item)=>sum+item.earned,0);
for(const item of groups){const mark=item.earned===item.points?'PASS':'FAIL';console.log(`${mark} ${item.name}: ${item.earned}/${item.points}`);for(const failure of item.failed)console.log(`  - ${failure}`)}
console.log(`HIU Y Quan V20 technical acceptance score: ${score}/100`);
if(score<100){console.error('V20 REJECTED: all engine contract groups must pass.');process.exit(1)}
console.log('V20 CONTRACT GATE ACCEPTED. Runtime build/playthrough still required before production acceptance.');
