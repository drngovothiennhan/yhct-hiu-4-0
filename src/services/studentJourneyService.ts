import type {ModuleId} from '../modules/moduleContract';

export type StudentYear=1|2|3|4|5|6;
export type StudyGoal='daily'|'exam'|'research'|'clinical';
export type StudentPreferences={year:StudentYear;focus:string;goal:StudyGoal;dailyMinutes:10|20|30|45};
export type StudentJourney={
  version:1;
  preferences?:StudentPreferences;
  onboardedAt?:string;
  lastActiveDate?:string;
  streak:number;
  todayDate:string;
  todayQuestions:number;
  xp:number;
  moduleVisits:Partial<Record<ModuleId,number>>;
  lastModule?:ModuleId;
  examAttempts:number;
  lastExamScore?:number;
  aiUses:number;
  updatedAt:string;
};

type JourneyEventDetail={identity:string;state:StudentJourney};
type JourneyListener=(state:StudentJourney)=>void;
const PREFIX='yhct-student-journey-v1:';
const EVENT='yhct:journey:update';

const identityKey=(memberId?:string|null)=>String(memberId||'guest').trim()||'guest';
const storageKey=(memberId?:string|null)=>`${PREFIX}${identityKey(memberId)}`;
const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const yesterdayKey=()=>{const date=new Date();date.setDate(date.getDate()-1);return dayKey(date)};
const nowIso=()=>new Date().toISOString();
const emptyJourney=():StudentJourney=>({version:1,streak:0,todayDate:dayKey(),todayQuestions:0,xp:0,moduleVisits:{},examAttempts:0,aiUses:0,updatedAt:nowIso()});
const safeNumber=(value:unknown,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function normalize(raw:Partial<StudentJourney>|null|undefined):StudentJourney{
  const today=dayKey(),base=emptyJourney(),sameDay=raw?.todayDate===today;
  return{
    ...base,
    ...raw,
    version:1,
    streak:Math.max(0,Math.floor(safeNumber(raw?.streak))),
    todayDate:today,
    todayQuestions:sameDay?Math.max(0,Math.floor(safeNumber(raw?.todayQuestions))):0,
    xp:Math.max(0,Math.floor(safeNumber(raw?.xp))),
    moduleVisits:raw?.moduleVisits&&typeof raw.moduleVisits==='object'?raw.moduleVisits:{},
    examAttempts:Math.max(0,Math.floor(safeNumber(raw?.examAttempts))),
    aiUses:Math.max(0,Math.floor(safeNumber(raw?.aiUses))),
    updatedAt:typeof raw?.updatedAt==='string'?raw.updatedAt:base.updatedAt
  };
}

export function readStudentJourney(memberId?:string|null):StudentJourney{
  if(typeof window==='undefined')return emptyJourney();
  try{
    const value=localStorage.getItem(storageKey(memberId));
    const own=normalize(value?JSON.parse(value):null);
    if(!own.preferences&&memberId){
      const guestValue=localStorage.getItem(storageKey(null));
      const guest=normalize(guestValue?JSON.parse(guestValue):null);
      if(guest.preferences)return{...own,preferences:guest.preferences};
    }
    return own;
  }catch{return emptyJourney()}
}

function persist(memberId:string|null|undefined,state:StudentJourney){
  if(typeof window==='undefined')return state;
  const identity=identityKey(memberId),next={...state,updatedAt:nowIso()};
  try{localStorage.setItem(storageKey(memberId),JSON.stringify(next))}catch{}
  window.dispatchEvent(new CustomEvent<JourneyEventDetail>(EVENT,{detail:{identity,state:next}}));
  return next;
}

function withActivity(state:StudentJourney){
  const today=dayKey();
  if(state.lastActiveDate===today)return state;
  const streak=state.lastActiveDate===yesterdayKey()?Math.max(1,state.streak+1):1;
  return{...state,lastActiveDate:today,streak,todayDate:today,todayQuestions:state.todayDate===today?state.todayQuestions:0};
}

export function saveStudentPreferences(preferences:StudentPreferences,memberId?:string|null){
  const state=withActivity(readStudentJourney(memberId));
  return persist(memberId,{...state,preferences,onboardedAt:state.onboardedAt||nowIso(),xp:state.xp+(state.preferences?0:5)});
}

export function recordModuleVisit(module:ModuleId,memberId?:string|null){
  const state=withActivity(readStudentJourney(memberId)),visits={...state.moduleVisits,[module]:(state.moduleVisits[module]||0)+1};
  return persist(memberId,{...state,moduleVisits:visits,lastModule:module});
}

export function recordExamAnswer(memberId?:string|null,correct?:boolean){
  const state=withActivity(readStudentJourney(memberId));
  return persist(memberId,{...state,todayQuestions:state.todayQuestions+1,xp:state.xp+(correct===true?3:2)});
}

export function recordExamResult(score:number,memberId?:string|null){
  const state=withActivity(readStudentJourney(memberId)),safeScore=Math.max(0,Math.min(100,Math.round(safeNumber(score))));
  return persist(memberId,{...state,examAttempts:state.examAttempts+1,lastExamScore:safeScore,xp:state.xp+Math.max(5,Math.round(safeScore/10))});
}

export function recordAiUse(memberId?:string|null){
  const state=withActivity(readStudentJourney(memberId));
  return persist(memberId,{...state,aiUses:state.aiUses+1,xp:state.xp+1});
}

export function subscribeStudentJourney(memberId:string|null|undefined,listener:JourneyListener){
  if(typeof window==='undefined')return()=>{};
  const identity=identityKey(memberId),onCustom=(event:Event)=>{const detail=(event as CustomEvent<JourneyEventDetail>).detail;if(detail?.identity===identity)listener(normalize(detail.state))},onStorage=(event:StorageEvent)=>{if(event.key===storageKey(memberId))listener(readStudentJourney(memberId))};
  window.addEventListener(EVENT,onCustom as EventListener);window.addEventListener('storage',onStorage);
  return()=>{window.removeEventListener(EVENT,onCustom as EventListener);window.removeEventListener('storage',onStorage)};
}
