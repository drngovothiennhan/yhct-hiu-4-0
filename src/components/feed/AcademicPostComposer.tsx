import { useEffect,useMemo,useRef,useState } from 'react';
import { ImagePlus,Plus,X } from 'lucide-react';
import type { PostDraft,PostMedia } from '../../services/socialService';

const SPECIALTIES=[['general','Tổng quát YHCT'],['internal','Nội khoa YHCT'],['acupuncture','Châm cứu'],['rehabilitation','Dưỡng sinh · PHCN'],['materia_medica','Dược liệu · Phương tễ'],['medicinal_diet','Dược thiện']] as const;
const POST_TYPES=[['research','Nghiên cứu'],['clinical_case','Ca lâm sàng'],['medicinal_diet','Dược thiện']] as const;
const VISIBILITIES=[['public','Công khai'],['members','Chỉ thành viên']] as const;
const DEFAULT_TAGS=['ChâmCứu','DượcLiệu','PhươngTễ','NộiKhoaYHCT','DưỡngSinh','HuyệtVị','DượcThiện','NghiênCứuYHCT','CaLâmSàng','YHCT'];
const MAX_TAGS=12,MAX_TAG_LENGTH=32,MAX_IMAGES=6,MAX_IMAGE_BYTES=8*1024*1024,MAX_MEDIA_DATA=1_800_000;

