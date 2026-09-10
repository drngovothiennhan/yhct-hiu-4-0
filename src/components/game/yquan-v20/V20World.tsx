import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {HeartPulse,LibraryBig,Stethoscope,X} from 'lucide-react';
import {DoctorSprite,PatientSprite} from './ActorSprites';
import {gameEventBus} from './GameEventBus';
import {legacyRuleAdapter} from './LegacyRuleAdapter';
import {SCENE_LABEL} from './sceneGraph';
import type {DoctorGender,DoctorOutfit,HerbVisual,PlayerVisualState,SceneId,VisualCase} from './types';
import {YQuanStoryController,type StoryViewState} from './YQuanStoryController';

const initialStory:StoryViewState={stage:'RESTING',cameraHint:'clinic',doctorState:'RESTING',patientState:'SPAWNING',doctorAnimation:'idle',patientAnimation:'idle',caseKey:null,bedAssignment:null,statusText:'Thầy thuốc đang trực tại Y Quán'};
const fallbackHerbs=['Nhân trần','Diệp hạ châu','Đinh lăng','Phèn đen','Sài hồ','Hạ khô thảo','Mã đề','Xuyên tâm liên','Cà gai leo','Cam thảo','Bạch truật','Đương quy'];

function ClinicBackdrop(){
  const drawers=Array.from({length:30},(_,i)=>i);
  return <svg className="hyq-v20-backdrop" viewBox="0 0 1600 900" aria-hidden="true">
    <rect width="1600" height="900" fill="#efe2c6"/><rect y="0" width="1600" height="150" fill="#d5b47c"/>
    <path d="M0 150h1600v470H0z" fill="#ead7b7"/><path d="M0 620h1600v280H0z" fill="#8b5d3e"/>
    {Array.from({length:16},(_,i)=><path key={i} d={`M${i*110} 620l220 280M${i*110-160} 900l220-280`} stroke="#744a32" strokeWidth="5" opacity=".35"/>)}
    <rect x="75" y="105" width="520" height="500" rx="18" fill="#6f482f" stroke="#4f3025" strokeWidth="16"/>
    <rect x="103" y="145" width="464" height="425" fill="#93603c"/>
    {drawers.map(i=>{const col=i%6,row=Math.floor(i/6),x=118+col*73,y=162+row*78;return <g key={i}><rect x={x} y={y} width="62" height="65" rx="6" fill="#a76d43" stroke="#5c3828" strokeWidth="4"/><rect x={x+22} y={y+32} width="18" height="7" rx="4" fill="#d4a35e"/></g>})}
    <rect x="650" y="125" width="330" height="320" rx="12" fill="#7e553c" stroke="#503323" strokeWidth="14"/><rect x="685" y="158" width="260" height="240" fill="#dce9de"/>
    <path d="M815 158v240M685 278h260" stroke="#6e8b78" strokeWidth="10"/><path d="M690 402h250" stroke="#d09a56" strokeWidth="18"/>
    <g><rect x="590" y="515" width="590" height="115" rx="24" fill="#74472f" stroke="#4c2d24" strokeWidth="12"/><rect x="640" y="472" width="495" height="83" rx="18" fill="#a96f48" stroke="#5e3828" strokeWidth="10"/><ellipse cx="810" cy="485" rx="58" ry="15" fill="#d7b57f"/><rect x="745" y="458" width="130" height="20" rx="8" fill="#e9d7ae"/><path d="M1040 487q23-42 48 0v39h-48z" fill="#b65f49" stroke="#603528" strokeWidth="7"/><path d="M1088 493q30-18 38 8-8 25-38 16" fill="none" stroke="#603528" strokeWidth="7"/></g>
    <g transform="translate(1220 108)"><rect width="300" height="470" rx="14" fill="#81583d" stroke="#543424" strokeWidth="12"/><rect x="35" y="38" width="230" height="340" fill="#f2e4c9"/><path d="M150 38v340M35 150h230M35 265h230" stroke="#9b7551" strokeWidth="8"/><rect x="32" y="392" width="236" height="45" rx="10" fill="#6a4430"/></g>
    <g transform="translate(1185 625)"><rect x="0" y="34" width="76" height="105" rx="12" fill="#8e5937"/><ellipse cx="38" cy="35" rx="40" ry="13" fill="#b57a4b"/><ellipse cx="38" cy="1" rx="25" ry="9" fill="#dcb77a"/></g>
    <g transform="translate(470 420)"><rect x="0" y="0" width="85" height="125" rx="8" fill="#744931"/><path d="M11 12h63v86H11z" fill="#e7d7b7"/><path d="M18 25h48M18 42h48M18 59h34" stroke="#8b5b3b" strokeWidth="4"/></g>
    <g transform="translate(1330 590)"><path d="M70 118h-42l8-94h26z" fill="#b97854"/><path d="M49 34q-66-50-78 6 51 13 78 13M50 45q68-55 84 3-52 16-84 14M45 30Q22-42-9-19q10 51 54 68" fill="#4e8559" stroke="#355f40" strokeWidth="6"/></g>
  </svg>;
}

