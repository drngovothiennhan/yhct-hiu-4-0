export const LEARNING_QUIZ_PRESET_KEY='yhct-learning-quiz-preset-v1';
export type LearningQuizPreset={count?:10|20|30|50;subject?:string;resourceKey?:string};

export function setLearningQuizPreset(preset:LearningQuizPreset){
  if(typeof sessionStorage==='undefined')return;
  try{sessionStorage.setItem(LEARNING_QUIZ_PRESET_KEY,JSON.stringify(preset))}catch{}
}

export function consumeLearningQuizPreset():LearningQuizPreset|null{
  if(typeof sessionStorage==='undefined')return null;
  try{
    const raw=sessionStorage.getItem(LEARNING_QUIZ_PRESET_KEY);sessionStorage.removeItem(LEARNING_QUIZ_PRESET_KEY);
    if(!raw)return null;
    const value=JSON.parse(raw) as LearningQuizPreset;
    const count=[10,20,30,50].includes(Number(value.count))?Number(value.count) as 10|20|30|50:undefined;
    const subject=String(value.subject||'').trim().slice(0,180)||undefined;
    const resourceKey=/^hiu_res_[0-9a-f]{20}$/.test(String(value.resourceKey||''))?String(value.resourceKey):undefined;
    return {count,subject,resourceKey};
  }catch{return null}
}