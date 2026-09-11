import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const root=process.cwd();
const sourceDir=path.join(root,'src/components/game/yquan-v20');
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'hiu-yquan-v20-'));
const runtimeFiles=['types.ts','sceneGraph.ts','PathSystem.ts','AnimationController.ts','CharacterActor.ts','GameEventBus.ts','YQuanStoryController.ts'];

const assert=(ok,message)=>{if(!ok)throw new Error(`V20 runtime assertion failed: ${message}`)};
const normalizeImports=code=>code.replace(/from\s+(['"])(\.\/.+?)(?<!\.js)\1/g,(_,quote,specifier)=>`from ${quote}${specifier}.js${quote}`);

try{
  for(const file of runtimeFiles){
    const source=fs.readFileSync(path.join(sourceDir,file),'utf8');
    const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,strict:true,esModuleInterop:true}});
    fs.writeFileSync(path.join(tempDir,file.replace(/\.ts$/,'.js')),normalizeImports(result.outputText),'utf8');
  }

  const memory=new Map();
  globalThis.localStorage={
    getItem:key=>memory.has(String(key))?memory.get(String(key)):null,
    setItem:(key,value)=>memory.set(String(key),String(value)),
    removeItem:key=>memory.delete(String(key)),
    clear:()=>memory.clear(),
    key:index=>[...memory.keys()][index]??null,
    get length(){return memory.size}
  };

  const [{YQuanStoryController},{GameEventBus},{BED_DOCTOR_WAYPOINTS}]=await Promise.all([
    import(pathToFileURL(path.join(tempDir,'YQuanStoryController.js')).href),
    import(pathToFileURL(path.join(tempDir,'GameEventBus.js')).href),
    import(pathToFileURL(path.join(tempDir,'sceneGraph.js')).href)
  ]);

  const bus=new GameEventBus();
  const seen=[];
  const watched=['PATIENT_ARRIVED','PATIENT_READY_FOR_EXAM','EXAM_STARTED','INSPECTION_COMPLETED','LISTENING_COMPLETED','INQUIRY_COMPLETED','PALPATION_COMPLETED','DIAGNOSIS_SUBMITTED','DIAGNOSIS_CORRECT','DIAGNOSIS_INCORRECT','PRESCRIPTION_CREATED','MEDICINE_PREPARATION_STARTED','MEDICINE_READY','INPATIENT_REQUIRED','BED_ASSIGNED','TREATMENT_STARTED','TREATMENT_COMPLETED','PATIENT_DISCHARGED','FOLLOWUP_REQUIRED','ACTOR_ARRIVED','ANIMATION_COMPLETED'];
  watched.forEach(event=>bus.on(event,payload=>seen.push({event,payload})));

  const controller=new YQuanStoryController({storageKey:'v20-runtime-playthrough',bus});
  const advanceFor=(ms,step=50)=>{for(let elapsed=0;elapsed<ms;elapsed+=step)controller.update(step)};
  const advanceUntil=(predicate,label,maxMs=120000)=>{
    for(let elapsed=0;elapsed<=maxMs;elapsed+=50){controller.update(50);if(predicate())return elapsed}
    throw new Error(`V20 runtime timeout: ${label}`);
  };
  const hasEvent=name=>seen.some(item=>item.event===name);
  const arrived=(actor,scene,waypoint)=>seen.some(item=>item.event==='ACTOR_ARRIVED'&&item.payload?.actor===actor&&item.payload?.scene===scene&&item.payload?.waypoint===waypoint);
  const animations=(actor,animation)=>seen.filter(item=>item.event==='ANIMATION_COMPLETED'&&item.payload?.actor===actor&&item.payload?.animation===animation).length;
  const separation=()=>Math.hypot(controller.doctor.position.x-controller.patient.position.x,controller.doctor.position.y-controller.patient.position.y);

  const waiting={case_key:'V20-PLAY-001',patient_age:68,patient_gender:'female',patient_variant:2,completed:false,correct:false,care_status:'waiting_diagnosis',bed_slot:null};
  controller.sync([waiting]);
  advanceUntil(()=>controller.snapshot().stage==='WAITING_DIAGNOSIS','Tứ chẩn -> WAITING_DIAGNOSIS');
  assert(controller.doctor.scene==='clinic'&&controller.doctor.waypoint==='C_DESK_DOCTOR','doctor reaches clinic examination desk');
  assert(controller.patient.scene==='clinic'&&controller.patient.waypoint==='C_DESK_PATIENT','patient reaches clinic examination desk');
  ['PATIENT_ARRIVED','PATIENT_READY_FOR_EXAM','EXAM_STARTED','INSPECTION_COMPLETED','LISTENING_COMPLETED','INQUIRY_COMPLETED','PALPATION_COMPLETED'].forEach(event=>assert(hasEvent(event),`${event} emitted during Tứ chẩn`));
  assert(animations('patient','talk')>=3,'patient visibly speaks during initial complaint, listening response and questioning response');
  assert(animations('doctor','talk_patient')===1,'doctor speaks for questioning but does not animate mouth while LISTENING');
  assert(animations('doctor','observe_patient')>=2,'doctor observes and listens with non-speaking animation');

  const diagnosed={...waiting,completed:true,correct:true,care_status:'awaiting_transfer'};
  controller.sync([diagnosed]);
  advanceUntil(()=>controller.snapshot().stage==='WAITING_DISPOSITION','diagnosis -> pharmacy -> WAITING_DISPOSITION');
  assert(controller.doctor.scene==='clinic'&&controller.doctor.waypoint==='C_DESK_DOCTOR','doctor returns from pharmacy to clinic desk');
  ['DIAGNOSIS_SUBMITTED','DIAGNOSIS_CORRECT','PRESCRIPTION_CREATED','MEDICINE_PREPARATION_STARTED','MEDICINE_READY'].forEach(event=>assert(hasEvent(event),`${event} emitted after diagnosis`));
  ['P_CABINET','P_SCALE','P_MORTAR','P_POT','P_PACKAGE'].forEach(waypoint=>assert(arrived('doctor','pharmacy',waypoint),`doctor physically reaches ${waypoint}`));

  const observing={...diagnosed,care_status:'observing',bed_slot:2,treatment_started_at:new Date().toISOString()};
  controller.sync([observing]);
  advanceUntil(()=>controller.snapshot().stage==='IN_TREATMENT','transfer -> bedside exam -> IN_TREATMENT');
  assert(controller.patient.scene==='ward'&&controller.patient.waypoint==='W_BED2','patient reaches BED_02 without scene teleport');
  assert(controller.doctor.scene==='ward'&&controller.doctor.waypoint===BED_DOCTOR_WAYPOINTS[2],'doctor uses dedicated bedside examination waypoint');
  assert(separation()>=220,`doctor/patient bedside spacing stays collision-safe (${Math.round(separation())}px)`);
  assert(arrived('doctor','ward',BED_DOCTOR_WAYPOINTS[2]),'doctor physically reaches dedicated BED_02 examination lane');
  assert(animations('doctor','pulse_check')>=2,'pulse animation exists in clinic and is repeated at bedside');
  assert(animations('doctor','observe_patient')>=3,'bedside observation animation is executed');
  ['INPATIENT_REQUIRED','BED_ASSIGNED','TREATMENT_STARTED'].forEach(event=>assert(hasEvent(event),`${event} emitted for ward transfer`));

  const restoreBus=new GameEventBus();
  const restored=new YQuanStoryController({storageKey:'v20-runtime-playthrough',bus:restoreBus});
  restored.sync([observing]);
  assert(restored.snapshot().stage==='IN_TREATMENT','reload restores IN_TREATMENT stage');
  assert(restored.patient.scene==='ward'&&restored.patient.waypoint==='W_BED2','reload restores patient at BED_02');
  assert(restored.doctor.scene==='ward'&&restored.doctor.waypoint===BED_DOCTOR_WAYPOINTS[2],'reload restores doctor in separated bedside lane');
  assert(Math.hypot(restored.doctor.position.x-restored.patient.position.x,restored.doctor.position.y-restored.patient.position.y)>=220,'reload preserves collision-safe doctor/patient separation');
  restored.dispose();

  const recheck={...observing,care_status:'recheck_due'};
  controller.sync([recheck]);
  advanceFor(30000);
  assert(controller.snapshot().stage==='FOLLOW_UP','observing -> recheck_due transitions directly to FOLLOW_UP');
  assert(controller.patient.scene==='ward'&&controller.patient.waypoint==='W_BED2','follow-up keeps patient at assigned bed');
  assert(controller.doctor.waypoint===BED_DOCTOR_WAYPOINTS[2],'follow-up keeps doctor in bedside examination lane');
  assert(separation()>=220,'follow-up remains collision-safe');
  assert(hasEvent('FOLLOWUP_REQUIRED'),'FOLLOWUP_REQUIRED emitted');

  controller.sync([]);
  advanceUntil(()=>controller.snapshot().stage==='RESTING'&&!controller.patient.visible,'discharge -> RESTING');
  assert(arrived('patient','ward','W_EXIT'),'patient walks to ward exit before discharge');
  assert(hasEvent('TREATMENT_COMPLETED'),'TREATMENT_COMPLETED emitted after ward care');
  assert(hasEvent('PATIENT_DISCHARGED'),'PATIENT_DISCHARGED emitted after exit animation');

  // Reload during movement and tool work, not just at stable end states.
  const resumeAt=(label,setup,predicate)=>{
    const key=`v20-resume-${label}`,originalBus=new GameEventBus();
    const original=new YQuanStoryController({storageKey:key,bus:originalBus});
    setup(original);
    let reached=false;
    for(let i=0;i<2400;i++){original.update(50);if(predicate(original)){reached=true;break}}
    assert(reached,`${label}: interruption point reached`);
    original.dispose();
    const resumedBus=new GameEventBus(),resumed=new YQuanStoryController({storageKey:key,bus:resumedBus});
    resumed.sync([original.currentCase]);
    assert(JSON.stringify(original.doctor.snapshot())===JSON.stringify(resumed.doctor.snapshot()),`${label}: doctor path and animation frame restored`);
    assert(JSON.stringify(original.patient.snapshot())===JSON.stringify(resumed.patient.snapshot()),`${label}: patient path and animation frame restored`);
    const before=[],after=[];
    watched.forEach(event=>{
      originalBus.on(event,payload=>before.push({event,payload}));
      resumedBus.on(event,payload=>after.push({event,payload}));
    });
    for(let i=0;i<2400;i++){
      original.update(50);resumed.update(50);
      assert(JSON.stringify(original.doctor.snapshot())===JSON.stringify(resumed.doctor.snapshot()),`${label}: doctor trajectory after reload at tick ${i}`);
      assert(JSON.stringify(original.patient.snapshot())===JSON.stringify(resumed.patient.snapshot()),`${label}: patient trajectory after reload at tick ${i}`);
    }
    assert(JSON.stringify(before)===JSON.stringify(after),`${label}: remaining events run once in original order`);
    assert(original.snapshot().stage===resumed.snapshot().stage,`${label}: same terminal story stage`);
    original.dispose();resumed.dispose();
  };
  resumeAt('patient-enter',c=>c.sync([waiting]),c=>c.patient.isMoving());
  resumeAt('pulse',c=>c.sync([waiting]),c=>c.doctor.state==='PULSE_CHECK'&&c.doctor.animation.frame>=3);
  resumeAt('pharmacy-walk',c=>c.sync([diagnosed]),c=>c.doctor.scene==='pharmacy'&&c.doctor.isMoving());
  resumeAt('medicine-pot',c=>c.sync([diagnosed]),c=>c.doctor.state==='COOKING_MEDICINE'&&c.doctor.animation.frame>=3);
  for(const bed_slot of [1,2,3]){
    resumeAt(`ward-${bed_slot}`,c=>c.sync([{...observing,bed_slot}]),c=>c.patient.scene==='ward'&&c.patient.isMoving());
  }
  const stale=new YQuanStoryController({storageKey:'v20-stale-server'});
  stale.sync([waiting]);stale.update(50);stale.dispose();
  const newer=new YQuanStoryController({storageKey:'v20-stale-server'});
  newer.sync([observing]);
  for(let i=0;i<2400&&newer.snapshot().stage!=='IN_TREATMENT';i++)newer.update(50);
  assert(newer.patient.waypoint==='W_BED2'&&newer.snapshot().stage==='IN_TREATMENT','server disposition overrides stale locally saved exam');
  newer.dispose();

  const wrongBus=new GameEventBus();
  const wrongSeen=[];
  wrongBus.on('DIAGNOSIS_INCORRECT',payload=>wrongSeen.push(payload));
  const wrong=new YQuanStoryController({storageKey:'v20-runtime-wrong',bus:wrongBus});
  wrong.sync([{...waiting,case_key:'V20-PLAY-002'}]);
  for(let i=0;i<2400&&wrong.snapshot().stage!=='WAITING_DIAGNOSIS';i++)wrong.update(50);
  wrong.sync([{...waiting,case_key:'V20-PLAY-002',completed:true,correct:false,care_status:'awaiting_transfer'}]);
  assert(wrongSeen.length===1,'incorrect diagnosis path emits DIAGNOSIS_INCORRECT exactly once');
  wrong.dispose();
  controller.dispose();

  console.log('V20.1 runtime playthrough PASS: natural question/listen turn-taking -> diagnosis -> pharmacy -> collision-safe BED_02 bedside exam -> restore -> lying follow-up -> discharge.');
}finally{
  fs.rmSync(tempDir,{recursive:true,force:true});
}
