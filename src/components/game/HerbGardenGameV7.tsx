import {useEffect,useMemo,useState} from 'react';
import {CheckCircle2,ChevronDown,ChevronUp,Clock3,Coins,Droplets,Gift,Grid3X3,HeartHandshake,Leaf,LockKeyhole,MoveHorizontal,PackageOpen,RefreshCw,ShoppingBasket,Sparkles,Sprout} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';
import '../../herb-garden-v2.css';
import '../../garden-v6.css';
import '../../garden-rewards.css';

type PlantStatus='growing'|'mature'|'dead'|'harvested';
type Plot={slot_no:number;unlocked:boolean;initial_selected:boolean;harvest_count:number;initial_selection_complete:boolean;id?:string|null;planted_at?:string|null;matures_at?:string|null;expires_at?:string|null;status?:PlantStatus|null;water_count:number;fertilizer_count:number;required_water_count:number;required_fertilizer_count:number;last_watered_at?:string|null;last_fertilized_at?:string|null;next_water_at?:string|null;next_fertilizer_at?:string|null;can_water:boolean;can_fertilize:boolean;ready_for_harvest:boolean;missed_water_slots:number;missed_fertilizer_days:number;died_at?:string|null;death_reason?:string|null;name?:string|null;other_names?:string|null;botanical_name?:string|null;family?:string|null;used_part?:string|null;traditional_actions?:string|null;dosage?:string|null;caution?:string|null;source_ref?:string|null;source_page?:number|null;visual_variant?:number|null};
type Inventory={seed_key:string;name:string;botanical_name:string;quantity:number;updated_at:string};
type SeedInventory={seed_key:string;name:string;botanical_name:string;quantity:number;visual_variant?:number|null};
type RewardRow={slot_no:number;care_streak:number;best_care_streak:number;reward_credits:number;reward_seeds:number;wallet_balance:number;seed_total:number};
type GardenProfile={theme:string;decor:string[]};
type CareResult={ok?:boolean;applied?:boolean;watered?:boolean;fertilized?:boolean;message?:string;care_streak?:number;growth_index?:number;next_at?:string;reward?:{credits?:number;seeds?:number}};

const DAY=86400000;
const DECOR_LABEL:Record<string,string>={pond:'Ao sen',lantern:'Đèn lồng','stone-path':'Lối đá','bamboo-gate':'Cổng trúc','lotus-pot':'Chậu sen','herb-sign':'Bảng tên dược liệu'};
const sprite=`${import.meta.env.BASE_URL}garden-decor-sprite.svg`;
function DecorArt({name}:{name:string}){return <svg className="garden-decor-svg" role="img" aria-label={DECOR_LABEL[name]||name}><use href={`${sprite}#${name}`}/></svg>}
function remaining(iso:string|undefined|null,now:number){if(!iso)return'—';const ms=Math.max(0,Date.parse(iso)-now),days=Math.floor(ms/DAY),hours=Math.floor((ms%DAY)/3600000),minutes=Math.floor((ms%3600000)/60000);return days?`${days} ngày ${hours} giờ`:`${hours} giờ ${minutes} phút`}
function growth(plot:Plot,now:number){if(!plot.id)return 0;if(plot.status==='mature'||plot.status==='harvested'||plot.status==='dead')return 100;const start=Date.parse(plot.planted_at||''),end=Date.parse(plot.matures_at||'');if(!Number.isFinite(start)||!Number.isFinite(end))return 0;return Math.max(0,Math.min(100,Math.round((now-start)/Math.max(1,end-start)*100)))}
function growthDay(plot:Plot,now:number){const start=Date.parse(plot.planted_at||'');if(!Number.isFinite(start))return 1;return Math.max(1,Math.min(3,Math.floor(Math.max(0,now-start)/DAY)+1))}
function CareDots({count,total,current,label}:{count:number;total:number;current:number;label:string}){return <div className="garden-care-dots" aria-label={`${label}: ${count}/${total}`}>{Array.from({length:total},(_,i)=><i key={i} className={i<count?'done':i===current?'current':''} title={`${label} ${i+1}/${total}`}/>)}</div>}

