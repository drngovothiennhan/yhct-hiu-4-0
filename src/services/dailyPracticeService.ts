import {supabase} from './authService';

export type DailyPracticeConfig={ready:boolean;eligibleCount:number;needsReviewCount:number;practiceDate:string;hasTodaySession:boolean;defaultCount:number};
export type DailyPracticeQuestion={id:string;subject:string;topic:string;stem:string;options:string[];sourceFileName:string;generationMethod:'parsed'|'ai_generated';reviewStatus:'source_verified'|'expert_approved'};
export type DailyPracticeSession={ready:boolean;sessionId?:string;practiceDate:string;status?:'active'|'completed';questionCount?:number;available?:number;answers?:Record<string,number>;questions:DailyPracticeQuestion[]};
export type DailyPracticeAnswer={accepted:boolean;alreadyAnswered:boolean;correct:boolean;selectedIndex:number;correctIndex:number;explanation:string;sourceFileName:string;reviewStatus:string};
export type DriveSyncRow={driveFileId:string;fileName:string;status:string;parsed:number;generated:number;inserted:number;updated:number;message:string};
export type DriveSyncResult={ok:boolean;degraded:boolean;reason?:string;folderId?:string;filesFound?:number;processed:DriveSyncRow[];latencyMs?:number};
export type PracticeReviewQuestion={id:string;subject:string;topic:string;stem:string;options:string[];correctIndex:number;explanation:string;sourceFileName:string;sourceModifiedTime?:string|null;generationMethod:string;provenance?:Record<string,unknown>;createdAt:string};

export async function getDailyPracticeConfig():Promise<DailyPracticeConfig>{const {data,error}=await supabase.rpc('daily_practice_config_v1');if(error)throw error;return data as DailyPracticeConfig}
export async function getTodayDailyPractice(count=10):Promise<DailyPracticeSession>{const {data,error}=await supabase.rpc('daily_practice_today_v1',{p_count:Math.max(1,Math.min(30,Math.trunc(count)||10))});if(error)throw error;return data as DailyPracticeSession}
export async function answerDailyPractice(sessionId:string,questionId:string,selectedIndex:number):Promise<DailyPracticeAnswer>{const {data,error}=await supabase.rpc('daily_practice_answer_v1',{p_session_id:sessionId,p_question_id:questionId,p_selected_index:selectedIndex});if(error)throw error;return data as DailyPracticeAnswer}
export async function getPracticeReviewQueue(limit=5):Promise<PracticeReviewQuestion[]>{const {data,error}=await supabase.rpc('practice_question_review_queue_v1',{p_limit:Math.max(1,Math.min(20,Math.trunc(limit)||5))});if(error)throw error;return Array.isArray(data)?data as PracticeReviewQuestion[]:[]}
export async function reviewPracticeQuestion(questionId:string,status:'expert_approved'|'rejected'){const {data,error}=await supabase.rpc('practice_question_review_v1',{p_question_id:questionId,p_status:status});if(error)throw error;return data}
export async function syncDriveQuizBank(maxFiles=3,allowAi=true):Promise<DriveSyncResult>{
  const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('Vui lòng đăng nhập lại để đồng bộ Drive.');
  const response=await fetch('/api/ai/drive-rag',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:'quiz-sync',maxFiles:Math.max(1,Math.min(5,Math.trunc(maxFiles)||3)),allowAi})});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(String(payload.error||`Drive sync ${response.status}`));return payload as DriveSyncResult;
}