function PharmacyBackdrop(){
  return <svg className="hyq-v20-backdrop" viewBox="0 0 1600 900" aria-hidden="true">
    <rect width="1600" height="900" fill="#e7d1a4"/><rect y="0" width="1600" height="145" fill="#b77e45"/>
    <path d="M0 145h1600v475H0z" fill="#d9c292"/><path d="M0 620h1600v280H0z" fill="#9a6943"/>
    {Array.from({length:15},(_,i)=><path key={i} d={`M${i*120} 620v280`} stroke="#805436" strokeWidth="5" opacity=".35"/>)}
    <path d="M0 148h1600M95 0v620M1505 0v620" stroke="#69432e" strokeWidth="22"/>
    <rect x="85" y="175" width="540" height="410" rx="18" fill="#70452f" stroke="#4f2f22" strokeWidth="16"/>
    <rect x="105" y="198" width="500" height="360" fill="#95623d"/>
    <g transform="translate(690 145)"><rect width="700" height="260" rx="18" fill="#805237" stroke="#523222" strokeWidth="14"/><path d="M25 75h650M25 170h650" stroke="#c39458" strokeWidth="12"/>{Array.from({length:10},(_,i)=><g key={i} transform={`translate(${45+i*62} ${i%2?90:185})`}><path d="M0 0q18-35 36 0v42H0z" fill="#d1b27a" stroke="#6c4a31" strokeWidth="5"/><path d="M8 10h20" stroke="#7d5b3b" strokeWidth="4"/></g>)}</g>
    <g transform="translate(620 485)"><rect x="0" y="65" width="760" height="100" rx="22" fill="#765038" stroke="#4d3025" strokeWidth="12"/><rect x="28" y="0" width="700" height="90" rx="18" fill="#b47a4e" stroke="#67402d" strokeWidth="10"/></g>
    <g transform="translate(728 470)"><path d="M0 60h95l-12 45H15z" fill="#b99a67" stroke="#594333" strokeWidth="7"/><path d="M47 60l48-85" stroke="#74543b" strokeWidth="12" strokeLinecap="round"/></g>
    <g transform="translate(895 455)"><path d="M45 30v65M0 95h90" stroke="#5b4634" strokeWidth="9"/><path d="M3 30h84" stroke="#5b4634" strokeWidth="8"/><path d="M14 35q8 35 30 0m12 0q8 35 30 0" fill="#d4b875" stroke="#6d553a" strokeWidth="6"/></g>
    <g transform="translate(1110 438)"><ellipse cx="85" cy="85" rx="67" ry="32" fill="#6e5647" stroke="#46352d" strokeWidth="8"/><path d="M36 77q5-75 99 0" fill="#8f7662" stroke="#46352d" strokeWidth="8"/><path d="M137 80h45q30 6 10 32h-46" fill="none" stroke="#46352d" strokeWidth="9"/><path d="M75 18q-14-44 8-56m26 56q15-43-4-61" fill="none" stroke="#efe5cf" strokeWidth="9" opacity=".7"/></g>
    <g transform="translate(1410 225)"><path d="M45 0v130" stroke="#65462f" strokeWidth="10"/><path d="M10 35q35 40 70 0M4 73q41 43 82 0M0 110q45 38 90 0" fill="none" stroke="#5d8650" strokeWidth="14" strokeLinecap="round"/></g>
    <g transform="translate(70 605)"><rect x="0" y="0" width="105" height="130" rx="10" fill="#6d4932"/><ellipse cx="52" cy="12" rx="53" ry="18" fill="#9d7047"/><path d="M15 30h74v75H15z" fill="#d2b077"/></g>
  </svg>;
}

