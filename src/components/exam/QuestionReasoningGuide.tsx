import {useEffect,useState} from 'react';
import {Brain} from 'lucide-react';
import {askServerAi,renderAiAnswer} from '../../modules/ai';

type Props={
  questionId:string;
  subject:string;
  topic?:string;
  stem:string;
  options?:string[];
  sourceLabel?:string;
  selectedIndex?:number|null;
  disabled?:boolean;
};

const clean=(value:string,max=1600)=>String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
const deterministicGuide=(subject:string,topic:string,stem:string,options:string[])=>{
  const labels=options.map((option,index)=>`${String.fromCharCode(65+index)}. ${clean(option,180)}`).join(' · ');
  return `A.I cloud chưa trả được phân tích cho lượt này. Hướng suy luận theo đúng câu hiện tại: 1) Xác định từ khóa quyết định trong “${clean(stem,360)}”. 2) Đối chiếu từng lựa chọn${labels?`: ${labels}`:''}; loại phương án mâu thuẫn trực tiếp với dữ kiện trước. 3) Kiểm tra lại nguyên tắc thuộc ${clean(subject,120)}${topic?` · ${clean(topic,120)}`:''} rồi mới chốt lựa chọn. Nội dung này là quy trình suy luận dự phòng, không phải đáp án A.I.`;
};

export default function QuestionReasoningGuide({questionId,subject,topic='',stem,options=[],sourceLabel='',selectedIndex=null,disabled=false}:Props){
  const [busy,setBusy]=useState(false),[guide,setGuide]=useState(''),[error,setError]=useState('');
  useEffect(()=>{setGuide('');setError('');setBusy(false)},[questionId]);
  const ask=async()=>{
    if(busy||disabled||!stem.trim())return;setBusy(true);setGuide('');setError('');
    const optionText=options.map((option,index)=>`${String.fromCharCode(65+index)}. ${clean(option,500)}`).join(' | ');
    const selection=Number.isInteger(selectedIndex)?`Người học đã chọn ${String.fromCharCode(65+Number(selectedIndex))}.`:'Người học chưa chọn đáp án.';
    const prompt=[
      'Bạn là gia sư luyện thi y khoa/YHCT. Hãy hướng dẫn suy luận CHỈ cho câu hỏi được cung cấp, không trả lời chung chung.',
      'Nếu người học chưa chọn đáp án: KHÔNG tiết lộ đáp án đúng; chỉ nêu dữ kiện quyết định, cách loại trừ và kiến thức cần nhớ.',
      'Nếu người học đã chọn: vẫn ưu tiên giải thích đường suy luận, không suy diễn ngoài dữ kiện câu hỏi.',
      `Môn/nội dung: ${clean(subject,180)}. Chủ đề: ${clean(topic,180)||'không ghi riêng'}.`,
      `Câu hỏi: ${clean(stem,1200)}.`,
      optionText?`Lựa chọn: ${optionText}.`:'',
      selection,
      'Trả lời tiếng Việt, ngắn gọn theo 3 mục: Dữ kiện quyết định; Loại trừ; Điểm cần nhớ.'
    ].filter(Boolean).join('\n');
    try{
      const source={id:`reasoning:${questionId}`,title:`${clean(subject,120)}${topic?` · ${clean(topic,120)}`:''}`,text:[stem,...options,sourceLabel].filter(Boolean).join(' | ').slice(0,4200),url:null};
      const result=await askServerAi(prompt,'exam',[source]);
      setGuide(result.degraded?deterministicGuide(subject,topic,stem,options):renderAiAnswer(result));
    }catch(error){setGuide(deterministicGuide(subject,topic,stem,options));setError((error as Error).message||'A.I cloud chưa khả dụng.')}
    finally{setBusy(false)}
  };
  return <div className="question-reasoning-guide">
    <button type="button" className="secondary question-reasoning-guide__button" disabled={busy||disabled} onClick={()=>void ask()}><Brain/>{busy?'A.I đang phân tích…':'A.I hướng dẫn suy luận'}</button>
    {guide&&<div className="ai-note question-reasoning-guide__answer"><Brain/><span>{guide}</span></div>}
    {error&&<small className="question-reasoning-guide__status">Đã chuyển sang quy trình suy luận dự phòng theo đúng câu hỏi hiện tại.</small>}
  </div>;
}
