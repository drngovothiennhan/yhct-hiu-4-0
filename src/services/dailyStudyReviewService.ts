import {supabase} from './authService';

export type DailyReviewQuestion={
  id:string;sourceTitle:string;sourceFileId:string;questionType:'multiple_choice'|'short_answer';stem:string;options:string[];
  status:'pending'|'answered';userAnswer:{selectedIndex?:number}|null;isCorrect:boolean|null;
  correctAnswer:string|null;explanation:string|null;evidenceQuote:string|null;
};
export type DailyReview={date:string;hasQuiz:boolean;status:'empty'|'generated'|'completed';generatedAt:string|null;hasEligibleSource:boolean;questions:DailyReviewQuestion[]};
export type DailyReviewResult={score:number;correctCount:number;total:number;review:Array<{id:string;selectedIndex:number;correctAnswer:string;correct:boolean;explanation:string;evidenceQuote:string;sourceTitle:string;sourceFileId:string}>};

export async function getTodayDailyReview():Promise<DailyReview>{
  const {data,error}=await supabase.rpc('daily_study_review_today_v1');
  if(error)throw new Error(error.message||'Không thể tải bài ôn tập hôm nay.');
  const payload=data as Partial<DailyReview>|null;
  return{
    date:String(payload?.date||''),hasQuiz:Boolean(payload?.hasQuiz),
    status:payload?.status==='completed'?'completed':payload?.status==='generated'?'generated':'empty',
    generatedAt:typeof payload?.generatedAt==='string'?payload.generatedAt:null,
    hasEligibleSource:Boolean(payload?.hasEligibleSource),
    questions:Array.isArray(payload?.questions)?payload.questions.filter(question=>question&&typeof question.id==='string'&&typeof question.stem==='string'&&Array.isArray(question.options)).slice(0,5):[]
  };
}

export async function submitTodayDailyReview(answers:Array<{questionId:string;selectedIndex:number}>):Promise<DailyReviewResult>{
  const {data,error}=await supabase.rpc('daily_study_review_submit_v1',{p_answers:answers});
  if(error)throw new Error(error.message||'Không thể nộp bài ôn tập.');
  const payload=data as Partial<DailyReviewResult>|null;
  if(!payload||!Array.isArray(payload.review))throw new Error('Kết quả bài ôn chưa hợp lệ.');
  if(typeof window!=='undefined')window.dispatchEvent(new Event('yhct:review'));
  return{score:Number(payload.score)||0,correctCount:Number(payload.correctCount)||0,total:Number(payload.total)||0,review:payload.review};
}
