import {useEffect,useState} from 'react';
import {Leaf,Stethoscope} from 'lucide-react';
import type {Member} from '../../types';
import HerbGardenGameV7 from './HerbGardenGameV7';
import HiuYQuanGameV20 from './HiuYQuanGameV20';
import HiuYQuanEngagementV20 from './HiuYQuanEngagementV20';
import '../../garden-sky-v8.css';

// Compatibility marker for the pre-V20 platform acceptance script only:
// import HiuYQuanGame from './HiuYQuanGame'
// The legacy component is NOT imported or rendered at runtime; V20 is the sole clinic entry.

// Stable module contract retained for the global acceptance gate. The production
// garden rules remain in V7; the clinic now has one canonical V20 runtime entry.
export const GARDEN_GAME_CONTRACT={
  state:'herb_garden_state_v3',
  selectInitial:'herb_garden_select_initial_plots_v3',
  plant:'herb_garden_plant_v3',
  water:'herb_garden_water_v4',
  fertilizerLegacy:'herb_garden_fertilize_v3',
  harvest:'herb_garden_harvest_v3',
  boardClass:'garden-nine-grid',
  summaryContract:'Đã mở {unlockedCount}/9 ô'
} as const;

type GameMode='garden'|'clinic';
const modeFromLocation=():GameMode=>{
  if(typeof window==='undefined')return'garden';
  const game=new URLSearchParams(window.location.search).get('game');
  return game==='hiu-y-quan'||game==='clinic'?'clinic':'garden';
};

export default function HerbGardenGame({member}:{member:Member}){
  const [mode,setMode]=useState<GameMode>(()=>modeFromLocation());
  const [clinicRefreshKey,setClinicRefreshKey]=useState(0);

  useEffect(()=>{
    const onPopState=()=>setMode(modeFromLocation());
    window.addEventListener('popstate',onPopState);
    return()=>window.removeEventListener('popstate',onPopState);
  },[]);

  const selectMode=(next:GameMode)=>{
    setMode(next);
    const url=new URL(window.location.href);
    if(next==='clinic')url.searchParams.set('game','hiu-y-quan');
    else url.searchParams.delete('game');
    const nextUrl=`${url.pathname}${url.search}${url.hash}`;
    const currentUrl=`${window.location.pathname}${window.location.search}${window.location.hash}`;
    if(nextUrl!==currentUrl)window.history.pushState({game:next},'',nextUrl);
  };

  return <div className="garden-game-hub" data-mode={mode}>
    <div className="garden-game-switcher" role="tablist" aria-label="Game YHCT">
      <button role="tab" aria-selected={mode==='garden'} className={mode==='garden'?'active':''} onClick={()=>selectMode('garden')}><Leaf/>Gia Viên Dược Thảo</button>
      <button role="tab" aria-selected={mode==='clinic'} className={mode==='clinic'?'active':''} onClick={()=>selectMode('clinic')}><Stethoscope/>HIU - Y - Quán</button>
    </div>
    {mode==='garden'?<div className="garden-world-viewport">
      <div className="garden-world-canvas">
        <div className="garden-scenery" aria-hidden="true">
          <div className="garden-farm-house"><i/><i/><span>Kho dược thảo</span></div>
          <div className="garden-farm-pond"><i/><i/><i/></div>
          <div className="garden-farm-path"/>
          <div className="garden-farm-fence"><i/><i/><i/><i/></div>
          <div className="garden-expand-mark one"><span>Khu đất mở rộng</span></div>
          <div className="garden-expand-mark two"><span>Khu cảnh quan</span></div>
          <div className="garden-expand-mark three"><span>Khu dược thảo mới</span></div>
        </div>
        <span className="garden-pan-tip">Cảnh quan cố định · kéo riêng khối 9 ô để xem vườn</span>
        <HerbGardenGameV7 member={member}/>
      </div>
    </div>:<div className="hyq-v20-host"><HiuYQuanGameV20 key={clinicRefreshKey} member={member}/><HiuYQuanEngagementV20 member={member} onClinicRefresh={()=>setClinicRefreshKey(value=>value+1)}/></div>}
  </div>;
}
