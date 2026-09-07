import { useMemo,useRef,useState } from 'react';
import { Hash,ImagePlus,X } from 'lucide-react';
import type { PostDraft } from '../../services/socialService';

const YHCT_TAGS=['âm dương','ngũ hành','tạng phủ','kinh lạc','châm cứu','phương tễ','dược liệu','dược thiện','bát cương','tứ chẩn','hàn thấp','khí huyết','tâm tỳ','can thận','ôn bệnh'];
const SPECIALTIES=[['general','Tổng quát YHCT'],['noi','Nội khoa YHCT'],['cham-cuu','Châm cứu'],['duoc-lieu','Dược liệu'],['duoc-thien','Dược thiện'],['phuong-te','Phương tễ']];
const POST_TYPES=[['research','Nghiên cứu'],['clinical_case','Ca lâm sàng'],['medicinal_diet','Dược thiện']];
const VISIBILITY=[['public','Công khai'],['members','Thành viên']];

type Props={draft:PostDraft;setDraft:(value:PostDraft)=>void;busy:boolean;editing:boolean;onSave:()=>void;onClose:()=>void};

type Preview={id:string;url:string;name:string;ratio:'16:9'|'1:1'};

const cleanTag=(value:string)=>value.trim().replace(/^#/,'').replace(/\s+/g,' ').slice(0,64);
const meaningfulCitation=(x:string)=>{const v=x.trim();return v.length>=8&&(!/^[-_.\s]+$/.test(v))};

export default function AcademicComposer({draft,setDraft,busy,editing,onSave,onClose}:Props){
  const [tagInput,setTagInput]=useState(''),[previews,setPreviews]=useState<Preview[]>([]),[error,setError]=useState('');
  const fileRef=useRef<HTMLInputElement|null>(null);
  const suggestions=useMemo(()=>YHCT_TAGS.filter(x=>x.includes(tagInput.toLocaleLowerCase('vi-VN'))&&!draft.tags.includes(x)).slice(0,6),[tagInput,draft.tags]);
  const addTag=(raw:string)=>{const tag=cleanTag(raw);if(!tag)return;if(draft.tags.includes(tag)){setTagInput('');return}if(draft.tags.length>=20){setError('Tối đa 20 thẻ.');return}setDraft({...draft,tags:[...draft.tags,tag]});setTagInput('');setError('')};
  const removeTag=(tag:string)=>setDraft({...draft,tags:draft.tags.filter(x=>x!==tag)});
  const addFiles=(files:FileList|null)=>{if(!files)return;const next:Preview[]=[];for(const file of Array.from(files).slice(0,8-previews.length)){if(!file.type.startsWith('image/'))continue;const url=URL.createObjectURL(file);const ratio=/diagram|schema|huyet|acupoint/i.test(file.name)?'1:1':'16:9';next.push({id:crypto.randomUUID(),url,name:file.name.slice(0,120),ratio})}setPreviews(x=>[...x,...next])};
  const removePreview=(id:string)=>setPreviews(items=>items.filter(item=>{if(item.id===id)URL.revokeObjectURL(item.url);return item.id!==id}));
  const citationsText=draft.citations.join('\n');
  const save=()=>{if(draft.title.trim().length<5){setError('Tiêu đề tối thiểu 5 ký tự.');return}if(!draft.citations.some(meaningfulCitation)){setError('Bắt buộc có ít nhất một nguồn trích dẫn/tài liệu tham khảo hợp lệ.');return}setError('');onSave()};

  return <div className="schedule-editor composer-editor academic-composer">
    <div className="between"><div><h3>{editing?'Chỉnh sửa bài học thuật':'Bài học thuật mới'}</h3><small>Bài của thành viên luôn vào hàng đợi kiểm duyệt trước khi xuất hiện trên Newsfeed.</small></div><button className="icon-button" onClick={onClose} aria-label="Đóng"><X/></button></div>
    <label>Tiêu đề<input value={draft.title} maxLength={300} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <label>Chủ chứng / Tóm tắt học thuật<textarea value={draft.chiefComplaint} maxLength={8000} onChange={e=>setDraft({...draft,chiefComplaint:e.target.value})}/></label>
    <details className="composer-taxonomy" open><summary>Phân loại bài viết</summary><div className="three composer-select-grid">
      <label>Chuyên khoa<select value={draft.specialty} onChange={e=>setDraft({...draft,specialty:e.target.value})}>{SPECIALTIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label>Loại bài<select value={draft.postType} onChange={e=>setDraft({...draft,postType:e.target.value as PostDraft['postType']})}>{POST_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
      <label>Hiển thị<select value={draft.visibility} onChange={e=>setDraft({...draft,visibility:e.target.value as PostDraft['visibility']})}>{VISIBILITY.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    </div></details>
    <div className="four"><label>Vọng<textarea value={draft.fourExams.vong} onChange={e=>setDraft({...draft,fourExams:{...draft.fourExams,vong:e.target.value}})}/></label><label>Văn<textarea value={draft.fourExams.van} onChange={e=>setDraft({...draft,fourExams:{...draft.fourExams,van:e.target.value}})}/></label><label>Vấn<textarea value={draft.fourExams.vanHoi} onChange={e=>setDraft({...draft,fourExams:{...draft.fourExams,vanHoi:e.target.value}})}/></label><label>Thiết<textarea value={draft.fourExams.thiet} onChange={e=>setDraft({...draft,fourExams:{...draft.fourExams,thiet:e.target.value}})}/></label></div>
    <label>Biện chứng<textarea value={draft.syndrome} onChange={e=>setDraft({...draft,syndrome:e.target.value})}/></label>
    <label>Pháp trị<textarea value={draft.treatmentPrinciple} onChange={e=>setDraft({...draft,treatmentPrinciple:e.target.value})}/></label>
    <label>Phương<textarea value={draft.formula||''} onChange={e=>setDraft({...draft,formula:e.target.value})}/></label>
    <label>Huyệt<input value={draft.acupoints.join(', ')} onChange={e=>setDraft({...draft,acupoints:e.target.value.split(/[;,]/).map(x=>x.trim()).filter(Boolean).slice(0,50)})}/></label>
    <div className="tag-editor"><label><Hash/> Thẻ YHCT</label><div className="tag-pills">{draft.tags.map(tag=><button key={tag} type="button" className="tag-pill" onClick={()=>removeTag(tag)}>#{tag}<X/></button>)}<input value={tagInput} maxLength={64} placeholder="Gõ thẻ và nhấn Enter/dấu cách" onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&tagInput.trim()){e.preventDefault();addTag(tagInput)}}}/></div>{tagInput&&<div className="tag-suggestions">{suggestions.map(x=><button key={x} onClick={()=>addTag(x)}>#{x}</button>)}</div>}</div>
    <div className="composer-media"><div className="between"><b>Ảnh đính kèm</b><button type="button" onClick={()=>fileRef.current?.click()}><ImagePlus/>Thêm ảnh</button></div><input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={e=>addFiles(e.target.files)}/><div className="image-preview-grid">{previews.map(p=><figure key={p.id} className={p.ratio==='1:1'?'square':'wide'}><img src={p.url} alt={p.name}/><figcaption>{p.name} · {p.ratio}</figcaption><button onClick={()=>removePreview(p.id)} aria-label={`Xóa ${p.name}`}><X/></button></figure>)}</div><small>Preview dùng `object-fit: cover`; ảnh ngang ưu tiên 16:9, sơ đồ/huyệt vị ưu tiên 1:1. File gốc không bị thay đổi trước khi upload.</small></div>
    <label>Nguồn trích dẫn / Tài liệu tham khảo<textarea value={citationsText} placeholder="Tên sách/tạp chí, năm, số xuất bản, DOI hoặc URL bài gốc — mỗi nguồn một dòng" onChange={e=>setDraft({...draft,citations:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,30)})}/></label>
    {error&&<div className="error" role="alert">{error}</div>}
    <div className="schedule-actions"><button disabled={busy} onClick={save}>{busy?'Đang gửi…':editing?'Lưu và gửi duyệt lại':'Gửi vào hàng đợi duyệt'}</button><button className="secondary" onClick={onClose}>Đóng</button></div>
  </div>;
}
