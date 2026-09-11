import {supabase} from './authService';
export type QuizDriveItem={id:string;name:string;mimeType?:string;webViewLink?:string;folder?:boolean;supported?:boolean};
export type QuizCandidate={id:string;number:string;stem:string;options:string[];correctIndex:number|null;explanation:string;issues:string[];raw:string;answerEvidence:string;importedSnapshot?:Partial<QuizCandidate>;imported?:boolean};
export type QuizPipelineState='processing'|'needs_review'|'ready'|'error';
export type QuizPipeline={version:number;state:QuizPipelineState;strategy:'generate_chunks'|'extract';totalChunks:number;completedChunks:number;nextChunk:number;failedChunk:number|null;attempt:number;percent:number;retryable:boolean;sourceChars:number;chunkSize:number;startedAt:string;updatedAt:string;completedAt?:string|null;lastError?:string|null};
export type QuizDraft={id:string;revision:number;questions:QuizCandidate[];total:number;ready:number;needsReview:number;warnings:string[];unassigned:string[];sourceText:string;document:{fileName:string;subjectHint:string;syncStatus?:string;syncMessage?:string};file:{id:string;name:string;parentName:string};pipeline?:QuizPipeline};
export type QuizDraftSummary={id:string;fileName:string;subject:string;total:number;pending:number;pipelineState?:string;pipelineProgress?:number;updatedAt:string};
export type QuizWorkspaceError=Error&{status?:number;draft?:QuizDraft};
export async function quizWorkspace<T>(action:string,data:Record<string,unknown>={}):Promise<T>{
 const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('Vui lòng đăng nhập admin.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),55000);
 try{
  const r=await fetch('/api/ai/drive-rag',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...data}),signal:controller.signal});
  const result=await r.json().catch(()=>({}));
  if(!r.ok){const error=new Error(result.error||`Lỗi nhập liệu ${r.status}`) as QuizWorkspaceError;error.status=r.status;if(result.draft)error.draft=result.draft as QuizDraft;throw error}
  return result as T;
 }finally{clearTimeout(timer)}
}
export async function wordBase64(file:File){if(!/\.docx$/i.test(file.name)||file.size>2000000)throw new Error('Chọn tệp .docx tối đa 2 MB.');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)}
