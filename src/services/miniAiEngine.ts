import type {ActivitySchedule,Member} from '../types';
import {rankDrlCandidates} from '../utils/vietnameseFuzzy';
import {supabase} from './authService';
import {fetchSchedules,loadCachedSchedules} from './scheduleService';

export type OmniFilter='all'|'medicine'|'acupoint'|'drl'|'research';
export type KnowledgeKind='formula'|'herb'|'acupoint';
export type KnowledgeRecord={id:string;kind:KnowledgeKind;name:string;aliases?:string[];[key:string]:unknown};
export type KnowledgeHit={record:KnowledgeRecord;score:number;elapsedMs:number};
export type ResearchLink={provider:'Google Scholar'|'PubMed'|'Cochrane Library'|'Google PDF';label:string;url:string;query:string};
export type DrlPublicRow={full_name:string;student_code_masked:string;semester_code:string;semester_title:string;total_points:number;match_score:number};
export type DrlHistoryRow={id:string;semester_code:string;semester_title:string;activity_name:string;points:number;note:string;occurred_at?:string|null;created_at:string};
export type DrlSummary={mode:'mine'|'public';query:string;semesterTitle?:string;total:number;items:Array<{label:string;detail:string;points:number}>;candidates?:DrlPublicRow[]};
export type DrlReminder={id:string;title:string;startsAt:string;daysLeft:number;points:number|null;location:string;note:string};
export type DailyIdea={title:string;hook:string;outline:string[];hashtags:string[];references:string[]};
export type DailyContentPack={dateLabel:string;season:string;solarTerm:string;solarTermNote:string;ideas:DailyIdea[]};

const DB_NAME='yhct-mini-ai-v3';
const DB_VERSION=1;
const STORE='knowledge';
const META='meta';
const DRL_TARGET_KEY='yhct-drl-target-v1';
const NORM_RE=/[\u0300-\u036f]/g;
const normalize=(value:string)=>value.normalize('NFD').replace(NORM_RE,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
const tokens=(value:string)=>normalize(value).split(' ').filter(Boolean);

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined')return reject(new Error('IndexedDB không khả dụng.'));
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:'id'});store.createIndex('kind','kind',{unique:false});store.createIndex('name','name',{unique:false})}if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'key'})};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Không mở được IndexedDB.'));
  });
}

async function txDone(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction lỗi.'));tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction bị hủy.'))})}

async function seedChunk(key:string,loader:()=>Promise<KnowledgeRecord[]>){
  const db=await openDb();
  try{
    const known=await new Promise<boolean>((resolve,reject)=>{const tx=db.transaction(META,'readonly');const req=tx.objectStore(META).get(key);req.onsuccess=()=>resolve(Boolean(req.result?.ready));req.onerror=()=>reject(req.error)});
    if(known)return;
    const rows=await loader();
    const tx=db.transaction([STORE,META],'readwrite');
    const store=tx.objectStore(STORE);for(const row of rows)store.put(row);
    tx.objectStore(META).put({key,ready:true,count:rows.length,seededAt:new Date().toISOString()});
    await txDone(tx);
  }finally{db.close()}
}

export async function ensureKnowledgeBase(){
  await seedChunk('formulas-v1',async()=>{const m=await import('../data/ai-kb/formulas');return m.FORMULA_KNOWLEDGE as unknown as KnowledgeRecord[]});
  await seedChunk('herbs-v1',async()=>{const m=await import('../data/ai-kb/herbs');return m.HERB_KNOWLEDGE as unknown as KnowledgeRecord[]});
  await seedChunk('acupoints-v1',async()=>{const m=await import('../data/ai-kb/acupoints');return m.ACUPOINT_KNOWLEDGE as unknown as KnowledgeRecord[]});
}

function recordText(record:KnowledgeRecord){return normalize([record.name,...(record.aliases||[]),record.code,record.category,record.actions,record.indications,record.meridian,record.commonUses].filter(Boolean).join(' '))}
function localScore(query:string,record:KnowledgeRecord){const q=normalize(query),text=recordText(record);if(!q)return 0;if(text===q)return 1;if(text.startsWith(q)||normalize(record.name).startsWith(q))return .96;if(text.includes(q))return .88;const qTokens=tokens(q);if(!qTokens.length)return 0;let matches=0;for(const t of qTokens)if(text.includes(t))matches++;const tokenScore=matches/qTokens.length;const name=normalize(record.name);const prefix=qTokens.some(t=>name.startsWith(t))?.08:0;return Math.min(.86,tokenScore*.78+prefix)}

