import type {ResearchWork} from './researchService';

export const GUEST_SEARCH_LIMIT=3;
const GUEST_QUOTA_KEY='yhct-research-guest-search-v2';
const GUEST_WINDOW_MS=24*60*60*1000;

type GuestQuotaState={used:number;resetAt:number};
export type GuestQuota={used:number;remaining:number;resetAt:number;msUntilReset:number};
export type TopicSuggestion={title:string;rationale:string;design:string;keywords:string[]};
export type LocalProposalSections={overview:string;significance:string;objectives:string;populationScope:string;location:string;mainContents:string;methods:string;expectedResults:string;reportOutline:string;assignments:string;progress:string;specialNeeds:string;references:string};

const clean=(value:unknown,max=4000)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const stripDiacritics=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const STOP=new Set('the a an and or of in on for to with by from study studies research randomized trial clinical systematic review meta analysis effect effects efficacy safety patient patients vietnam vietnamese traditional medicine y hoc co truyen nghien cuu danh gia hieu qua anh huong va cua trong tren tai cho voi mot cac nhung ve duoc'.split(' '));

function readRawQuota(now=Date.now()):GuestQuotaState{
  try{
    const parsed=JSON.parse(localStorage.getItem(GUEST_QUOTA_KEY)||'null') as GuestQuotaState|null;
    if(parsed&&Number.isFinite(parsed.used)&&Number.isFinite(parsed.resetAt)&&parsed.resetAt>now)return{used:Math.max(0,Math.min(GUEST_SEARCH_LIMIT,Math.floor(parsed.used))),resetAt:parsed.resetAt};
  }catch{}
  const fresh={used:0,resetAt:now+GUEST_WINDOW_MS};
  try{localStorage.setItem(GUEST_QUOTA_KEY,JSON.stringify(fresh))}catch{}
  return fresh;
}

export function readGuestSearchQuota(now=Date.now()):GuestQuota{
  const state=readRawQuota(now),used=Math.max(0,Math.min(GUEST_SEARCH_LIMIT,state.used));
  return{used,remaining:Math.max(0,GUEST_SEARCH_LIMIT-used),resetAt:state.resetAt,msUntilReset:Math.max(0,state.resetAt-now)};
}

export function consumeGuestSearchQuota(now=Date.now()):GuestQuota{
  const state=readRawQuota(now),next={used:Math.min(GUEST_SEARCH_LIMIT,state.used+1),resetAt:state.resetAt};
  try{localStorage.setItem(GUEST_QUOTA_KEY,JSON.stringify(next))}catch{}
  return readGuestSearchQuota(now);
}

