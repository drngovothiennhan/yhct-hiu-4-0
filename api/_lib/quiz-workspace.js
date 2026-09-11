import {createHash} from 'node:crypto';
import {memberAccess,memberRpc} from './member-access.js';
import {browseQuizFolder,quizRoots,scopedQuizItem,readSelectedQuizFile,readUploadedQuizFile,driveQuizMeta} from './drive-quiz.js';
import {parseMcqDocument,normalizeImportQuestion} from './mcq-parser.js';

export async function handleQuizWorkspace(req,res){
 const access=await memberAccess(req,'admin');if(!access.ok)return res.status(access.status).json({error:access.error});
 const body=req.body||{},action=String(body.action||'');
 const rpc=(type,key='',payload={})=>memberRpc(req,'practice_import_workspace_v2',{p_action:type,p_key:key,p_payload:payload});
 try{
  if(action==='quiz-roots')return res.json({roots:quizRoots()});
  if(action==='quiz-browse')return res.json(await browseQuizFolder(body.folderId,body.pageToken));
  if(action==='quiz-drafts')return res.json({drafts:await rpc('list')});
  if(action==='quiz-draft')return res.json(await rpc('get',body.id));
  if(action==='quiz-preview'){
   const source=body.fileId?await readSelectedQuizFile(body.fileId):await readUploadedQuizFile(String(body.fileName||''),body.base64);
   if(body.subjectFolderId){const folder=await scopedQuizItem(body.subjectFolderId);if(folder.mimeType!=='application/vnd.google-apps.folder')throw new Error('Chủ đề phải là thư mục kiến thức');source.file.parentName=folder.name;source.file.subjectFolderId=folder.id;}
   if(!source.file.parentName)throw new Error('Hãy chọn thư mục kiến thức trước khi tải Word.');
   const parsed=parseMcqDocument(source.text);if(parsed.questions.length>1000)throw new Error('Tài liệu có hơn 1.000 câu; hãy chia nhỏ.');
   const id=createHash('sha256').update(`${source.file.id}|${source.sourceHash}|${source.file.parentName}`).digest('hex');
   const document=driveQuizMeta(source.file,source.sourceHash,source.file.parentName,parsed.needsReview?'needs_review':'ready',`${parsed.total} câu nhận diện; ${parsed.needsReview} câu cần kiểm tra.`);
   return res.json(await rpc('save',id,{...parsed,file:source.file,document,extractionWarnings:source.warnings||[]}));
  }
  if(action==='quiz-commit'){
   const draft=await rpc('get',body.id);if(draft.revision!==body.revision)return res.status(409).json({error:'Bản nháp đã thay đổi. Hãy mở lại.'});
   if(!Array.isArray(body.selection)||!body.selection.length||body.selection.length>200)throw new Error('Chọn từ 1 đến 200 câu mỗi lần nhập.');
   const ids=new Set(),questions=[];
   for(const entry of body.selection){
    const original=draft.questions.find(q=>q.id===entry.id&&!q.imported);if(!original||ids.has(entry.id))throw new Error('Câu bị trùng, đã nhập hoặc không tồn tại.');ids.add(entry.id);
    if(entry.confirmed!==true)throw new Error('Admin phải xác nhận câu hỏi trước khi nhập.');
    const question={...original,stem:entry.stem??original.stem,options:entry.options??original.options,correctIndex:entry.correctIndex??original.correctIndex,explanation:entry.explanation??original.explanation};
    questions.push(normalizeImportQuestion(question,draft.file,true));
   }
   const result=await rpc('commit',body.id,{revision:body.revision,ids:[...ids],questions});return res.json(result);
  }
  return res.status(400).json({error:'Thao tác nhập liệu không hợp lệ'});
 }catch(error){console.warn('quiz-workspace',String(error?.message||error).slice(0,300));return res.status(400).json({error:String(error?.message||'Không xử lý được tài liệu').slice(0,500)})}
}