function normalizeTag(raw:string){return raw.replace(/^#+/,'').replace(/[^\p{L}\p{N}_-]/gu,'').slice(0,MAX_TAG_LENGTH)}
function meaningfulCitation(value:string){const s=value.trim();if(s.length<12)return false;const compact=s.replace(/[^\p{L}\p{N}]/gu,'');return compact.length>=8&&!/^(test|abc|asdf|khongco|none|null|nguon)$/i.test(compact)}
async function cropImage(file:File):Promise<PostMedia>{
  if(!file.type.startsWith('image/'))throw new Error(`${file.name}: không phải file ảnh.`);
  if(file.size>MAX_IMAGE_BYTES)throw new Error(`${file.name}: ảnh vượt 8 MB.`);
  const source=await createImageBitmap(file);
  const landscape=source.width/source.height>=1.25;
  const ratio=landscape?16/9:1;
  const outW=landscape?1280:960,outH=Math.round(outW/ratio);
  const srcRatio=source.width/source.height;
  let sx=0,sy=0,sw=source.width,sh=source.height;
  if(srcRatio>ratio){sw=Math.round(source.height*ratio);sx=Math.round((source.width-sw)/2)}else{sh=Math.round(source.width/ratio);sy=Math.round((source.height-sh)/2)}
  const canvas=document.createElement('canvas');canvas.width=outW;canvas.height=outH;
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
  ctx.drawImage(source,sx,sy,sw,sh,0,0,outW,outH);source.close();
  let quality=.82,dataUrl=canvas.toDataURL('image/webp',quality);
  while(dataUrl.length>450_000&&quality>.5){quality-=.08;dataUrl=canvas.toDataURL('image/webp',quality)}
  if(dataUrl.length>600_000)throw new Error(`${file.name}: ảnh vẫn quá lớn sau nén.`);
  return{id:crypto.randomUUID(),name:file.name.slice(0,120),url:dataUrl,aspect:landscape?'16:9':'1:1',width:outW,height:outH};
}

export default function AcademicPostComposer({draft,onChange,onSave,onClose,busy,editing=false}:{draft:PostDraft;onChange:(next:PostDraft)=>void;onSave:()=>void;onClose:()=>void;busy:boolean;editing?:boolean}){
  const [tagInput,setTagInput]=useState(''),[error,setError]=useState(''),fileRef=useRef<HTMLInputElement>(null);
  const suggestions=useMemo(()=>DEFAULT_TAGS.filter(x=>!draft.tags.includes(x)&&x.toLocaleLowerCase('vi-VN').includes(tagInput.toLocaleLowerCase('vi-VN'))).slice(0,6),[draft.tags,tagInput]);
  const citationsOk=draft.citations.length>0&&draft.citations.every(meaningfulCitation);
  const canSave=draft.title.trim().length>=5&&draft.chiefComplaint.trim().length>=8&&citationsOk&&!busy;
  useEffect(()=>()=>{for(const m of draft.media)if(m.url.startsWith('blob:'))URL.revokeObjectURL(m.url)},[]);
  const addTag=(raw:string)=>{const value=normalizeTag(raw);if(!value)return;if(draft.tags.length>=MAX_TAGS){setError(`Tối đa ${MAX_TAGS} thẻ.`);return}if(!draft.tags.some(x=>x.toLocaleLowerCase('vi-VN')===value.toLocaleLowerCase('vi-VN')))onChange({...draft,tags:[...draft.tags,value]});setTagInput('');setError('')};
  const tagKey=(e:React.KeyboardEvent<HTMLInputElement>)=>{if(e.key==='Enter'||e.key===' '||e.key===','){e.preventDefault();addTag(tagInput)}else if(e.key==='Backspace'&&!tagInput&&draft.tags.length)onChange({...draft,tags:draft.tags.slice(0,-1)})};
  const pickImages=async(files:FileList|null)=>{if(!files?.length)return;setError('');try{const incoming=[...files].slice(0,Math.max(0,MAX_IMAGES-draft.media.length));const media:PostMedia[]=[];for(const file of incoming)media.push(await cropImage(file));const total=[...draft.media,...media].reduce((sum,x)=>sum+x.url.length,0);if(total>MAX_MEDIA_DATA)throw new Error('Tổng dữ liệu ảnh sau nén vượt giới hạn 1,8 MB. Hãy giảm số ảnh.');onChange({...draft,media:[...draft.media,...media]})}catch(e){setError((e as Error).message)}finally{if(fileRef.current)fileRef.current.value=''}};
  return <section className="academic-composer composer-editor" aria-label="Soạn bài học thuật">
    <header className="academic-composer__head"><div><h3>{editing?'Chỉnh sửa bài học thuật':'Bài học thuật mới'}</h3><p>Bài của thành viên luôn vào hàng đợi kiểm duyệt trước khi xuất hiện trên Newsfeed.</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng"><X/></button></header>
    <details className="composer-classification" open><summary>Phân loại bài viết</summary><div className="composer-select-grid"><label>Chuyên khoa<select value={draft.specialty} onChange={e=>onChange({...draft,specialty:e.target.value})}>{SPECIALTIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Loại bài<select value={draft.postType} onChange={e=>onChange({...draft,postType:e.target.value as PostDraft['postType']})}>{POST_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Hiển thị<select value={draft.visibility} onChange={e=>onChange({...draft,visibility:e.target.value as PostDraft['visibility']})}>{VISIBILITIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div></details>
    <label>Tiêu đề<input maxLength={300} value={draft.title} onChange={e=>onChange({...draft,title:e.target.value})}/></label>
    <label>Chủ chứng / Tóm tắt học thuật<textarea maxLength={8000} value={draft.chiefComplaint} onChange={e=>onChange({...draft,chiefComplaint:e.target.value})}/></label>
    <div className="four"><label>Vọng<textarea value={draft.fourExams.vong} onChange={e=>onChange({...draft,fourExams:{...draft.fourExams,vong:e.target.value}})}/></label><label>Văn<textarea value={draft.fourExams.van} onChange={e=>onChange({...draft,fourExams:{...draft.fourExams,van:e.target.value}})}/></label><label>Vấn<textarea value={draft.fourExams.vanHoi} onChange={e=>onChange({...draft,fourExams:{...draft.fourExams,vanHoi:e.target.value}})}/></label><label>Thiết<textarea value={draft.fourExams.thiet} onChange={e=>onChange({...draft,fourExams:{...draft.fourExams,thiet:e.target.value}})}/></label></div>
    <label>Bát cương<input value={draft.eightPrinciples.join(', ')} onChange={e=>onChange({...draft,eightPrinciples:e.target.value.split(/[;,]/).map(x=>x.trim()).filter(Boolean)})}/></label>
    <label>Biện chứng<textarea value={draft.syndrome} onChange={e=>onChange({...draft,syndrome:e.target.value})}/></label><label>Pháp trị<textarea value={draft.treatmentPrinciple} onChange={e=>onChange({...draft,treatmentPrinciple:e.target.value})}/></label><label>Phương<textarea value={draft.formula||''} onChange={e=>onChange({...draft,formula:e.target.value})}/></label><label>Huyệt<input value={draft.acupoints.join(', ')} onChange={e=>onChange({...draft,acupoints:e.target.value.split(/[;,]/).map(x=>x.trim()).filter(Boolean)})}/></label>
    <div className="tag-editor"><span className="field-title">#tag YHCT</span><div className="tag-pills">{draft.tags.map(t=><span key={t}>#{t}<button type="button" onClick={()=>onChange({...draft,tags:draft.tags.filter(x=>x!==t)})} aria-label={`Xóa ${t}`}><X/></button></span>)}<input value={tagInput} maxLength={MAX_TAG_LENGTH} onChange={e=>setTagInput(e.target.value)} onKeyDown={tagKey} onBlur={()=>tagInput&&addTag(tagInput)} placeholder="Nhập tag + Enter/Space"/></div>{tagInput&&suggestions.length>0&&<div className="tag-suggestions">{suggestions.map(t=><button type="button" key={t} onMouseDown={e=>e.preventDefault()} onClick={()=>addTag(t)}>#{t}</button>)}</div>}</div>
    <div className="media-editor"><div className="between"><div><b>Ảnh minh họa</b><small>Tự crop 16:9 cho ảnh ngang, 1:1 cho sơ đồ/huyệt vị · tối đa {MAX_IMAGES} ảnh.</small></div><button type="button" className="secondary" disabled={draft.media.length>=MAX_IMAGES} onClick={()=>fileRef.current?.click()}><ImagePlus/>Thêm ảnh</button></div><input ref={fileRef} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>void pickImages(e.target.files)}/>{draft.media.length>0&&<div className="media-preview-grid">{draft.media.map(m=><figure key={m.id} className={`media-${m.aspect.replace(':','x')}`}><img src={m.url} alt={m.name}/><figcaption>{m.aspect}<button type="button" onClick={()=>onChange({...draft,media:draft.media.filter(x=>x.id!==m.id)})}><X/></button></figcaption></figure>)}</div>}</div>
    <label>Nguồn trích dẫn / Tài liệu tham khảo <textarea className={!citationsOk&&draft.citations.length?'invalid-field':''} value={draft.citations.join('\n')} onChange={e=>onChange({...draft,citations:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)})} placeholder="Ví dụ: Nguyễn Văn A. Giáo trình YHCT...; DOI: 10.xxxx/... hoặc URL nghiên cứu gốc"/></label><small className={citationsOk?'citation-ok':'citation-help'}>{citationsOk?'Nguồn hợp lệ để gửi kiểm duyệt.':'Bắt buộc ít nhất 1 nguồn có ý nghĩa; không chấp nhận chuỗi test/abc/nguồn.'}</small>
    {error&&<div className="error" role="alert">{error}</div>}<div className="schedule-actions"><button disabled={!canSave} onClick={onSave}>{busy?'Đang gửi…':<><Plus/>Gửi kiểm duyệt</>}</button><button className="secondary" onClick={onClose}>Đóng</button></div>
  </section>;
}
