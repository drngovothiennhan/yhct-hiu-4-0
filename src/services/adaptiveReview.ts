export type ReviewCard={id:string;subject?:string;topic:string;stem:string;answer:string;source:string;due:number;interval:number;streak:number;lastAttempt:string};
const DAY=86400000;
const key=(identity:string|null)=>`yhct-review-v1:${identity||'guest'}`;
function validReviewCard(c:ReviewCard){return c&&typeof c.id==='string'&&typeof c.topic==='string'&&typeof c.stem==='string'&&typeof c.answer==='string'&&typeof c.source==='string'&&(c.subject===undefined||typeof c.subject==='string')&&Number.isFinite(c.due)&&Number.isFinite(c.interval)&&c.interval>=0&&Number.isInteger(c.streak)&&c.streak>=0}
export function scheduleReview(card:ReviewCard,correct:boolean,attempt:string,now=Date.now()):ReviewCard{
  if(card.lastAttempt===attempt)return card;
  const interval=correct?(card.streak===0?1:Math.min(60,Math.max(1,card.interval)*2)):0;
  return {...card,interval,streak:correct?card.streak+1:0,due:now+(correct?interval*DAY:10*60000),lastAttempt:attempt};
}
export function readReviewCards(identity:string|null):ReviewCard[]{
  try{const data=JSON.parse(localStorage.getItem(key(identity))||'[]');return Array.isArray(data)?data.filter((c:ReviewCard)=>validReviewCard(c)).slice(0,500):[]}catch{return []}
}
export function replaceReviewCards(identity:string|null,cards:unknown){
  if(!Array.isArray(cards))return false;
  const clean=cards.filter((c):c is ReviewCard=>validReviewCard(c as ReviewCard)).slice(0,500);
  try{localStorage.setItem(key(identity),JSON.stringify(clean));window.dispatchEvent(new Event('yhct:review'));return true}catch{return false}
}

export function saveReviewCard(identity:string|null,card:ReviewCard){
  const cards=readReviewCards(identity),next=[card,...cards.filter(c=>c.id!==card.id)].slice(0,500);
  try{localStorage.setItem(key(identity),JSON.stringify(next));window.dispatchEvent(new Event('yhct:review'));return true}catch{return false}
}
export function recordReview(identity:string|null,question:{id:string;subject?:string;topic:string;stem:string},answer:string,source:string,correct:boolean,attempt:string){
  const previous=readReviewCards(identity).find(c=>c.id===question.id);
  const card:ReviewCard={...question,subject:question.subject?.trim()||previous?.subject,answer,source,due:Date.now(),interval:0,streak:0,lastAttempt:'',...previous};
  return saveReviewCard(identity,scheduleReview({...card,...question,subject:question.subject?.trim()||card.subject,answer,source},correct,attempt));
}
