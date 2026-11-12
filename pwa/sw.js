'use strict';
const SCOPE=new URL(self.registration.scope),PREFIX='moce-pwa@'+encodeURIComponent(SCOPE.pathname)+':';
const CACHE=PREFIX+__CACHE__,FILES=__FILES__.map(file=>new URL(file,SCOPE).pathname);
const CORE=__CORE__.map(file=>new URL(file,SCOPE).pathname);
const INDEX=new URL('index.html',SCOPE).pathname;
let preparing=null;
async function fetchAsset(url){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch(new Request(url,{cache:'no-cache',signal:controller.signal}));if(!response.ok)throw Error('Asset unavailable');return response;}finally{clearTimeout(timer);}
}
async function status(target,type='CACHE_STATUS'){
  const cache=await caches.open(CACHE),keys=await cache.keys();
  const completed=keys.filter(r=>FILES.includes(new URL(r.url).pathname)).length;
  target?.postMessage({type,completed,total:FILES.length,ready:completed===FILES.length});
}
async function prepare(target){
  const cache=await caches.open(CACHE);
  // Full offline resources are user-requested, resumable and downloaded one at
  // a time. A failed optional track never throws away already cached artwork.
  try{for(const file of FILES){if(!await cache.match(file))await cache.put(file,await fetchAsset(file));await status(target,'CACHE_PROGRESS');}}
  catch{await status(target,'CACHE_ERROR');return;}
  await status(target,'CACHE_STATUS');
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{for(let i=0;i<CORE.length;i+=2)await cache.addAll(CORE.slice(i,i+2).map(url=>new Request(url,{cache:'no-cache'})));}
  catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if((key.startsWith(PREFIX)||(SCOPE.pathname==='/'&&/^moce-pwa-\d/.test(key)))&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='OFFLINE_STATUS')event.waitUntil(status(event.source));
  if(event.data?.type==='CACHE_REST'){
    if(!preparing)preparing=prepare(event.source).finally(()=>{preparing=null;});
    event.waitUntil(preparing);
  }
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
    if(!cached){
      const response=await fetch(request);
      if(response.ok&&response.status===200&&!request.headers.has('range'))try{await cache.put(url.pathname,response.clone());}catch{}
      return response;
    }
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
