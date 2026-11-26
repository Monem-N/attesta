const CACHE='attesta-v16';
const ASSETS=[
  './','./index.html','./styles.css','./app.js','./lang.js','./input-validation.js','./output.js','./manifest.webmanifest',
  './regions/wallonia.js','./regions/flanders.js','./regions/flanders-pdf.js','./regions/wallonia-criteria.js','./regions/flanders-criteria.js',
  './regions/pdf-render.js','./regions/wallonia-pdf.js','./regions/brussels.js',
  './print-wallonia.js','./print-flanders.js','./print-brussels.js',
  './regions/checkbox-vocab.js','./regions/diag-helper.js','./regions/legacy-maps.js','./regions/wa-template.js',
  './wallonia.html','./flanders.html','./brussels.html',
  './vendor/pdf-lib.min.js','./vendor/fontkit.umd.min.js','./vendor/DejaVuSans.ttf',
  './assets/wa-attestation-bg.pdf','./assets/fl-model-verbrandingsattest.pdf',
  './assets/fl-model-keuringsrapport.pdf','./assets/fl-model-reinigingsattest.pdf',
  './assets/br-solid-fuel-model.pdf','./assets/br-1mw-annex.pdf','./assets/checkbox-rects.json','./assets/br-option-marks.json','./attachments.js','./signature.js','./status.js',
  './assets/logos/wallonie.jpg','./assets/logos/dgo4.png','./assets/logos/air-climat.jpg','./assets/br-logo-5.png',
  './assets/template-hashes.json'
];
self.addEventListener('install',e=>{
  // Bypass the HTTP cache when refreshing the offline copy. A stale module in
  // Cache Storage otherwise survives a new worker until the next cache bump.
  e.waitUntil(caches.open(CACHE).then(async cache=>{
    await Promise.all(ASSETS.map(async url=>{
      const response=await fetch(url,{cache:'reload'});
      if(!response.ok) throw new Error(`Offline asset failed: ${url}`);
      await cache.put(url,response);
    }));
  }).then(()=>self.skipWaiting()));
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
