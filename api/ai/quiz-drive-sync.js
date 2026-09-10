import {memberAccess,memberRpc} from '../_lib/member-access.js';
import {driveQuizMeta,generateMcqsFromStudyText,listQuizDocuments,parseExplicitMcqs,readQuizDocument} from '../_lib/drive-quiz.js';

const clean=(v,max=400)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);

export default async function handler(req,res){
  const started=Date.now();res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const access=await memberAccess(req,'admin');if(!access.ok)return res.status(access.status).json({error:access.error});
  const maxFiles=Math.max(1,Math.min(5,Number(req.body?.maxFiles)||3)),allowAi=req.body?.allowAi!==false;
  try{
    const listing=await listQuizDocuments(maxFiles);if(!listing.configured)return res.status(200).json({ok:false,degraded:true,reason:listing.reason,folderId:listing.folder,processed:[]});
    const processed=[];
    for(const file of listing.files){
      const row={driveFileId:String(file.id||''),fileName:clean(file.name,300),status:'error',parsed:0,generated:0,inserted:0,updated:0,message:''};
      try{
        const source=await readQuizDocument(file),parsed=parseExplicitMcqs(source.text,file);let questions=parsed,status='ready',message='Đã nhận diện câu hỏi và đáp án trực tiếp từ DOCX.';
        if(!parsed.length){
          if(allowAi){
            try{const ai=await generateMcqsFromStudyText(source.text,file);questions=ai.questions;row.generated=questions.length;if(questions.length){status='needs_review';message='A.I đã tạo câu hỏi có dẫn chứng từ nội dung; cần duyệt trước khi cấp cho sinh viên.'}else{status='needs_ai_conversion';message=`Chưa tạo được câu hỏi có căn cứ: ${ai.reason||'unknown'}.`}}catch(error){status='needs_ai_conversion';message=`A.I chuyển đổi tạm chưa sẵn sàng: ${clean(error?.message,220)}`}
          }else{status='needs_ai_conversion';message='DOCX là tài liệu học tập, chưa có câu hỏi/đáp án định dạng rõ; cần chạy lớp A.I chuyển đổi.'}
        }
        row.parsed=parsed.length;
        const meta=driveQuizMeta(file,source.sourceHash,questions[0]?.subject||row.fileName.replace(/\.docx$/i,''),status,message);
        const result=await memberRpc(req,'practice_drive_ingest_admin_v1',{p_document:meta,p_questions:questions});
        row.status=status;row.inserted=Number(result?.inserted||0);row.updated=Number(result?.updated||0);row.message=message;
      }catch(error){
        row.status='error';row.message=clean(error?.message||'Không xử lý được tài liệu.',300);
        try{await memberRpc(req,'practice_drive_ingest_admin_v1',{p_document:{driveFileId:row.driveFileId,fileName:row.fileName||'DOCX không xác định',mimeType:String(file.mimeType||''),modifiedTime:file.modifiedTime||null,sourceHash:`error-${row.driveFileId}`,subjectHint:row.fileName.replace(/\.docx$/i,''),syncStatus:'error',syncMessage:row.message},p_questions:[]})}catch{}
      }
      processed.push(row);
    }
    const latencyMs=Date.now()-started;res.setHeader('Server-Timing',`quiz-drive;dur=${latencyMs}`);
    return res.status(200).json({ok:true,degraded:false,folderId:listing.folder,filesFound:listing.files.length,processed,latencyMs});
  }catch(error){
    const latencyMs=Date.now()-started;console.warn(JSON.stringify({event:'quiz_drive_sync',ok:false,role:access.role,latencyMs,error:clean(error?.message,240)}));
    return res.status(200).json({ok:false,degraded:true,reason:'drive_sync_failed',message:clean(error?.message||'Drive sync failed',300),processed:[],latencyMs});
  }
}