export async function searchKnowledge(query:string,filter:OmniFilter='all',limit=8):Promise<KnowledgeHit[]>{
  const started=performance.now();
  await ensureKnowledgeBase();
  const db=await openDb();
  try{
    const records=await new Promise<KnowledgeRecord[]>((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),store=tx.objectStore(STORE);const req=store.getAll();req.onsuccess=()=>resolve((req.result||[]) as KnowledgeRecord[]);req.onerror=()=>reject(req.error)});
    const allowed=(r:KnowledgeRecord)=>filter==='all'||filter==='medicine'&&(r.kind==='herb'||r.kind==='formula')||filter==='acupoint'&&r.kind==='acupoint';
    const ranked=records.filter(allowed).map(record=>({record,score:localScore(query,record)})).filter(x=>x.score>=.2).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(limit,20)));
    const elapsedMs=Math.round((performance.now()-started)*10)/10;
    return ranked.map(x=>({...x,elapsedMs}));
  }finally{db.close()}
}

export function buildResearchLinks(topic:string):ResearchLink[]{
  const clean=topic.trim().replace(/\s+/g,' ');if(!clean)return[];
  const scholar=`${clean} traditional medicine`;
  const pubmed=`(${clean}) AND (traditional medicine OR acupuncture OR herbal medicine)`;
  const cochrane=`${clean} traditional medicine`;
  const pdf=`${clean} "y học cổ truyền" filetype:pdf (site:edu.vn OR site:gov.vn OR site:who.int)`;
  return[
    {provider:'Google Scholar',label:'Tìm trên Google Scholar',query:scholar,url:`https://scholar.google.com/scholar?q=${encodeURIComponent(scholar)}`},
    {provider:'PubMed',label:'Tìm trên PubMed',query:pubmed,url:`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(pubmed)}&sort=date`},
    {provider:'Cochrane Library',label:'Tìm trên Cochrane',query:cochrane,url:`https://www.cochranelibrary.com/?q=${encodeURIComponent(cochrane)}&t=1`},
    {provider:'Google PDF',label:'Tìm PDF học thuật',query:pdf,url:`https://www.google.com/search?q=${encodeURIComponent(pdf)}`}
  ];
}

export function parseDrlIntent(text:string){
  const n=normalize(text);
  if(/^(xem\s+)?diem(\s+ren\s+luyen)?(\s+ky\s+nay)?\s+cua\s+(toi|minh)$/.test(n)||/diem\s+ky\s+nay\s+cua\s+(toi|minh)/.test(n))return{mode:'mine' as const,query:''};
  const m=n.match(/(?:xem\s+)?diem(?:\s+ren\s+luyen)?\s+cua\s+(.{2,60})$/);if(m)return{mode:'public' as const,query:m[1].trim()};
  const code=text.match(/\b\d{6,14}\b/);if(code&&/diem/i.test(n))return{mode:'public' as const,query:code[0]};
  return null;
}

export async function checkDrlConversation(text:string,member:Member|null):Promise<DrlSummary|null>{
  const intent=parseDrlIntent(text);if(!intent)return null;
  if(intent.mode==='mine'){
    if(!member)throw new Error('Bạn cần đăng nhập để xem điểm của chính mình.');
    const {data,error}=await supabase.rpc('drl_member_history_v1');if(error)throw error;
    const rows=(Array.isArray(data)?data:[]) as DrlHistoryRow[];
    if(!rows.length)return{mode:'mine',query:'',total:0,items:[]};
    const groups=new Map<string,{title:string,total:number,items:DrlHistoryRow[]}>();
    for(const row of rows){const g=groups.get(row.semester_code)||{title:row.semester_title,total:0,items:[]};g.total+=Number(row.points||0);g.items.push(row);groups.set(row.semester_code,g)}
    const current=[...groups.values()].sort((a,b)=>{const ad=Math.max(...a.items.map(x=>Date.parse(x.occurred_at||x.created_at)||0));const bd=Math.max(...b.items.map(x=>Date.parse(x.occurred_at||x.created_at)||0));return bd-ad})[0];
    return{mode:'mine',query:'',semesterTitle:current.title,total:current.total,items:current.items.map(x=>({label:x.activity_name,detail:x.note||new Date(x.occurred_at||x.created_at).toLocaleDateString('vi-VN'),points:Number(x.points||0)}) )};
  }
  const {data,error}=await supabase.rpc('drl_public_search_v1',{p_query:intent.query,p_limit:20});if(error)throw error;
  const candidates=rankDrlCandidates(intent.query,(data||[]) as DrlPublicRow[]).slice(0,6);
  return{mode:'public',query:intent.query,total:candidates[0]?.total_points||0,semesterTitle:candidates[0]?.semester_title,items:[],candidates};
}

