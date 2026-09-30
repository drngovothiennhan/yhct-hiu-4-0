import {readReviewCards,type ReviewCard} from './adaptiveReview';

/** Tín hiệu học tập rút ra từ thẻ ôn tập THẬT của người dùng (localStorage). Không bịa dữ liệu. */
export type StudyCoachSignal={dueCount:number;weakTopics:string[];strongStreak:number;totalCards:number};

const clean=(value:unknown,max:number)=>String(value??'').replace(/[|\n\r]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

export function summarizeStudyCoach(cards:ReviewCard[],now=Date.now()):StudyCoachSignal{
  const valid=Array.isArray(cards)?cards:[];
  const due=valid.filter(card=>card.due<=now);
  const weak=new Map<string,number>();
  for(const card of valid){
    if(card.streak===0&&card.lastAttempt){
      const label=clean(card.subject||card.topic,40);
      if(label)weak.set(label,(weak.get(label)||0)+1);
    }
  }
  const weakTopics=[...weak.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3).map(([label])=>label);
  const strongStreak=valid.reduce((max,card)=>Math.max(max,card.streak),0);
  return{dueCount:due.length,weakTopics,strongStreak,totalCards:valid.length};
}

/** Chuỗi ngữ cảnh ngắn cho PAGE_CONTEXT; rỗng khi chưa có dữ liệu thật. */
export function studyCoachContext(signal:StudyCoachSignal):string{
  if(!signal.totalCards)return'';
  return[
    `review_due=${signal.dueCount}`,
    signal.weakTopics.length?`weak_topics=${signal.weakTopics.join(', ')}`:'',
    signal.strongStreak>0?`best_streak=${signal.strongStreak}`:''
  ].filter(Boolean).join(' | ');
}

export function readStudyCoachContext(identity:string|null,now=Date.now()):string{
  try{return studyCoachContext(summarizeStudyCoach(readReviewCards(identity),now))}catch{return''}
}
