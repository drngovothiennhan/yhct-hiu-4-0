export type PerformanceTier='low'|'balanced'|'high';
export type DisplayClass='compact'|'standard'|'wide'|'ultrawide';

type NavigatorHints=Navigator&{
  deviceMemory?:number;
  connection?:{saveData?:boolean;effectiveType?:string;addEventListener?:(event:string,cb:()=>void)=>void;removeEventListener?:(event:string,cb:()=>void)=>void};
};

export type DeviceCapabilityProfile={
  tier:PerformanceTier;
  cores:number;
  memoryGb:number|null;
  saveData:boolean;
  effectiveType:string;
  reducedMotion:boolean;
  touch:boolean;
  viewportWidth:number;
  viewportHeight:number;
  screenWidth:number;
  screenHeight:number;
  devicePixelRatio:number;
  orientation:'portrait'|'landscape';
  displayClass:DisplayClass;
  finePointer:boolean;
};

function viewportSize(){
  const vv=window.visualViewport;
  const width=Math.max(1,Math.round(vv?.width||document.documentElement.clientWidth||window.innerWidth));
  const height=Math.max(1,Math.round(vv?.height||document.documentElement.clientHeight||window.innerHeight));
  return{width,height};
}

function displayClass(width:number):DisplayClass{return width<900?'compact':width<1280?'standard':width<1800?'wide':'ultrawide'}

function profile():DeviceCapabilityProfile{
  const n=navigator as NavigatorHints;
  const cores=Math.max(1,Number(n.hardwareConcurrency||2));
  const memory=Number(n.deviceMemory||0);
  const memoryGb=memory>0?memory:null;
  const saveData=Boolean(n.connection?.saveData);
  const effectiveType=String(n.connection?.effectiveType||'unknown');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const touch=n.maxTouchPoints>0;
  const viewport=viewportSize();
  const dpr=Math.max(1,Math.min(4,Number(window.devicePixelRatio||1)));
  let score=0;
  if(cores>=8)score+=2;else if(cores>=4)score+=1;else score-=1;
  if(memoryGb!==null){if(memoryGb>=8)score+=2;else if(memoryGb>=4)score+=1;else score-=2}
  if(saveData)score-=3;
  if(/(^|-)2g$|slow-2g/.test(effectiveType))score-=3;else if(effectiveType==='3g')score-=1;
  if(reducedMotion)score-=2;
  const tier:PerformanceTier=score<=-1?'low':score>=3?'high':'balanced';
  return{tier,cores,memoryGb,saveData,effectiveType,reducedMotion,touch,viewportWidth:viewport.width,viewportHeight:viewport.height,screenWidth:Math.round(screen.width||viewport.width),screenHeight:Math.round(screen.height||viewport.height),devicePixelRatio:dpr,orientation:viewport.width>=viewport.height?'landscape':'portrait',displayClass:displayClass(viewport.width),finePointer};
}

export function applyDeviceCapabilityProfile(){
  let raf=0;
  const sync=()=>{
    const p=profile();
    const root=document.documentElement;
    root.dataset.performanceTier=p.tier;
    root.dataset.saveData=p.saveData?'true':'false';
    root.dataset.reducedMotion=p.reducedMotion?'true':'false';
    root.dataset.displayClass=p.displayClass;
    root.dataset.viewportWidth=String(p.viewportWidth);
    root.dataset.viewportHeight=String(p.viewportHeight);
    root.dataset.devicePixelRatio=String(p.devicePixelRatio);
    root.dataset.orientation=p.orientation;
    root.dataset.pointer=p.finePointer?'fine':p.touch?'touch':'coarse';
    root.style.setProperty('--yhct-viewport-width',`${p.viewportWidth}px`);
    root.style.setProperty('--yhct-viewport-height',`${p.viewportHeight}px`);
    root.style.setProperty('--yhct-device-pixel-ratio',String(p.devicePixelRatio));
    return p;
  };
  const schedule=()=>{if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{raf=0;sync()})};
  const initial=sync();
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const n=navigator as NavigatorHints;
  motion.addEventListener?.('change',schedule);
  n.connection?.addEventListener?.('change',schedule);
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  return{profile:initial,dispose:()=>{if(raf)cancelAnimationFrame(raf);motion.removeEventListener?.('change',schedule);n.connection?.removeEventListener?.('change',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('orientationchange',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule)}};
}