export function formatQuotaCountdown(ms:number){
  const total=Math.max(0,Math.floor(ms/1000)),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60),seconds=total%60;
  return`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function tokens(value:string){
  return stripDiacritics(value).toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(x=>!STOP.has(x))||[];
}

function evidenceStats(works:ResearchWork[]){
  const years=works.map(w=>w.year).filter((x):x is number=>Boolean(x&&x>1900&&x<2200)).sort((a,b)=>a-b),providers=[...new Set(works.map(w=>w.provider))];
  return{count:works.length,minYear:years[0]||null,maxYear:years.at(-1)||null,providers};
}

function topTerms(query:string,works:ResearchWork[],limit=6){
  const freq=new Map<string,number>();
  for(const word of tokens(`${query} ${works.slice(0,20).map(w=>`${w.title} ${w.abstract||''}`).join(' ')}`))freq.set(word,(freq.get(word)||0)+1);
  return[...freq.entries()].sort((a,b)=>b[1]-a[1]).map(([w])=>w).slice(0,limit);
}

export function suggestResearchTopics(query:string,works:ResearchWork[],limit=4):TopicSuggestion[]{
  const base=clean(query,220)||topTerms('',works,3).join(' ')||'Y học cổ truyền',terms=topTerms(base,works,8),stats=evidenceStats(works),concept=terms.slice(0,3).join(' – ')||base;
  const window=stats.minYear&&stats.maxYear?`${stats.minYear}–${stats.maxYear}`:'giai đoạn tài liệu hiện có';
  const suggestions:TopicSuggestion[]=[
    {title:`Tổng quan phạm vi bằng chứng về ${base}`,rationale:`Phù hợp khi cần lập bản đồ bằng chứng từ ${stats.count||'các'} tài liệu tìm được trong ${window}, đồng thời nhận diện khoảng trống nghiên cứu mà không suy diễn hiệu quả lâm sàng.`,design:'Scoping review',keywords:terms.slice(0,5)},
    {title:`Tổng quan hệ thống về ${base}: hiệu quả, an toàn và chất lượng bằng chứng`,rationale:`Ưu tiên câu hỏi có đủ nghiên cứu so sánh. Cần đăng ký tiêu chí chọn mẫu và phương pháp đánh giá nguy cơ sai lệch trước khi tổng hợp.`,design:'Systematic review',keywords:terms.slice(0,5)},
    {title:`Khảo sát thực trạng và các yếu tố liên quan đến ${concept}`,rationale:'Thiết kế mô tả cắt ngang phù hợp cho đề tài sinh viên khi mục tiêu là mô tả hiện trạng và khảo sát mối liên quan, không khẳng định quan hệ nhân quả.',design:'Cross-sectional study',keywords:terms.slice(0,5)},
    {title:`Nghiên cứu khả thi về ${base} trong bối cảnh đào tạo/thực hành YHCT`,rationale:`Tập trung tính khả thi, mức chấp nhận, quy trình và tiêu chí đầu ra trước khi tiến tới nghiên cứu can thiệp quy mô lớn.`,design:'Feasibility study',keywords:terms.slice(0,5)}
  ];
  return suggestions.slice(0,Math.max(1,Math.min(6,limit)));
}

function ieeeReference(work:ResearchWork,index:number){
  const authors=work.authors.slice(0,4).join(', ')||'Không rõ tác giả',year=work.year?`, ${work.year}`:'',doi=work.doi?`, doi: ${work.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//,'')}`:'';
  return`[${index}] ${authors}, “${clean(work.title,300)},” ${clean(work.source,180)}${year}${doi}. [Online]. Available: ${work.url}`;
}

function designMethod(design:string,title:string){
  const d=design.toLowerCase();
  if(d.includes('systematic'))return`Thiết kế tổng quan hệ thống. Xây dựng câu hỏi nghiên cứu, chiến lược tìm kiếm, tiêu chuẩn chọn/loại trừ, sàng lọc độc lập, trích xuất dữ liệu và đánh giá nguy cơ sai lệch theo hướng dẫn phù hợp. Chỉ thực hiện phân tích gộp khi dữ liệu đủ đồng nhất. Không tự điền cỡ mẫu.`;
  if(d.includes('scoping'))return`Thiết kế tổng quan phạm vi. Xác định câu hỏi, nguồn dữ liệu, tiêu chuẩn lựa chọn, quy trình sàng lọc và bảng trích xuất trước khi thu thập. Kết quả trình bày theo nhóm chủ đề và khoảng trống bằng chứng.`;
  if(d.includes('cross'))return`Thiết kế mô tả cắt ngang. Xác định rõ quần thể đích, tiêu chuẩn chọn/loại trừ, biến số chính, công cụ thu thập và kế hoạch phân tích. Cỡ mẫu phải được tính bằng công thức phù hợp với mục tiêu và tham số đầu vào có nguồn trước khi nộp đề cương.`;
  if(d.includes('feasibility'))return`Thiết kế nghiên cứu khả thi. Xác định tiêu chí khả thi, mức chấp nhận, an toàn/quy trình, tiêu chuẩn chọn mẫu và ngưỡng quyết định go/no-go. Cỡ mẫu được lựa chọn theo mục tiêu khả thi và phải giải trình, không suy đoán tự động.`;
  return`Lựa chọn thiết kế phù hợp với mục tiêu của đề tài “${title}”. Cần nêu rõ tiêu chuẩn chọn mẫu, loại trừ, biến số, công cụ thu thập, kiểm soát sai số, kế hoạch phân tích và công thức cỡ mẫu trước khi phê duyệt.`;
}

