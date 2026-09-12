import {supabase} from './authService';

export type DailyPracticeConfig={authenticated:boolean;ready:boolean;eligibleCount:number;needsReviewCount:number;practiceDate:string;hasTodaySession:boolean;defaultCount:number};
export type DailyPracticeQuestion={id:string;subject:string;topic:string;stem:string;options:string[];sourceFileName:string;generationMethod:'parsed'|'ai_generated';reviewStatus:'source_verified'|'expert_approved'};
export type DailyPracticeSession={ready:boolean;sessionId?:string;practiceDate:string;status?:'active'|'completed';questionCount?:number;available?:number;answers?:Record<string,number>;questions:DailyPracticeQuestion[]};
export type DailyPracticeAnswer={accepted:boolean;alreadyAnswered:boolean;correct:boolean;selectedIndex:number;correctIndex:number;explanation:string;sourceFileName:string;reviewStatus:string};
export type DriveSyncRow={driveFileId:string;fileName:string;status:string;parsed:number;generated:number;inserted:number;updated:number;message:string};
export type DriveSyncResult={ok:boolean;degraded:boolean;reason?:string;folderId?:string;filesFound?:number;processed:DriveSyncRow[];latencyMs?:number};
export type PracticeReviewQuestion={id:string;subject:string;topic:string;stem:string;options:string[];correctIndex:number;explanation:string;sourceFileName:string;sourceModifiedTime?:string|null;generationMethod:string;provenance?:Record<string,unknown>;createdAt:string};
export type AnswerReviewRequest={requestId:string;questionId:string;subject:string;topic:string;stem:string;options:string[];correctIndex:number;sourceFileName:string;reviewStatus:string;reason:string;requestedAt:string;requestCount:number};

const GUEST_CONFIG:DailyPracticeConfig={authenticated:false,ready:false,eligibleCount:0,needsReviewCount:0,practiceDate:'',hasTodaySession:false,defaultCount:10};
const memberGate=/permission denied|approved member required|member required|jwt|not authenticated/i;
const isMemberGate=(error:unknown)=>memberGate.test(String((error as {message?:unknown})?.message||''));
const requireMemberSession=async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('Vui lòng đăng nhập thành viên để sử dụng Ôn tập nhanh.');return session};

export async function getDailyPracticeConfig():Promise<DailyPracticeConfig>{
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token)return GUEST_CONFIG;
  const {data,error}=await supabase.rpc('daily_practice_config_v1');
  if(error){if(isMemberGate(error))return GUEST_CONFIG;throw error}
  return{...GUEST_CONFIG,...(data as Omit<DailyPracticeConfig,'authenticated'>),authenticated:true};
}
export async function getTodayDailyPractice(count=10):Promise<DailyPracticeSession>{await requireMemberSession();const {data,error}=await supabase.rpc('daily_practice_today_v1',{p_count:Math.max(1,Math.min(30,Math.trunc(count)||10))});if(error)throw error;return data as DailyPracticeSession}
export async function answerDailyPractice(sessionId:string,questionId:string,selectedIndex:number):Promise<DailyPracticeAnswer>{await requireMemberSession();const {data,error}=await supabase.rpc('daily_practice_answer_v1',{p_session_id:sessionId,p_question_id:questionId,p_selected_index:selectedIndex});if(error)throw error;return data as DailyPracticeAnswer}
export async function getPracticeReviewQueue(limit=5):Promise<PracticeReviewQuestion[]>{await requireMemberSession();const {data,error}=await supabase.rpc('practice_question_review_queue_v1',{p_limit:Math.max(1,Math.min(20,Math.trunc(limit)||5))});if(error)throw error;return Array.isArray(data)?data as PracticeReviewQuestion[]:[]}
export async function reviewPracticeQuestion(questionId:string,status:'expert_approved'|'rejected'){await requireMemberSession();const {data,error}=await supabase.rpc('practice_question_review_v1',{p_question_id:questionId,p_status:status});if(error)throw error;return data}
export async function requestPracticeAnswerReview(questionId:string,reason=''){await requireMemberSession();const {data,error}=await supabase.rpc('practice_answer_review_request_v1',{p_question_id:questionId,p_reason:String(reason||'').trim().slice(0,1000)});if(error)throw error;return data}
export async function getAnswerReviewQueue(limit=20):Promise<AnswerReviewRequest[]>{await requireMemberSession();const {data,error}=await supabase.rpc('practice_answer_review_queue_v1',{p_limit:Math.max(1,Math.min(50,Math.trunc(limit)||20))});if(error)throw error;return Array.isArray(data)?data as AnswerReviewRequest[]:[]}
export async function resolveAnswerReview(requestId:string,resolution:'confirmed'|'corrected'|'dismissed',correctIndex?:number,note=''){await requireMemberSession();const {data,error}=await supabase.rpc('practice_answer_review_resolve_v1',{p_request_id:requestId,p_resolution:resolution,p_correct_index:Number.isInteger(correctIndex)?correctIndex:null,p_note:String(note||'').trim().slice(0,2000)});if(error)throw error;return data}
export async function syncDriveQuizBank(maxFiles=3,allowAi=true):Promise<DriveSyncResult>{
  const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('Vui lòng đăng nhập lại để đồng bộ Drive.');
  const response=await fetch('/api/ai/drive-rag',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:'quiz-sync',maxFiles:Math.max(1,Math.min(5,Math.trunc(maxFiles)||3)),allowAi})});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(String(payload.error||`Drive sync ${response.status}`));return payload as DriveSyncResult;
}
