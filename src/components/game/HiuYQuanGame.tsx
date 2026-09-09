import {useEffect,useMemo,useState} from 'react';
import {CheckCircle2,Clock3,Coins,HeartPulse,RefreshCw,ShieldCheck,Sparkles,Stethoscope,UserRound} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';
import '../../hiu-y-quan.css';

type PlayerState={active:boolean;display_name?:string|null;gender?:'male'|'female'|null;wallet_balance:number;total_cases:number;correct_cases:number;next_visit_at:string};
type Option={code:string;label:string};
type ClinicCase={case_key:string;patient_age:number;patient_gender:'male'|'female';vong:string;van_am:string;van_hoi:string;thiet:string;options:Option[];completed:boolean;correct:boolean;credits_awarded:number};
type SubmitResult={already_answered?:boolean;correct:boolean;credits_awarded:number;expected_label:string;explanation:string;wallet_balance:number};

const emptyState:PlayerState={active:false,wallet_balance:0,total_cases:0,correct_cases:0,next_visit_at:new Date(Date.now()+3600000).toISOString()};
const genderLabel=(value:'male'|'female')=>value==='female'?'Nữ':'Nam';
const patientName=(patient:ClinicCase,index:number)=>`${patient.patient_gender==='female'?'Bệnh nhân nữ':'Bệnh nhân nam'} ${index+1}`;
const formatCountdown=(iso:string,now:number)=>{const ms=Math.max(0,Date.parse(iso)-now),m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};

function DoctorAvatar({gender}:{gender:'male'|'female'}){
  return <div className={`hyq-doctor hyq-doctor--${gender}`} aria-label={`Thầy thuốc ${genderLabel(gender)}`}>
    <span className="hyq-hair"/><span className="hyq-face"><i/><i/><b/></span><span className="hyq-neck"/><span className="hyq-robe"><i className="hyq-robe-cross"/><i className="hyq-belt"/></span><span className="hyq-sleeve left"/><span className="hyq-sleeve right"/>
  </div>
}
function PatientAvatar({gender}:{gender:'male'|'female'}){
  return <div className={`hyq-patient hyq-patient--${gender}`} aria-hidden="true"><span className="head"><i/><i/></span><span className="body"/></div>
}