function WardBackdrop(){
  return <svg className="hyq-v20-backdrop" viewBox="0 0 1600 900" aria-hidden="true">
    <rect width="1600" height="900" fill="#e8e0ca"/><rect y="0" width="1600" height="150" fill="#a8b7a5"/><rect y="150" width="1600" height="470" fill="#dce3d6"/><rect y="620" width="1600" height="280" fill="#9b744f"/>
    {Array.from({length:15},(_,i)=><path key={i} d={`M${i*120} 620v280`} stroke="#7d5b40" strokeWidth="5" opacity=".3"/>)}
    <g transform="translate(140 140)"><rect width="300" height="250" rx="15" fill="#6c5846"/><rect x="28" y="28" width="244" height="194" fill="#cbe0dc"/><path d="M150 28v194M28 125h244" stroke="#7c9b91" strokeWidth="10"/><path d="M0 248h300" stroke="#aa7c4f" strokeWidth="18"/></g>
    <g transform="translate(650 140)"><rect width="300" height="250" rx="15" fill="#6c5846"/><rect x="28" y="28" width="244" height="194" fill="#cbe0dc"/><path d="M150 28v194M28 125h244" stroke="#7c9b91" strokeWidth="10"/><path d="M0 248h300" stroke="#aa7c4f" strokeWidth="18"/></g>
    <g transform="translate(1160 140)"><rect width="300" height="250" rx="15" fill="#6c5846"/><rect x="28" y="28" width="244" height="194" fill="#cbe0dc"/><path d="M150 28v194M28 125h244" stroke="#7c9b91" strokeWidth="10"/></g>
    <g transform="translate(75 120)"><path d="M0 0v500" stroke="#6e5441" strokeWidth="16"/><rect x="-10" y="0" width="165" height="500" rx="10" fill="#7d5c44"/><rect x="14" y="30" width="115" height="420" fill="#e6d3b2"/><circle cx="105" cy="250" r="10" fill="#bc8b4b"/></g>
    <g transform="translate(1360 610)"><rect x="0" y="35" width="175" height="95" rx="13" fill="#795139" stroke="#4d3024" strokeWidth="9"/><rect x="18" y="0" width="140" height="55" rx="10" fill="#ab7950"/><path d="M25 15h126" stroke="#dbc39c" strokeWidth="5"/></g>
    <g transform="translate(1510 395)"><path d="M0 0v210" stroke="#6b4c35" strokeWidth="12"/><path d="M-85 0h85M-75 20v165m30-165v165" stroke="#7f9b8c" strokeWidth="8"/></g>
    <g transform="translate(50 545)"><path d="M0 70h140" stroke="#73513a" strokeWidth="11"/><path d="M15 70v90m110-90v90" stroke="#73513a" strokeWidth="10"/><ellipse cx="70" cy="58" rx="66" ry="19" fill="#c99d65"/></g>
  </svg>;
}

