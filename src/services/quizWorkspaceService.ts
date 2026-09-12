import {supabase} from './authService';

export type QuizDriveItem={id:string;name:string;mimeType?:string;webViewLink?:string;modifiedTime?:string;folder?:boolean;supported?:boolean};
export type QuizDriveRoot={id:string;name:string};
export type QuizBrowseResult={folder:QuizDriveItem;roots:QuizDriveRoot[];items:QuizDriveItem[];nextPageToken?:string|null};
export type QuizRootsResult={roots:QuizDriveRoot[];driveConfigured:boolean;credentialMode:string};
export type QuizPublishResult={ok:boolean;resourceKey:string;status:string;audience:string;approvedNow:number;questionCount:number;publishedAt:string;title:string};
export type TrustedQuizImportResult={ok:boolean;status:string;fileName:string;total?:number;valid?:number;inserted?:number;updated?:number;message?:string;marker?:string};
export type TrustedQuizSyncResult={ok:boolean;folderId?:string;filesSeen?:number;alreadySynced?:number;pending?:number;processed:TrustedQuizImportResult[]};
export type QuizCandidate={id:string;number:string;stem:string;options:string[];correctIndex:number|null;explanation:string;issues:string[];raw:string;answerEvidence:string;importedSnapshot?:Partial<QuizCandidate>;imported?:boolean};
export type QuizPipelineState='processing'|'needs_review'|'ready'|'error';
export type QuizPipeline={version:number;state:QuizPipelineState;strategy:'generate_chunks'|'extract';totalChunks:number;completedChunks:number;nextChunk:number;failedChunk:number|null;attempt:number;percent:number;retryable:boolean;sourceChars:number;chunkSize:number;startedAt:string;updatedAt:string;completedAt?:string|null;lastError?:string|null};
export type QuizDraft={id:string;revision:number;questions:QuizCandidate[];total:number;ready:number;needsReview:number;warnings:string[];unassigned:string[];sourceText:string;document:{fileName:string;subjectHint:string;driveFileId?:string;mimeType?:string;modifiedTime?:string;sourceHash?:string;syncStatus?:string;syncMessage?:string};file:{id:string;name:string;parentName:string;mimeType?:string;subjectFolderId?:string};pipeline?:QuizPipeline};
export type QuizDraftSummary={id:string;fileName:string;subject:string;total:number;pending:number;pipelineState?:string;pipelineProgress?:number;updatedAt:string};
export type QuizWorkspaceError=Error&{status?:number;draft?:QuizDraft};
export type QuizPipelineUpdate=(draft:QuizDraft)=>void|Promise<void>;

export async function quizWorkspace<T>(action:string,data:Record<string,unknown>={}):Promise<T>{
 const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('Vui lòng đăng nhập admin.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),55000);
 try{
  const r=await fetch('/api/ai/drive-rag',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...data}),signal:controller.signal});
  const result=await r.json().catch(()=>({}));
  if(!r.ok){const error=new Error(result.error||result.message||`Lỗi nhập liệu ${r.status}`) as QuizWorkspaceError;error.status=r.status;if(result.draft)error.draft=result.draft as QuizDraft;throw error}
  return result as T;
 }finally{clearTimeout(timer)}
}

const emit=async(update:QuizPipelineUpdate|undefined,draft:QuizDraft)=>{if(update)await update(draft)};

export async function continueQuizPipeline(initial:QuizDraft,onUpdate?:QuizPipelineUpdate):Promise<QuizDraft>{
 let current=initial;await emit(onUpdate,current);
 while(current.pipeline?.state==='processing'){
  try{current=await quizWorkspace<QuizDraft>('quiz-process-chunk',{id:current.id,revision:current.revision})}
  catch(error){const known=(error as QuizWorkspaceError).draft;current=known||await quizWorkspace<QuizDraft>('quiz-draft',{id:current.id});await emit(onUpdate,current);throw error}
  await emit(onUpdate,current);
 }
 if(current.pipeline?.state==='error'){const error=new Error(current.pipeline.lastError||'Pipeline đang dừng và có thể thử lại.') as QuizWorkspaceError;error.draft=current;throw error}
 return current;
}

export async function startQuizPipeline(data:Record<string,unknown>,onUpdate?:QuizPipelineUpdate):Promise<QuizDraft>{const initial=await quizWorkspace<QuizDraft>('quiz-start',data);return continueQuizPipeline(initial,onUpdate)}
export async function retryQuizPipeline(draft:QuizDraft,onUpdate?:QuizPipelineUpdate):Promise<QuizDraft>{if(!draft.pipeline||draft.pipeline.state!=='error'||draft.pipeline.retryable===false)return draft;const initial=await quizWorkspace<QuizDraft>('quiz-retry',{id:draft.id,revision:draft.revision});return continueQuizPipeline(initial,onUpdate)}

export const getQuizDriveRoots=()=>quizWorkspace<QuizRootsResult>('quiz-roots');
export const browseQuizDrive=(folderId:string)=>quizWorkspace<QuizBrowseResult>('quiz-browse',{folderId});
export const publishQuizDraft=(id:string)=>quizWorkspace<QuizPublishResult>('quiz-publish',{id});
export const syncTrustedApprovedDrive=(maxFiles=5)=>quizWorkspace<TrustedQuizSyncResult>('trusted-quiz-sync',{maxFiles:Math.max(1,Math.min(10,Math.trunc(maxFiles)||5))});
export const tryTrustedQuizUpload=async(fileName:string,base64:string,subjectName:string):Promise<TrustedQuizImportResult|null>=>{try{return await quizWorkspace<TrustedQuizImportResult>('trusted-quiz-upload',{fileName,base64,subjectName})}catch(error){const status=(error as QuizWorkspaceError).status;if(status===400||status===422)return null;throw error}};

export async function sourceFileBase64(file:File){
 if(!/\.(?:docx|txt|pdf)$/i.test(file.name)||file.size>2000000)throw new Error('Chọn tệp .docx, .txt hoặc .pdf tối đa 2 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(binary);
}
export async function wordBase64(file:File){if(!/\.docx$/i.test(file.name))throw new Error('Chọn tệp .docx tối đa 2 MB.');return sourceFileBase64(file)}
