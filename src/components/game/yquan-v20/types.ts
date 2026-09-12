export type DoctorGender='male'|'female';
export type DoctorOutfit='classic'|'academy'|'master';
export type SceneId='clinic'|'pharmacy'|'ward';
export type LegacySceneId='consult'|'lab'|'ward';
export type ActorDirection='front'|'back'|'left'|'right';

export type DoctorState=
  |'IDLE'|'WALKING'|'WAITING_PATIENT'|'GREETING'|'OBSERVING'|'LISTENING'|'QUESTIONING'
  |'PULSE_CHECK'|'WRITING'|'THINKING'|'DIAGNOSING'|'PRESCRIBING'|'WALK_TO_PHARMACY'
  |'SELECTING_HERBS'|'WEIGHING_HERBS'|'GRINDING_HERBS'|'COOKING_MEDICINE'
  |'PACKING_MEDICINE'|'WALK_TO_WARD'|'CHECKING_BED'|'CARING_PATIENT'|'RETURNING'|'RESTING';

export type PatientState=
  |'SPAWNING'|'ENTERING_CLINIC'|'WAITING'|'WALKING_TO_DESK'|'SITTING'|'CONSULTING'
  |'BEING_EXAMINED'|'WAITING_DIAGNOSIS'|'WAITING_MEDICINE'|'WALKING_TO_WARD'
  |'IN_TREATMENT'|'RECOVERING'|'FOLLOW_UP'|'LEAVING'|'COMPLETED';

export type DoctorAnimation=
  |'idle'|'blink'|'look_left'|'look_right'|'walk_front'|'walk_back'|'walk_left'|'walk_right'
  |'greet'|'sit'|'stand'|'observe_patient'|'pulse_check'|'write_record'|'think'|'open_drawer'
  |'take_herb'|'weigh_herb'|'grind_herb'|'mix_herb'|'cook_medicine'|'package_medicine'
  |'check_bed'|'talk_patient';

export type PatientAnimation=
  |'idle'|'walk'|'sit'|'talk'|'pain'|'being_examined'|'lying'|'sleeping'|'recovering'|'happy'|'leave';

export type ActorAnimation=DoctorAnimation|PatientAnimation;

export interface WorldPoint{x:number;y:number}
export interface Waypoint extends WorldPoint{id:string;links:string[]}
export interface InteractionPoint extends WorldPoint{id:string;kind:'entrance'|'exit'|'desk'|'cabinet'|'tool'|'bed'|'waiting'|'idle'}
export interface SceneDefinition{
  id:SceneId;
  width:1600;
  height:900;
  spawn:string;
  exit:string;
  waypoints:Record<string,Waypoint>;
  interactions:Record<string,InteractionPoint>;
}

export interface VisualCase{
  case_key:string;
  patient_age:number;
  patient_gender:DoctorGender;
  patient_variant?:number;
  completed:boolean;
  correct:boolean;
  care_status?:'waiting_diagnosis'|'awaiting_transfer'|'observing'|'recheck_due'|'discharged';
  bed_slot?:number|null;
  recheck_due_at?:string|null;
  treatment_started_at?:string|null;
}

export interface PlayerVisualState{
  active:boolean;
  display_name?:string|null;
  gender?:DoctorGender|null;
  outfit?:DoctorOutfit|null;
}

export interface HerbVisual{
  herb_key:string;
  name:string;
  latin_name?:string;
  nature_flavor?:string;
  meridians?:string;
  actions?:string;
  indications?:string;
}

export interface AnimationSnapshot{
  current:ActorAnimation;frame:number;elapsed:number;finished:boolean;loopCycles:number;playbackSpeed:number;
}

export type StoryStep=
  |{kind:'move';actor:'doctor'|'patient';waypoint:string;started?:boolean}
  |{kind:'switch';actor:'doctor'|'patient';scene:SceneId;waypoint?:string}
  |{kind:'action';actor:'doctor'|'patient';state:DoctorState|PatientState;animation:ActorAnimation;started?:boolean}
  |{kind:'wait';ms:number;remaining?:number}
  |{kind:'hide';actor:'doctor'|'patient';hidden:boolean}
  |{kind:'emit';event:'PATIENT_DISCHARGED'|'TREATMENT_COMPLETED';caseKey:string;bedSlot?:number|null};

export interface ActorSnapshot<S extends string=string>{
  scene:SceneId;
  position:WorldPoint;
  waypoint:string;
  direction:ActorDirection;
  state:S;
  animation:ActorAnimation;
  visible:boolean;
  path?:Array<WorldPoint & {id:string}>;
  targetWaypoint?:string|null;
  animationProgress?:AnimationSnapshot;
}

export interface PersistedStoryState{
  version:20;
  savedAt:number;
  caseKey:string|null;
  stage:string;
  doctor:ActorSnapshot<DoctorState>;
  patient:ActorSnapshot<PatientState>;
  bedAssignment:number|null;
  execution?:{
    queue:StoryStep[];activeStep:StoryStep|null;cameraHint:SceneId;
    careStatus:VisualCase['care_status'];completed:boolean;
  };
}

export interface GameEventMap{
  PATIENT_ARRIVED:{caseKey:string};
  PATIENT_READY_FOR_EXAM:{caseKey:string};
  EXAM_STARTED:{caseKey:string};
  INSPECTION_COMPLETED:{caseKey:string};
  LISTENING_COMPLETED:{caseKey:string};
  INQUIRY_COMPLETED:{caseKey:string};
  PALPATION_COMPLETED:{caseKey:string};
  DIAGNOSIS_SUBMITTED:{caseKey:string;correct:boolean};
  DIAGNOSIS_CORRECT:{caseKey:string};
  DIAGNOSIS_INCORRECT:{caseKey:string};
  PRESCRIPTION_CREATED:{caseKey:string};
  MEDICINE_PREPARATION_STARTED:{caseKey:string};
  MEDICINE_READY:{caseKey:string};
  INPATIENT_REQUIRED:{caseKey:string};
  BED_ASSIGNED:{caseKey:string;bedSlot:number};
  TREATMENT_STARTED:{caseKey:string;bedSlot:number};
  TREATMENT_COMPLETED:{caseKey:string;bedSlot:number|null};
  PATIENT_DISCHARGED:{caseKey:string};
  FOLLOWUP_REQUIRED:{caseKey:string;bedSlot:number};
  ANIMATION_COMPLETED:{actor:'doctor'|'patient';animation:ActorAnimation};
  ACTOR_ARRIVED:{actor:'doctor'|'patient';scene:SceneId;waypoint:string};
  SYNC_REQUESTED:{reason:string};
}

export const legacyToScene=(scene:LegacySceneId):SceneId=>scene==='consult'?'clinic':scene==='lab'?'pharmacy':'ward';
export const sceneToLegacy=(scene:SceneId):LegacySceneId=>scene==='clinic'?'consult':scene==='pharmacy'?'lab':'ward';