function MedicineDrawer({name,index,onClick}:{name:string;index:number;onClick:()=>void}){
  const clean=name.replace(/\s*\(.+\)$/,'').trim(),compact=clean.length>13?'very-compact':clean.length>9?'compact':'';
  return <button type="button" className={`hyq-v20-medicine-drawer ${compact}`} onClick={onClick} title={`Mở thẻ ${clean}`}><span className="drawer-label">{clean}</span><i className="drawer-handle"/><small>{String(index+1).padStart(2,'0')}</small></button>;
}

type BedState='EMPTY'|'RESERVED'|'OCCUPIED'|'TREATING'|'RECOVERING';
function bedState(item:VisualCase|null):BedState{
  if(!item)return'EMPTY';
  if(item.care_status==='recheck_due')return'RECOVERING';
  if(item.care_status==='observing')return'TREATING';
  return item.bed_slot?'OCCUPIED':'RESERVED';
}

function WardBed({slot,item,onClick}:{slot:1|2|3;item:VisualCase|null;onClick:()=>void}){
  const state=bedState(item);
  return <button type="button" className={`hyq-v20-bed hyq-v20-bed-${slot}`} data-bed-state={state} onClick={onClick} disabled={!item} aria-label={`BED_0${slot} ${state}`}>
    <span className="bed-headboard"/><span className="bed-mattress"/><span className="bed-pillow"/><span className="bed-blanket"/>
    {item&&<span className="bed-occupant"><span className="occupant-head"/><span className="occupant-hair"/></span>}
    <span className="bed-label"><b>Giường {slot}</b><small>{state==='EMPTY'?'Trống':state==='RECOVERING'?'Đến giờ tái khám':'Đang theo dõi'}</small></span>
  </button>;
}

function HerbPopover({herb,onClose}:{herb:HerbVisual;onClose:()=>void}){
  return <div className="hyq-v20-herb-popover" role="dialog" aria-modal="true"><button type="button" className="close" onClick={onClose} aria-label="Đóng"><X/></button><span>DƯỢC LIỆU HỌC TẬP</span><h4>{herb.name}</h4>{herb.latin_name&&<small>{herb.latin_name}</small>}<div><p><b>Tính vị:</b> {herb.nature_flavor||'Đang cập nhật'}</p><p><b>Quy kinh:</b> {herb.meridians||'Đang cập nhật'}</p><p><b>Công năng:</b> {herb.actions||'Đang cập nhật'}</p></div></div>;
}

