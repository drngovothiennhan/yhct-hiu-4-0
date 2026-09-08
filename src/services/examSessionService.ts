import {supabase} from './authService';

export type ExamV2Domain='Bệnh học Đông-Tây y'|'Biện chứng luận trị'|'Phương tễ'|'Châm cứu';
export type ExamV2Question={id:string;domain:ExamV2Domain;topic:string;stem:string;options:string[];sourceRef?:string};
export type ExamV2Config={questionCount:number;durationMinutes:number;domains:ExamV2Domain[];eligibleCount:number|null;expertApprovedCount:number|null;candidateCount:number|null;ready:boolean};
export type ExamV2Session={sessionId:string;questionCount:number;durationMinutes:number;deadlineAt:string;questions:ExamV2Question[]};
export type ExamV2PracticeAnswer={accepted:boolean;correct?:boolean;correctIndex?:number;explanation?:string;sourceRef?:string};
export type ExamV2ReviewItem={id:string;domain:ExamV2Domain;topic:string;selectedIndex:number|null;correctIndex:number;correct:boolean;explanation:string;sourceRef:string};
export type ExamV2Result={score:number;correctCount:number;total:number;review:ExamV2ReviewItem[];submittedAt:string};

const DOMAINS:ExamV2Domain[]=['Bệnh học Đông-Tây y','Biện chứng luận trị','Phương tễ','Châm cứu'];
const PUBLIC_CONFIG:ExamV2Config={questionCount:50,durationMinutes:60,domains:DOMAINS,eligibleCount:null,expertApprovedCount:null,candidateCount:null,ready:false};
const asError=(error:unknown,fallback:string)=>new Error(String((error as {message?:unknown})?.message||fallback));
const isMemberGate=(error:unknown)=>/permission denied|approved member required|member required|jwt|not authenticated/i.test(String((error as {message?:unknown})?.message||''));

export async function getExamConfigV2():Promise<ExamV2Config>{
  const {data,error}=await supabase.rpc('exam_config_v2');
  if(error){if(isMemberGate(error))return PUBLIC_CONFIG;throw asError(error,'Không đọc được cấu hình luyện thi.');}
  const x=(data||{}) as Record<string,unknown>;
  return{
    questionCount:Number(x.questionCount||50),durationMinutes:Number(x.durationMinutes||60),
    domains:Array.isArray(x.domains)?x.domains.map(String) as ExamV2Domain[]:DOMAINS,
    eligibleCount:Number(x.eligibleCount||0),expertApprovedCount:Number(x.expertApprovedCount||0),candidateCount:Number(x.candidateCount||0),ready:Boolean(x.ready)
  };
}

export async function startExamSessionV2(mode:'mock'|'practice'):Promise<ExamV2Session>{
  const {data,error}=await supabase.rpc('exam_session_start_v2',{p_mode:mode});
  if(error)throw asError(error,'Không thể mở phiên luyện thi.');
  const x=(data||{}) as Record<string,unknown>;
  return{
    sessionId:String(x.sessionId||''),questionCount:Number(x.questionCount||50),durationMinutes:Number(x.durationMinutes||60),
    deadlineAt:String(x.deadlineAt||''),questions:Array.isArray(x.questions)?x.questions as ExamV2Question[]:[]
  };
}

export async function saveExamAnswerV2(sessionId:string,questionId:string,selectedIndex:number):Promise<ExamV2PracticeAnswer>{
  const {data,error}=await supabase.rpc('exam_session_answer_v2',{p_session_id:sessionId,p_question_id:questionId,p_selected_index:selectedIndex});
  if(error)throw asError(error,'Không lưu được đáp án.');
  return (data||{accepted:true}) as ExamV2PracticeAnswer;
}

export async function submitExamSessionV2(sessionId:string):Promise<ExamV2Result>{
  const {data,error}=await supabase.rpc('exam_session_submit_v2',{p_session_id:sessionId});
  if(error)throw asError(error,'Không thể nộp bài.');
  return data as ExamV2Result;
}
