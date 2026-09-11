import {supabase} from './authService';

export type PracticeQuizConfig={ready:boolean;eligibleCount:number;subjects:string[];pageSize:number;continuous:boolean};
export type PracticeQuizQuestion={id:string;subject:string;topic:string;stem:string;options:string[];sourceFileName:string;generationMethod:'parsed'|'ai_generated';reviewStatus:'source_verified'|'expert_approved'};
export type PracticeQuizPage={ready:boolean;subject:string;offset:number;pageSize:number;total:number;hasMore:boolean;questions:PracticeQuizQuestion[]};
export type PracticeQuizReview={id:string;subject:string;topic:string;selectedIndex:number|null;correctIndex:number;correct:boolean;explanation:string;sourceFileName:string;evidenceText:string};
export type PracticeQuizResult={score:number;correctCount:number;total:number;review:PracticeQuizReview[];submittedAt:string};

const asError=(error:unknown,fallback:string)=>new Error(String((error as {message?:unknown})?.message||fallback));

export async function getPracticeQuizConfig():Promise<PracticeQuizConfig>{
  const {data,error}=await supabase.rpc('practice_quiz_config_v1');
  if(error)throw asError(error,'Không đọc được ngân hàng luyện thi.');
  const x=(data||{}) as Record<string,unknown>;
  return{ready:Boolean(x.ready),eligibleCount:Number(x.eligibleCount||0),subjects:Array.isArray(x.subjects)?x.subjects.map(String):[],pageSize:Number(x.pageSize||25),continuous:Boolean(x.continuous)};
}

export async function getPracticeQuizPage(subject:string,offset:number,seed:string,limit=25):Promise<PracticeQuizPage>{
  const {data,error}=await supabase.rpc('practice_quiz_page_v1',{p_subject:subject,p_offset:Math.max(0,Math.trunc(offset)||0),p_limit:Math.max(1,Math.min(50,Math.trunc(limit)||25)),p_seed:seed});
  if(error)throw asError(error,'Không tải được câu luyện thi.');
  const x=(data||{}) as Record<string,unknown>;
  return{ready:Boolean(x.ready),subject:String(x.subject||''),offset:Number(x.offset||0),pageSize:Number(x.pageSize||limit),total:Number(x.total||0),hasMore:Boolean(x.hasMore),questions:Array.isArray(x.questions)?x.questions as PracticeQuizQuestion[]:[]};
}

export async function submitPracticeQuiz(questions:PracticeQuizQuestion[],answers:Record<string,number>):Promise<PracticeQuizResult>{
  if(!questions.length)throw new Error('Chưa có câu để nộp.');
  let correctCount=0,total=0;const review:PracticeQuizReview[]=[];let submittedAt=new Date().toISOString();
  for(let at=0;at<questions.length;at+=500){
    const batch=questions.slice(at,at+500).map(q=>({questionId:q.id,selectedIndex:Number.isInteger(answers[q.id])?answers[q.id]:null}));
    const {data,error}=await supabase.rpc('practice_quiz_submit_v1',{p_answers:batch});
    if(error)throw asError(error,'Không chấm được bài luyện thi.');
    const part=data as PracticeQuizResult;correctCount+=Number(part.correctCount||0);total+=Number(part.total||0);review.push(...(Array.isArray(part.review)?part.review:[]));submittedAt=part.submittedAt||submittedAt;
  }
  return{score:total?Math.round(correctCount/total*100):0,correctCount,total,review,submittedAt};
}