export function buildLocalProposalSections(title:string,works:ResearchWork[],design='Cross-sectional study'):LocalProposalSections{
  const safeTitle=clean(title,320)||'Đề tài nghiên cứu chưa đặt tên',stats=evidenceStats(works),refs=works.slice(0,8).map(ieeeReference).join('\n'),yearText=stats.minYear&&stats.maxYear?`${stats.minYear}–${stats.maxYear}`:'các năm gần đây';
  const evidenceLine=stats.count?`Tra cứu ban đầu ghi nhận ${stats.count} kết quả từ ${stats.providers.join(', ')} trong ${yearText}. Các kết quả này chỉ dùng để định hướng tổng quan; nhóm nghiên cứu phải đọc toàn văn và xác minh tài liệu trước khi trích dẫn chính thức.`:'Chưa có đủ kết quả y văn trong phiên hiện tại; nhóm nghiên cứu cần hoàn thiện chiến lược tìm kiếm và xác minh tài liệu trước khi nộp.';
  return{
    overview:`Đề tài “${safeTitle}” được hình thành từ nhu cầu hệ thống hóa câu hỏi nghiên cứu và khoảng trống bằng chứng có liên quan. ${evidenceLine} Tổng quan chính thức cần phân tích tình hình nghiên cứu trong nước và quốc tế, chỉ ra điểm còn chưa thống nhất hoặc chưa được khảo sát trong bối cảnh dự kiến nghiên cứu.`,
    significance:`Ý nghĩa khoa học: làm rõ câu hỏi và bổ sung dữ liệu có cấu trúc cho lĩnh vực liên quan đến ${safeTitle}. Ý nghĩa thực tiễn: cung cấp thông tin phục vụ học tập, quản lý hoặc thực hành YHCT trong phạm vi nghiên cứu. Tính mới phải được đối chiếu trực tiếp với các công trình đã công bố, không khẳng định khi chưa đủ bằng chứng.`,
    objectives:`Mục tiêu chung: Đánh giá/mô tả vấn đề nghiên cứu liên quan đến ${safeTitle}.\nMục tiêu cụ thể 1: Mô tả đặc điểm của đối tượng/dữ liệu nghiên cứu.\nMục tiêu cụ thể 2: Phân tích kết quả hoặc các yếu tố liên quan phù hợp với thiết kế đã chọn.\nMục tiêu cụ thể 3: Đề xuất hướng ứng dụng hoặc nghiên cứu tiếp theo dựa trên kết quả thu được.`,
    populationScope:'Đối tượng nghiên cứu: xác định theo câu hỏi nghiên cứu. Phạm vi: giới hạn thời gian, địa điểm, nhóm đối tượng và tiêu chuẩn lựa chọn/loại trừ. Không mở rộng kết luận vượt quá quần thể và phạm vi đã chọn.',
    location:'Dự kiến tại Khoa Y/Trường Đại học Quốc tế Hồng Bàng và/hoặc cơ sở thực hành phù hợp sau khi có chấp thuận của đơn vị liên quan.',
    mainContents:'Nội dung nghiên cứu 1: Hoàn thiện tổng quan và câu hỏi nghiên cứu.\nNội dung nghiên cứu 2: Thu thập dữ liệu theo thiết kế và tiêu chuẩn đã phê duyệt.\nNội dung nghiên cứu 3: Phân tích, diễn giải kết quả, thảo luận giới hạn và đề xuất.',
    methods:designMethod(design,safeTitle),
    expectedResults:'Báo cáo tổng kết đề tài theo quy định của Nhà trường; bộ dữ liệu/bảng trích xuất phù hợp với thiết kế; đăng ký tham dự Hội nghị NCKH sinh viên khi đủ điều kiện; cân nhắc đăng ký giải hoặc bài báo nếu kết quả đạt yêu cầu.',
    reportOutline:'Đặt vấn đề; Tổng quan tài liệu; Đối tượng và phương pháp nghiên cứu; Kết quả; Bàn luận; Kết luận và kiến nghị; Tài liệu tham khảo; Phụ lục.',
    assignments:'Chủ nhiệm: điều phối chung, tổng quan, phương pháp và tổng hợp báo cáo.\nThành viên: phân công theo các gói công việc thu thập dữ liệu, nhập/kiểm tra dữ liệu, phân tích và trình bày.\nGiảng viên hướng dẫn: cố vấn chuyên môn và kiểm soát chất lượng.',
    progress:'Tháng 1–2: tổng quan, hoàn thiện đề cương và công cụ.\nTháng 3–6: thu thập dữ liệu.\nTháng 7–9: làm sạch, phân tích và viết kết quả.\nTháng 10–12: hoàn thiện báo cáo, nghiệm thu và chuẩn bị sản phẩm khoa học (điều chỉnh theo thời gian được phê duyệt, tối đa 12 tháng).',
    specialNeeds:'Chỉ ghi các nhu cầu thực tế sau khi thống nhất với giảng viên hướng dẫn và đơn vị triển khai; không tự dự toán thiết bị/vật tư khi chưa có báo giá hoặc căn cứ.',
    references:refs||'Chưa có tài liệu đã xác minh. Hãy dùng kết quả PubMed/OpenAlex/ClinicalTrials.gov, đọc nguồn gốc và trình bày danh mục tài liệu theo chuẩn IEEE.'
  };
}

