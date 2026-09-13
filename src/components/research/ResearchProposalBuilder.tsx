import {useEffect,useMemo,useState} from 'react';
import {Bot,Clock3,Download,FileText,Sparkles,X} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';
import type {ResearchWork} from '../../services/researchService';
import {suggestResearchTopics} from '../../services/researchLocalAi';
import {downloadResearchProposalDocx,type ProposalFormData} from '../../services/researchProposalDocx';

type Props={member:Member;works:ResearchWork[];initialTitle?:string;onClose:()=>void};
type Quota={allowed:boolean;limit:number;remaining:number;used:number;windowHours:number;retryAt?:string|null};
const clean=(v:string)=>v.replace(/\s+/g,' ').trim();
const defaultForm=(member:Member,title=''):ProposalFormData=>({title,chairName:member.fullName||'',studentCode:member.studentCode||'',className:'',studentYear:'',faculty:'Khoa Y - Trường Đại học Quốc tế Hồng Bàng',phone:member.phone||'',email:member.email||'',address:'',adviserName:'',adviserDegree:'',adviserSpecialty:'',adviserUnit:'Khoa Y - Trường Đại học Quốc tế Hồng Bàng',adviserPhone:'',adviserEmail:'',adviserAddress:'',durationMonths:'12',teamMembers:'',overview:'',significance:'',objectives:'',populationScope:'',location:'',mainContents:'',methods:'',expectedResults:'',reportOutline:'',assignments:'',totalBudget:'',progress:'',specialNeeds:'',references:''});
const DESIGNS=['Scoping review','Systematic review','Cross-sectional study','Feasibility study','Cohort study','Case-control study','Experimental study'];
const IDENTITY_FIELDS:[keyof ProposalFormData,string][]=[['title','Tên đề tài'],['chairName','Chủ nhiệm đề tài'],['studentCode','MSSV'],['className','Lớp'],['studentYear','Sinh viên năm thứ'],['faculty','Khoa/Viện/Bộ môn'],['phone','Số điện thoại'],['email','Email'],['address','Địa chỉ liên lạc'],['adviserName','GVHD'],['adviserDegree','Học hàm, học vị'],['adviserSpecialty','Chuyên môn'],['adviserUnit','Đơn vị GVHD'],['adviserPhone','Điện thoại GVHD'],['adviserEmail','Email GVHD'],['adviserAddress','Địa chỉ GVHD'],['durationMonths','Thời gian (tháng, tối đa 12)']];
const WRITING_FIELDS:[keyof ProposalFormData,string][]=[['overview','6. Tổng quan'],['significance','7. Ý nghĩa khoa học, ý nghĩa thực tiễn'],['objectives','8. Mục tiêu nghiên cứu'],['populationScope','9. Đối tượng và phạm vi nghiên cứu'],['location','10. Địa điểm nghiên cứu'],['mainContents','11. Nội dung chủ yếu của đề tài'],['methods','12. Phương pháp nghiên cứu'],['expectedResults','13. Dự kiến kết quả, sản phẩm nghiên cứu'],['reportOutline','14. Bố cục báo cáo tổng kết'],['assignments','15. Phân công công việc'],['totalBudget','16. Tổng kinh phí'],['progress','17. Tiến độ'],['specialNeeds','18. Nhu cầu đặc biệt'],['references','19. Tài liệu tham khảo IEEE']];

