import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,BookOpen,CheckCircle2,Copy,FlaskConical,Leaf,Loader2,QrCode,Search,ShieldAlert,Sparkles} from 'lucide-react';
import {supabase} from '../../services/authService';
import './smart-herb.css';

type EvidenceSource={label:string;url:string;pmid?:string};
type SmartHerb={
  slug:string;
  vietnamese_name:string;
  latin_name:string;
  chinese_name:string;
  identification:string;
  part_used:string;
  traditional_summary:string;
  evidence_summary:string;
  safety_note:string;
  evidence_level:'educational'|'preclinical'|'mixed'|'clinical_review';
  source_urls:EvidenceSource[];
};

const FALLBACK_HERBS:SmartHerb[]=[
  {
    slug:'duong-quy',vietnamese_name:'Đương quy',latin_name:'Angelica sinensis',chinese_name:'当归',
    identification:'Rễ khô có mùi thơm đặc trưng; mặt cắt thường vàng trắng đến vàng nâu. Dùng mẫu chuẩn có nguồn gốc rõ ràng để học nhận diện.',
    part_used:'Rễ (Radix Angelicae Sinensis).',
    traditional_summary:'Trong Y học cổ truyền Đông Á, Đương quy được học trong nhóm dược liệu liên quan đến huyết. Nội dung này phục vụ học tập và không thay thế chỉ định điều trị.',
    evidence_summary:'Tài liệu tổng quan gần đây mô tả thành phần hóa học và các hướng nghiên cứu dược lý, nhưng mức độ bằng chứng khác nhau theo từng chỉ định. Không suy diễn kết quả tiền lâm sàng thành hiệu quả điều trị ở người.',
    safety_note:'Cần xem xét tương tác thuốc, thai kỳ, nguy cơ chảy máu và bệnh nền theo từng trường hợp. Không tự sử dụng để điều trị chỉ dựa trên thông tin của nền tảng.',
    evidence_level:'mixed',
    source_urls:[{label:'PubMed – Review 2026 về Đương quy và thành phần hoạt tính',url:'https://pubmed.ncbi.nlm.nih.gov/41976194/',pmid:'41976194'}]
  },
  {
    slug:'sinh-khuong',vietnamese_name:'Sinh khương (Gừng tươi)',latin_name:'Zingiber officinale',chinese_name:'生姜',
    identification:'Thân rễ tươi phân nhánh, mùi thơm và vị cay đặc trưng. Cần phân biệt mẫu tươi, khô và chế biến khi học dược liệu.',
    part_used:'Thân rễ tươi.',
    traditional_summary:'Gừng được dùng rộng rãi trong ẩm thực và nhiều hệ thống y học truyền thống. Hồ sơ này tập trung vào nhận diện, học thuật và truy xuất bằng chứng.',
    evidence_summary:'Các tổng quan ghi nhận nhiều nghiên cứu tiền lâm sàng và một số dữ liệu lâm sàng tùy lĩnh vực; vẫn còn khoảng trống bằng chứng với nhiều tuyên bố sức khỏe.',
    safety_note:'Không mặc định “tự nhiên” đồng nghĩa “an toàn tuyệt đối”. Liều dùng, tương tác thuốc và bệnh nền cần được đánh giá trong bối cảnh chuyên môn.',
    evidence_level:'mixed',
    source_urls:[{label:'PubMed – Review 2024 về Zingiber officinale',url:'https://pubmed.ncbi.nlm.nih.gov/39199328/',pmid:'39199328'}]
  },
  {
    slug:'cam-thao',vietnamese_name:'Cam thảo',latin_name:'Glycyrrhiza uralensis',chinese_name:'甘草',
    identification:'Rễ hình trụ, mặt ngoài vàng nâu đến nâu đỏ; vị ngọt rõ. Việc xác định loài cần dựa vào mẫu chuẩn và tài liệu dược liệu chính thống.',
    part_used:'Rễ và thân rễ.',
    traditional_summary:'Cam thảo là dược liệu xuất hiện trong nhiều bài thuốc cổ truyền. Nền tảng chỉ trình bày kiến thức học thuật, không đưa ra phác đồ cá nhân.',
    evidence_summary:'Glycyrrhizic acid và các thành phần của Glycyrrhiza đang được nghiên cứu rộng rãi. Phần lớn cơ chế không đồng nghĩa với bằng chứng hiệu quả cho mọi chỉ định lâm sàng.',
    safety_note:'Cam thảo có thể gây tác dụng bất lợi và tương tác thuốc, đặc biệt khi dùng kéo dài hoặc liều cao. Cần chú ý huyết áp, kali máu và thuốc đang sử dụng.',
    evidence_level:'mixed',
    source_urls:[{label:'PubMed – Review 2026 về glycyrrhizic acid',url:'https://pubmed.ncbi.nlm.nih.gov/42543293/',pmid:'42543293'}]
  }
];

