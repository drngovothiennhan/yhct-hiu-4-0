const CACHE='yhct-hiu-4-final4-static-v2';
const SHELL=['/','/manifest.webmanifest','/logo-clb-yhct-hiu.jpg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('yhct-hiu-4-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;event.respondWith(caches.match(req).then(cached=>{const network=fetch(req).then(res=>{if(res.ok&&res.type==='basic'){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res}).catch(()=>cached);return cached||network}))});
