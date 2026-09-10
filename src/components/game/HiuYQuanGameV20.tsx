import {useEffect,useMemo,useRef,useState} from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  Coins,
  HeartPulse,
  LibraryBig,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trophy,
  UserRound
} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';
import V20World from './yquan-v20/V20World';
import {gameEventBus} from './yquan-v20/GameEventBus';
import {legacyRuleAdapter} from './yquan-v20/LegacyRuleAdapter';
import type {DoctorGender,DoctorOutfit,HerbVisual} from './yquan-v20/types';

type CareStatus='waiting_diagnosis'|'awaiting_transfer'|'observing'|'recheck_due'|'discharged';
type ViewId='clinic'|'records'|'pharmacy'|'progress';
type Option={code:string;label:string};
type ClinicCase={
  case_key:string;
  patient_age:number;
  patient_gender:DoctorGender;
  patient_variant?:number;
  vong:string;
  van_am:string;
  van_hoi:string;
  thiet:string;
  options:Option[];
  completed:boolean;
  correct:boolean;
  credits_awarded:number;
  appointment_offered?:boolean;
  appointment_status?:'none'|'pending'|'accepted'|'declined';
  appointment_for_at?:string|null;
  appointment_decided_at?:string|null;
  care_status?:CareStatus;
  treatment_started_at?:string|null;
  recheck_due_at?:string|null;
  rechecked_at?:string|null;
  discharged_at?:string|null;
  recheck_count?:number;
  bed_slot?:number|null;
};
type PlayerState={
  active:boolean;
  display_name?:string|null;
  gender?:DoctorGender|null;
  outfit?:DoctorOutfit|null;
  wallet_balance:number;
  total_cases:number;
  correct_cases:number;
  next_visit_at?:string|null;
};
type SubmitResult={
  already_answered?:boolean;
  correct:boolean;
  credits_awarded:number;
  expected_label?:string;
  explanation?:string;
  wallet_balance?:number;
};
type CaseRecord={
  case_key:string;
  patient_age:number;
  patient_gender:DoctorGender;
  patient_variant?:number;
  syndrome_label:string;
  selected_label:string;
  correct:boolean;
  credits_awarded:number;
  vong:string;
  van_am:string;
  van_hoi:string;
  thiet:string;
  answered_at:string;
  treatment_started_at?:string|null;
  rechecked_at?:string|null;
  discharged_at?:string|null;
  recheck_count?:number;
  outcome?:string;
};

const EMPTY_STATE:PlayerState={active:false,wallet_balance:0,total_cases:0,correct_cases:0};
const OUTFITS:{id:DoctorOutfit;label:string}[]=[
  {id:'classic',label:'Cổ điển YHCT'},
  {id:'academy',label:'Học viện hiện đại'},
  {id:'master',label:'Danh y truyền thống'}
];

const normalizeCase=(row:ClinicCase):ClinicCase=>({
  ...row,
  patient_variant:Math.max(1,Math.min(3,Number(row.patient_variant)||1)),
  care_status:row.care_status||(row.completed?'awaiting_transfer':'waiting_diagnosis'),
  bed_slot:Number(row.bed_slot)>=1&&Number(row.bed_slot)<=3?Number(row.bed_slot):null,
  recheck_count:Number(row.recheck_count||0),
  options:Array.isArray(row.options)?row.options:[]
});

const formatCountdown=(iso:string|undefined|null,now:number)=>{
  if(!iso)return'--:--';
  const remaining=Math.max(0,Date.parse(iso)-now);
  const minutes=Math.floor(remaining/60000);
  const seconds=Math.floor((remaining%60000)/1000);
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
};

const formatDate=(iso?:string|null)=>iso
  ?new Date(iso).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
  :'—';

const recheckReady=(item:ClinicCase,now:number)=>
  item.care_status==='recheck_due'||
  (item.care_status==='observing'&&Boolean(item.recheck_due_at)&&Date.parse(item.recheck_due_at||'')<=now);

const patientLabel=(item:ClinicCase)=>{
  if(item.patient_age<13)return item.patient_gender==='female'?'Bé gái':'Bé trai';
  if(item.patient_age<18)return item.patient_gender==='female'?'Thiếu niên nữ':'Thiếu niên nam';
  if(item.patient_age>=60)return item.patient_gender==='female'?'Cụ bà':'Cụ ông';
  return item.patient_gender==='female'?'Bệnh nhân nữ':'Bệnh nhân nam';
};

