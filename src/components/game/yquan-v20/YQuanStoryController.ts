import {CharacterActor} from './CharacterActor';
import {gameEventBus,GameEventBus} from './GameEventBus';
import {BED_WAYPOINTS,SCENES} from './sceneGraph';
import type {ActorAnimation,DoctorState,PatientState,PersistedStoryState,SceneId,VisualCase} from './types';

type ActorName='doctor'|'patient';
type StoryStep=
  |{kind:'move';actor:ActorName;waypoint:string;started?:boolean}
  |{kind:'switch';actor:ActorName;scene:SceneId;waypoint?:string}
  |{kind:'action';actor:ActorName;state:DoctorState|PatientState;animation:ActorAnimation;started?:boolean}
  |{kind:'wait';ms:number;remaining?:number}
  |{kind:'hide';actor:ActorName;hidden:boolean};

export interface StoryViewState{
  stage:string;
  cameraHint:SceneId;
  doctorState:DoctorState;
  patientState:PatientState;
  doctorAnimation:ActorAnimation;
  patientAnimation:ActorAnimation;
  caseKey:string|null;
  bedAssignment:number|null;
  statusText:string;
}

const doctorAnimationFor=(state:DoctorState):ActorAnimation=>({
  IDLE:'idle',WALKING:'walk_front',WAITING_PATIENT:'idle',GREETING:'greet',OBSERVING:'observe_patient',LISTENING:'talk_patient',QUESTIONING:'talk_patient',
  PULSE_CHECK:'pulse_check',WRITING:'write_record',THINKING:'think',DIAGNOSING:'think',PRESCRIBING:'write_record',WALK_TO_PHARMACY:'walk_left',
  SELECTING_HERBS:'take_herb',WEIGHING_HERBS:'weigh_herb',GRINDING_HERBS:'grind_herb',COOKING_MEDICINE:'cook_medicine',PACKING_MEDICINE:'package_medicine',
  WALK_TO_WARD:'walk_right',CHECKING_BED:'check_bed',CARING_PATIENT:'talk_patient',RETURNING:'walk_left',RESTING:'idle'
} as const)[state];

const patientAnimationFor=(state:PatientState):ActorAnimation=>({
  SPAWNING:'idle',ENTERING_CLINIC:'walk',WAITING:'idle',WALKING_TO_DESK:'walk',SITTING:'sit',CONSULTING:'talk',BEING_EXAMINED:'being_examined',
  WAITING_DIAGNOSIS:'idle',WAITING_MEDICINE:'idle',WALKING_TO_WARD:'walk',IN_TREATMENT:'lying',RECOVERING:'recovering',FOLLOW_UP:'talk',LEAVING:'leave',COMPLETED:'happy'
} as const)[state];

const casePriority=(cases:VisualCase[])=>
  cases.find(item=>item.care_status==='recheck_due')||
  cases.find(item=>item.care_status==='awaiting_transfer')||
  cases.find(item=>item.care_status==='waiting_diagnosis')||
  cases.find(item=>item.care_status==='observing')||null;

export class YQuanStoryController{
  readonly doctor:CharacterActor<DoctorState>;
  readonly patient:CharacterActor<PatientState>;
  private bus:GameEventBus;
  private queue:StoryStep[]=[];
  private activeStep:StoryStep|null=null;
  currentCase:VisualCase|null=null;
  private previousCase:VisualCase|null=null;
  private stage='RESTING';
  private cameraHint:SceneId='clinic';
  private idleElapsed=0;
  private storageKey:string;
  private pendingRestore:PersistedStoryState|null=null;
  private onChange?:(view:StoryViewState)=>void;
  private bedAssignment:number|null=null;

  constructor(options:{storageKey:string;bus?:GameEventBus;onChange?:(view:StoryViewState)=>void}){
    this.bus=options.bus||gameEventBus;this.storageKey=options.storageKey;this.onChange=options.onChange;
    this.doctor=new CharacterActor({id:'doctor',scene:'clinic',waypoint:'C_IDLE',state:'RESTING',speed:235,
      onArrive:(scene,waypoint)=>this.bus.emit('ACTOR_ARRIVED',{actor:'doctor',scene,waypoint}),
      onAnimationComplete:animation=>this.bus.emit('ANIMATION_COMPLETED',{actor:'doctor',animation})});
    this.patient=new CharacterActor({id:'patient',scene:'clinic',waypoint:'C_ENTRANCE',state:'SPAWNING',speed:210,
      onArrive:(scene,waypoint)=>this.bus.emit('ACTOR_ARRIVED',{actor:'patient',scene,waypoint}),
      onAnimationComplete:animation=>this.bus.emit('ANIMATION_COMPLETED',{actor:'patient',animation})});
    this.patient.visible=false;
    this.readPersisted();
  }

