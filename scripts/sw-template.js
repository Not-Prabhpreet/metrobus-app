const CACHE='metrobus-next-'+__VERSION__;
const PRECACHE=__PRECACHE__;
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    await cache.put('/__schedule-saved__',new Response(new Date().toISOString()));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys()) if(name.startsWith('metrobus-next-')&&name!==CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data==='SCHEDULE_SAVED') event.waitUntil((async()=>{
    const cache=await caches.open(CACHE),response=await cache.match('/__schedule-saved__');
    event.ports[0]?.postMessage(response?await response.text():null);
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    // Same-origin immutable assets can carry Vary: Origin from the preview/CDN.
    const cached=await cache.match(event.request,{ignoreSearch:true,ignoreVary:true});
    if(cached)return cached;
    if(event.request.mode==='navigate')return await cache.match('/index.html')||fetch(event.request);
    return fetch(event.request);
  })());
});
