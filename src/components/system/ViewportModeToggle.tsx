import {Monitor,Smartphone} from 'lucide-react';

export type ViewportMode='desktop'|'mobile';
export const VIEWPORT_MODE_KEY='yhct-viewport-mode-v1';
export const FORCE_DESKTOP_MOBILE_KEY='yhct-force-desktop-on-mobile-v1';
const LEGACY_KEY='yhct-mobile-ui-v2';
const MOBILE_VIEWPORT='width=device-width, initial-scale=1, viewport-fit=cover';
const DESKTOP_VIEWPORT='width=1280, viewport-fit=cover';
const isCompactScreen=()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 980px)').matches;

export function readViewportMode():ViewportMode{
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
    if(isCompactScreen()&&mode==='desktop')localStorage.setItem(FORCE_DESKTOP_MOBILE_KEY,'1');
    else localStorage.removeItem(FORCE_DESKTOP_MOBILE_KEY);
    localStorage.setItem(VIEWPORT_MODE_KEY,mode);
    localStorage.setItem(LEGACY_KEY,mode==='desktop'?'pc':'social');
  }catch{}
}

export function applyViewportMode(mode:ViewportMode){
  const root=document.documentElement;
  root.dataset.viewportMode=mode;
  root.dataset.mobileUi=mode==='mobile'?'social':'pc';
  let viewport=document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if(!viewport){viewport=document.createElement('meta');viewport.name='viewport';document.head.appendChild(viewport)}
  viewport.content=mode==='desktop'?DESKTOP_VIEWPORT:MOBILE_VIEWPORT;
  try{
    localStorage.setItem(VIEWPORT_MODE_KEY,mode);
    localStorage.setItem(LEGACY_KEY,mode==='desktop'?'pc':'social');
  }catch{}
  window.requestAnimationFrame(()=>{
    window.scrollTo({left:0,top:0,behavior:'auto'});
    window.dispatchEvent(new Event('resize'));
  });
}

export default function ViewportModeToggle({mode,onChange,className=''}:{mode:ViewportMode;onChange:(mode:ViewportMode)=>void;className?:string}){
  const next:ViewportMode=mode==='mobile'?'desktop':'mobile';
  const label=next==='desktop'?'Xem bản Desktop':'Xem bản Mobile';
  const Icon=next==='desktop'?Monitor:Smartphone;
  return <button type="button" className={`viewport-mode-toggle ${className}`.trim()} onClick={()=>{rememberExplicitViewportMode(next);onChange(next)}} title={label} aria-label={label} data-current-mode={mode} data-target-mode={next}>
    <Icon aria-hidden="true"/><span>{label}</span>
  </button>;
}
