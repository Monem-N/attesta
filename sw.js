const CACHE='attesta-v1';
const ASSETS=[
  './','./index.html','./styles.css','./app.js','./output.js','./manifest.webmanifest',
  './regions/wallonia.js','./regions/flanders.js','./regions/brussels.js',
  './vendor/pdf-lib.min.js',
  './assets/wa-attestation-bg.pdf','./assets/fl-model-verbrandingsattest.pdf',
  './assets/fl-model-keuringsrapport.pdf','./assets/fl-model-reinigingsattest.pdf',
  './assets/br-solid-fuel-model.pdf','./assets/br-1mw-annex.pdf'
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k.startsWith('attesta-')&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  if(new URL(e.request.url).origin!==self.location.origin) return;
  const isNavigation=e.request.mode==='navigate';
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(!res.ok) return isNavigation?caches.match('./index.html'):res;
    const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return res;
  }).catch(()=>isNavigation?caches.match('./index.html'):new Response('Attesta asset unavailable',{status:503,statusText:'Offline asset unavailable'}))));
});