function parsePoints(text:string){const m=text.match(/(?:\+\s*)?(\d{1,3})\s*(?:điểm|diem)\b/i);if(!m)return null;const value=Number(m[1]);return Number.isFinite(value)&&value>=0&&value<=200?value:null}
function dayDiff(iso:string){return Math.ceil((new Date(iso).getTime()-Date.now())/86400000)}
export async function getDrlReminders(member:Member|null,horizonDays=30):Promise<{items:DrlReminder[];target:number|null;current:number|null;gap:number|null}>{
  let schedules=loadCachedSchedules();
  if(!schedules.length){try{schedules=await fetchSchedules()}catch{schedules=[]}}
  const items=schedules.filter((x:ActivitySchedule)=>x.status==='scheduled'&&dayDiff(x.startsAt)>=0&&dayDiff(x.startsAt)<=horizonDays&&(!member||x.visibility!=='assignees'||x.assigneeIds.includes(member.id))).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,8).map(x=>({id:x.id,title:x.title,startsAt:x.startsAt,daysLeft:dayDiff(x.startsAt),points:parsePoints(`${x.title} ${x.notes}`),location:x.location,note:x.notes}));
  let target:number|null=null;try{const parsed=JSON.parse(localStorage.getItem(DRL_TARGET_KEY)||'null');const value=Number(parsed?.target??parsed);if(Number.isFinite(value)&&value>0&&value<=200)target=value}catch{}
  let current:number|null=null;
  if(member){try{const summary=await checkDrlConversation('Điểm kỳ này của tôi',member);current=summary?.total??null}catch{current=null}}
  return{items,target,current,gap:target!==null&&current!==null?Math.max(0,target-current):null};
}