export default function HiuYQuanGameV20({member}:{member:Member}){
  const [player,setPlayer]=useState<PlayerState>(EMPTY_STATE);
  const [cases,setCases]=useState<ClinicCase[]>([]);
  const [activeKey,setActiveKey]=useState('');
  const [selected,setSelected]=useState('');
  const [result,setResult]=useState<SubmitResult|null>(null);
  const [herbs,setHerbs]=useState<HerbVisual[]>([]);
  const [records,setRecords]=useState<CaseRecord[]>([]);
  const [recordQuery,setRecordQuery]=useState('');
  const [view,setView]=useState<ViewId>('clinic');
  const [name,setName]=useState(member.herbalAlias||member.fullName||'');
  const [gender,setGender]=useState<DoctorGender>('female');
  const [outfit,setOutfit]=useState<DoctorOutfit>('classic');
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [now,setNow]=useState(Date.now());
  const loading=useRef(false);
  const mounted=useRef(true);

  const current=useMemo(
    ()=>cases.find(item=>item.case_key===activeKey)||cases[0]||null,
    [cases,activeKey]
  );
  const wardCases=useMemo(
    ()=>cases.filter(item=>item.care_status==='observing'||item.care_status==='recheck_due'),
    [cases]
  );
  const waitingCount=useMemo(()=>cases.filter(item=>item.care_status==='waiting_diagnosis').length,[cases]);
  const transferCount=useMemo(()=>cases.filter(item=>item.care_status==='awaiting_transfer').length,[cases]);
  const accuracy=player.total_cases?Math.round(player.correct_cases/player.total_cases*100):0;
  const bedsFull=wardCases.length>=3;

  const chooseDefault=(rows:ClinicCase[])=>
    rows.find(item=>item.care_status==='recheck_due')||
    rows.find(item=>item.care_status==='waiting_diagnosis')||
    rows.find(item=>item.care_status==='awaiting_transfer')||
    rows[0]||null;

  const load=async(silent=false)=>{
    if(loading.current)return;
    loading.current=true;
    if(!silent)setBusy('refresh');
    try{
      const {data,error}=await supabase.rpc('hiu_y_quan_state_v1');
      if(error)throw error;
      if(!mounted.current)return;
      const next={...EMPTY_STATE,...(data||{})} as PlayerState;
      setPlayer(next);
      if(next.gender==='male'||next.gender==='female')setGender(next.gender);
      if(next.outfit==='classic'||next.outfit==='academy'||next.outfit==='master')setOutfit(next.outfit);
      if(next.display_name)setName(next.display_name);
      if(!next.active){setCases([]);setActiveKey('');return;}

      const rows=(await legacyRuleAdapter.getCases() as unknown as ClinicCase[]).map(normalizeCase);
      if(!mounted.current)return;
      setCases(rows);
      setActiveKey(previous=>rows.some(item=>item.case_key===previous)?previous:(chooseDefault(rows)?.case_key||''));
      if(!herbs.length){
        try{
          const nextHerbs=await legacyRuleAdapter.getHerbs();
          if(mounted.current)setHerbs(nextHerbs);
        }catch{/* Learning cabinet degradation must not block core gameplay. */}
      }
      gameEventBus.emit('SYNC_REQUESTED',{reason:'v20-canonical-load'});
      if(!silent)setMessage('');
    }catch(error){
      if(mounted.current&&!silent)setMessage((error as Error).message||'Không đồng bộ được HIU Y Quán.');
    }finally{
      loading.current=false;
      if(mounted.current&&!silent)setBusy('');
    }
  };

  const loadRecords=async()=>{
    if(!player.active)return;
    setBusy('records');
    try{
      const rows=await legacyRuleAdapter.getRecords(recordQuery,60) as CaseRecord[];
      if(mounted.current){setRecords(rows);setMessage('');}
    }catch(error){
      if(mounted.current)setMessage((error as Error).message);
    }finally{
      if(mounted.current)setBusy('');
    }
  };

  useEffect(()=>{
    mounted.current=true;
    void load();
    const tick=window.setInterval(()=>setNow(Date.now()),1000);
    const sync=window.setInterval(()=>{if(!document.hidden)void load(true)},60000);
    return()=>{mounted.current=false;window.clearInterval(tick);window.clearInterval(sync);};
  },[member.id]);

  useEffect(()=>{if(view==='records')void loadRecords();},[view]);
  useEffect(()=>{setSelected('');setResult(null);},[current?.case_key]);

  const activate=async()=>{
    const clean=name.replace(/\s+/g,' ').trim();
    if(clean.length<2){setMessage('Tên thầy thuốc cần ít nhất 2 ký tự.');return;}
    setBusy('activate');setMessage('');
    try{
      await legacyRuleAdapter.activate(clean,gender);
      await legacyRuleAdapter.customize(gender,outfit);
      await load(true);
    }catch(error){setMessage((error as Error).message);}
    finally{setBusy('');}
  };

  const saveAppearance=async()=>{
    if(busy)return;
    setBusy('appearance');setMessage('');
    try{
      await legacyRuleAdapter.customize(gender,outfit);
      setPlayer(previous=>({...previous,gender,outfit}));
      setMessage('Đã lưu tạo hình V20.');
    }catch(error){setMessage((error as Error).message);}
    finally{setBusy('');}
  };

  const submitDiagnosis=async()=>{
    if(!current||!selected||current.completed||busy)return;
    setBusy('diagnosis');setMessage('');
    try{
      const next=await legacyRuleAdapter.submitDiagnosis(current.case_key,selected) as SubmitResult;
      setResult(next);
      if(typeof next.wallet_balance==='number'){
        setPlayer(previous=>({...previous,wallet_balance:next.wallet_balance as number}));
      }
      await load(true);
      setMessage(next.correct
        ?`Chẩn thể chính xác · +${next.credits_awarded||0} tín dụng.`
        :'Đã ghi nhận đáp án. Xem giải thích và tiếp tục xử trí ca.');
      gameEventBus.emit('SYNC_REQUESTED',{reason:'v20-diagnosis'});
    }catch(error){setMessage((error as Error).message);}
    finally{setBusy('');}
  };

  const disposition=async(action:'observe'|'discharge')=>{
    if(!current||busy)return;
    if(action==='observe'&&bedsFull){
      setMessage('Cả 3 giường Dưỡng Trị đang có bệnh nhân. Vẫn tiếp nhận và khám ca khác; chỉ tạm khóa chuyển thêm bệnh nhân vào phòng.');
      return;
    }
    setBusy(action);setMessage('');
    try{
      const data=await legacyRuleAdapter.disposition(current.case_key,action) as {bed_slot?:number|null;summary?:string};
      setMessage(action==='observe'
        ?`Đã chuyển bệnh nhân vào Giường ${data?.bed_slot||'Dưỡng Trị'}. Quán vẫn tiếp tục nhận và khám ca mới.`
        :(data?.summary||'Đã cho bệnh nhân về và lưu hồ sơ.'));
      await load(true);
      gameEventBus.emit('SYNC_REQUESTED',{reason:`v20-${action}`});
    }catch(error){setMessage((error as Error).message);}
    finally{setBusy('');}
  };

  const recheck=async()=>{
    if(!current||busy)return;
    setBusy('recheck');setMessage('');
    try{
      const data=await legacyRuleAdapter.recheck(current.case_key) as {ready?:boolean;seconds_remaining?:number;summary?:string};
      if(data?.ready===false){
        setMessage(`Chưa đến giờ tái khám. Còn ${Math.max(0,Number(data.seconds_remaining||0))} giây.`);
        return;
      }
      setMessage(data?.summary||'Đã hoàn tất lần tái khám mô phỏng.');
      await load(true);
      gameEventBus.emit('SYNC_REQUESTED',{reason:'v20-recheck'});
    }catch(error){setMessage((error as Error).message);}
    finally{setBusy('');}
  };

  const decideAppointment=async(accept:boolean)=>{
    if(!current||busy)return;
    setBusy('appointment');
    try{
      await legacyRuleAdapter.decideAppointment(current.case_key,accept);
      await load(true);
      setMessage(accept?'Đã nhận lịch khám mô phỏng.':'Đã từ chối lịch khám mô phỏng.');
    }catch(error){setMessage((error as Error).message);}
    finally{setBusy('');}
  };

  if(!player.active){
    return <section className="hyq-v20-unified hyq-v20-onboarding">
      <div className="hyq-v20-card hyq-v20-onboarding-card">
        <div className="hyq-v20-seal"><Stethoscope/></div>
        <span className="hyq-v20-kicker">HIU · Y · QUÁN</span>
        <h2>Khai trương Y Quán</h2>
        <p>Game mô phỏng học tập Y học cổ truyền. Tình huống dùng để luyện nhận diện thể bệnh, không dùng cho chẩn đoán hay điều trị thực tế.</p>
        <label>Tên thầy thuốc<input value={name} maxLength={40} onChange={event=>setName(event.target.value)}/></label>
        <div className="hyq-v20-choice-row">
          <button className={gender==='female'?'active':''} onClick={()=>setGender('female')}><UserRound/>Nữ</button>
          <button className={gender==='male'?'active':''} onClick={()=>setGender('male')}><UserRound/>Nam</button>
        </div>
        <select value={outfit} onChange={event=>setOutfit(event.target.value as DoctorOutfit)}>
          {OUTFITS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        {message&&<div className="hyq-v20-message">{message}</div>}
        <button className="hyq-v20-primary" disabled={Boolean(busy)} onClick={()=>void activate()}><Sparkles/>{busy?'Đang kích hoạt…':'Kích hoạt HIU Y Quán'}</button>
      </div>
    </section>;
  }

  return <section className="hyq-v20-unified" data-runtime="v20">
    <header className="hyq-v20-page-head">
      <div><span className="hyq-v20-kicker"><Sparkles/> HIU · Y · QUÁN</span><h2>Phòng khám Y học cổ truyền</h2><p>Một runtime V20 duy nhất · 3 bối cảnh · nhân vật actor · Tứ chẩn · Chế Dược · Dưỡng Trị.</p></div>
      <button className="hyq-v20-refresh" disabled={Boolean(busy)} onClick={()=>void load()}><RefreshCw/>Đồng bộ</button>
    </header>

    <div className="hyq-v20-hud">
      <article><Coins/><span><small>Tín dụng</small><b>{player.wallet_balance}</b></span></article>
      <article><HeartPulse/><span><small>Ca đã xử lý</small><b>{player.total_cases}</b></span></article>
      <article><CheckCircle2/><span><small>Tỷ lệ đúng</small><b>{accuracy}%</b></span></article>
      <article className={bedsFull?'is-full':''}><Clock3/><span><small>Dưỡng Trị</small><b>{wardCases.length}/3 giường</b></span></article>
    </div>
    {message&&<div className="hyq-v20-message" role="status">{message}</div>}

    <details className="hyq-v20-rules">
      <summary><Sparkles/><b>Luật chơi V20 thống nhất</b></summary>
      <div>
        <p><strong>Tiếp nhận:</strong> mỗi giờ vẫn tạo ca học tập theo luật hiện có, không dừng chỉ vì Dưỡng Trị đang có người.</p>
        <p><strong>Khám:</strong> đọc Vọng · Văn · Vấn · Thiết và chọn thể bệnh; điểm chấm một lần ở máy chủ.</p>
        <p><strong>Xử trí:</strong> cho về hoặc chuyển vào Dưỡng Trị. Chỉ khóa thao tác chuyển khi đủ đúng 3/3 giường; việc nhận và khám ca khác vẫn hoạt động.</p>
        <p><strong>Chế Dược:</strong> sau chẩn thể, thầy thuốc tự đi qua tủ thuốc → cân → nghiền → sắc → đóng gói trước khi trở lại bàn khám.</p>
      </div>
    </details>

    <div className="hyq-v20-appearance">
      <span><Palette/><b>Tạo hình</b></span>
      <button className={gender==='female'?'active':''} onClick={()=>setGender('female')}>Nữ</button>
      <button className={gender==='male'?'active':''} onClick={()=>setGender('male')}>Nam</button>
      <select value={outfit} onChange={event=>setOutfit(event.target.value as DoctorOutfit)}>{OUTFITS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <button disabled={busy==='appearance'} onClick={()=>void saveAppearance()}>Lưu</button>
    </div>

    <nav className="hyq-v20-tabs" aria-label="Khu vực HIU Y Quán">
      <button className={view==='clinic'?'active':''} onClick={()=>setView('clinic')}><Stethoscope/>Khám bệnh</button>
      <button className={view==='records'?'active':''} onClick={()=>setView('records')}><BookOpen/>Sổ bệnh án</button>
      <button className={view==='pharmacy'?'active':''} onClick={()=>setView('pharmacy')}><LibraryBig/>Dược phòng</button>
      <button className={view==='progress'?'active':''} onClick={()=>setView('progress')}><Trophy/>Thành tích</button>
    </nav>

    {view==='clinic'&&<div className="hyq-v20-clinic-layout">
      <V20World/>
      <div className="hyq-v20-workspace">
        <aside className="hyq-v20-queue">
          <header><b>Ca đang hoạt động</b><small>{cases.length} ca · {waitingCount} chờ khám · {transferCount} chờ xử trí</small></header>
          {cases.map((item,index)=>{
            const status=item.care_status==='waiting_diagnosis'
              ?'Chờ khám'
              :item.care_status==='awaiting_transfer'
                ?(bedsFull?'Đã chẩn · Dưỡng Trị đủ 3/3':'Đã chẩn · chờ quyết định')
                :item.care_status==='recheck_due'
                  ?`Giường ${item.bed_slot||'—'} · đến giờ tái khám`
                  :`Giường ${item.bed_slot||'—'} · ${formatCountdown(item.recheck_due_at,now)}`;
            return <button key={item.case_key} className={current?.case_key===item.case_key?'active':''} onClick={()=>setActiveKey(item.case_key)}>
              <span>{index+1}</span>
              <div><b>{patientLabel(item)} · {item.patient_age} tuổi</b><small>{status}</small></div>
              {item.completed&&<CheckCircle2/>}
            </button>;
          })}
        </aside>

        <main className="hyq-v20-case-panel">
          {current?<>
            <div className="hyq-v20-patient-title"><UserRound/><div><b>{patientLabel(current)} · {current.patient_age} tuổi</b><small>Mã ca {current.case_key}{current.bed_slot?` · Giường ${current.bed_slot}`:''}</small></div></div>
            <div className="hyq-v20-four-exams">
              <article><b>VỌNG</b><p>{current.vong}</p></article>
              <article><b>VĂN</b><p>{current.van_am}</p></article>
              <article><b>VẤN</b><p>{current.van_hoi}</p></article>
              <article><b>THIẾT</b><p>{current.thiet}</p></article>
            </div>

            {current.appointment_offered&&(current.appointment_status||'pending')==='pending'&&<div className="hyq-v20-appointment">
              <span><Clock3/><b>Yêu cầu đặt lịch mô phỏng</b><small>{formatDate(current.appointment_for_at)}</small></span>
              <div><button disabled={Boolean(busy)} onClick={()=>void decideAppointment(true)}>Nhận lịch</button><button disabled={Boolean(busy)} onClick={()=>void decideAppointment(false)}>Từ chối</button></div>
            </div>}

            {!current.completed?<div className="hyq-v20-diagnosis">
              <header><ShieldCheck/><span><b>Chẩn thể bệnh</b><small>Mỗi ca chỉ tính điểm một lần.</small></span></header>
              <div className="hyq-v20-options">{current.options.map(option=><button key={option.code} className={selected===option.code?'selected':''} disabled={Boolean(busy)} onClick={()=>setSelected(option.code)}>{option.label}</button>)}</div>
              <button className="hyq-v20-primary" disabled={!selected||Boolean(busy)} onClick={()=>void submitDiagnosis()}>Xác nhận chẩn thể</button>
            </div>:<div className={`hyq-v20-result ${current.correct?'correct':'review'}`}>
              <b>{result?.correct===true?'Chẩn thể chính xác':current.correct?'Ca đã chẩn đúng':'Ca đã hoàn tất chẩn thể'}</b>
              {result?.expected_label&&<p>Đáp án: <strong>{result.expected_label}</strong>. {result.explanation}</p>}
            </div>}

            {current.care_status==='awaiting_transfer'&&<div className="hyq-v20-disposition">
              <div><HeartPulse/><span><b>Quyết định xử trí sau chẩn thể</b><small>{bedsFull?'Dưỡng Trị đang đủ 3/3. Vẫn có thể chọn ca khác để tiếp tục khám.':`Còn ${3-wardCases.length} giường trống.`}</small></span></div>
              <div>
                <button disabled={Boolean(busy)} onClick={()=>void disposition('discharge')}>Cho về · lưu hồ sơ</button>
                <button className="hyq-v20-primary" disabled={Boolean(busy)||bedsFull} onClick={()=>void disposition('observe')}>{bedsFull?'Đủ 3 giường':'Chuyển vào Dưỡng Trị'}</button>
              </div>
            </div>}

            {(current.care_status==='observing'||current.care_status==='recheck_due')&&<div className="hyq-v20-recheck">
              <Clock3/>
              <span><b>Giường {current.bed_slot||'—'} · {recheckReady(current,now)?'đến giờ tái khám':'đang theo dõi'}</b><small>{recheckReady(current,now)?'Có thể thực hiện vòng đánh giá tiếp theo.':`Còn ${formatCountdown(current.recheck_due_at,now)}.`}</small></span>
              <button className="hyq-v20-primary" disabled={Boolean(busy)||!recheckReady(current,now)} onClick={()=>void recheck()}>Tái khám</button>
            </div>}
          </>:<div className="hyq-v20-empty"><Clock3/><b>Chưa có ca đang hoạt động</b><p>Y Quán vẫn trực. Ca mới sẽ được đồng bộ theo lịch phát ca hiện có.</p></div>}
        </main>
      </div>
    </div>}

    {view==='records'&&<section className="hyq-v20-card hyq-v20-records">
      <header><div><BookOpen/><span><b>Sổ bệnh án</b><small>Ca đã kết thúc trong game.</small></span></div><div className="hyq-v20-record-search"><Search/><input value={recordQuery} onChange={event=>setRecordQuery(event.target.value)} placeholder="Tìm thể bệnh hoặc mã ca"/><button disabled={busy==='records'} onClick={()=>void loadRecords()}>Tìm</button></div></header>
      <div className="hyq-v20-record-list">{records.map(item=><article key={item.case_key}><div><b>{item.syndrome_label}</b><small>{item.case_key} · {item.patient_age} tuổi · {formatDate(item.discharged_at)}</small></div><strong>{item.correct?'Đúng':'Ôn lại'}</strong><p>Vọng: {item.vong}</p><p>Văn: {item.van_am}</p><p>Vấn: {item.van_hoi}</p><p>Thiết: {item.thiet}</p></article>)}{!records.length&&<div className="hyq-v20-empty"><BookOpen/><b>Chưa có hồ sơ phù hợp</b></div>}</div>
    </section>}

    {view==='pharmacy'&&<section className="hyq-v20-card hyq-v20-pharmacy">
      <header><LibraryBig/><div><b>Dược phòng học tập</b><small>{herbs.length} thẻ dược liệu đang khả dụng</small></div></header>
      <div className="hyq-v20-herb-grid">{herbs.map(item=><article key={item.herb_key}><b>{item.name}</b><small>{item.latin_name||''}</small><p><strong>Tính vị:</strong> {item.nature_flavor||'—'}</p><p><strong>Quy kinh:</strong> {item.meridians||'—'}</p><p><strong>Công năng:</strong> {item.actions||'—'}</p></article>)}</div>
    </section>}

    {view==='progress'&&<section className="hyq-v20-card hyq-v20-progress">
      <header><Trophy/><div><b>Thành tích thầy thuốc</b><small>{player.display_name||member.herbalAlias||member.fullName}</small></div></header>
      <div className="hyq-v20-progress-grid">
        <article><Coins/><span><small>Tín dụng</small><b>{player.wallet_balance}</b></span></article>
        <article><HeartPulse/><span><small>Ca đã xử lý</small><b>{player.total_cases}</b></span></article>
        <article><CheckCircle2/><span><small>Ca đúng</small><b>{player.correct_cases}</b></span></article>
        <article><Clock3/><span><small>Khách mới</small><b>{formatCountdown(player.next_visit_at,now)}</b></span></article>
      </div>
      <p className="hyq-v20-progress-note">Dưỡng Trị {wardCases.length}/3 giường. Trạng thái giường chỉ chi phối thao tác chuyển bệnh nhân, không khóa tiếp nhận hay Tứ chẩn.</p>
    </section>}

    <footer className="hyq-v20-safety">Mô phỏng giáo dục YHCT · không phải hướng dẫn kê đơn, liều dùng, chẩn đoán hoặc điều trị người bệnh thực tế.</footer>
  </section>;
}
