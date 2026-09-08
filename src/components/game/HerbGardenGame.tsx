import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import {Droplets,Leaf,PackageOpen,RefreshCw,ShoppingBasket,Sparkles,Sprout} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';
import '../../herb-garden-v2.css';

type PlantStatus='growing'|'mature'|'dead'|'harvested';
type Plant={
  id:string;planted_at:string;matures_at:string;expires_at:string;status:PlantStatus;
  water_count:number;fertilizer_count:number;required_water_count:number;required_fertilizer_count:number;
  last_watered_at?:string|null;last_fertilized_at?:string|null;next_water_at?:string|null;next_fertilizer_at?:string|null;
  can_water:boolean;can_fertilize:boolean;ready_for_harvest:boolean;missed_water_slots:number;missed_fertilizer_days:number;
  died_at?:string|null;death_reason?:string|null;name?:string|null;other_names?:string|null;botanical_name?:string|null;
  family?:string|null;used_part?:string|null;traditional_actions?:string|null;dosage?:string|null;caution?:string|null;
  source_ref?:string|null;source_page?:number|null;visual_variant?:number|null;
};
type Inventory={name:string;other_names:string;botanical_name:string;family:string;used_part:string;traditional_actions:string;dosage:string;caution:string;source_ref:string;source_page:number;quantity:number;updated_at:string;visual_variant:number};

const DAY=86400000;
function remaining(iso:string|undefined|null,now:number){
  if(!iso)return '—';
  const ms=Math.max(0,Date.parse(iso)-now),days=Math.floor(ms/DAY),hours=Math.floor((ms%DAY)/3600000),minutes=Math.floor((ms%3600000)/60000);
  return days?`${days} ngày ${hours} giờ`:`${hours} giờ ${minutes} phút`;
}
function sourceThumbStyle(page?:number|null):CSSProperties{
  const index=Math.max(0,Math.min(69,(page||1)-1)),col=index%7,row=Math.floor(index/7);
  return {'--garden-source-x':`${col*100/6}%`,'--garden-source-y':`${row*100/9}%`} as CSSProperties;
}

