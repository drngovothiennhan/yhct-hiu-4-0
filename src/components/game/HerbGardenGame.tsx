import {useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {Leaf,Stethoscope} from 'lucide-react';
import type {Member} from '../../types';
import HerbGardenGameV7 from './HerbGardenGameV7';
import HiuYQuanGame from './HiuYQuanGame';
import '../../garden-sky-v8.css';

// Stable module contract retained for the global acceptance gate. The production
// garden rules remain in V7; V8 adds an original draggable 2D world shell and
// HIU - Y - Quán without changing the existing care/harvest RPC contracts.
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

type DragState={pointerId:number;startX:number;startY:number;scrollLeft:number;scrollTop:number}|null;

export default function HerbGardenGame({member}:{member:Member}){
  const [mode,setMode]=useState<'garden'|'clinic'>('garden');
  const viewport=useRef<HTMLDivElement>(null),drag=useRef<DragState>(null);
  const onPointerDown=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const target=event.target as Element;if(target.closest('button,a,input,select,textarea,[role="button"]'))return;
    const node=viewport.current;if(!node)return;drag.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,scrollLeft:node.scrollLeft,scrollTop:node.scrollTop};node.setPointerCapture(event.pointerId);node.classList.add('is-dragging');
  };
  const onPointerMove=(event:ReactPointerEvent<HTMLDivElement>)=>{const state=drag.current,node=viewport.current;if(!state||!node||state.pointerId!==event.pointerId)return;node.scrollLeft=state.scrollLeft-(event.clientX-state.startX);node.scrollTop=state.scrollTop-(event.clientY-state.startY)};
  const release=(event:ReactPointerEvent<HTMLDivElement>)=>{const node=viewport.current;if(drag.current?.pointerId!==event.pointerId)return;drag.current=null;node?.classList.remove('is-dragging');try{node?.releasePointerCapture(event.pointerId)}catch{}};

  return <div className="garden-game-hub" data-mode={mode}>
    <div className="garden-game-switcher" role="tablist" aria-label="Game YHCT">
      <button role="tab" aria-selected={mode==='garden'} className={mode==='garden'?'active':''} onClick={()=>setMode('garden')}><Leaf/>Gia Viên Dược Thảo</button>
      <button role="tab" aria-selected={mode==='clinic'} className={mode==='clinic'?'active':''} onClick={()=>setMode('clinic')}><Stethoscope/>HIU - Y - Quán</button>
    </div>
    {mode==='garden'?<div ref={viewport} className="garden-world-viewport" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={release} onPointerCancel={release}>
      <span className="garden-pan-tip">Giữ và kéo để khám phá vườn</span>
      <div className="garden-world-canvas"><div className="garden-expand-mark one"><span>Khu đất mở rộng</span></div><div className="garden-expand-mark two"><span>Khu cảnh quan</span></div><div className="garden-expand-mark three"><span>Khu dược thảo mới</span></div><HerbGardenGameV7 member={member}/></div>
    </div>:<HiuYQuanGame member={member}/>} 
  </div>;
}