export default function V20World(){
  const viewportRef=useRef<HTMLDivElement|null>(null),stageRef=useRef<HTMLDivElement|null>(null),doctorRef=useRef<HTMLDivElement|null>(null),patientRef=useRef<HTMLDivElement|null>(null);
  const controllerRef=useRef<YQuanStoryController|null>(null),syncBusy=useRef(false),manualFocusUntil=useRef(0),lastFrame=useRef(0);
  const [player,setPlayer]=useState<PlayerVisualState>({active:true,gender:'female',outfit:'classic'}),[cases,setCases]=useState<VisualCase[]>([]),[herbs,setHerbs]=useState<HerbVisual[]>([]),[story,setStory]=useState<StoryViewState>(initialStory),[focusScene,setFocusScene]=useState<SceneId>('clinic'),[selectedHerb,setSelectedHerb]=useState<HerbVisual|null>(null),[bedNotice,setBedNotice]=useState('');

  if(!controllerRef.current)controllerRef.current=new YQuanStoryController({storageKey:'hiu-y-quan-v20-story',onChange:setStory});
  const controller=controllerRef.current;

  const refresh=useCallback(async()=>{
    if(syncBusy.current||document.hidden)return;syncBusy.current=true;
    try{
      const [nextPlayer,nextCases,nextHerbs]=await Promise.all([legacyRuleAdapter.getPlayerState(),legacyRuleAdapter.getCases(),herbs.length?Promise.resolve(herbs):legacyRuleAdapter.getHerbs().catch(()=>[] as HerbVisual[])]);
      setPlayer(nextPlayer);setCases(nextCases);if(nextHerbs.length)setHerbs(nextHerbs);controller.sync(nextCases);
    }catch(error){console.warn('[HIU Y QUAN V20] visual sync failed',error)}finally{syncBusy.current=false}
  },[controller,herbs]);

  useEffect(()=>{void refresh();const interval=window.setInterval(()=>void refresh(),20000);const off=gameEventBus.on('SYNC_REQUESTED',()=>{window.setTimeout(()=>void refresh(),450);window.setTimeout(()=>void refresh(),1600)});const visible=()=>{if(!document.hidden)void refresh()};document.addEventListener('visibilitychange',visible);return()=>{window.clearInterval(interval);off();document.removeEventListener('visibilitychange',visible)}},[refresh]);

  useEffect(()=>{if(Date.now()>manualFocusUntil.current)setFocusScene(story.cameraHint)},[story.cameraHint,story.stage]);

  useEffect(()=>{
    const viewport=viewportRef.current,stage=stageRef.current;if(!viewport||!stage)return;
    const resize=()=>{const box=viewport.getBoundingClientRect(),scale=Math.min(box.width/1600,box.height/900);const x=(box.width-1600*scale)/2,y=(box.height-900*scale)/2;stage.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`};
    resize();const observer=new ResizeObserver(resize);observer.observe(viewport);return()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    let frame=0;
    const renderActor=(node:HTMLDivElement|null,actor:typeof controller.doctor|typeof controller.patient,isDoctor:boolean)=>{
      if(!node)return;const snapshot=actor.snapshot();
      node.style.display=snapshot.visible&&snapshot.scene===focusScene?'block':'none';node.style.transform=`translate3d(${snapshot.position.x-(isDoctor?105:95)}px,${snapshot.position.y-(isDoctor?286:266)}px,0)`;node.style.zIndex=String(100+Math.round(snapshot.position.y));
      if(node.dataset.animation!==snapshot.animation)node.dataset.animation=snapshot.animation;if(node.dataset.direction!==snapshot.direction)node.dataset.direction=snapshot.direction;node.dataset.state=String(snapshot.state);node.dataset.scene=snapshot.scene;node.dataset.frame=String(actor.animation.frame);
    };
    const tick=(time:number)=>{const delta=lastFrame.current?time-lastFrame.current:16;lastFrame.current=time;controller.update(delta);renderActor(doctorRef.current,controller.doctor,true);renderActor(patientRef.current,controller.patient,false);frame=requestAnimationFrame(tick)};
    frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);lastFrame.current=0;controller.dispose()};
  },[controller,focusScene]);

  const chooseScene=(scene:SceneId)=>{manualFocusUntil.current=Date.now()+9000;setFocusScene(scene)};
  const visibleHerbs=useMemo(()=>herbs.length?herbs.slice(0,12):fallbackHerbs.map((name,index)=>({herb_key:`fallback-${index}`,name})),[herbs]);
  const wardCases=cases.filter(item=>item.care_status==='observing'||item.care_status==='recheck_due');
  const bed=(slot:1|2|3)=>wardCases.find(item=>Number(item.bed_slot)===slot)||null;
  const gender:DoctorGender=player.gender==='male'?'male':'female',outfit:DoctorOutfit=player.outfit==='academy'||player.outfit==='master'?player.outfit:'classic';

  return <section className="hyq-v20-shell" aria-label="HIU Y Quán V20 game engine">
    <header className="hyq-v20-toolbar"><div className="hyq-v20-live"><i/><span><b>{story.statusText}</b><small>{SCENE_LABEL[story.cameraHint]} · {story.doctorState.replaceAll('_',' ')}</small></span></div><nav aria-label="Chọn bối cảnh V20"><button type="button" className={focusScene==='clinic'?'active':''} onClick={()=>chooseScene('clinic')}><Stethoscope/><span>Chẩn Mạch</span></button><button type="button" className={focusScene==='pharmacy'?'active':''} onClick={()=>chooseScene('pharmacy')}><LibraryBig/><span>Chế Dược</span></button><button type="button" className={focusScene==='ward'?'active':''} onClick={()=>chooseScene('ward')}><HeartPulse/><span>Dưỡng Trị</span></button></nav></header>
    <div className="hyq-v20-world-viewport" ref={viewportRef}>
      <div className="hyq-v20-stage" ref={stageRef} data-focus-scene={focusScene}>
        <section className="hyq-v20-scene hyq-v20-scene-clinic" aria-label="ClinicScene" hidden={focusScene!=='clinic'}><ClinicBackdrop/><div className="hyq-v20-scene-title"><b>PHÒNG CHẨN MẠCH</b><small>Vọng · Văn · Vấn · Thiết</small></div><span className="hyq-v20-interaction pulse-desk" title="pulseDeskDoctorPoint"/><span className="hyq-v20-interaction waiting-point" title="patientWaitingPoint"/></section>
        <section className="hyq-v20-scene hyq-v20-scene-pharmacy" aria-label="PharmacyScene" hidden={focusScene!=='pharmacy'}><PharmacyBackdrop/><div className="hyq-v20-scene-title"><b>PHÒNG CHẾ DƯỢC</b><small>Chọn · cân · nghiền · sắc · đóng gói</small></div><div className="hyq-v20-drawer-wall">{visibleHerbs.map((herb,index)=><MedicineDrawer key={herb.herb_key} name={herb.name} index={index} onClick={()=>setSelectedHerb(herb)}/>)}</div><span className="hyq-v20-tool-label scale">CÂN THUỐC</span><span className="hyq-v20-tool-label mortar">CỐI NGHIỀN</span><span className="hyq-v20-tool-label pot">NỒI SẮC</span><span className="hyq-v20-tool-label package">ĐÓNG GÓI</span></section>
        <section className="hyq-v20-scene hyq-v20-scene-ward" aria-label="WardScene" hidden={focusScene!=='ward'}><WardBackdrop/><div className="hyq-v20-scene-title"><b>PHÒNG DƯỠNG TRỊ</b><small>Đúng 3 giường · theo dõi và tái khám</small></div><WardBed slot={1} item={bed(1)} onClick={()=>setBedNotice(bed(1)?`Giường 1 · ${bedState(bed(1))}`:'')}/><WardBed slot={2} item={bed(2)} onClick={()=>setBedNotice(bed(2)?`Giường 2 · ${bedState(bed(2))}`:'')}/><WardBed slot={3} item={bed(3)} onClick={()=>setBedNotice(bed(3)?`Giường 3 · ${bedState(bed(3))}`:'')}/>{bedNotice&&<div className="hyq-v20-bed-notice">{bedNotice}</div>}</section>
        <div ref={doctorRef} className="hyq-v20-actor hyq-v20-actor-doctor" data-animation="idle" data-direction="front"><DoctorSprite gender={gender} outfit={outfit}/><span className="hyq-v20-nameplate">{player.display_name||'Thầy thuốc HIU'}</span></div>
        <div ref={patientRef} className="hyq-v20-actor hyq-v20-actor-patient" data-animation="idle" data-direction="front"><PatientSprite gender={(controller.currentCase?.patient_gender||cases[0]?.patient_gender||'female') as DoctorGender} age={controller.currentCase?.patient_age||cases[0]?.patient_age||45} variant={controller.currentCase?.patient_variant||cases[0]?.patient_variant||1}/></div>
      </div>
    </div>
    <footer className="hyq-v20-engine-strip"><span><i className="state-dot"/>CHARACTER ACTOR</span><span>{story.stage.replaceAll('_',' ')}</span><span>{wardCases.length}/3 GIƯỜNG</span></footer>
    {selectedHerb&&<HerbPopover herb={selectedHerb} onClose={()=>setSelectedHerb(null)}/>} 
  </section>;
}