export function buildAcademicFallback(question:string,works:ResearchWork[]){
  const q=clean(question,500),topics=suggestResearchTopics(q,works,3),stats=evidenceStats(works);
  return`A.I local 0đ chưa dùng mô hình sinh văn bản cloud cho câu hỏi này. Phiên hiện có ${stats.count} kết quả y văn. Hướng làm tiếp: ${topics.map((t,i)=>`${i+1}) ${t.title}`).join(' · ')}. Hãy mở nguồn gốc trước khi dùng cho quyết định học thuật hoặc lâm sàng.`;
}

async function detectLanguage(text:string){
  const g=globalThis as any,Ctor=g.LanguageDetector||g.ai?.languageDetector;
  if(Ctor?.create){try{const detector=await Ctor.create();const result=await detector.detect(text.slice(0,1200));const first=Array.isArray(result)?result[0]:result;const lang=String(first?.detectedLanguage||first?.language||'');if(lang)return lang}catch{}}
  return/[ăâđêôơưà-ỹ]/i.test(text)?'vi':'en';
}

export async function translateZeroCost(text:string,targetLanguage:'vi'|'en',sourceLanguage:'auto'|'vi'|'en'='auto'){
  const value=clean(text,12000);if(!value)throw new Error('Hãy nhập nội dung cần dịch.');
  const source=sourceLanguage==='auto'?await detectLanguage(value):sourceLanguage;if(source===targetLanguage)return{translation:value,provider:'local-noop'};
  const g=globalThis as any,Ctor=g.Translator||g.ai?.translator;
  if(!Ctor?.create)throw new Error('Chrome trên thiết bị này chưa cung cấp Translator API local. Công cụ 0đ không gửi văn bản lên máy chủ; hãy dùng Chrome có Built-in Translator hoặc chọn A.I cloud riêng nếu chấp nhận chi phí nhà cung cấp.');
  try{
    if(Ctor.availability){const availability=await Ctor.availability({sourceLanguage:source,targetLanguage});if(String(availability).toLowerCase().includes('unavailable'))throw new Error('Cặp ngôn ngữ local chưa khả dụng trên thiết bị.');}
    const translator=await Ctor.create({sourceLanguage:source,targetLanguage});const translation=await translator.translate(value);return{translation:clean(translation,24000),provider:'chrome-local'};
  }catch(error){throw new Error((error as Error).message||'Không thể khởi tạo mô hình dịch local trên trình duyệt.');}
}

export function getLocalAiCapability(){
  const g=globalThis as any;
  return{translator:Boolean(g.Translator?.create||g.ai?.translator?.create),languageDetector:Boolean(g.LanguageDetector?.create||g.ai?.languageDetector?.create),mode:'local-first' as const};
}
