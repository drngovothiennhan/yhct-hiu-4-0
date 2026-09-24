import {SUPABASE_PUBLISHABLE_KEY,SUPABASE_URL,supabase} from './authService';
import {readReviewCards} from './adaptiveReview';
import {readStudentJourney} from './studentJourneyService';

const DAILY_HISTORY_PREFIX='yhct-study-os-daily-v1:';
const LAST_SYNC_PREFIX='yhct-learning-cloud-last-sync-v1:';
const SYNC_DEBOUNCE_MS=4500;
const MIN_RESYNC_MS=25000;

type LearningSnapshot={
  schemaVersion:1;
  capturedAt:string;
  journey:ReturnType<typeof readStudentJourney>;
  reviewCards:ReturnType<typeof readReviewCards>;
  dailyHistory:unknown[];
};

function readDailyHistory(memberId:string):unknown[]{
  try{
    const raw=JSON.parse(localStorage.getItem(DAILY_HISTORY_PREFIX+memberId)||'[]');
    return Array.isArray(raw)?raw.slice(-14):[];
  }catch{return []}
}

function readLastSync(memberId:string){
  try{return Number(localStorage.getItem(LAST_SYNC_PREFIX+memberId)||0)||0}catch{return 0}
}
function writeLastSync(memberId:string,value:number){
  try{localStorage.setItem(LAST_SYNC_PREFIX+memberId,String(value))}catch{}
}

function buildSnapshot(memberId:string):LearningSnapshot{
  return{
    schemaVersion:1,
    capturedAt:new Date().toISOString(),
    journey:readStudentJourney(memberId),
    reviewCards:readReviewCards(memberId),
    dailyHistory:readDailyHistory(memberId)
  };
}

let inFlight:Promise<boolean>|null=null;

export async function syncLearningCloud(memberId:string,force=false):Promise<boolean>{
  if(!memberId)return false;
  const now=Date.now();
  if(!force&&now-readLastSync(memberId)<MIN_RESYNC_MS)return true;
  if(inFlight)return inFlight;

  inFlight=(async()=>{
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)return false;
      const response=await fetch(`${SUPABASE_URL}/functions/v1/learning-sync`,{
        method:'POST',
        headers:{
          apikey:SUPABASE_PUBLISHABLE_KEY,
          Authorization:`Bearer ${session.access_token}`,
          'Content-Type':'application/json'
        },
        body:JSON.stringify({
          snapshot:buildSnapshot(memberId),
          clientUpdatedAt:readStudentJourney(memberId).updatedAt,
          sourceVersion:'study-os-web-v1'
        }),
        cache:'no-store'
      });
      if(!response.ok){
        const body=await response.json().catch(()=>({})) as Record<string,unknown>;
        console.warn('learning cloud sync rejected',response.status,body.error||'');
        return false;
      }
      writeLastSync(memberId,Date.now());
      window.dispatchEvent(new CustomEvent('yhct:learning-cloud-synced',{detail:{memberId,syncedAt:new Date().toISOString()}}));
      return true;
    }catch(error){
      console.warn('learning cloud sync deferred',error);
      return false;
    }finally{
      inFlight=null;
    }
  })();

  return inFlight;
}

export function startLearningCloudSync(memberId:string){
  if(typeof window==='undefined'||!memberId)return()=>{};
  let timer=0;
  let disposed=false;

  const schedule=(force=false)=>{
    if(disposed)return;
    window.clearTimeout(timer);
    timer=window.setTimeout(()=>{if(!disposed)void syncLearningCloud(memberId,force)},force?500:SYNC_DEBOUNCE_MS);
  };
  const onJourney=()=>schedule(false);
  const onReview=()=>schedule(false);
  const onFocus=()=>schedule(false);
  const onVisible=()=>{if(document.visibilityState==='visible')schedule(false)};

  window.addEventListener('yhct:journey:update',onJourney);
  window.addEventListener('yhct:review',onReview);
  window.addEventListener('focus',onFocus);
  document.addEventListener('visibilitychange',onVisible);
  schedule(true);

  return()=>{
    disposed=true;
    window.clearTimeout(timer);
    window.removeEventListener('yhct:journey:update',onJourney);
    window.removeEventListener('yhct:review',onReview);
    window.removeEventListener('focus',onFocus);
    document.removeEventListener('visibilitychange',onVisible);
  };
}
