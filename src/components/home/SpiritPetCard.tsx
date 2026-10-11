import {useEffect,useRef,useState,type FormEvent,type PointerEvent as ReactPointerEvent} from 'react';
import {
  SPIRIT_PET_NAMES,careSpiritPet,spiritPetIconUrl,syncSpiritPetProgress,
  type SpiritPetCareAction,type SpiritPetProgress,type SpiritPetSpecies,
} from '../../services/spiritPetService';
import {answerPetScript,type PetContext,type PetLearningTab} from '../../services/spiritPetScript';

// Biểu tượng linh thú nổi ở góc phải dưới (như launcher HIU TMC). Bấm vào mới mở bảng chi tiết.
type Props={
  memberId:string|null;
  onLogin:()=>void;
  context:PetContext;
  onOpenLearning:(tab:PetLearningTab)=>void;
};
type State=
  |{status:'guest'}
  |{status:'loading'}
  |{status:'error'}
  |{status:'empty'}
  |{status:'ready';progress:SpiritPetProgress};
type Line={from:'pet'|'you';text:string};

const CARE_LABELS:Record<SpiritPetCareAction,string>={feed:'Cho ăn',groom:'Chải lông',play:'Chơi cùng'};
const CARE_FAIL:Record<'limit'|'unknown'|'missing'|'error',string>={
  limit:'Hôm nay bạn đã chăm sóc đủ số lượt. Quay lại vào ngày mai.',
  unknown:'Hành động chăm sóc này chưa có.',
  missing:'Chưa có linh thú để chăm sóc.',
  error:'Chưa chăm sóc được. Thử lại sau.',
};
const LEVEL_NEXT=[100,300,600];
const SPECIES_COLOR:Record<SpiritPetSpecies,string>={thanh_long:'#2f8e8a',chu_tuoc:'#c64b3d',kim_su:'#b97b35',ky_lan:'#568c80',ho_ly:'#b85d34',khong_tuoc:'#237a77'};
// Chữ viết tắt hiện khi ảnh không tải được: "Thanh Long" -> "TL".
function initials(name:string):string{return name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()}

