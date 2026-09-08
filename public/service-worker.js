const CACHE='yhct-hiu-4-final4-v5-atomic-theme-pwa';
const SCOPE_URL=new URL(self.registration.scope);
const ROOT=SCOPE_URL.pathname.endsWith('/')?SCOPE_URL.pathname:`${SCOPE_URL.pathname}/`;
const path=name=>new URL(name,self.registration.scope).pathname;
const SHELL=[path('./'),path('yhct-system-mark.svg')];
const LEGACY_MANIFESTS=[path('manifest.webmanifest'),path('api/manifest')];
const NAV_TIMEOUT_MS=4500;

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE&&key.startsWith('yhct-hiu-4-')).map(key=>caches.delete(key)));
    const cache=await caches.open(CACHE);
    await Promise.all(LEGACY_MANIFESTS.map(entry=>cache.delete(entry)));
    await self.clients.claim();
  })());
});

async function fetchWithTimeout(request,timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(request,{signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timer)}
}

async function navigationResponse(request){
  try{
    const fresh=await fetchWithTimeout(request,NAV_TIMEOUT_MS);
    if(fresh.ok){const copy=fresh.clone();void caches.open(CACHE).then(cache=>cache.put(request,copy));void caches.open(CACHE).then(cache=>cache.put(ROOT,fresh.clone()));return fresh}
  }catch{}
  return (await caches.match(request))||(await caches.match(ROOT))||Response.error();
}

async function staticResponse(request){
  const url=new URL(request.url);
  if(url.pathname.endsWith('/manifest.webmanifest')||url.pathname.endsWith('manifest.webmanifest')){
    try{return await fetch(request,{cache:'no-store'})}catch{return Response.error()}
  }
  const cached=await caches.match(request);
  const update=fetch(request).then(response=>{
    if(response.ok&&response.type==='basic'){const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,copy))}
    return response;
  }).catch(()=>null);
  if(cached){void update;return cached}
  return (await update)||Response.error();
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith(`${ROOT}api/`))return;
  if(request.mode==='navigate'){event.respondWith(navigationResponse(request));return}
  event.respondWith(staticResponse(request));
});