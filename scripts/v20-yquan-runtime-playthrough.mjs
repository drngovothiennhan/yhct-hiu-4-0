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

  const [{YQuanStoryController},{GameEventBus}]=await Promise.all([
    import(pathToFileURL(path.join(tempDir,'YQuanStoryController.js')).href),
    import(pathToFileURL(path.join(tempDir,'GameEventBus.js')).href)
  ]);

  const bus=new GameEventBus();
  const seen=[];
  const watched=['PATIENT_ARRIVED','PATIENT_READY_FOR_EXAM','EXAM_STARTED','INSPECTION_COMPLETED','LISTENING_COMPLETED','INQUIRY_COMPLETED','PALPATION_COMPLETED','DIAGNOSIS_SUBMITTED','DIAGNOSIS_CORRECT','DIAGNOSIS_INCORRECT','PRESCRIPTION_CREATED','MEDICINE_PREPARATION_STARTED','MEDICINE_READY','INPATIENT_REQUIRED','BED_ASSIGNED','TREATMENT_STARTED','TREATMENT_COMPLETED','PATIENT_DISCHARGED','FOLLOWUP_REQUIRED','ACTOR_ARRIVED'];
  watched.forEach(event=>bus.on(event,payload=>seen.push({event,payload})));

  const controller=new YQuanStoryController({storageKey:'v20-runtime-playthrough',bus});
  const advanceFor=(ms,step=50)=>{for(let elapsed=0;elapsed<ms;elapsed+=step)controller.update(step)};
  const advanceUntil=(predicate,label,maxMs=120000)=>{
    for(let elapsed=0;elapsed<=maxMs;elapsed+=50){controller.update(50);if(predicate())return elapsed}
    throw new Error(`V20 runtime timeout: ${label}`);
  };
  const hasEvent=name=>seen.some(item=>item.event===name);
  const arrived=(actor,scene,waypoint)=>seen.some(item=>item.event==='ACTOR_ARRIVED'&&item.payload?.actor===actor&&item.payload?.scene===scene&&item.payload?.waypoint===waypoint);

  const waiting={case_key:'V20-PLAY-001',patient_age:68,patient_gender:'female',patient_variant:2,completed:false,correct:false,care_status:'waiting_diagnosis',bed_slot:null};
  controller.sync([waiting]);
  advanceUntil(()=>controller.snapshot().stage==='WAITING_DIAGNOSIS','Tứ chẩn -> WAITING_DIAGNOSIS');
  assert(controller.doctor.scene==='clinic'&&controller.doctor.waypoint==='C_DESK_DOCTOR','doctor reaches clinic examination desk');
  assert(controller.patient.scene==='clinic'&&controller.patient.waypoint==='C_DESK_PATIENT','patient reaches clinic examination desk');
  ['PATIENT_ARRIVED','PATIENT_READY_FOR_EXAM','EXAM_STARTED','INSPECTION_COMPLETED','LISTENING_COMPLETED','INQUIRY_COMPLETED','PALPATION_COMPLETED'].forEach(event=>assert(hasEvent(event),`${event} emitted during Tứ chẩn`));

  const diagnosed={...waiting,completed:true,correct:true,care_status:'awaiting_transfer'};
  controller.sync([diagnosed]);
  advanceUntil(()=>controller.snapshot().stage==='WAITING_DISPOSITION','diagnosis -> pharmacy -> WAITING_DISPOSITION');
  assert(controller.doctor.scene==='clinic'&&controller.doctor.waypoint==='C_DESK_DOCTOR','doctor returns from pharmacy to clinic desk');
  ['DIAGNOSIS_SUBMITTED','DIAGNOSIS_CORRECT','PRESCRIPTION_CREATED','MEDICINE_PREPARATION_STARTED','MEDICINE_READY'].forEach(event=>assert(hasEvent(event),`${event} emitted after diagnosis`));
  ['P_CABINET','P_SCALE','P_MORTAR','P_POT','P_PACKAGE'].forEach(waypoint=>assert(arrived('doctor','pharmacy',waypoint),`doctor physically reaches ${waypoint}`));

  const observing={...diagnosed,care_status:'observing',bed_slot:2,treatment_started_at:new Date().toISOString()};
  controller.sync([observing]);
  advanceUntil(()=>controller.snapshot().stage==='IN_TREATMENT','transfer -> bed -> IN_TREATMENT');
  assert(controller.patient.scene==='ward'&&controller.patient.waypoint==='W_BED2','patient reaches BED_02 without scene teleport');
  assert(controller.doctor.scene==='ward'&&controller.doctor.waypoint==='W_BED2','doctor reaches BED_02 after patient');
  ['INPATIENT_REQUIRED','BED_ASSIGNED','TREATMENT_STARTED'].forEach(event=>assert(hasEvent(event),`${event} emitted for ward transfer`));

  const restoreBus=new GameEventBus();
  const restored=new YQuanStoryController({storageKey:'v20-runtime-playthrough',bus:restoreBus});
  restored.sync([observing]);
  assert(restored.snapshot().stage==='IN_TREATMENT','reload restores IN_TREATMENT stage');
  assert(restored.patient.scene==='ward'&&restored.patient.waypoint==='W_BED2','reload restores patient at BED_02');
  assert(restored.doctor.scene==='ward','reload restores doctor scene');
  restored.dispose();

  const recheck={...observing,care_status:'recheck_due'};
  controller.sync([recheck]);
  advanceFor(30000);
  assert(controller.snapshot().stage==='FOLLOW_UP','observing -> recheck_due transitions directly to FOLLOW_UP');
  assert(controller.patient.scene==='ward'&&controller.patient.waypoint==='W_BED2','follow-up keeps patient at assigned bed');
  assert(hasEvent('FOLLOWUP_REQUIRED'),'FOLLOWUP_REQUIRED emitted');

  controller.sync([]);
  advanceUntil(()=>controller.snapshot().stage==='RESTING'&&!controller.patient.visible,'discharge -> RESTING');
  assert(arrived('patient','ward','W_EXIT'),'patient walks to ward exit before discharge');
  assert(hasEvent('TREATMENT_COMPLETED'),'TREATMENT_COMPLETED emitted after ward care');
  assert(hasEvent('PATIENT_DISCHARGED'),'PATIENT_DISCHARGED emitted after exit animation');

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

  console.log('V20 runtime playthrough PASS: arrival -> Tứ chẩn -> diagnosis -> pharmacy -> BED_02 -> restore -> follow-up -> discharge; incorrect-diagnosis event path verified.');
}finally{
  fs.rmSync(tempDir,{recursive:true,force:true});
}
