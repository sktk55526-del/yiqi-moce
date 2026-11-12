'use strict';
const SCOPE=new URL(self.registration.scope),PREFIX='moce-pwa@'+encodeURIComponent(SCOPE.pathname)+':';
const CACHE=PREFIX+__CACHE__,FILES=__FILES__.map(file=>new URL(file,SCOPE).pathname);
const INDEX=new URL('index.html',SCOPE).pathname;
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{for(let i=0;i<FILES.length;i+=6)await cache.addAll(FILES.slice(i,i+6).map(url=>new Request(url,{cache:'reload'})));}
  catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if((key.startsWith(PREFIX)||(SCOPE.pathname==='/'&&/^moce-pwa-\d/.test(key)))&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE')event.waitUntil((async()=>{
    const windows=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>{const url=new URL(client.url);return url.origin===SCOPE.origin&&[SCOPE.pathname,INDEX].includes(url.pathname);});
    if(windows.length>1){event.source?.postMessage({type:'OTHER_WINDOWS'});return;}
    await self.skipWaiting();
  })());
});
self.addEventListener('fetch',event=>{
  const {request}=event,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    if(![SCOPE.pathname,INDEX].includes(url.pathname))return;
    // Static hosts redirect /index.html to /. A redirected cached Response is
    // rejected for browser navigations (ERR_FAILED). Return a clean response
    // while retaining its body, CSP and content type.
    event.respondWith(caches.open(CACHE).then(c=>c.match(INDEX)).then(r=>r?new Response(r.body,{status:r.status,statusText:r.statusText,headers:r.headers}):fetch(request)));return;
  }
  if(!FILES.includes(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(url.pathname);
    if(!cached)return fetch(request);
    if(!request.headers.has('range'))return cached;
    // Safari can request ranged media even when the full asset is cached.
    const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range'));
    if(!match||(!match[1]&&!match[2]))return fetch(request);
    const data=await cached.arrayBuffer(),size=data.byteLength;
    const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
    const end=match[1]?(match[2]?Math.min(Number(match[2]),size-1):size-1):size-1;
    if(start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
    const headers=new Headers(cached.headers);headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
    return new Response(data.slice(start,end+1),{status:206,headers});
  })());
});