  private readPersisted(){
    try{
      const raw=localStorage.getItem(this.storageKey);if(!raw)return;
      const parsed=JSON.parse(raw) as PersistedStoryState;
      if(parsed.version!==20||Date.now()-parsed.savedAt>6*60*60*1000)return;
      this.pendingRestore=parsed;
    }catch{this.pendingRestore=null}
  }

  private persist(){
    try{
      const data:PersistedStoryState={version:20,savedAt:Date.now(),caseKey:this.currentCase?.case_key||null,stage:this.stage,doctor:this.doctor.snapshot(),patient:this.patient.snapshot(),bedAssignment:this.bedAssignment};
      localStorage.setItem(this.storageKey,JSON.stringify(data));
    }catch{/* storage can be unavailable in private browser modes */}
  }

  private view(statusText?:string):StoryViewState{
    return {stage:this.stage,cameraHint:this.cameraHint,doctorState:this.doctor.state,patientState:this.patient.state,doctorAnimation:this.doctor.animation.current,patientAnimation:this.patient.animation.current,caseKey:this.currentCase?.case_key||null,bedAssignment:this.bedAssignment,statusText:statusText||this.statusText()};
  }

  private statusText(){
    const labels:Record<string,string>={
      RESTING:'Thầy thuốc đang trực tại Y Quán',PATIENT_ENTER:'Bệnh nhân đang vào phòng Chẩn Mạch',GREETING:'Đang tiếp đón bệnh nhân',EXAMINATION:'Đang thực hiện Tứ chẩn',
      WAITING_DIAGNOSIS:'Đang chờ người chơi quyết định chẩn thể',MEDICINE_PREPARATION:'Đang chuẩn bị dược liệu theo tình huống học tập',WAITING_DISPOSITION:'Đã hoàn tất chẩn thể · chờ quyết định xử trí',
      TRANSFER_TO_WARD:'Đang đưa bệnh nhân sang Dưỡng Trị',IN_TREATMENT:'Bệnh nhân đang được theo dõi tại Dưỡng Trị',FOLLOW_UP:'Đã đến giờ tái khám',DISCHARGING:'Bệnh nhân đang rời Y Quán',IDLE_PATROL:'Thầy thuốc đang kiểm tra Y Quán'
    };
    return labels[this.stage]||'HIU Y Quán đang hoạt động';
  }

  private changed(text?:string){this.onChange?.(this.view(text));this.persist()}

  private setDoctor(state:DoctorState,animation=doctorAnimationFor(state)){
    if(this.doctor.state!==state){this.doctor.setState(state);this.doctor.play(animation,true);this.changed()}
  }

  private setPatient(state:PatientState,animation=patientAnimationFor(state)){
    if(this.patient.state!==state){this.patient.setState(state);this.patient.play(animation,true);this.changed()}
  }

  private replace(stage:string,steps:StoryStep[],cameraHint?:SceneId){
    this.queue=steps;this.activeStep=null;this.stage=stage;if(cameraHint)this.cameraHint=cameraHint;this.changed();
  }

  private examSequence(){
    this.patient.visible=true;
    this.replace('PATIENT_ENTER',[
      {kind:'switch',actor:'patient',scene:'clinic',waypoint:'C_ENTRANCE'},
      {kind:'action',actor:'patient',state:'ENTERING_CLINIC',animation:'walk'},
      {kind:'move',actor:'patient',waypoint:'C_WAIT'},
      {kind:'action',actor:'patient',state:'WAITING',animation:'idle'},
      {kind:'move',actor:'patient',waypoint:'C_DESK_PATIENT'},
      {kind:'action',actor:'patient',state:'SITTING',animation:'sit'},
      {kind:'switch',actor:'doctor',scene:'clinic',waypoint:this.doctor.scene==='clinic'?this.doctor.waypoint:'C_IDLE'},
      {kind:'move',actor:'doctor',waypoint:'C_DESK_DOCTOR'},
      {kind:'action',actor:'doctor',state:'GREETING',animation:'greet'},
      {kind:'action',actor:'patient',state:'CONSULTING',animation:'talk'},
      {kind:'action',actor:'doctor',state:'OBSERVING',animation:'observe_patient'},
      {kind:'action',actor:'doctor',state:'LISTENING',animation:'talk_patient'},
      {kind:'action',actor:'doctor',state:'QUESTIONING',animation:'talk_patient'},
      {kind:'action',actor:'doctor',state:'PULSE_CHECK',animation:'pulse_check'},
      {kind:'action',actor:'patient',state:'BEING_EXAMINED',animation:'being_examined'},
      {kind:'action',actor:'doctor',state:'WRITING',animation:'write_record'},
      {kind:'action',actor:'patient',state:'WAITING_DIAGNOSIS',animation:'idle'},
      {kind:'action',actor:'doctor',state:'THINKING',animation:'think'}
    ],'clinic');
  }

