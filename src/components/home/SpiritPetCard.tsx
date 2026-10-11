import {useEffect,useState} from 'react';
import {SPIRIT_PET_NAMES,readSpiritPetSpecies,spiritPetImageUrl,type SpiritPetSpecies} from '../../services/spiritPetService';

type Props={memberId:string|null;onLogin:()=>void};
type State=
  |{status:'guest'}
  |{status:'loading'}
  |{status:'error'}
  |{status:'empty'}
  |{status:'ready';species:SpiritPetSpecies};

export default function SpiritPetCard({memberId,onLogin}:Props){
  const [state,setState]=useState<State>({status:'guest'});

  useEffect(()=>{
    if(!memberId){setState({status:'guest'});return}
    let alive=true;
    setState({status:'loading'});
    readSpiritPetSpecies(memberId)
      .then(species=>{if(alive)setState(species?{status:'ready',species}:{status:'empty'})})
      .catch(()=>{if(alive)setState({status:'error'})});
    return()=>{alive=false};
  },[memberId]);

  return <section className="study-os-v2__spirit-pet" aria-label="Linh thú">
    <header>
      <div><span>LINH THÚ</span><h3>Người bạn đồng hành học tập</h3></div>
    </header>
    {state.status==='guest'&&<p>Đăng nhập thành viên để xem linh thú của bạn. <button onClick={onLogin}>Đăng nhập</button></p>}
    {state.status==='loading'&&<p role="status">Đang tải linh thú…</p>}
    {state.status==='error'&&<p>Chưa tải được linh thú. Thử lại sau.</p>}
    {state.status==='empty'&&<p>Bạn chưa có linh thú. Mở HIU TMC để chọn linh thú, rồi quay lại đây.</p>}
    {state.status==='ready'&&<div className="study-os-v2__spirit-pet-body">
      <img src={spiritPetImageUrl(state.species)} alt={`Linh thú ${SPIRIT_PET_NAMES[state.species]}`} width={96} height={96} loading="lazy"/>
      <div><b>{SPIRIT_PET_NAMES[state.species]}</b><p>Linh thú hiển thị theo hồ sơ HIU TMC. Cấp và tiến hóa sẽ cập nhật khi có tiến độ được máy chủ xác nhận.</p></div>
    </div>}
  </section>;
}