export default function HerbGardenGame({member}:{member:Member}){
  const [plant,setPlant]=useState<Plant|null>(null),[inventory,setInventory]=useState<Inventory[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[fx,setFx]=useState<'water'|'fertilize'|''>(''),[now,setNow]=useState(Date.now());
  const load=async()=>{setBusy(true);setMsg('');try{
    const [state,stock]=await Promise.all([supabase.rpc('herb_garden_state_v2'),supabase.rpc('herb_garden_inventory_v2')]);
    if(state.error)throw state.error;if(stock.error)throw stock.error;
    setPlant(Array.isArray(state.data)&&state.data[0]?state.data[0] as Plant:null);
    setInventory((Array.isArray(stock.data)?stock.data:[]) as Inventory[]);
  }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  useEffect(()=>{void load();const t=window.setInterval(()=>setNow(Date.now()),30000);return()=>window.clearInterval(t)},[member.id]);
  const progress=useMemo(()=>{if(!plant)return 0;if(plant.status==='mature'||plant.status==='harvested'||plant.status==='dead')return 100;const start=Date.parse(plant.planted_at),end=Date.parse(plant.matures_at);return Math.max(0,Math.min(100,Math.round((now-start)/Math.max(1,end-start)*100)))},[plant,now]);
  const run=async(kind:'plant'|'water'|'fertilize'|'harvest')=>{setBusy(true);setMsg('');try{
    const rpc={plant:'herb_garden_plant_v2',water:'herb_garden_water_v2',fertilize:'herb_garden_fertilize_v2',harvest:'herb_garden_harvest_v2'}[kind];
    const {data,error}=await supabase.rpc(rpc);if(error)throw error;
    if(kind==='plant')setMsg('Đã gieo hạt ngẫu nhiên từ danh mục 70 cây thuốc mẫu của Bộ Y tế. Tên cây được giữ bí mật đến đủ 72 giờ.');
    if(kind==='water'){setFx('water');setMsg('Đã tưới cây cho chu kỳ 6 giờ hiện tại.');window.setTimeout(()=>setFx(''),900)}
    if(kind==='fertilize'){setFx('fertilize');setMsg('Đã bón phân cho ngày sinh trưởng hiện tại.');window.setTimeout(()=>setFx(''),900)}
    if(kind==='harvest'&&Array.isArray(data)&&data[0])setMsg(`Thu hoạch thành công: ${(data[0] as Inventory).name} đã vào kho dược thảo.`);
    await load();
  }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};
  const active=plant&&(plant.status==='growing'||plant.status==='mature');
  const revealed=plant&&(plant.status==='mature'||plant.status==='dead'||plant.status==='harvested')&&plant.name;
  const careComplete=plant&&plant.water_count>=plant.required_water_count&&plant.fertilizer_count>=plant.required_fertilizer_count;
  const variant=Math.max(1,Math.min(8,plant?.visual_variant||1));
  return <section className="herb-garden-page herb-garden-v2">
    <header className="garden-hero"><div><span className="garden-kicker"><Sparkles/> Game học thuật nhẹ · dữ liệu Bộ Y tế</span><h2>Gia Viên Dược Thảo</h2><p>Một lượt kéo dài 72 giờ theo thời gian máy chủ: tưới 1 lần mỗi chu kỳ 6 giờ (12 lần), bón phân 1 lần mỗi ngày (3 lần). Đủ chăm sóc mới được thu hoạch.</p></div><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw/>Làm mới</button></header>
    <div className="garden-rules" aria-label="Luật chăm sóc"><span><Droplets/> Tưới: 6 giờ/lần</span><span>🌱 Bón phân: 1 lần/ngày</span><span>⏳ Sinh trưởng: 72 giờ</span><span>🧺 Thu hoạch: đủ 12/12 + 3/3</span></div>
    {msg&&<div className="ai-note" role="status">{msg}</div>}
    <div className="garden-layout">
      <section className="garden-plot panel">
        {!plant?<div className="garden-empty"><div className="seed-orb"><Sprout/></div><h3>Ô đất đang trống</h3><p>Hệ thống sẽ chọn ngẫu nhiên một trong 70 cây thuốc mẫu. Danh tính hạt giống được giữ bí mật trong suốt thời gian sinh trưởng.</p><button disabled={busy} onClick={()=>void run('plant')}><Leaf/>Nhận hạt và gieo</button></div>:<>
          <div className={`garden-scene-v2 stage-${plant.status} stage-progress-${progress>=67?3:progress>=34?2:1} variant-${variant} fx-${fx}`} aria-label={plant.status==='dead'?'Cây đã chết':plant.status==='mature'?'Cây đã trưởng thành':'Cây thuốc đang phát triển'}>
            <div className="garden-sun"/><div className="garden-cloud cloud-a"/><div className="garden-cloud cloud-b"/><div className="garden-hills"/><div className="garden-ground"/><div className="garden-soil"/>
            <div className="plant-art-v2"><i className="stem"/><i className="leaf leaf-a"/><i className="leaf leaf-b"/><i className="leaf leaf-c"/><i className="leaf leaf-d"/><i className="flower flower-a"/><i className="flower flower-b"/></div>
            <div className="water-fx"><i/><i/><i/><i/></div><div className="fertilizer-fx"><i>✦</i><i>✦</i><i>✦</i></div>
            {plant.status==='dead'&&<div className="garden-dead-overlay"><span>🍂</span><b>Cây đã chết</b></div>}
          </div>
          <div className="garden-progress"><div className="between"><b>{plant.status==='dead'?'Lượt trồng đã kết thúc':plant.status==='harvested'?'Đã thu hoạch':plant.status==='mature'?'Cây đã trưởng thành':'Cây đang phát triển'}</b><span>{progress}%</span></div><div className="progress-track"><i style={{width:`${progress}%`}}/></div><small>{plant.status==='growing'?`Còn ${remaining(plant.matures_at,now)} đến mốc 72 giờ`:plant.status==='mature'?`Cửa sổ thu hoạch còn ${remaining(plant.expires_at,now)}`:plant.death_reason||'Lượt đã hoàn tất.'}</small></div>
          <div className="garden-care-grid">
            <article className={plant.can_water?'care-due':''}><div><Droplets/><b>Tưới nước</b></div><strong>{plant.water_count}/{plant.required_water_count}</strong><small>{plant.status==='growing'?(plant.can_water?'Đang đến lượt tưới':`Lần tiếp theo sau ${remaining(plant.next_water_at,now)}`):'Đã đóng chu kỳ tưới'}</small></article>
            <article className={plant.can_fertilize?'care-due':''}><div><span className="fertilizer-icon">🌱</span><b>Bón phân</b></div><strong>{plant.fertilizer_count}/{plant.required_fertilizer_count}</strong><small>{plant.status==='growing'?(plant.can_fertilize?'Đang đến lượt bón phân':`Lần tiếp theo sau ${remaining(plant.next_fertilizer_at,now)}`):'Đã đóng chu kỳ bón phân'}</small></article>
          </div>
          {plant.status==='growing'&&!careComplete&&(plant.missed_water_slots>0||plant.missed_fertilizer_days>0)&&<div className="garden-warning">Cần hoàn tất đúng từng chu kỳ. Hiện còn thiếu {plant.missed_water_slots} lượt tưới và {plant.missed_fertilizer_days} lượt bón phân tính đến thời điểm hiện tại.</div>}
          {revealed?<article className="herb-reveal herb-reveal-v2"><div className="herb-reveal-head"><div><span className="badge">Đã mở danh tính</span><h3>{plant.name}</h3><i>{plant.botanical_name}</i></div>{plant.source_page&&<div className="herb-source-thumb" style={sourceThumbStyle(plant.source_page)} title={`Trang ${plant.source_page} - Bộ tranh cây thuốc mẫu`}/>}</div>{plant.other_names&&<p><b>Tên khác:</b> {plant.other_names}</p>}<p><b>Họ:</b> {plant.family||'—'}</p><p><b>Bộ phận dùng:</b> {plant.used_part||'—'}</p><p><b>Công năng, chủ trị:</b> {plant.traditional_actions||'—'}</p><p><b>Liều lượng, cách dùng:</b> {plant.dosage?.trim()||'Trang nguồn không nêu liều lượng/cách dùng.'}</p><p><b>Kiêng kỵ/lưu ý:</b> {plant.caution?.trim()||'Trang nguồn không nêu kiêng kỵ/lưu ý riêng.'}</p><small>Nguồn: {plant.source_ref||'Dữ liệu game phiên bản trước'}{plant.source_page?` · trang ${plant.source_page}/70`:''}. Nội dung phục vụ học tập, không thay thế tư vấn/chỉ định chuyên môn.</small></article>:<article className="seed-mystery"><span>?</span><div><b>Hạt giống bí ẩn</b><small>Tên, loài và thông tin dược liệu chỉ mở khi cây đạt mốc 72 giờ.</small></div></article>}
          <div className="garden-actions-v2">
            {plant.status==='growing'&&<><button className="secondary" disabled={busy||!plant.can_water} onClick={()=>void run('water')}><Droplets/>Tưới nước</button><button className="secondary" disabled={busy||!plant.can_fertilize} onClick={()=>void run('fertilize')}><span aria-hidden>🌱</span>Bón phân</button></>}
            {plant.status==='mature'&&<button disabled={busy||!plant.ready_for_harvest} onClick={()=>void run('harvest')}><ShoppingBasket/>Thu hoạch về kho</button>}
            {!active&&<button disabled={busy} onClick={()=>void run('plant')}><Sprout/>Gieo lượt mới</button>}
          </div>
        </>}
      </section>
      <section className="garden-inventory panel"><div className="row"><PackageOpen/><div><h3>Kho dược thảo</h3><p className="muted">Cây đã thu hoạch · dữ liệu học thuật theo nguồn, không phải hướng dẫn tự điều trị.</p></div></div>{inventory.length===0?<div className="empty-state compact"><ShoppingBasket/><p>Kho đang trống.</p></div>:<div className="herb-stock-list herb-stock-v2">{inventory.map(x=><article key={`${x.name}-${x.source_page}`}><div className="herb-stock-title"><div><b>{x.name}</b><small>{x.botanical_name}</small></div><strong>×{x.quantity}</strong></div><p><b>Họ:</b> {x.family}</p><p><b>Bộ phận dùng:</b> {x.used_part}</p><p>{x.traditional_actions}</p><small>{x.source_ref} · trang {x.source_page}/70</small></article>)}</div>}</section>
    </div>
  </section>;
}
