import {useEffect,useState,type FormEvent} from 'react';
import {SPIRIT_PET_NAMES,readSpiritPetSpecies,spiritPetImageUrl,type SpiritPetSpecies} from '../../services/spiritPetService';
import {answerPetScript,type PetContext,type PetLearningTab} from '../../services/spiritPetScript';

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
  |{status:'ready';species:SpiritPetSpecies};
type Line={from:'pet'|'you';text:string};

export default function SpiritPetCard({memberId,onLogin,context,onOpenLearning}:Props){
  const [state,setState]=useState<State>({status:'guest'});
  const [lines,setLines]=useState<Line[]>([]);
  const [draft,setDraft]=useState('');
  const [suggestions,setSuggestions]=useState<string[]>(['Tiến độ hôm nay','Thẻ đến hạn','Mở quiz','Bạn làm được gì?']);

  useEffect(()=>{
    if(!memberId){setState({status:'guest'});return}
    let alive=true;
    setState({status:'loading'});
    readSpiritPetSpecies(memberId)
      .then(species=>{if(alive)setState(species?{status:'ready',species}:{status:'empty'})})
      .catch(()=>{if(alive)setState({status:'error'})});
    return()=>{alive=false};
  },[memberId]);

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

  return <section className="study-os-v2__spirit-pet" aria-label="Linh thú">
    <header>
      <div><span>LINH THÚ</span><h3>Người bạn đồng hành học tập</h3></div>
    </header>
    {state.status==='guest'&&<p>Đăng nhập thành viên để xem linh thú của bạn. <button onClick={onLogin}>Đăng nhập</button></p>}
    {state.status==='loading'&&<p role="status">Đang tải linh thú…</p>}
    {state.status==='error'&&<p>Chưa tải được linh thú. Thử lại sau.</p>}
    {state.status==='empty'&&<p>Bạn chưa có linh thú. Mở HIU TMC để chọn linh thú, rồi quay lại đây.</p>}
    {state.status==='ready'&&<>
      <div className="study-os-v2__spirit-pet-body">
        <img src={spiritPetImageUrl(state.species)} alt={`Linh thú ${SPIRIT_PET_NAMES[state.species]}`} width={96} height={96} loading="lazy"/>
        <div><b>{SPIRIT_PET_NAMES[state.species]}</b><p>Trò chuyện theo kịch bản cố định. Không dùng AI.</p></div>
      </div>
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
  </section>;
}