const SOLAR_TERMS:[number,number,string][]=[
  [1,5,'Tiểu hàn'],[1,20,'Đại hàn'],[2,4,'Lập xuân'],[2,19,'Vũ thủy'],[3,5,'Kinh trập'],[3,20,'Xuân phân'],[4,4,'Thanh minh'],[4,20,'Cốc vũ'],[5,5,'Lập hạ'],[5,21,'Tiểu mãn'],[6,5,'Mang chủng'],[6,21,'Hạ chí'],[7,7,'Tiểu thử'],[7,22,'Đại thử'],[8,7,'Lập thu'],[8,23,'Xử thử'],[9,7,'Bạch lộ'],[9,23,'Thu phân'],[10,8,'Hàn lộ'],[10,23,'Sương giáng'],[11,7,'Lập đông'],[11,22,'Tiểu tuyết'],[12,7,'Đại tuyết'],[12,21,'Đông chí']
];
function solarTerm(date:Date){const md=(date.getMonth()+1)*100+date.getDate();let current=SOLAR_TERMS[SOLAR_TERMS.length-1];for(const term of SOLAR_TERMS){if(term[0]*100+term[1]<=md)current=term;else break}return current[2]}
function seasonFor(month:number){if(month>=2&&month<=4)return'Xuân';if(month>=5&&month<=7)return'Hạ';if(month>=8&&month<=10)return'Thu';return'Đông'}
export function generateDailyContent(date=new Date()):DailyContentPack{
  const term=solarTerm(date),season=seasonFor(date.getMonth()+1),dateLabel=date.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  const base=`${season} · ${term}`;
  const ideas:DailyIdea[]=[
    {title:`${term}: hiểu đúng dưỡng sinh theo YHCT trong tiết ${season}`,hook:`Bắt đầu từ khí hậu và sinh hoạt hôm nay, phân biệt khuyến nghị dưỡng sinh truyền thống với bằng chứng y học hiện đại.`,outline:['Đặc điểm khí hậu và sinh hoạt thường gặp','Nguyên tắc dưỡng sinh YHCT liên quan','Đối chiếu bằng chứng hiện đại','Nhóm cần thận trọng','Thông điệp thực hành an toàn'],hashtags:['YHCT','DuongSinh',term.replace(/\s/g,'')],references:['Giáo trình Lý luận cơ bản YHCT','WHO Traditional Medicine resources','PubMed review phù hợp chủ đề']},
    {title:`Một huyệt – một mốc giải phẫu: bài học 60 giây ngày ${date.getDate()}`,hook:'Dùng ảnh/mốc giải phẫu để học vị trí huyệt, đồng thời nhắc rõ không tự châm kim.',outline:['Tên và mã huyệt','Kinh lạc','Mốc giải phẫu','Cách xác định trên mô hình','Cảnh báo an toàn'],hashtags:['ChamCuu','HuyetVi','HocYHCT'],references:['WHO Standard Acupuncture Point Locations','Giáo trình Châm cứu']},
    {title:`Phương tễ hôm nay: từ cấu trúc bài thuốc đến tư duy biện chứng`,hook:`Chọn một cổ phương và giải thích vai trò Quân–Thần–Tá–Sứ thay vì chỉ học thuộc thành phần.`,outline:['Nguồn gốc phương','Thành phần và vai trò','Pháp trị – chứng phù hợp','Gia giảm thường gặp trong giáo trình','Chống chỉ định/tương tác cần tra cứu'],hashtags:['PhuongTe','DuocLieu','HocThuatYHCT'],references:['Giáo trình Phương tễ học','Dược điển Việt Nam/chuyên luận dược liệu']},
    {title:`Ca học thuật ${base}: luyện Tứ chẩn → Bát cương → Pháp trị`,hook:'Một ca giả định ngắn, yêu cầu người đọc tự biện chứng trước khi mở đáp án.',outline:['Tứ chẩn tối thiểu','Xác định Bát cương','Biện chứng thể bệnh','Đề xuất pháp trị','Câu hỏi thảo luận và nguồn đọc thêm'],hashtags:['TuChan','BatCuong','CaseStudyYHCT'],references:['Giáo trình Chẩn đoán học YHCT','Hướng dẫn lâm sàng phù hợp bệnh cảnh']},
    {title:`YHCT và bằng chứng: 3 bước đọc một nghiên cứu không bị “giật tít”`,hook:'Hướng dẫn sinh viên kiểm tra thiết kế nghiên cứu, cỡ mẫu và kết cục trước khi chia sẻ.',outline:['Xác định câu hỏi PICO','Nhận diện thiết kế và nguy cơ sai lệch','Đọc hiệu quả tuyệt đối/tương đối','Kiểm tra xung đột lợi ích','Kết luận không vượt quá dữ liệu'],hashtags:['NCKH','EvidenceBasedMedicine','YHCT'],references:['PubMed','Cochrane Library','CONSORT/PRISMA tùy thiết kế']}
  ];
  return{dateLabel,season,solarTerm:term,solarTermNote:'Mốc 24 tiết khí trong trợ lý là xấp xỉ theo lịch dương và có thể lệch khoảng ±1 ngày so với thời điểm thiên văn thực tế.',ideas};
}

export function describeKnowledge(record:KnowledgeRecord){
  if(record.kind==='formula')return[{k:'Thành phần',v:String(record.components||'')},{k:'Liều tham khảo',v:String(record.referenceDose||'')},{k:'Công năng',v:String(record.actions||'')},{k:'Chủ trị học tập',v:String(record.indications||'')},{k:'Thận trọng',v:String(record.cautions||'')}];
  if(record.kind==='herb')return[{k:'Nhóm',v:String(record.category||'')},{k:'Tính vị',v:String(record.natureFlavor||'')},{k:'Quy kinh',v:String(record.meridians||'')},{k:'Công năng',v:String(record.actions||'')},{k:'Liều tham khảo',v:String(record.referenceDose||'')},{k:'Thận trọng',v:String(record.cautions||'')}];
  return[{k:'Mã huyệt',v:String(record.code||'')},{k:'Kinh',v:String(record.meridian||'')},{k:'Vị trí',v:String(record.location||'')},{k:'Cách xác định',v:String(record.howToLocate||'')},{k:'Ứng dụng học tập',v:String(record.commonUses||'')},{k:'An toàn',v:String(record.safeUse||'')}];
}
