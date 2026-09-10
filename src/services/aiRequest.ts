/** One cancellable deadline per request; abort never starts a fallback. */
export function requestDeadline(timeoutMs:number,parent?:AbortSignal){
  const controller=new AbortController();
  const abort=()=>controller.abort(parent?.reason);
  if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Quá thời gian chờ','TimeoutError')),timeoutMs);
  return{signal:controller.signal,dispose(){clearTimeout(timer);parent?.removeEventListener('abort',abort)}};
}
export function ensureActive(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Đã hủy yêu cầu','AbortError')}