export default function SpiritPetCard({memberId,onLogin,context,onOpenLearning}:Props){
  const [state,setState]=useState<State>({status:'guest'});
  const [open,setOpen]=useState(false);
  const [iconFailed,setIconFailed]=useState(false);
  // Vị trí nút nổi do người dùng kéo (chỉ trong phiên, không lưu cục bộ).
  const [pos,setPos]=useState<{right:number;bottom:number}|null>(null);
  const drag=useRef<{id:number;x:number;y:number;right:number;bottom:number;moved:boolean}|null>(null);
  const suppressClick=useRef(false);
  const [lines,setLines]=useState<Line[]>([]);
  const [draft,setDraft]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [suggestions,setSuggestions]=useState<string[]>(['Tiến độ hôm nay','Thẻ đến hạn','Mở quiz','Bạn làm được gì?']);

  useEffect(()=>{
    if(!memberId){setState({status:'guest'});return}
    let alive=true;
    setState({status:'loading'});
    // Đồng bộ XP từ điểm học đã ghi trên máy chủ; máy chủ tính cấp và XP.
    syncSpiritPetProgress().then(progress=>{if(alive)setState(progress?{status:'ready',progress}:{status:'empty'})})
      .catch(()=>{if(alive)setState({status:'error'})});
    return()=>{alive=false};
  },[memberId]);

  const care=async(action:SpiritPetCareAction)=>{
    if(busy)return;
    setBusy(true);
    setNotice('');
    try{
      const result=await careSpiritPet(action);
      if(result.ok){
        setState({status:'ready',progress:result.progress});
        const left=result.progress.remainingToday;
        setNotice(`${CARE_LABELS[action]} xong.${typeof left==='number'?` Còn ${left} lượt hôm nay.`:''}`);
      }else{
        setNotice(CARE_FAIL[result.reason]);
      }
    }finally{
      setBusy(false);
    }
  };

  const ask=(text:string)=>{
    const clean=text.trim();
    if(!clean)return;
    const result=answerPetScript(clean,context);
    setLines(prev=>[...prev.slice(-11),{from:'you',text:clean},{from:'pet',text:result.reply}]);
    setSuggestions(result.suggestions);
    setDraft('');
    if(result.action.type==='learning')onOpenLearning(result.action.tab);
  };

  const submit=(event:FormEvent)=>{event.preventDefault();ask(draft)};

  const species=state.status==='ready'?state.progress.species:null;
  const label=species?`Mở linh thú ${SPIRIT_PET_NAMES[species]}`:'Mở linh thú';

  const clampPos=(right:number,bottom:number)=>({
    right:Math.min(Math.max(6,right),Math.max(6,window.innerWidth-70)),
    bottom:Math.min(Math.max(6,bottom),Math.max(6,window.innerHeight-70)),
  });
  const onPointerDown=(e:ReactPointerEvent<HTMLButtonElement>)=>{
    const r=e.currentTarget.getBoundingClientRect();
    drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,right:window.innerWidth-r.right,bottom:window.innerHeight-r.bottom,moved:false};
    try{e.currentTarget.setPointerCapture(e.pointerId)}catch{/* không bắt buộc */}
  };
  const onPointerMove=(e:ReactPointerEvent<HTMLButtonElement>)=>{
    const d=drag.current;
    if(!d||d.id!==e.pointerId)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.moved&&Math.hypot(dx,dy)<6)return;
    d.moved=true;
    setPos(clampPos(d.right-dx,d.bottom-dy));
  };
  const onPointerEnd=(e:ReactPointerEvent<HTMLButtonElement>)=>{
    const d=drag.current;
    if(!d||d.id!==e.pointerId)return;
    suppressClick.current=d.moved;
    drag.current=null;
    try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{/* không bắt buộc */}
  };
  // Nút ở sát mép trên thì mở panel xuống dưới để không bị cắt.
  const panelBelow=!!pos&&(window.innerHeight-pos.bottom-64)<380;
  const rootStyle=pos?{right:pos.right,bottom:pos.bottom,flexDirection:panelBelow?'column' as const:'column-reverse' as const}:undefined;
  const fallbackStyle=species&&iconFailed?{background:SPECIES_COLOR[species]}:undefined;
  return <section className="study-os-v2__spirit-pet" aria-label="Linh thú" style={rootStyle}>
    <button type="button" className="study-os-v2__spirit-pet-launcher" aria-expanded={open} aria-label={label} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}
      onClick={()=>{if(suppressClick.current){suppressClick.current=false;return}setIconFailed(false);setOpen(v=>!v)}} style={fallbackStyle}>
      {species&&!iconFailed
        ? <img src={spiritPetIconUrl(species)} alt="" width={56} height={56} loading="lazy" referrerPolicy="no-referrer" onError={()=>setIconFailed(true)}/>
        : <span aria-hidden="true" className="study-os-v2__spirit-pet-fallback">{species?initials(SPIRIT_PET_NAMES[species]):'✦'}</span>}
    </button>
    {open&&<div className="study-os-v2__spirit-pet-panel" role="dialog" aria-label="Chi tiết linh thú">
      <header>
        <div><span>LINH THÚ</span><h3>Người bạn đồng hành học tập</h3></div>
        <button type="button" className="study-os-v2__spirit-pet-close" onClick={()=>setOpen(false)} aria-label="Đóng">×</button>
      </header>
      {state.status==='guest'&&<p>Đăng nhập thành viên để xem linh thú của bạn. <button type="button" onClick={onLogin}>Đăng nhập</button></p>}
      {state.status==='loading'&&<p role="status">Đang tải linh thú…</p>}
      {state.status==='error'&&<p>Chưa tải được linh thú. Thử lại sau.</p>}
      {state.status==='empty'&&<p>Bạn chưa có linh thú. Mở HIU TMC để chọn linh thú, rồi quay lại đây.</p>}
      {state.status==='ready'&&<>
        <div className="study-os-v2__spirit-pet-body">
          <div>
            <b>{SPIRIT_PET_NAMES[state.progress.species]}</b>
            <p>Cấp {state.progress.level} · {state.progress.xp} XP{LEVEL_NEXT[state.progress.level-1]?` · cấp kế tiếp ở ${LEVEL_NEXT[state.progress.level-1]} XP`:' · cấp tối đa'}</p>
            <p>Thân mật: {state.progress.affection}</p>
          </div>
        </div>
        <div className="study-os-v2__spirit-pet-suggest" aria-label="Chăm sóc">
          {(Object.keys(CARE_LABELS) as SpiritPetCareAction[]).map(action=>
            <button key={action} type="button" disabled={busy} onClick={()=>care(action)}>{CARE_LABELS[action]}</button>
          )}
        </div>
        {notice&&<p role="status">{notice}</p>}
        <div className="study-os-v2__spirit-pet-chat" aria-live="polite">
          {lines.map((line,i)=><p key={i} className={line.from==='you'?'you':'pet'}>{line.text}</p>)}
        </div>
        <div className="study-os-v2__spirit-pet-suggest">
          {suggestions.map(s=><button key={s} type="button" onClick={()=>ask(s)}>{s}</button>)}
        </div>
        <form onSubmit={submit} className="study-os-v2__spirit-pet-form">
          <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Hỏi linh thú…" aria-label="Hỏi linh thú" maxLength={200}/>
          <button type="submit">Gửi</button>
        </form>
      </>}
    </div>}
  </section>;
}