const levelLabel:Record<SmartHerb['evidence_level'],string>={
  educational:'Kiến thức giáo dục',preclinical:'Chủ yếu tiền lâm sàng',mixed:'Bằng chứng hỗn hợp',clinical_review:'Có tổng quan lâm sàng'
};

export default function SmartHerbCenter(){
  const [herbs,setHerbs]=useState<SmartHerb[]>(FALLBACK_HERBS);
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  const initialSlug=useMemo(()=>new URLSearchParams(window.location.search).get('herb')||'duong-quy',[]);
  const [selectedSlug,setSelectedSlug]=useState(initialSlug);
  const [copied,setCopied]=useState(false);
  const [quizAnswer,setQuizAnswer]=useState<string>('');

  useEffect(()=>{
    let active=true;
    (async()=>{
      const {data,error}=await supabase.from('smart_herbs')
        .select('slug,vietnamese_name,latin_name,chinese_name,identification,part_used,traditional_summary,evidence_summary,safety_note,evidence_level,source_urls')
        .eq('active',true).order('vietnamese_name');
      if(!active)return;
      if(!error&&Array.isArray(data)&&data.length){
        const normalized=data.map(row=>({...row,source_urls:Array.isArray(row.source_urls)?row.source_urls:[]})) as SmartHerb[];
        setHerbs(normalized);
        if(!normalized.some(h=>h.slug===initialSlug))setSelectedSlug(normalized[0].slug);
      }
      setLoading(false);
    })().catch(()=>setLoading(false));
    return()=>{active=false};
  },[initialSlug]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLocaleLowerCase('vi');
    if(!q)return herbs;
    return herbs.filter(h=>`${h.vietnamese_name} ${h.latin_name} ${h.chinese_name}`.toLocaleLowerCase('vi').includes(q));
  },[herbs,query]);

  const herb=herbs.find(h=>h.slug===selectedSlug)||herbs[0];
  const qrTarget=herb?`${window.location.origin}/smart-herb?herb=${encodeURIComponent(herb.slug)}`:'';

  function selectHerb(slug:string){
    setSelectedSlug(slug);setQuizAnswer('');setCopied(false);
    const url=new URL(window.location.href);url.pathname='/smart-herb';url.searchParams.set('herb',slug);window.history.replaceState({},'',url);
  }

  async function copyTarget(){
    try{await navigator.clipboard.writeText(qrTarget);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}catch{setCopied(false)}
  }

  if(!herb)return null;

  return <main className="smart-herb-shell">
    <header className="smart-herb-topbar">
      <a className="smart-herb-back" href="/"><ArrowLeft size={18}/> YHCT Connect</a>
      <div className="smart-herb-brand"><Leaf size={19}/><strong>Smart Herb</strong><span>Near · Simple · Free</span></div>
    </header>

    <section className="smart-herb-hero">
      <div>
        <div className="smart-herb-kicker"><Sparkles size={16}/> PHYGITAL LEARNING MVP</div>
        <h1>Quét mẫu thật. Học kiến thức thật. Kiểm chứng nguồn.</h1>
        <p>Smart Herb kết nối mẫu dược liệu vật lý với hồ sơ học thuật miễn phí trên YHCT Connect. Không cần cài ứng dụng riêng, không cần tài khoản để đọc.</p>
      </div>
      <div className="smart-herb-qr-card" aria-label="QR target">
        <QrCode size={42}/><strong>QR target</strong><code>{qrTarget.replace(window.location.origin,'')}</code>
        <button onClick={copyTarget}><Copy size={16}/>{copied?'Đã sao chép':'Sao chép liên kết'}</button>
      </div>
    </section>

    <section className="smart-herb-layout">
      <aside className="smart-herb-catalog">
        <label className="smart-herb-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm dược liệu…"/></label>
        {loading&&<div className="smart-herb-loading"><Loader2 className="spin" size={17}/> Đồng bộ dữ liệu…</div>}
        <div className="smart-herb-list">
          {filtered.map(item=><button key={item.slug} className={item.slug===herb.slug?'active':''} onClick={()=>selectHerb(item.slug)}>
            <span>{item.vietnamese_name}</span><small><i>{item.latin_name}</i> · {item.chinese_name}</small>
          </button>)}
        </div>
      </aside>

      <article className="smart-herb-profile">
        <div className="smart-herb-title-row">
          <div><span className="smart-herb-eyebrow">HỒ SƠ DƯỢC LIỆU</span><h2>{herb.vietnamese_name}</h2><p><i>{herb.latin_name}</i> · {herb.chinese_name}</p></div>
          <span className="smart-herb-evidence-badge">{levelLabel[herb.evidence_level]}</span>
        </div>

        <div className="smart-herb-grid">
          <section><h3><Leaf size={17}/> Nhận diện</h3><p>{herb.identification}</p></section>
          <section><h3><FlaskConical size={17}/> Bộ phận dùng</h3><p>{herb.part_used}</p></section>
          <section><h3><BookOpen size={17}/> Kiến thức YHCT</h3><p>{herb.traditional_summary}</p></section>
          <section><h3><Sparkles size={17}/> Bằng chứng hiện đại</h3><p>{herb.evidence_summary}</p></section>
        </div>

        <section className="smart-herb-safety"><ShieldAlert size={20}/><div><h3>An toàn trước tiên</h3><p>{herb.safety_note}</p><small>Nội dung phục vụ giáo dục, không thay thế chẩn đoán hoặc điều trị chuyên môn.</small></div></section>

        <section className="smart-herb-sources"><h3>Nguồn học thuật có thể truy xuất</h3>{herb.source_urls.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer"><BookOpen size={16}/><span>{source.label}{source.pmid?` · PMID ${source.pmid}`:''}</span></a>)}</section>

        <section className="smart-herb-quiz">
          <div><span className="smart-herb-eyebrow">MICRO-QUIZ</span><h3>Mục tiêu của Smart Herb là gì?</h3></div>
          <div className="smart-herb-quiz-options">
            {[
              ['treat','Tự động kê đơn từ dược liệu'],
              ['learn','Kết nối mẫu thật với học tập và nguồn kiểm chứng'],
              ['sell','Bán dược liệu trực tiếp cho sinh viên']
            ].map(([value,label])=><button key={value} onClick={()=>setQuizAnswer(value)} className={quizAnswer===value?'selected':''}>{label}</button>)}
          </div>
          {quizAnswer&&<div className={quizAnswer==='learn'?'smart-herb-feedback correct':'smart-herb-feedback'}><CheckCircle2 size={17}/>{quizAnswer==='learn'?'Đúng. Sản phẩm ưu tiên học tập, khả năng tiếp cận và truy xuất nguồn.':'Chưa đúng. Smart Herb không phải công cụ kê đơn hay gian hàng.'}</div>}
        </section>
      </article>
    </section>
  </main>;
}
