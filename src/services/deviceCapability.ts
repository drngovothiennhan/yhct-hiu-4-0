export type PerformanceTier='low'|'balanced'|'high';

type NavigatorHints=Navigator&{
  deviceMemory?:number;
  connection?:{saveData?:boolean;effectiveType?:string;addEventListener?:(event:string,cb:()=>void)=>void;removeEventListener?:(event:string,cb:()=>void)=>void};
};

export type DeviceCapabilityProfile={tier:PerformanceTier;cores:number;memoryGb:number|null;saveData:boolean;effectiveType:string;reducedMotion:boolean;touch:boolean};

function profile():DeviceCapabilityProfile{
  const n=navigator as NavigatorHints;
  const cores=Math.max(1,Number(n.hardwareConcurrency||2));
  const memory=Number(n.deviceMemory||0);
  const memoryGb=memory>0?memory:null;
  const saveData=Boolean(n.connection?.saveData);
  const effectiveType=String(n.connection?.effectiveType||'unknown');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch=n.maxTouchPoints>0;
  let score=0;
  if(cores>=8)score+=2;else if(cores>=4)score+=1;else score-=1;
  if(memoryGb!==null){if(memoryGb>=8)score+=2;else if(memoryGb>=4)score+=1;else score-=2}
  if(saveData)score-=3;
  if(/(^|-)2g$|slow-2g/.test(effectiveType))score-=3;else if(effectiveType==='3g')score-=1;
  if(reducedMotion)score-=2;
  const tier:PerformanceTier=score<=-1?'low':score>=3?'high':'balanced';
  return{tier,cores,memoryGb,saveData,effectiveType,reducedMotion,touch};
}

export function applyDeviceCapabilityProfile(){
  const sync=()=>{
    const p=profile();
    const root=document.documentElement;
    root.dataset.performanceTier=p.tier;
    root.dataset.saveData=p.saveData?'true':'false';
    root.dataset.reducedMotion=p.reducedMotion?'true':'false';
    return p;
  };
  const initial=sync();
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const n=navigator as NavigatorHints;
  motion.addEventListener?.('change',sync);
  n.connection?.addEventListener?.('change',sync);
  return{profile:initial,dispose:()=>{motion.removeEventListener?.('change',sync);n.connection?.removeEventListener?.('change',sync)}};
}
