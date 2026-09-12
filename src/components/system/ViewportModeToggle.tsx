import {Monitor,Smartphone} from 'lucide-react';

export type ViewportMode='desktop'|'mobile';
export const VIEWPORT_MODE_KEY='yhct-viewport-mode-v1';
export const FORCE_DESKTOP_MOBILE_KEY='yhct-force-desktop-on-mobile-v1';
export const VIEWPORT_CONTRACT_KEY='yhct-viewport-contract-v4';
const LEGACY_KEY='yhct-mobile-ui-v2';
const DEVICE_VIEWPORT='width=device-width, initial-scale=1, viewport-fit=cover';
const DESKTOP_PHONE_CANVAS_WIDTH=1280;
const hasFinePointer=()=>typeof window!=='undefined'&&window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isWideDesktop=()=>typeof window!=='undefined'&&window.matchMedia('(min-width: 980px)').matches;
const isCompactScreen=()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 979px)').matches&&!hasFinePointer();
const isPhysicalPhoneLike=()=>{
  if(typeof window==='undefined'||hasFinePointer())return false;
  const sw=Math.max(1,Number(window.screen?.width||window.innerWidth||1));
  const sh=Math.max(1,Number(window.screen?.height||window.innerHeight||1));
  return Math.min(sw,sh)<980;
};
const desktopPhoneScale=()=>{
  const sw=Math.max(1,Number(window.screen?.width||window.innerWidth||1));
  const sh=Math.max(1,Number(window.screen?.height||window.innerHeight||1));
  const landscape=window.matchMedia('(orientation: landscape)').matches;
  const physicalWidth=landscape?Math.max(sw,sh):Math.min(sw,sh);
  return Math.max(.25,Math.min(1,physicalWidth/DESKTOP_PHONE_CANVAS_WIDTH));
};
const desktopPhoneViewport=()=>`width=${DESKTOP_PHONE_CANVAS_WIDTH}, initial-scale=${desktopPhoneScale().toFixed(4)}, viewport-fit=cover`;

function ensureViewportContract(){
  try{
    if(localStorage.getItem(VIEWPORT_CONTRACT_KEY)==='1')return;
    localStorage.removeItem(VIEWPORT_MODE_KEY);
    localStorage.removeItem(FORCE_DESKTOP_MOBILE_KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.setItem(VIEWPORT_CONTRACT_KEY,'1');
  }catch{}
}

export function readViewportMode():ViewportMode{
  ensureViewportContract();
  // A wide PC canvas must always boot in desktop mode. Mobile on PC is preview-only
  // and must never survive a reload/session boundary.
  if(isWideDesktop())return'desktop';
  try{
    const compact=isCompactScreen();
    const forceDesktop=localStorage.getItem(FORCE_DESKTOP_MOBILE_KEY)==='1';
    if(compact&&!forceDesktop)return'mobile';
    const saved=localStorage.getItem(VIEWPORT_MODE_KEY);
    if(saved==='desktop'||saved==='mobile')return saved;
    const legacy=localStorage.getItem(LEGACY_KEY);
    if(legacy==='pc')return'desktop';
    if(legacy==='social')return'mobile';
  }catch{}
  return isCompactScreen()?'mobile':'desktop';
}

export function rememberExplicitViewportMode(mode:ViewportMode){
  try{
    localStorage.setItem(VIEWPORT_CONTRACT_KEY,'1');
    // On a real PC, Mobile is a temporary visual preview only. Do not persist it.
    if(isWideDesktop()){
      localStorage.removeItem(FORCE_DESKTOP_MOBILE_KEY);
      localStorage.setItem(VIEWPORT_MODE_KEY,'desktop');
      localStorage.setItem(LEGACY_KEY,'pc');
      return;
    }
    if((isCompactScreen()||isPhysicalPhoneLike())&&mode==='desktop')localStorage.setItem(FORCE_DESKTOP_MOBILE_KEY,'1');
    else localStorage.removeItem(FORCE_DESKTOP_MOBILE_KEY);
    localStorage.setItem(VIEWPORT_MODE_KEY,mode);
    localStorage.setItem(LEGACY_KEY,mode==='desktop'?'pc':'social');
  }catch{}
}

export function applyViewportMode(mode:ViewportMode){
  const root=document.documentElement;
  let forceDesktop=false;
  try{forceDesktop=localStorage.getItem(FORCE_DESKTOP_MOBILE_KEY)==='1'}catch{}
  const desktopOnPhone=mode==='desktop'&&forceDesktop&&isPhysicalPhoneLike();
  root.dataset.viewportMode=mode;
  root.dataset.mobileUi=mode==='mobile'?'social':'pc';
  root.dataset.desktopOnPhone=desktopOnPhone?'true':'false';
  let viewport=document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if(!viewport){viewport=document.createElement('meta');viewport.name='viewport';document.head.appendChild(viewport)}
  viewport.content=desktopOnPhone?desktopPhoneViewport():DEVICE_VIEWPORT;
  try{
    localStorage.setItem(VIEWPORT_CONTRACT_KEY,'1');
    if(isWideDesktop()){
      // Keep the persisted contract desktop-safe even while showing a temporary
      // Mobile preview in the current React state.
      localStorage.removeItem(FORCE_DESKTOP_MOBILE_KEY);
      localStorage.setItem(VIEWPORT_MODE_KEY,'desktop');
      localStorage.setItem(LEGACY_KEY,'pc');
    }else{
      localStorage.setItem(VIEWPORT_MODE_KEY,mode);
      localStorage.setItem(LEGACY_KEY,mode==='desktop'?'pc':'social');
    }
  }catch{}
  window.requestAnimationFrame(()=>{
    window.scrollTo({left:0,top:0,behavior:'auto'});
    window.dispatchEvent(new Event('resize'));
  });
}

export default function ViewportModeToggle({mode,onChange,className=''}:{mode:ViewportMode;onChange:(mode:ViewportMode)=>void;className?:string}){
  const next:ViewportMode=mode==='mobile'?'desktop':'mobile';
  const label=next==='desktop'?'Xem bản Desktop đầy đủ':isWideDesktop()?'Xem thử bản Mobile':'Xem bản Mobile';
  const Icon=next==='desktop'?Monitor:Smartphone;
  return <button type="button" className={`viewport-mode-toggle ${className}`.trim()} onClick={()=>{rememberExplicitViewportMode(next);onChange(next)}} title={label} aria-label={label} data-current-mode={mode} data-target-mode={next}>
    <Icon aria-hidden="true"/><span>{label}</span>
  </button>;
}