export default function HiuYQuanGame({member}:{member:Member}){
  const [state,setState]=useState<PlayerState>(emptyState),[cases,setCases]=useState<ClinicCase[]>([]),[activeCase,setActiveCase]=useState(0),[selected,setSelected]=useState(''),[result,setResult]=useState<SubmitResult|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[now,setNow]=useState(Date.now());
  const [name,setName]=useState(member.herbalAlias||member.fullName||''),[gender,setGender]=useState<'male'|'female'>('female');

  const load=async(clear=true)=>{if(clear)setMessage('');setBusy(true);try{
    const {data,error}=await supabase.rpc('hiu_y_quan_state_v1');if(error)throw error;const next={...emptyState,...(data||{})} as PlayerState;setState(next);
    if(next.active){const current=await supabase.rpc('hiu_y_quan_hourly_cases_v1');if(current.error)throw current.error;const rows=(Array.isArray(current.data)?current.data:[]) as ClinicCase[];setCases(rows);setActiveCase(i=>Math.min(i,Math.max(0,rows.length-1)));}
  }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}};
  useEffect(()=>{void load();const tick=window.setInterval(()=>setNow(Date.now()),1000),sync=window.setInterval(()=>void load(false),60000);return()=>{window.clearInterval(tick);window.clearInterval(sync)}},[member.id]);
  useEffect(()=>{setSelected('');setResult(null)},[activeCase]);

  const current=cases[activeCase]||null;
  const accuracy=state.total_cases?Math.round(state.correct_cases/state.total_cases*100):0;
  const nextVisit=useMemo(()=>formatCountdown(state.next_visit_at,now),[state.next_visit_at,now]);

  const activate=async()=>{const clean=name.replace(/\s+/g,' ').trim();if(clean.length<2){setMessage('Tên thầy thuốc cần ít nhất 2 ký tự.');return}setBusy(true);setMessage('');try{const {error}=await supabase.rpc('hiu_y_quan_activate_v1',{p_display_name:clean,p_gender:gender});if(error)throw error;await load(false)}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}};
  const submit=async()=>{if(!current||!selected||current.completed||busy)return;setBusy(true);setMessage('');try{const {data,error}=await supabase.rpc('hiu_y_quan_submit_v1',{p_case_key:current.case_key,p_selected_code:selected});if(error)throw error;const next=data as SubmitResult;setResult(next);setState(s=>({...s,wallet_balance:next.wallet_balance,total_cases:s.total_cases+1,correct_cases:s.correct_cases+(next.correct?1:0)}));setCases(rows=>rows.map((x,i)=>i===activeCase?{...x,completed:true,correct:next.correct,credits_awarded:next.credits_awarded}:x))}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}};

  if(!state.active)return <section className="hyq-page hyq-onboarding">
    <div className="hyq-onboarding-card"><div className="hyq-seal"><Stethoscope/></div><span className="hyq-kicker">HIU · Y · QUÁN</span><h2>Khai trương phòng khám của bạn</h2><p>Game mô phỏng học tập Y học cổ truyền. Tình huống chỉ dùng để luyện nhận diện thể bệnh, không dùng chẩn đoán người bệnh thực tế.</p>
      <label>Tên thầy thuốc<input value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="Nhập tên nhân vật"/></label>
      <div className="hyq-gender"><button type="button" className={gender==='female'?'active':''} onClick={()=>setGender('female')}><UserRound/>Nữ</button><button type="button" className={gender==='male'?'active':''} onClick={()=>setGender('male')}><UserRound/>Nam</button></div>
      <div className="hyq-avatar-preview"><DoctorAvatar gender={gender}/><div><b>{name.trim()||'Thầy thuốc HIU'}</b><small>Trang phục YHCT 2D nguyên bản · {genderLabel(gender)}</small></div></div>
      {message&&<div className="hyq-message">{message}</div>}<button className="hyq-primary" disabled={busy} onClick={()=>void activate()}><Sparkles/>{busy?'Đang kích hoạt…':'Kích hoạt HIU - Y - Quán'}</button>
    </div>
  </section>;

  return <section className="hyq-page">
    <header className="hyq-header"><div><span className="hyq-kicker"><Sparkles/> HIU · Y · QUÁN</span><h2>Phòng khám Y học cổ truyền</h2><p>Vọng · Văn · Vấn · Thiết → nhận diện thể bệnh → nhận tín dụng Gia Viên.</p></div><button className="hyq-refresh" disabled={busy} onClick={()=>void load()}><RefreshCw/>Làm mới</button></header>
    <div className="hyq-hud"><article><Coins/><span><small>Tín dụng Gia Viên</small><b>{state.wallet_balance}</b></span></article><article><HeartPulse/><span><small>Ca đã xử lý</small><b>{state.total_cases}</b></span></article><article><CheckCircle2/><span><small>Tỷ lệ đúng</small><b>{accuracy}%</b></span></article><article><Clock3/><span><small>Đợt khách mới</small><b>{nextVisit}</b></span></article></div>
    {message&&<div className="hyq-message">{message}</div>}

    <div className="hyq-clinic-scene">
      <div className="hyq-wall"><span className="hyq-window"><i/><i/></span><span className="hyq-scroll">醫<br/>德</span></div>
      <div className="hyq-medicine-cabinet" aria-label="Tủ thuốc"><b>TỦ DƯỢC</b>{Array.from({length:18},(_,i)=><span key={i}><i>{['Quế','Cam','Trần','Bạch','Đương','Phục'][i%6]}</i></span>)}</div>
      <div className="hyq-doctor-zone"><DoctorAvatar gender={(state.gender||'female') as 'male'|'female'}/><span className="hyq-nameplate">{state.display_name}</span></div>
      <div className="hyq-desk"><span className="hyq-pulse-pillow"/><span className="hyq-teapot"/><b>BÀN BẮT MẠCH</b></div>
      {current?<div className="hyq-patient-zone"><PatientAvatar gender={current.patient_gender}/><div className="hyq-speech"><b>{patientName(current,activeCase)} · {current.patient_age} tuổi</b><span>“Thầy thuốc xem giúp tôi với…”</span></div></div>:<div className="hyq-empty-patient"><Clock3/><b>Đang chờ khách tiếp theo</b></div>}
      <div className="hyq-floor"><i/><i/><i/><i/></div>
    </div>

    <div className="hyq-workspace">
      <aside className="hyq-queue"><header><b>Khách trong giờ</b><small>{cases.length} ca</small></header>{cases.map((item,i)=><button key={item.case_key} className={`${i===activeCase?'active':''} ${item.completed?'done':''}`} onClick={()=>setActiveCase(i)}><span>{i+1}</span><div><b>{patientName(item,i)}</b><small>{item.patient_age} tuổi · {item.completed?(item.correct?'Đã chẩn đúng':'Đã xử lý'):'Đang chờ'}</small></div>{item.completed&&<CheckCircle2/>}</button>)}</aside>
      <main className="hyq-case-panel">{current?<>
        <div className="hyq-four-exams"><article><b>VỌNG</b><p>{current.vong}</p></article><article><b>VĂN</b><p>{current.van_am}</p></article><article><b>VẤN</b><p>{current.van_hoi}</p></article><article><b>THIẾT</b><p>{current.thiet}</p></article></div>
        <div className="hyq-diagnosis"><header><div><ShieldCheck/><span><b>Chẩn thể bệnh</b><small>Chọn 1 đáp án. Mỗi ca chỉ được tính tín dụng một lần.</small></span></div><em>+1 tín dụng nếu đúng</em></header><div className="hyq-options">{current.options.map(option=><button key={option.code} disabled={current.completed||busy} className={selected===option.code?'selected':''} onClick={()=>setSelected(option.code)}><span/>{option.label}</button>)}</div><button className="hyq-primary" disabled={!selected||current.completed||busy} onClick={()=>void submit()}>{busy?'Đang đối chiếu…':'Xác nhận chẩn đoán'}</button></div>
        {result&&<div className={`hyq-result ${result.correct?'correct':'wrong'}`}><b>{result.correct?`Chính xác · +${result.credits_awarded} tín dụng`:'Chưa chính xác'}</b><p>Đáp án: <strong>{result.expected_label}</strong>. {result.explanation}</p></div>}
        {current.completed&&!result&&<div className={`hyq-result ${current.correct?'correct':'wrong'}`}><b>{current.correct?`Ca này đã chẩn đúng · +${current.credits_awarded} tín dụng`:'Ca này đã được xử lý'}</b></div>}
      </>:<div className="hyq-no-case"><Clock3/><h3>Chưa có ca trong khung giờ này</h3><p>Hệ thống phát 1–2 khách ngẫu nhiên mỗi giờ và tự đồng bộ khi sang giờ mới.</p></div>}</main>
    </div>
    <footer className="hyq-safety">Mô phỏng giáo dục · 20 thể bệnh YHCT cơ bản · không phải công cụ chẩn đoán hay kê đơn lâm sàng.</footer>
  </section>;
}
