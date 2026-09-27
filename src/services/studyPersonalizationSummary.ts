import type {StudyPersonalization,TopicLearningSignal} from './studyPersonalizationService';

const localDate=(value:string)=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'chưa xác định':new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium',timeZone:'Asia/Ho_Chi_Minh'}).format(date);
};
const accuracy=(topic:TopicLearningSignal)=>`${Math.round(Number(topic.accuracy_pct)||0)}%`;

export function buildStudySummaryText(data:StudyPersonalization):string[]|null{
  const review=data.reviewSummary;
  if(data.state!=='personalized'||!review)return null;
  const weakest=review.weakestTopic,stale=review.staleTopic;
  if(!weakest&&!stale)return null;
  if(stale&&weakest&&stale.subject===weakest.subject&&stale.topic===weakest.topic){
    return [`${stale.subject} · ${stale.topic} có ${accuracy(stale)} chính xác trong ${stale.attempts} lượt và đã ${stale.days_since_seen} ngày từ lần ôn gần nhất.`,`Hôm nay nên xem lại${stale.source_title?` nguồn “${stale.source_title}”`:''} để củng cố chủ đề này.`];
  }
  const sentences:string[]=[];
  if(stale)sentences.push(`${stale.subject} · ${stale.topic} đã ${stale.days_since_seen} ngày chưa được ôn lại${stale.source_title?` (nguồn: “${stale.source_title}”)`:''}.`);
  if(weakest)sentences.push(`Điểm quiz thấp nhất hiện là ${weakest.subject} · ${weakest.topic}: ${accuracy(weakest)} chính xác (${weakest.wrong_count} câu sai trong ${weakest.attempts} lượt); lần làm gần nhất ${localDate(weakest.last_seen_at)}.`);
  if(stale&&weakest)sentences.push(`Ưu tiên hôm nay: ôn ${stale.subject} · ${stale.topic}, rồi củng cố ${weakest.topic}.`);
  else if(weakest)sentences.push(`Ưu tiên hôm nay: củng cố ${weakest.topic}${weakest.source_title?` từ nguồn “${weakest.source_title}”`:''}.`);
  return sentences.slice(0,3);
}
