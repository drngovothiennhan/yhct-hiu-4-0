import {supabase} from './authService';

export type LessonProgress={
  status:'in_progress'|'completed';
  lastSectionId:string;
  progressPct:number;
  activeSeconds:number;
  lastActivityAt:string|null;
  completedAt:string|null;
};

export type TopicLearningSignal={
  subject:string;
  topic:string;
  correct_count:number;
  wrong_count:number;
  attempts:number;
  last_seen_at:string;
  accuracy_pct:number;
  source_file_id:string|null;
  source_title:string|null;
  days_since_seen:number;
};

export type StudyPersonalization={
  hasData:boolean;
  state:'empty'|'lesson_only'|'personalized';
  generatedFor:string;
  lessonProgress:LessonProgress|null;
  recommendation:null|{
    kind:'resume_lesson'|'review_weak_topic'|'standard_lesson'|'curriculum_missing';
    lessonId?:string;
    sectionId?:string;
    progressPct?:number;
    activeSeconds?:number;
    lastActivityAt?:string;
    subject?:string;
    topic?:string;
    accuracyPct?:number;
    wrongCount?:number;
    attemptCount?:number;
    lastSeenAt?:string;
    sourceFileId?:string|null;
    sourceTitle?:string|null;
    label:string;
  };
  reviewSummary:null|{weakestTopic:TopicLearningSignal|null;staleTopic:TopicLearningSignal|null;lastQuizAt:string|null};
};

const cleanLessonProgress=(value:unknown):LessonProgress|null=>{
  if(!value||typeof value!=='object')return null;
  const raw=value as Record<string,unknown>;
  if(raw.status!=='in_progress'&&raw.status!=='completed')return null;
  return{
    status:raw.status,
    lastSectionId:typeof raw.lastSectionId==='string'?raw.lastSectionId:'overview',
    progressPct:Math.max(0,Math.min(100,Number(raw.progressPct)||0)),
    activeSeconds:Math.max(0,Number(raw.activeSeconds)||0),
    lastActivityAt:typeof raw.lastActivityAt==='string'?raw.lastActivityAt:null,
    completedAt:typeof raw.completedAt==='string'?raw.completedAt:null
  };
};

export async function getStudyPersonalization():Promise<StudyPersonalization>{
  const {data,error}=await supabase.rpc('study_os_personalization_summary_v1');
  if(error)throw new Error(error.message||'Không thể tải gợi ý học tập cá nhân.');
  const raw=data as Record<string,unknown>|null;
  if(!raw||typeof raw!=='object')throw new Error('Dữ liệu cá nhân hóa chưa hợp lệ.');
  const recommendation=raw.recommendation&&typeof raw.recommendation==='object'?raw.recommendation as StudyPersonalization['recommendation']:null;
  const reviewRaw=raw.reviewSummary&&typeof raw.reviewSummary==='object'?raw.reviewSummary as Record<string,unknown>:null;
  return{
    hasData:Boolean(raw.hasData),
    state:raw.state==='personalized'?'personalized':raw.state==='lesson_only'?'lesson_only':'empty',
    generatedFor:typeof raw.generatedFor==='string'?raw.generatedFor:'',
    lessonProgress:cleanLessonProgress(raw.lessonProgress),
    recommendation,
    reviewSummary:reviewRaw?{
      weakestTopic:reviewRaw.weakestTopic&&typeof reviewRaw.weakestTopic==='object'?reviewRaw.weakestTopic as TopicLearningSignal:null,
      staleTopic:reviewRaw.staleTopic&&typeof reviewRaw.staleTopic==='object'?reviewRaw.staleTopic as TopicLearningSignal:null,
      lastQuizAt:typeof reviewRaw.lastQuizAt==='string'?reviewRaw.lastQuizAt:null
    }:null
  };
}

export async function getStudyLessonProgress():Promise<LessonProgress|null>{
  const {data,error}=await supabase.rpc('study_lesson_progress_read_v1',{p_lesson_id:'tcm-herbs-formulas-v1'});
  if(error)throw new Error(error.message||'Không thể khôi phục tiến độ bài học.');
  const raw=data as Record<string,unknown>|null;
  if(!raw?.hasProgress)return null;
  return cleanLessonProgress(raw);
}

export async function saveStudyLessonProgress(input:{sectionId:string;progressPct:number;activeSeconds?:number;completed?:boolean}):Promise<LessonProgress>{
  const {data,error}=await supabase.rpc('study_lesson_progress_save_v1',{
    p_lesson_id:'tcm-herbs-formulas-v1',
    p_section_id:input.sectionId,
    p_progress_pct:input.progressPct,
    p_active_seconds:Math.max(0,Math.min(120,Math.floor(input.activeSeconds||0))),
    p_completed:Boolean(input.completed)
  });
  if(error)throw new Error(error.message||'Không thể lưu tiến độ bài học.');
  const progress=cleanLessonProgress(data);
  if(!progress)throw new Error('Tiến độ bài học nhận về chưa hợp lệ.');
  return progress;
}