  private medicineSequence(){
    this.replace('MEDICINE_PREPARATION',[
      {kind:'action',actor:'doctor',state:'DIAGNOSING',animation:'think'},
      {kind:'action',actor:'doctor',state:'PRESCRIBING',animation:'write_record'},
      {kind:'action',actor:'patient',state:'WAITING_MEDICINE',animation:'idle'},
      {kind:'move',actor:'doctor',waypoint:'C_PHARMACY_EXIT'},
      {kind:'switch',actor:'doctor',scene:'pharmacy',waypoint:'P_ENTRANCE'},
      {kind:'move',actor:'doctor',waypoint:'P_CABINET'},
      {kind:'action',actor:'doctor',state:'SELECTING_HERBS',animation:'open_drawer'},
      {kind:'action',actor:'doctor',state:'SELECTING_HERBS',animation:'take_herb'},
      {kind:'move',actor:'doctor',waypoint:'P_SCALE'},
      {kind:'action',actor:'doctor',state:'WEIGHING_HERBS',animation:'weigh_herb'},
      {kind:'move',actor:'doctor',waypoint:'P_MORTAR'},
      {kind:'action',actor:'doctor',state:'GRINDING_HERBS',animation:'grind_herb'},
      {kind:'action',actor:'doctor',state:'GRINDING_HERBS',animation:'mix_herb'},
      {kind:'move',actor:'doctor',waypoint:'P_POT'},
      {kind:'action',actor:'doctor',state:'COOKING_MEDICINE',animation:'cook_medicine'},
      {kind:'move',actor:'doctor',waypoint:'P_PACKAGE'},
      {kind:'action',actor:'doctor',state:'PACKING_MEDICINE',animation:'package_medicine'},
      {kind:'move',actor:'doctor',waypoint:'P_EXIT'},
      {kind:'switch',actor:'doctor',scene:'clinic',waypoint:'C_PHARMACY_EXIT'},
      {kind:'move',actor:'doctor',waypoint:'C_DESK_DOCTOR'},
      {kind:'action',actor:'doctor',state:'WAITING_PATIENT',animation:'idle'}
    ],'pharmacy');
    if(this.currentCase)this.bus.emit('MEDICINE_PREPARATION_STARTED',{caseKey:this.currentCase.case_key});
  }

  private wardSequence(item:VisualCase){
    const slot=Math.max(1,Math.min(3,Number(item.bed_slot)||1)) as 1|2|3;this.bedAssignment=slot;
    this.replace('TRANSFER_TO_WARD',[
      {kind:'switch',actor:'patient',scene:'clinic',waypoint:this.patient.scene==='clinic'?this.patient.waypoint:'C_DESK_PATIENT'},
      {kind:'action',actor:'patient',state:'WALKING_TO_WARD',animation:'walk'},
      {kind:'move',actor:'patient',waypoint:'C_WARD_EXIT'},
      {kind:'switch',actor:'patient',scene:'ward',waypoint:'W_ENTRANCE'},
      {kind:'move',actor:'patient',waypoint:BED_WAYPOINTS[slot]},
      {kind:'action',actor:'patient',state:'IN_TREATMENT',animation:'lying'},
      {kind:'switch',actor:'doctor',scene:'clinic',waypoint:this.doctor.scene==='clinic'?this.doctor.waypoint:'C_DESK_DOCTOR'},
      {kind:'move',actor:'doctor',waypoint:'C_WARD_EXIT'},
      {kind:'switch',actor:'doctor',scene:'ward',waypoint:'W_ENTRANCE'},
      {kind:'move',actor:'doctor',waypoint:BED_WAYPOINTS[slot]},
      {kind:'action',actor:'doctor',state:'CHECKING_BED',animation:'check_bed'},
      {kind:'action',actor:'doctor',state:'CARING_PATIENT',animation:'talk_patient'},
      {kind:'move',actor:'doctor',waypoint:'W_DESK'},
      {kind:'action',actor:'doctor',state:'WRITING',animation:'write_record'},
      {kind:'move',actor:'doctor',waypoint:BED_WAYPOINTS[slot]},
      {kind:'action',actor:'doctor',state:'RESTING',animation:'idle'}
    ],'ward');
  }

