import {Capacitor} from '@capacitor/core';

/** One cancellable deadline per request; abort never starts a fallback. */
export function requestDeadline(timeoutMs:number,parent?:AbortSignal){
  const controller=new AbortController();
  const abort=()=>controller.abort(parent?.reason);
  if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Quá thời gian chờ','TimeoutError')),timeoutMs);
  return{signal:controller.signal,dispose(){clearTimeout(timer);parent?.removeEventListener('abort',abort)}};
}
export function ensureActive(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Đã hủy yêu cầu','AbortError')}

const NATIVE_API_ORIGIN='https://yhct-hiu-final4-stage.vercel.app';
/** Web keeps same-origin API routes; native Capacitor uses the stable public hosted API origin. */
export function apiUrl(path:string){
  const normalized=path.startsWith('/')?path:`/${path}`;
  return Capacitor.isNativePlatform()?`${NATIVE_API_ORIGIN}${normalized}`:normalized;
}
