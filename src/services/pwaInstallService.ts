export type PwaInstallStatus='installed'|'available'|'unavailable';
type Choice={outcome:'accepted'|'dismissed';platform:string};
type BeforeInstallPromptEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<Choice>};
type Listener=()=>void;

let deferredPrompt:BeforeInstallPromptEvent|null=null;
const listeners=new Set<Listener>();
let bound=false;

const emit=()=>listeners.forEach(listener=>listener());
export const isStandalone=()=>typeof window!=='undefined'&&(window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone));
export const getPwaInstallStatus=():PwaInstallStatus=>isStandalone()?'installed':deferredPrompt?'available':'unavailable';

export function initPwaInstallCapture(){
  if(typeof window==='undefined'||bound)return()=>{};
  bound=true;
  const before=(event:Event)=>{event.preventDefault();deferredPrompt=event as BeforeInstallPromptEvent;emit()};
  const installed=()=>{deferredPrompt=null;emit()};
  window.addEventListener('beforeinstallprompt',before);
  window.addEventListener('appinstalled',installed);
  return()=>{window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',installed);bound=false};
}

export function subscribePwaInstall(listener:Listener){listeners.add(listener);return()=>listeners.delete(listener)}

export async function requestPwaInstall(){
  if(isStandalone())return{status:'installed' as const};
  const prompt=deferredPrompt;
  if(!prompt)return{status:'unavailable' as const};
  await prompt.prompt();
  const choice=await prompt.userChoice;
  if(choice.outcome==='accepted')deferredPrompt=null;
  emit();
  return{status:choice.outcome,platform:choice.platform};
}