export default function HerbGardenGame({member}:{member:Member}){
  const [plots,setPlots]=useState<Plot[]>([]);
  const [inventory,setInventory]=useState<Inventory[]>([]);
  const [seeds,setSeeds]=useState<SeedInventory[]>([]);
  const [rewards,setRewards]=useState<RewardRow[]>([]);
  const [wallet,setWallet]=useState(0);
  const [profile,setProfile]=useState<GardenProfile>({theme:'bamboo',decor:[]});
  const [initialChoice,setInitialChoice]=useState<number[]>([]);
  const [selectedSlot,setSelectedSlot]=useState(1);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [now,setNow]=useState(Date.now());
  const [plotDeckOpen,setPlotDeckOpen]=useState(true);

  const applyPlotRows=(rows:Plot[])=>{
    setPlots(rows);
    setSelectedSlot(current=>rows.find(x=>x.slot_no===current&&x.unlocked)?.slot_no||rows.find(x=>x.unlocked)?.slot_no||rows[0]?.slot_no||1);
  };
  const refreshPlotState=async()=>{const {data,error}=await supabase.rpc('herb_garden_state_v3');if(!error)applyPlotRows((Array.isArray(data)?data:[]) as Plot[])};
  const load=async(clearMessage=true)=>{
    setBusy(true);if(clearMessage)setMsg('');
    try{
      const [state,stock,personalization,seedStock,rewardState,walletState]=await Promise.all([
        supabase.rpc('herb_garden_state_v3'),supabase.rpc('herb_garden_inventory_v3'),supabase.rpc('herb_garden_visit_v2',{p_member_id:member.id}),supabase.rpc('herb_garden_seed_inventory_v1'),supabase.rpc('herb_garden_reward_status_v1'),supabase.rpc('herb_garden_wallet_v1')
      ]);
      for(const result of [state,stock,seedStock,rewardState,walletState])if(result.error)throw result.error;
      applyPlotRows((Array.isArray(state.data)?state.data:[]) as Plot[]);
      setInventory((Array.isArray(stock.data)?stock.data:[]) as Inventory[]);
      setSeeds((Array.isArray(seedStock.data)?seedStock.data:[]) as SeedInventory[]);
      setRewards((Array.isArray(rewardState.data)?rewardState.data:[]) as RewardRow[]);
      setWallet(Number(walletState.data||0));
      if(!personalization.error&&personalization.data){const own=personalization.data as {theme?:string;decor?:string[]};setProfile({theme:own.theme||'bamboo',decor:Array.isArray(own.decor)?own.decor:[]})}
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  useEffect(()=>{
    void load();
    const clock=window.setInterval(()=>setNow(Date.now()),30000);
    const sync=window.setInterval(()=>void refreshPlotState(),60000);
    const onProfile=(event:Event)=>{const detail=(event as CustomEvent<GardenProfile>).detail;if(detail?.theme&&Array.isArray(detail.decor))setProfile(detail)};
    window.addEventListener('yhct:garden-profile-updated',onProfile);
    return()=>{window.clearInterval(clock);window.clearInterval(sync);window.removeEventListener('yhct:garden-profile-updated',onProfile)};
  },[member.id]);

  const initialComplete=Boolean(plots[0]?.initial_selection_complete);
  const unlockedCount=plots.filter(x=>x.unlocked).length;
  const harvestedPlots=plots.filter(x=>x.unlocked&&x.harvest_count>0).length;
  const selected=plots.find(x=>x.slot_no===selectedSlot)||null;
  const activeCount=plots.filter(x=>x.id).length;
  const stockTotal=useMemo(()=>inventory.reduce((sum,x)=>sum+x.quantity,0),[inventory]);
  const seedTotal=useMemo(()=>seeds.reduce((sum,x)=>sum+x.quantity,0),[seeds]);
  const selectedReward=rewards.find(x=>x.slot_no===selectedSlot)||null;
  const selectedDay=selected?.id?growthDay(selected,now):1;
  const selectedStart=selected?.id?Date.parse(selected.planted_at||''):NaN;
  const currentWaterSlot=Number.isFinite(selectedStart)?Math.max(0,Math.min(11,Math.floor(Math.max(0,now-selectedStart)/21600000))):0;

  const toggleInitial=(slot:number)=>{if(initialComplete||busy)return;setInitialChoice(xs=>xs.includes(slot)?xs.filter(x=>x!==slot):xs.length<3?[...xs,slot]:xs)};
  const choosePlot=(plot:Plot)=>{if(!initialComplete){toggleInitial(plot.slot_no);return}if(plot.unlocked)setSelectedSlot(plot.slot_no)};
  const confirmInitial=async()=>{if(initialChoice.length!==3)return;setBusy(true);setMsg('');try{const chosen=[...initialChoice].sort((a,b)=>a-b);const {error}=await supabase.rpc('herb_garden_select_initial_plots_v3',{p_slots:initialChoice});if(error)throw error;setInitialChoice([]);await load(false);setMsg(`Đã mở 3 ô khởi đầu: ${chosen.join(', ')}. Túi giống khởi đầu đã sẵn sàng.`)}catch(e){setMsg((e as Error).message)}finally{setBusy(false)}};

  const run=async(kind:'plant'|'water'|'fertilize'|'harvest',slot:number)=>{
    setBusy(true);setMsg('');
    try{
      const rpc={plant:'herb_garden_plant_v3',water:'herb_garden_water_v4',fertilize:'herb_garden_fertilize_v4',harvest:'herb_garden_harvest_v3'}[kind];
      const {data,error}=await supabase.rpc(rpc,{p_slot_no:slot});
      if(error)throw error;
      await load(false);
      if(kind==='plant')setMsg(`Đã gieo 1 hạt tại ô ${slot}. Lịch chăm 72 giờ đã bắt đầu.`);
      if(kind==='water'){
        const result=(data||{}) as CareResult;
        setMsg(result.applied===false?(result.message||`Lượt tưới hiện tại của ô ${slot} đã hoàn tất.`):`Đã tưới ô ${slot}. Đây là lần chăm chung của lượt 6 giờ hiện tại.`);
      }
      if(kind==='fertilize'){
        const result=(data||{}) as CareResult;
        setMsg(result.applied===false?(result.message||`Ngày sinh trưởng hiện tại của ô ${slot} đã được bón phân.`):`Đã bón phân ô ${slot}. Đây là lần bón chung của ngày sinh trưởng hiện tại.`);
      }
      if(kind==='harvest'){
        const r=(data||{}) as {name?:string;unlocked_slot?:number|null;credits_reward?:number;seed_reward?:number};
        setMsg(`Thu hoạch ô ${slot}${r.name?`: ${r.name}`:''}. +${r.credits_reward||3} tín dụng, +${r.seed_reward||1} hạt cùng loài.${r.unlocked_slot?` Đã mở khóa ô ${r.unlocked_slot}.`:''}`);
      }
    }catch(e){setMsg((e as Error).message)}finally{setBusy(false)}
  };

  return <section className="herb-garden-page herb-garden-v3 garden-pro-v7">
    <header className="garden-hero garden-pro-hero">
      <div>
        <span className="garden-kicker"><Sparkles/> Gia Viên Dược Thảo · học mà chơi</span>
        <h2>Chăm cây theo một luật duy nhất</h2>
        <p>Chu kỳ 72 giờ tính từ lúc gieo: tưới 1 lần mỗi lượt 6 giờ và bón 1 lần mỗi ngày sinh trưởng. Chủ vườn và bạn bè dùng chung đúng lượt chăm, không cộng trùng.</p>
        <div className="garden-rule-chips"><span><Droplets/>12 lượt tưới</span><span><Leaf/>3 ngày bón phân</span><span><HeartHandshake/>Chăm chung cùng tiến độ</span></div>
      </div>
      <button className="secondary garden-refresh" disabled={busy} onClick={()=>void load()}><RefreshCw/>Làm mới</button>
    </header>

    <div className="garden-pro-hud" aria-label="Tổng quan Gia Viên">
      <article><Grid3X3/><span><small>Ô đã mở</small><b>{unlockedCount}/9</b></span></article>
      <article><Sprout/><span><small>Cây đang hoạt động</small><b>{activeCount}</b></span></article>
      <article><Gift/><span><small>Hạt giống</small><b>×{seedTotal}</b></span></article>
      <article><Coins/><span><small>Tín dụng</small><b>{wallet}</b></span></article>
      <article><PackageOpen/><span><small>Dược liệu</small><b>×{stockTotal}</b></span></article>
    </div>

    {msg&&<div className="ai-note garden-pro-message" role="status" aria-live="polite">{msg}</div>}

    <div className="garden-v3-layout garden-pro-layout">
      <section className={`garden-board-v3 garden-pro-board garden-scene-theme-${profile.theme}`} aria-label="Gia Viên 9 ô">
        <div className="garden-board-decor-art" aria-label="Trang trí vườn">{profile.decor.map(x=><DecorArt key={x} name={x}/>)}</div>
        <div className="garden-board-heading"><div><b>Khu vườn 3×3</b><small>{initialComplete?`${harvestedPlots} ô đã từng thu hoạch`:'Chọn 3 ô để bắt đầu'}</small></div><div className="garden-board-heading-actions"><span>72h</span><button type="button" className="garden-plot-toggle" aria-expanded={plotDeckOpen} aria-controls="garden-plot-deck" onClick={()=>setPlotDeckOpen(open=>!open)}>{plotDeckOpen?<ChevronUp/>:<ChevronDown/>}<b>{plotDeckOpen?'Thu gọn':'Mở 9 ô'}</b></button></div></div>
        {!initialComplete&&<div className="garden-v3-initial-note"><b>Chọn 3 ô khởi đầu</b><p>Chạm đúng 3 ô bất kỳ. Sau khi thu hoạch toàn bộ các ô đang mở, hệ thống tự mở thêm ô mới.</p><div className="garden-v3-initial-actions"><span>{initialChoice.length}/3 ô đã chọn</span><button disabled={busy||initialChoice.length!==3} onClick={()=>void confirmInitial()}><CheckCircle2/>Xác nhận</button></div></div>}
        <div id="garden-plot-deck" className={`garden-plot-viewport ${plotDeckOpen?'is-open':'is-collapsed'}`} aria-hidden={!plotDeckOpen}>
          <div className="garden-plot-scroll-hint"><MoveHorizontal/>Vuốt/kéo riêng khối 9 ô</div>
          <div className="garden-nine-grid">{plots.map(plot=>{const progress=growth(plot,now),chosen=initialChoice.includes(plot.slot_no);return <button type="button" key={plot.slot_no} onClick={()=>choosePlot(plot)} disabled={busy||initialComplete&&!plot.unlocked} className={`garden-cell ${!plot.unlocked?'is-locked':''} ${selectedSlot===plot.slot_no&&initialComplete?'is-selected':''} ${chosen?'is-initial-choice':''} ${plot.status?`stage-${plot.status}`:''}`} aria-label={`Ô ${plot.slot_no}${plot.id?`, tiến độ ${progress}%`:plot.unlocked?', ô trống':', đang khóa'}`}><span className="garden-cell-top"><i className="garden-cell-index">{plot.slot_no}</i>{plot.id&&<i className="garden-cell-status">{plot.status==='mature'?'Thu hoạch':`${progress}%`}</i>}</span><span className="garden-cell-soil"/>{plot.id?<span className="garden-cell-plant"><i/><i/><i/></span>:plot.unlocked?<span className="garden-cell-empty"><Sprout/><small>Ô trống</small></span>:<span className="garden-lock"><LockKeyhole/><small>{!initialComplete?'Chọn ô':'Chưa mở'}</small></span>}{plot.harvest_count>0&&<span className="garden-harvest-badge">×{plot.harvest_count}</span>}</button>})}</div>
        </div>
      </section>

      <aside className="panel garden-v3-detail garden-pro-inspector">
        {!initialComplete?<>
          <div className="garden-v3-detail-head"><div><span className="badge">Bước 1/1</span><h3>Quy hoạch vườn đầu tiên</h3></div><Grid3X3/></div>
          <p>Chọn ba ô, xác nhận và bắt đầu gieo hạt. Mọi mốc chăm sau đó đều do máy chủ tính từ thời điểm gieo.</p>
        </>:selected&&!selected.unlocked?<><LockKeyhole/><h3>Ô {selected.slot_no} đang khóa</h3></>:selected&&!selected.id?<>
          <div className="garden-v3-detail-head"><div><span className="badge">Ô {selected.slot_no}</span><h3>Đất đang sẵn sàng</h3></div><Sprout/></div>
          <p>Gieo một hạt để khởi động chu kỳ 72 giờ. Hệ thống tự chọn giống đang có trong Túi giống.</p>
          <button disabled={busy||seedTotal<1} onClick={()=>void run('plant',selected.slot_no)}><Leaf/>{seedTotal>0?'Gieo 1 hạt':'Túi giống đã hết'}</button>
        </>:selected?<>
          <div className="garden-v3-detail-head"><div><span className="badge">Ô {selected.slot_no} · ngày {selectedDay}/3</span><h3>{selected.name||'Cây thuốc bí ẩn'}</h3></div><Sprout/></div>

          <div className="garden-progress garden-pro-growth">
            <div className="between"><b>{selected.status==='mature'?'Đã trưởng thành':'Tiến độ sinh trưởng'}</b><span>{growth(selected,now)}%</span></div>
            <div className="progress-track"><i style={{width:`${growth(selected,now)}%`}}/></div>
            <small>{selected.status==='growing'?`Còn ${remaining(selected.matures_at,now)} đến mốc 72 giờ`:selected.status==='mature'?`Cửa sổ thu hoạch còn ${remaining(selected.expires_at,now)}`:'Chu kỳ đã kết thúc'}</small>
          </div>

          <section className="garden-care-protocol" aria-label="Lịch chăm 72 giờ">
            <div className="garden-care-title"><div><Clock3/><span><b>Lịch chăm 72 giờ</b><small>Một lượt chỉ ghi nhận một lần, dù chủ vườn hay bạn bè thực hiện.</small></span></div></div>
            <article>
              <div className="garden-care-row"><span><Droplets/><b>Tưới</b></span><strong>{selected.water_count}/{selected.required_water_count}</strong></div>
              <CareDots count={selected.water_count} total={12} current={currentWaterSlot} label="Tưới"/>
              <small>{selected.can_water?'Có thể tưới ngay trong lượt 6 giờ này':selected.status==='growing'?`Lượt kế tiếp sau ${remaining(selected.next_water_at,now)}`:'Đã đóng chu kỳ tưới'}</small>
            </article>
            <article>
              <div className="garden-care-row"><span><Leaf/><b>Bón phân</b></span><strong>{selected.fertilizer_count}/{selected.required_fertilizer_count}</strong></div>
              <CareDots count={selected.fertilizer_count} total={3} current={Math.max(0,selectedDay-1)} label="Bón phân"/>
              <small>{selected.can_fertilize?`Ngày ${selectedDay}/3 đang mở lượt bón`:selected.status==='growing'?`Lượt bón tiếp theo sau ${remaining(selected.next_fertilizer_at,now)}`:'Đã đóng chu kỳ bón'}</small>
            </article>
          </section>

          {selectedReward&&<div className="garden-streak-card garden-pro-streak"><span><Sparkles/><b>Chuỗi chăm: {selectedReward.care_streak}</b></span><small>Kỷ lục {selectedReward.best_care_streak} · thưởng đã nhận {selectedReward.reward_credits} tín dụng + {selectedReward.reward_seeds} hạt.</small></div>}

          <div className="garden-v3-actions garden-pro-actions">
            {selected.status==='growing'&&<>
              <button className="secondary" disabled={busy||!selected.can_water} onClick={()=>void run('water',selected.slot_no)}><Droplets/>{selected.can_water?'Tưới lượt này':`Tưới sau ${remaining(selected.next_water_at,now)}`}</button>
              <button className="secondary" disabled={busy||!selected.can_fertilize} onClick={()=>void run('fertilize',selected.slot_no)}><Leaf/>{selected.can_fertilize?'Bón phân ngày này':`Bón lại sau ${remaining(selected.next_fertilizer_at,now)}`}</button>
            </>}
            {selected.status==='mature'&&<button disabled={busy||!selected.ready_for_harvest} onClick={()=>void run('harvest',selected.slot_no)}><ShoppingBasket/>Thu hoạch · +3 tín dụng · +1 hạt</button>}
          </div>

          {selected.name&&<details className="garden-herb-details"><summary>Kiến thức dược liệu</summary><article className="garden-v3-herb"><h3>{selected.name}</h3>{selected.botanical_name&&<i>{selected.botanical_name}</i>}<p><b>Họ:</b> {selected.family||'—'}</p><p><b>Bộ phận dùng:</b> {selected.used_part||'—'}</p><p><b>Công năng, chủ trị:</b> {selected.traditional_actions||'—'}</p><p><b>Liều lượng, cách dùng:</b> {selected.dosage?.trim()||'Trang nguồn không nêu liều lượng/cách dùng.'}</p><p><b>Kiêng kỵ/lưu ý:</b> {selected.caution?.trim()||'Trang nguồn không nêu lưu ý riêng.'}</p><small>Nguồn: {selected.source_ref||'Danh mục game'}{selected.source_page?` · trang ${selected.source_page}/70`:''}. Nội dung học tập, không thay thế chỉ định chuyên môn.</small></article></details>}
        </>:<p className="muted">Đang tải trạng thái vườn…</p>}
      </aside>
    </div>

    <section className="garden-pro-guide panel"><div><HeartHandshake/><span><b>Cách chơi đã đồng bộ</b><small>Tự chăm và “Giúp chăm” đều tiêu thụ cùng một lượt. Nếu bạn bè đã bón phân trong ngày sinh trưởng hiện tại, chủ vườn không cần và không thể bón lại.</small></span></div><div><Gift/><span><b>Thưởng không cộng trùng</b><small>Mỗi lượt chăm hợp lệ chỉ tăng tiến độ và chuỗi thưởng một lần trên máy chủ.</small></span></div></section>

    <section className="panel garden-pro-storage"><div className="row"><Gift/><div><h3>Túi giống</h3><p className="muted">Mỗi lần gieo tiêu thụ 1 hạt.</p></div></div><div className="garden-seed-inventory">{seeds.map(x=><article key={x.seed_key}><span><b>{x.name}</b><small>{x.botanical_name}</small></span><strong>×{x.quantity}</strong></article>)}{!seeds.length&&<p className="muted">Túi giống đang trống. Tiếp tục chăm cây để nhận thưởng.</p>}</div></section>
    <section className="panel garden-pro-storage"><div className="row"><PackageOpen/><div><h3>Kho dược thảo</h3><p className="muted">Dược liệu đã thu hoạch; phục vụ học tập, không phải hướng dẫn tự điều trị.</p></div></div><div className="garden-v3-inventory">{inventory.map(x=><article key={x.seed_key}><span><b>{x.name}</b><small>{x.botanical_name}</small></span><strong>×{x.quantity}</strong></article>)}{!inventory.length&&<p className="muted">Kho đang trống.</p>}</div></section>
  </section>;
}
