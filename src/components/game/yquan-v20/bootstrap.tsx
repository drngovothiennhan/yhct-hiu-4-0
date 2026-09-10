import {createRoot,type Root} from 'react-dom/client';
import V20World from './V20World';
import {gameEventBus} from './GameEventBus';

const roots=new Map<Element,{root:Root;mount:HTMLElement}>();
let observer:MutationObserver|null=null;
let started=false;

const unmountShell=(shell:Element)=>{
  const entry=roots.get(shell);if(!entry)return;
  try{entry.root.unmount()}catch{/* host may already have removed the mount during React reconciliation */}
  roots.delete(shell);shell.removeAttribute('data-v20-mounted');
};

const mountShell=(shell:Element)=>{
  const existing=roots.get(shell);
  if(existing&&existing.mount.isConnected&&existing.mount.parentElement===shell)return;
  if(existing)unmountShell(shell);
  if(shell.getAttribute('data-v20-mounted')==='1')shell.removeAttribute('data-v20-mounted');
  const mount=document.createElement('div');mount.className='hyq-v20-mount';mount.setAttribute('data-engine','HIU_Y_QUAN_V20');shell.appendChild(mount);
  const root=createRoot(mount);root.render(<V20World/>);shell.setAttribute('data-v20-mounted','1');roots.set(shell,{root,mount});
};

const scan=()=>{
  for(const [shell,entry] of roots){
    if(document.documentElement.contains(shell)&&entry.mount.isConnected&&entry.mount.parentElement===shell)continue;
    unmountShell(shell);
  }
  document.querySelectorAll('.hyq-world-shell').forEach(mountShell);
};

const relevantAction=(target:EventTarget|null)=>{
  if(!(target instanceof Element))return false;
  return Boolean(target.closest('.hyq-case-panel button,.hyq-queue button,.hyq-appearance-panel button,.hyq-refresh,.hyq-recheck-alert-v17 button'));
};

const onClick=(event:MouseEvent)=>{
  if(!relevantAction(event.target))return;
  gameEventBus.emit('SYNC_REQUESTED',{reason:'legacy-ui-action'});
};

export function bootstrapYQuanV20(){
  if(started)return;started=true;
  const begin=()=>{
    scan();observer=new MutationObserver(()=>scan());observer.observe(document.body,{childList:true,subtree:true});document.addEventListener('click',onClick,true);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
}

export function disposeYQuanV20(){
  observer?.disconnect();observer=null;document.removeEventListener('click',onClick,true);for(const shell of [...roots.keys()])unmountShell(shell);started=false;
}

bootstrapYQuanV20();
