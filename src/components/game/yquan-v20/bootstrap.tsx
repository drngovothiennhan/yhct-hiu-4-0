import {createRoot,type Root} from 'react-dom/client';
import V20World from './V20World';
import {gameEventBus} from './GameEventBus';

const roots=new Map<Element,{root:Root;mount:HTMLElement}>();
let observer:MutationObserver|null=null;
let started=false;

const mountShell=(shell:Element)=>{
  if(roots.has(shell)||shell.getAttribute('data-v20-mounted')==='1')return;
  const mount=document.createElement('div');mount.className='hyq-v20-mount';mount.setAttribute('data-engine','HIU_Y_QUAN_V20');shell.appendChild(mount);
  const root=createRoot(mount);root.render(<V20World/>);shell.setAttribute('data-v20-mounted','1');roots.set(shell,{root,mount});
};

const scan=()=>{
  document.querySelectorAll('.hyq-world-shell').forEach(mountShell);
  for(const [shell,entry] of roots){
    if(document.documentElement.contains(shell))continue;
    entry.root.unmount();roots.delete(shell);
  }
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
  observer?.disconnect();observer=null;document.removeEventListener('click',onClick,true);for(const {root} of roots.values())root.unmount();roots.clear();started=false;
}

bootstrapYQuanV20();
