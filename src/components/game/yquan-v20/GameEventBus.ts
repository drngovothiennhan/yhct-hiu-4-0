import type {GameEventMap} from './types';

type EventKey=keyof GameEventMap;
type Listener<K extends EventKey>=(payload:GameEventMap[K])=>void;

export class GameEventBus{
  private listeners=new Map<EventKey,Set<(payload:never)=>void>>();

  on<K extends EventKey>(event:K,listener:Listener<K>){
    let bucket=this.listeners.get(event);
    if(!bucket){bucket=new Set();this.listeners.set(event,bucket)}
    bucket.add(listener as (payload:never)=>void);
    return()=>this.off(event,listener);
  }

  once<K extends EventKey>(event:K,listener:Listener<K>){
    const off=this.on(event,(payload)=>{off();listener(payload)});
    return off;
  }

  off<K extends EventKey>(event:K,listener:Listener<K>){
    this.listeners.get(event)?.delete(listener as (payload:never)=>void);
  }

  emit<K extends EventKey>(event:K,payload:GameEventMap[K]){
    const bucket=this.listeners.get(event);
    if(!bucket)return;
    [...bucket].forEach(listener=>listener(payload as never));
  }

  clear(){this.listeners.clear()}
}

export const gameEventBus=new GameEventBus();