  private followupSequence(item:VisualCase){
    const slot=Math.max(1,Math.min(3,Number(item.bed_slot)||1)) as 1|2|3;this.bedAssignment=slot;
    this.replace('FOLLOW_UP',[
      {kind:'switch',actor:'doctor',scene:'ward',waypoint:this.doctor.scene==='ward'?this.doctor.waypoint:'W_ENTRANCE'},
      {kind:'move',actor:'doctor',waypoint:BED_WAYPOINTS[slot]},
      {kind:'action',actor:'doctor',state:'CHECKING_BED',animation:'check_bed'},
      {kind:'action',actor:'patient',state:'FOLLOW_UP',animation:'talk'},
      {kind:'action',actor:'doctor',state:'CARING_PATIENT',animation:'talk_patient'},
      {kind:'action',actor:'patient',state:'RECOVERING',animation:'recovering'}
    ],'ward');
  }

  private dischargeSequence(caseKey:string){
    const patientScene=this.patient.scene;
    const steps:StoryStep[]=[];
    if(patientScene==='ward')steps.push({kind:'move',actor:'patient',waypoint:'W_EXIT'});
    else if(patientScene==='clinic')steps.push({kind:'move',actor:'patient',waypoint:'C_ENTRANCE'});
    steps.push({kind:'action',actor:'patient',state:'LEAVING',animation:'leave'},{kind:'hide',actor:'patient',hidden:true},{kind:'action',actor:'doctor',state:'RETURNING',animation:'idle'});
    this.replace('DISCHARGING',steps,patientScene);
    this.bus.emit('PATIENT_DISCHARGED',{caseKey});
  }

  sync(cases:VisualCase[]){
    const next=casePriority(cases);
    const ward=cases.filter(item=>item.care_status==='observing'||item.care_status==='recheck_due');
    if(!next){
      if(this.currentCase)this.dischargeSequence(this.currentCase.case_key);
      this.previousCase=this.currentCase;this.currentCase=null;this.bedAssignment=null;return;
    }

    const restored=this.pendingRestore;
    if(restored&&restored.caseKey===next.case_key){
      this.pendingRestore=null;this.currentCase=next;this.stage=restored.stage;this.bedAssignment=restored.bedAssignment;
      this.doctor.restore(restored.doctor);this.patient.restore(restored.patient);this.cameraHint=this.doctor.scene;this.changed('Đã khôi phục đúng trạng thái ca đang chơi.');return;
    }
    if(restored&&restored.caseKey!==next.case_key)this.pendingRestore=null;

    const previous=this.currentCase;
    this.previousCase=previous;this.currentCase=next;
    const isNew=!previous||previous.case_key!==next.case_key;
    if(isNew){
      this.bus.emit('PATIENT_ARRIVED',{caseKey:next.case_key});
      if(next.care_status==='observing'||next.care_status==='recheck_due'){
        this.patient.visible=true;this.wardSequence(next);
        if(next.bed_slot)this.bus.emit('BED_ASSIGNED',{caseKey:next.case_key,bedSlot:Number(next.bed_slot)});
      }else if(next.care_status==='awaiting_transfer'){
        this.patient.visible=true;this.patient.setScene('clinic','C_DESK_PATIENT');this.patient.setState('WAITING_MEDICINE');this.medicineSequence();
      }else this.examSequence();
      return;
    }

    if(previous?.care_status!==next.care_status||previous?.completed!==next.completed||previous?.bed_slot!==next.bed_slot){
      if(next.completed&&!previous?.completed){
        this.bus.emit('DIAGNOSIS_SUBMITTED',{caseKey:next.case_key,correct:Boolean(next.correct)});
        this.bus.emit(next.correct?'DIAGNOSIS_CORRECT':'DIAGNOSIS_INCORRECT',{caseKey:next.case_key});
        this.bus.emit('PRESCRIPTION_CREATED',{caseKey:next.case_key});this.medicineSequence();return;
      }
      if((next.care_status==='observing'||next.care_status==='recheck_due')&&previous?.care_status!==next.care_status){
        const slot=Math.max(1,Math.min(3,Number(next.bed_slot)||1));
        this.bus.emit('INPATIENT_REQUIRED',{caseKey:next.case_key});this.bus.emit('BED_ASSIGNED',{caseKey:next.case_key,bedSlot:slot});this.bus.emit('TREATMENT_STARTED',{caseKey:next.case_key,bedSlot:slot});this.wardSequence(next);return;
      }
    }

    if(next.care_status==='recheck_due'&&this.stage!=='FOLLOW_UP'){
      const slot=Math.max(1,Math.min(3,Number(next.bed_slot)||1));this.bus.emit('FOLLOWUP_REQUIRED',{caseKey:next.case_key,bedSlot:slot});this.followupSequence(next);return;
    }

    if(ward.length&&this.stage==='RESTING')this.wardSequence(next);
  }

