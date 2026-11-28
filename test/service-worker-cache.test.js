import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const serviceWorker=read('sw.js');
const assetList=serviceWorker.match(/const ASSETS=\[([\s\S]*?)\];/)[1];
const precacheUrls=[...assetList.matchAll(/'(\.\/[^']*)'/g)].map(m=>m[1]);
const assets=new Set(precacheUrls.filter(url=>url!=='./').map(url=>url.slice(2)));

function localDependencyClosure(entry){
  const seen=new Set(), missing=new Set();
  const walk=file=>{
    if(seen.has(file)) return;
    seen.add(file);
    const source=read(file);
    for(const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)){
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));
      if(!assets.has(resolved)) missing.add(resolved);
      if(resolved.endsWith('.js')) walk(resolved);
    }
  };
  walk(entry);
  return {seen,missing};
}

test('every local module reachable from app.js is precached for first offline launch',()=>{
  const {missing}=localDependencyClosure('app.js');
  assert.deepEqual([...missing].sort(),[]);
});

test('every service-worker precache asset exists',()=>{
  const missing=[...assets].filter(asset=>!fs.existsSync(path.join(root,asset))).sort();
  assert.deepEqual(missing,[]);
});

test('official print logos are available offline',()=>{
  const needed=[
    'assets/logos/wallonie.jpg','assets/logos/dgo4.png',
    'assets/logos/air-climat.jpg','assets/br-logo-5.png',
  ];
  assert.deepEqual(needed.filter(asset=>!assets.has(asset)),[]);
});

function makeSwSandbox(){
  const listeners=new Map(), fetched=[], stored=new Map();
  let skipped=false;
  const cache={ async addAll(){}, async put(url,response){ stored.set(url,response); } };
  const sandbox={
    URL,
    caches:{open:async()=>cache},
    fetch:async(url,options)=>{ fetched.push({url,options}); return {ok:true}; },
    self:{
      addEventListener:(type,handler)=>listeners.set(type,handler),
      skipWaiting:async()=>{ skipped=true; }
    }
  };
  vm.runInNewContext(serviceWorker,sandbox);
  return {listeners,fetched,stored,isSkipped:()=>skipped};
}

test('service-worker install refreshes every precache entry from the network without skipWaiting',async()=>{
  const {listeners,fetched,stored,isSkipped}=makeSwSandbox();
  let installPromise;
  listeners.get('install')({waitUntil:promise=>{ installPromise=promise; }});
  await installPromise;
  assert.deepEqual(fetched.map(call=>call.url),precacheUrls);
  assert.equal(stored.size,precacheUrls.length);
  assert.ok(fetched.every(call=>call.options?.cache==='reload'));
  // Install must NOT take over immediately; the app prompts the user to reload.
  assert.equal(isSkipped(),false);
});

test('service-worker activates a waiting worker only on a SKIP_WAITING message',async()=>{
  const {listeners,isSkipped}=makeSwSandbox();
  assert.equal(isSkipped(),false);
  listeners.get('message')({data:{type:'SKIP_WAITING'}});
  assert.equal(isSkipped(),true);
});

test('service-worker ignores unrelated messages',async()=>{
  const {listeners,isSkipped}=makeSwSandbox();
  listeners.get('message')({data:{type:'OTHER'}});
  listeners.get('message')({});
  assert.equal(isSkipped(),false);
});
