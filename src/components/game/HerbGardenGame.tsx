import {useEffect,useMemo,useState} from 'react';
import {Droplets,Leaf,PackageOpen,RefreshCw,Seedling,ShoppingBasket,Sparkles} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';

type Plant={id:string;planted_at:string;matures_at:string;last_cared_at?:string|null;care_count:number;ready:boolean;name?:string|null;botanical_name?:string|null;category?:string|null;traditional_actions?:string|null;caution?:string|null};
type Inventory={name:string;botanical_name:string;category:string;traditional_actions:string;caution:string;quantity:number;updated_at:string};

const DAY=86400000;
function remaining(iso:string,now:number){const ms=Math.max(0,Date.parse(iso)-now),days=Math.floor(ms/DAY),hours=Math.floor((ms%DAY)/3600000),minutes=Math.floor((ms%3600000)/60000);return days?`${days} ngày ${hours} giờ`:`${hours} giờ ${minutes} phút`}

export default function HerbGardenGame({member}:{member:Member}){
  const [plant,setPlant]=useState<Plant|null>(null),[inventory,setInventory]=useState<Inventory[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[now,setNow]=useState(Date.now());
  const load=async()=>{setBusy(true);setMsg('');try{const [state,stock]=await Promise.all([supabase.rpc('herb_garden_state_v1'),supabase.rpc('herb_garden_inventory_v1')]);if(state.error)throw state.error;if(stock.error)throw stock.error;setPlant(Array.isArray(state.data)&&state.data[0]?state.data[0] as Plant:null);setInventory((Array.isArray(stock.data)?stock.data:[]) as Inventory[])}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  useEffect(()=>{void load();const t=window.setInterval(()=>setNow(Date.now()),60000);return()=>window.clearInterval(t)},[member.id]);
  const progress=useMemo(()=>{if(!plant)return 0;const start=Date.parse(plant.planted_at),end=Date.parse(plant.matures_at);return Math.max(0,Math.min(100,Math.round((now-start)/Math.max(1,end-start)*100)))},[plant,now]);
  const action=async(kind:'plant'|'care'|'harvest')=>{setBusy(true);setMsg('');try{const rpc=kind==='plant'?'herb_garden_plant_v1':kind==='care'?'herb_garden_care_v1':'herb_garden_harvest_v1';const {data,error}=await supabase.rpc(rpc);if(error)throw error;if(kind==='harvest'&&Array.isArray(data)&&data[0])setMsg(`Thu hoạch thành công: ${(data[0] as Inventory).name} đã vào kho.`);else if(kind==='plant')setMsg('Đã nhận hạt giống ngẫu nhiên và gieo xuống vườn. Tên cây sẽ được mở sau 3 ngày.');else setMsg('Đã chăm sóc cây. Tiến độ trưởng thành vẫn dùng thời gian máy chủ.');await load()}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  return <section className="herb-garden-page">
    <header className="garden-hero"><div><span className="garden-kicker"><Sparkles/> Game học thuật nhẹ</span><h2>Gia Viên Dược Thảo</h2><p>Gieo một hạt giống ngẫu nhiên, chăm sóc và chờ cây trưởng thành sau đúng 3 ngày theo thời gian máy chủ. Khi trưởng thành, tên và công dụng YHCT mới được mở.</p></div><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw/>Làm mới</button></header>
    {msg&&<div className="ai-note" role="status">{msg}</div>}
    <div className="garden-layout">
      <section className="garden-plot panel">
        {!plant?<div className="garden-empty"><div className="seed-orb"><Seedling/></div><h3>Ô đất đang trống</h3><p>Mỗi lượt chỉ nuôi một cây. Hệ thống chọn ngẫu nhiên từ kho dược liệu học thuật và không tiết lộ loài trước khi cây trưởng thành.</p><button disabled={busy} onClick={()=>void action('plant')}><Leaf/>Nhận hạt và gieo</button></div>:<>
          <div className={`garden-stage stage-${plant.ready?'mature':progress>=66?'sprout-3':progress>=33?'sprout-2':'sprout-1'}`}><div className="soil-bed"/><div className="plant-sprite"><Leaf/><Leaf/><Seedling/></div></div>
          <div className="garden-progress"><div className="between"><b>{plant.ready?'Cây đã trưởng thành':'Cây đang phát triển'}</b><span>{plant.ready?'100%':`${progress}%`}</span></div><div className="progress-track"><i style={{width:`${plant.ready?100:progress}%`}}/></div><small>{plant.ready?'Có thể thu hoạch ngay.':`Còn khoảng ${remaining(plant.matures_at,now)} · đã chăm ${plant.care_count} lần`}</small></div>
          {plant.ready?<article className="herb-reveal"><span className="badge">Đã nhận diện</span><h3>{plant.name}</h3><i>{plant.botanical_name}</i><p><b>{plant.category}</b> · {plant.traditional_actions}</p><small>{plant.caution}</small></article>:<article className="seed-mystery"><span>?</span><div><b>Hạt giống bí ẩn</b><small>Tên, loài và công dụng chỉ được mở khi đủ 72 giờ.</small></div></article>}
          <div className="garden-actions"><button className="secondary" disabled={busy||plant.ready} onClick={()=>void action('care')}><Droplets/>Chăm sóc</button><button disabled={busy||!plant.ready} onClick={()=>void action('harvest')}><ShoppingBasket/>Thu hoạch về kho</button></div>
        </>}
      </section>
      <section className="garden-inventory panel"><div className="row"><PackageOpen/><div><h3>Kho dược thảo</h3><p className="muted">Thành quả đã thu hoạch · dữ liệu học thuật, không phải hướng dẫn tự điều trị.</p></div></div>{inventory.length===0?<div className="empty-state compact"><ShoppingBasket/><p>Kho đang trống.</p></div>:<div className="herb-stock-list">{inventory.map(x=><article key={x.name}><div><b>{x.name}</b><small>{x.botanical_name} · {x.category}</small></div><strong>×{x.quantity}</strong><p>{x.traditional_actions}</p><small>{x.caution}</small></article>)}</div>}</section>
    </div>
  </section>;
}
