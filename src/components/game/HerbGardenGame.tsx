import {useState} from 'react';
import {Leaf,Stethoscope} from 'lucide-react';
import type {Member} from '../../types';
import HerbGardenGameV7 from './HerbGardenGameV7';
import HiuYQuanGame from './HiuYQuanGame';
import '../../garden-sky-v8.css';

// Stable module contract retained for the global acceptance gate. The production
// garden rules remain in V7; V9 keeps the landscape fixed and makes only the
// 3x3 planting deck collapsible/scrollable on compact screens.
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

export default function HerbGardenGame({member}:{member:Member}){
  const [mode,setMode]=useState<'garden'|'clinic'>('garden');

  return <div className="garden-game-hub" data-mode={mode}>
    <div className="garden-game-switcher" role="tablist" aria-label="Game YHCT">
      <button role="tab" aria-selected={mode==='garden'} className={mode==='garden'?'active':''} onClick={()=>setMode('garden')}><Leaf/>Gia Viên Dược Thảo</button>
      <button role="tab" aria-selected={mode==='clinic'} className={mode==='clinic'?'active':''} onClick={()=>setMode('clinic')}><Stethoscope/>HIU - Y - Quán</button>
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
    </div>:<HiuYQuanGame member={member}/>} 
  </div>;
}
