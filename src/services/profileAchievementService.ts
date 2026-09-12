import {supabase} from './authService';

export type HiuYQuanProfileProgress={
  xp:number;
  level:number;
  title:string;
  streakDays:number;
  masteryUnlocked:number;
};

type RawProgress={xp?:unknown;level?:unknown;title?:unknown;streak_days?:unknown;mastery_unlocked?:unknown};

const finiteNonNegativeInt=(value:unknown)=>{
  const number=Number(value);
  return Number.isFinite(number)&&number>=0?Math.trunc(number):null;
};

export async function fetchHiuYQuanProfileProgress():Promise<HiuYQuanProfileProgress>{
  const {data,error}=await supabase.rpc('hiu_y_quan_engagement_v15');
  if(error)throw error;
  const raw=(data||{}) as RawProgress;
  const xp=finiteNonNegativeInt(raw.xp),level=finiteNonNegativeInt(raw.level),streakDays=finiteNonNegativeInt(raw.streak_days),masteryUnlocked=finiteNonNegativeInt(raw.mastery_unlocked),title=typeof raw.title==='string'?raw.title.trim():'';
  if(xp===null||level===null||level<1||streakDays===null||masteryUnlocked===null||!title)throw new Error('Tiến độ HIU Y Quán không hợp lệ');
  return {xp,level,title,streakDays,masteryUnlocked};
}
