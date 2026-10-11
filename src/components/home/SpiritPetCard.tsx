import {useEffect,useState,type FormEvent} from 'react';
import {
  SPIRIT_PET_NAMES,careSpiritPet,spiritPetIconUrl,syncSpiritPetProgress,
  type SpiritPetCareAction,type SpiritPetProgress,
} from '../../services/spiritPetService';
import {answerPetScript,type PetContext,type PetLearningTab} from '../../services/spiritPetScript';

// Trang chủ chỉ hiện biểu tượng linh thú (như launcher HIU TMC). Bấm vào mới mở bảng chi tiết.
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

export default function SpiritPetCard({memberId,onLogin,context,onOpenLearning}:Props){
  const [state,setState]=useState<State>({status:'guest'});
  const [open,setOpen]=useState(false);
  const [iconFailed,setIconFailed]=useState(false);
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

  return <section className="study-os-v2__spirit-pet" aria-label="Linh thú">
    <button type="button" className="study-os-v2__spirit-pet-launcher" aria-expanded={open} aria-label={label} onClick={()=>setOpen(v=>!v)}>
      {species&&!iconFailed
        ? <img src={spiritPetIconUrl(species)} alt="" width={56} height={56} loading="lazy" onError={()=>setIconFailed(true)}/>
        : <span aria-hidden="true">✦</span>}
    </button>
    {open&&<div className="study-os-v2__spirit-pet-panel">
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