export default function ResearchProposalBuilder({member,works,initialTitle='',onClose}:Props){
  const [form,setForm]=useState<ProposalFormData>(()=>defaultForm(member,initialTitle)),[design,setDesign]=useState('Cross-sectional study'),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[quota,setQuota]=useState<Quota|null>(null);
  const topics=useMemo(()=>suggestResearchTopics(form.title||initialTitle,works,4),[form.title,initialTitle,works]);
  const set=(key:keyof ProposalFormData,value:string)=>setForm(current=>({...current,[key]:value}));
  const auth=async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('Phiên đăng nhập không hợp lệ.');return session.access_token};
  const refreshQuota=async()=>{try{const token=await auth(),response=await fetch('/api/ai/research-proposal',{headers:{Authorization:`Bearer ${token}`}}),payload=await response.json();if(response.ok&&payload?.quota)setQuota(payload.quota)}catch{}};
  useEffect(()=>{void refreshQuota()},[]);
  useEffect(()=>{if(initialTitle&&!form.title)setForm(f=>({...f,title:initialTitle}))},[initialTitle,form.title]);

  const geminiAssist=async()=>{
    if(clean(form.title).length<5){setNote('Hãy nhập tên đề tài trước khi dùng Gemini.');return}
    if(quota&&quota.remaining<=0){setNote('Đã dùng đủ 3 lượt Gemini trong chu kỳ 6 giờ. Hãy chỉnh sửa bản hiện có hoặc chờ chu kỳ mới.');return}
    setBusy(true);setNote('Gemini Research đang xây dựng đề cương theo bằng chứng và thiết kế nghiên cứu…');
    try{
      const token=await auth(),evidence=works.slice(0,10).map(w=>({title:w.title,source:w.source,year:w.year,abstract:w.abstract||'',url:w.url}));
      const response=await fetch('/api/ai/research-proposal',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({title:form.title,studyDesign:design,context:`Mục tiêu hiện có: ${form.objectives||'(chưa có)'}; Địa điểm hiện có: ${form.location||'(chưa xác định)'}`,evidence})});
      const payload=await response.json();if(payload?.quota)setQuota(payload.quota);if(!response.ok)throw new Error(payload.error||`Gemini Research lỗi ${response.status}`);
      if(!payload?.draft)throw new Error('Gemini Research không trả về đề cương hợp lệ.');
      setForm(f=>({...f,...payload.draft}));setNote(`Đã tạo đề cương bằng Gemini Research${payload.model?` · ${payload.model}`:''}. Còn ${payload.quota?.remaining??'—'}/3 lượt trong chu kỳ 6 giờ. Kiểm chứng nguồn và xin GVHD duyệt trước khi nộp.`);
    }catch(e){setNote((e as Error).message||'Gemini Research chưa khả dụng. Hệ thống không tạo bản nháp local thay thế.')}finally{setBusy(false)}
  };
  const exportDocx=()=>{if(clean(form.title).length<5){setNote('Tên đề tài cần ít nhất 5 ký tự để xuất Word.');return}downloadResearchProposalDocx(form);setNote('Đã tạo file Word Mẫu 01-SV trên thiết bị. Vui lòng rà soát nội dung, chữ ký và dự toán với GVHD.');};
  const retryText=quota?.retryAt?new Date(quota.retryAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'';

  return <div className="research-proposal-backdrop" onMouseDown={onClose}><section className="research-proposal" role="dialog" aria-modal="true" aria-label="Tạo đề cương nghiên cứu" onMouseDown={e=>e.stopPropagation()}>
    <header><div><span className="kicker">GEMINI RESEARCH PROPOSAL</span><h3><FileText/> Tạo Thuyết minh đề tài Mẫu 01-SV</h3><p>Tra bằng chứng → Gemini xây đề cương → kiểm chứng → xuất Word.</p></div><button className="icon-btn" onClick={onClose} aria-label="Đóng"><X/></button></header>
    <div className="proposal-toolbar"><label>Thiết kế nghiên cứu<select value={design} onChange={e=>setDesign(e.target.value)}>{DESIGNS.map(x=><option key={x}>{x}</option>)}</select></label><div className="proposal-actions"><button className="secondary" disabled={busy||Boolean(quota&&quota.remaining<=0)} onClick={()=>void geminiAssist()}><Bot/>{busy?'Gemini đang tạo…':'Gemini tạo đề cương'}</button><button className="proposal-download" onClick={exportDocx}><Download/> Xuất Word</button></div></div>
    <div className="ai-note proposal-quota"><b><Clock3/> Hạn mức thành viên</b><span>{quota?`${quota.remaining}/${quota.limit} lượt Gemini còn lại · ${quota.windowHours} giờ/chu kỳ${quota.remaining===0&&retryText?` · mở lại khoảng ${retryText}`:''}`:'Đang kiểm tra hạn mức…'}</span></div>
    {topics.length>0&&<div className="proposal-topics"><b><Sparkles/> Gợi ý câu hỏi/đề tài để kiểm chứng</b><div>{topics.map(t=><button type="button" key={t.title} onClick={()=>set('title',t.title)}>{t.title}</button>)}</div></div>}
    <div className="ai-note proposal-guidance"><b>Quy tắc khoa học</b><ul><li>Gemini không được tự tạo PMID/DOI, cỡ mẫu, địa điểm, kinh phí hay phê duyệt đạo đức.</li><li>Khoảng trống và tính mới phải truy ngược được về PubMed/OpenAlex/ClinicalTrials hoặc nguồn đã cung cấp.</li><li>Mục tiêu, thiết kế, biến số, phương pháp thu thập và phân tích phải nhất quán.</li><li>Nội dung thiếu căn cứ phải để trạng thái cần xác nhận với GVHD, không điền đoán.</li></ul></div>
    {note&&<div className="ai-note" role="status">{note}</div>}
    <div className="proposal-section"><h4>1–5. Thông tin đề tài và nhân lực</h4>{IDENTITY_FIELDS.map(([key,label])=><label key={key} className={key==='title'?'span-2':''}>{label}<input value={form[key]} onChange={e=>set(key,e.target.value)} /></label>)}<label className="span-2">Thành viên (mỗi dòng: Họ tên | MSSV | Lớp/Khoa | Học lực | Điện thoại | Chức danh)<textarea value={form.teamMembers} onChange={e=>set('teamMembers',e.target.value)}/></label></div>
    <div className="proposal-section proposal-writing"><h4>6–19. Nội dung nghiên cứu</h4>{WRITING_FIELDS.map(([key,label])=><label key={key}>{label}{key==='totalBudget'?<input value={form[key]} onChange={e=>set(key,e.target.value)} placeholder="Chỉ nhập khi có căn cứ/GVHD xác nhận"/>:<textarea value={form[key]} onChange={e=>set(key,e.target.value)} rows={key==='overview'||key==='methods'||key==='references'?6:4}/>}</label>)}</div>
    <footer><button className="secondary" onClick={onClose}><X/> Đóng</button><button className="proposal-download" onClick={exportDocx}><Download/> Xuất Word Mẫu 01-SV</button></footer>
  </section></div>;
}