  private processStep(deltaMs:number){
    if(!this.activeStep)this.activeStep=this.queue.shift()||null;
    const step=this.activeStep;if(!step)return;
    const actor=step.kind==='move'||step.kind==='switch'||step.kind==='action'||step.kind==='hide'?(step.actor==='doctor'?this.doctor:this.patient):null;
    if(step.kind==='switch'){
      actor!.setScene(step.scene,step.waypoint||SCENES[step.scene].spawn);this.cameraHint=step.scene;this.activeStep=null;this.changed();return;
    }
    if(step.kind==='hide'){
      actor!.visible=!step.hidden;this.activeStep=null;this.changed();return;
    }
    if(step.kind==='wait'){
      step.remaining=(step.remaining??step.ms)-deltaMs;if(step.remaining<=0)this.activeStep=null;return;
    }
    if(step.kind==='move'){
      if(!step.started){step.started=true;if(step.actor==='doctor')this.setDoctor('WALKING');else this.setPatient(actor!.scene==='ward'?'WALKING_TO_WARD':'WALKING_TO_DESK');actor!.requestMove(step.waypoint)}
      if(!actor!.isMoving()){this.activeStep=null;this.changed()}return;
    }
    if(step.kind==='action'){
      if(!step.started){step.started=true;if(step.actor==='doctor')this.setDoctor(step.state as DoctorState,step.animation);else this.setPatient(step.state as PatientState,step.animation);actor!.play(step.animation,true)}
      if(actor!.animation.isComplete()){this.activeStep=null;this.changed()}return;
    }
  }

  private enqueueIdlePatrol(){
    const from=this.doctor.scene;
    if(from==='clinic')this.replace('IDLE_PATROL',[{kind:'move',actor:'doctor',waypoint:'C_PHARMACY_EXIT'},{kind:'switch',actor:'doctor',scene:'pharmacy',waypoint:'P_ENTRANCE'},{kind:'move',actor:'doctor',waypoint:'P_CABINET'},{kind:'action',actor:'doctor',state:'SELECTING_HERBS',animation:'open_drawer'}],'pharmacy');
    else if(from==='pharmacy')this.replace('IDLE_PATROL',[{kind:'move',actor:'doctor',waypoint:'P_EXIT'},{kind:'switch',actor:'doctor',scene:'ward',waypoint:'W_ENTRANCE'},{kind:'move',actor:'doctor',waypoint:'W_BED2'},{kind:'action',actor:'doctor',state:'CHECKING_BED',animation:'check_bed'}],'ward');
    else this.replace('IDLE_PATROL',[{kind:'move',actor:'doctor',waypoint:'W_EXIT'},{kind:'switch',actor:'doctor',scene:'clinic',waypoint:'C_WARD_EXIT'},{kind:'move',actor:'doctor',waypoint:'C_IDLE'},{kind:'action',actor:'doctor',state:'RESTING',animation:'idle'}],'clinic');
  }

  update(deltaMs:number){
    this.doctor.update(deltaMs);this.patient.update(deltaMs);this.processStep(deltaMs);
    if(this.activeStep||this.queue.length){this.idleElapsed=0;return}
    if(this.currentCase){
      if(this.currentCase.care_status==='waiting_diagnosis'&&this.stage!=='WAITING_DIAGNOSIS'){this.stage='WAITING_DIAGNOSIS';this.setDoctor('WAITING_PATIENT','idle');this.setPatient('WAITING_DIAGNOSIS','idle');this.changed()}
      else if(this.currentCase.care_status==='awaiting_transfer'&&this.stage!=='WAITING_DISPOSITION'){this.stage='WAITING_DISPOSITION';this.cameraHint='clinic';this.changed();this.bus.emit('MEDICINE_READY',{caseKey:this.currentCase.case_key})}
      else if(this.currentCase.care_status==='observing'&&this.stage!=='IN_TREATMENT'){this.stage='IN_TREATMENT';this.cameraHint='ward';this.setPatient('IN_TREATMENT','sleeping');this.changed()}
      return;
    }
    this.stage='RESTING';this.setDoctor('RESTING','idle');this.patient.visible=false;this.idleElapsed+=deltaMs;
    if(this.idleElapsed>=7000){this.idleElapsed=0;this.enqueueIdlePatrol()}
  }

  snapshot(){return this.view()}
  dispose(){this.persist()}
}
