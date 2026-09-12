import {learningContentAccess,memberRpc} from './member-access.js';
import {upsertLearningResource} from './knowledge-gateway.js';

const clean=(value,max=400)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);

export async function handleQuizPublish(req,res){
  const access=await learningContentAccess(req);
  if(!access.ok)return res.status(access.status).json({error:access.error});
  const draftId=clean(req.body?.id,240);
  if(!draftId)return res.status(400).json({error:'Thiếu bản nháp cần phát hành.'});
  try{
    const draft=await memberRpc(req,'practice_import_workspace_v2',{p_action:'get',p_key:draftId,p_payload:{}});
    const questions=Array.isArray(draft?.questions)?draft.questions:[];
    const valid=questions.filter(q=>Number.isInteger(q?.correctIndex)&&q.correctIndex>=0&&q.correctIndex<=3);
    const pending=valid.filter(q=>!q?.imported);
    const imported=valid.filter(q=>q?.imported);
    if(pending.length)return res.status(409).json({error:`Còn ${pending.length} câu hợp lệ chưa được nhập. Hãy hoàn tất bước Duyệt trước khi phát hành.`,pending:pending.length});
    if(!imported.length)return res.status(400).json({error:'Chưa có câu hỏi đã duyệt để phát hành.'});

    const sourceFileId=clean(draft?.document?.driveFileId||draft?.file?.id,2048);
    const fileName=clean(draft?.document?.fileName||draft?.file?.name,300);
    if(!sourceFileId||!fileName)throw new Error('Thiếu provenance của tài liệu nguồn.');
    const provider=sourceFileId.startsWith('upload-')?'upload':'drive';
    const registered=await upsertLearningResource(req,{
      title:fileName,
      resourceType:'quiz_source',
      audience:'private',
      source:{
        provider,
        id:sourceFileId,
        version:clean(draft?.document?.modifiedTime||draft?.document?.sourceHash,300),
        mimeType:clean(draft?.document?.mimeType||draft?.file?.mimeType,240),
        contentHash:clean(draft?.document?.sourceHash,160),
        metadata:{subject:clean(draft?.document?.subjectHint||draft?.file?.parentName,160),pipelineVersion:Number(draft?.pipeline?.version||0)||null}
      }
    });
    if(!registered.ok)return res.status(registered.status||400).json({error:registered.error||'Không đăng ký được tài nguyên.'});
    const resourceKey=String(registered.data?.resourceKey||'');
    const published=await memberRpc(req,'learning_quiz_publish_v1',{p_resource_key:resourceKey,p_source_file_id:sourceFileId});
    return res.status(200).json({ok:true,...published,title:fileName});
  }catch(error){
    const message=clean(error?.message||'Không thể phát hành quiz.',300);
    return res.status(/required|permission|manager/i.test(message)?403:400).json({error:message});
  }
}
