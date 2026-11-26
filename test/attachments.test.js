import test from 'node:test';
import assert from 'node:assert/strict';

class Request {
  constructor(){ this.result=undefined; this.error=null; this.onsuccess=null; this.onerror=null; }
}

class MemoryStore {
  constructor(){ this.records=new Map(); }
  request(action){
    const tx=this.tx, req=new Request();
    tx.pending++;
    queueMicrotask(()=>{
      try{ req.result=action(); req.onsuccess?.call(req); }
      catch(error){ req.error=error; req.onerror?.call(req); }
      finally{ tx.pending--; tx.maybeComplete(); }
    });
    return req;
  }
  put(value,key){ return this.request(()=>{ this.records.set(key,value); return key; }); }
  delete(key){ return this.request(()=>{ this.records.delete(key); }); }
  clear(){ return this.request(()=>{ this.records.clear(); }); }
  getAllKeys(){ return this.request(()=>[...this.records.keys()]); }
  openCursor(){
    const tx=this.tx, req=new Request(), entries=[...this.records.entries()];
    let index=0;
    tx.pending++;
    const step=()=>queueMicrotask(()=>{
      if(index===entries.length){
        req.result=null; req.onsuccess?.call(req); tx.pending--; tx.maybeComplete(); return;
      }
      const [key,value]=entries[index++];
      req.result={key,value,continue:()=>{ tx.pending++; step(); }};
      req.onsuccess?.call(req);
      tx.pending--; tx.maybeComplete();
    });
    step();
    return req;
  }
}

class MemoryTransaction {
  constructor(store){
    this.store=store; store.tx=this;
    this.pending=0; this.done=false;
    this.oncomplete=null; this.onerror=null; this.onabort=null; this.error=null;
  }
  objectStore(){ return this.store; }
  maybeComplete(){
    if(this.done||this.pending!==0) return;
    this.done=true;
    queueMicrotask(()=>this.oncomplete?.());
  }
}

class MemoryDatabase {
  constructor(){ this.store=new MemoryStore(); }
  get objectStoreNames(){ return {contains:name=>name==='files'}; }
  createObjectStore(){}
  transaction(){ return new MemoryTransaction(this.store); }
}

class MemoryIndexedDB {
  constructor(){ this.database=new MemoryDatabase(); this.opened=false; }
  open(){
    const req=new Request();
    queueMicrotask(()=>{
      req.result=this.database;
      if(!this.opened){ this.opened=true; req.onupgradeneeded?.call(req); }
      req.onsuccess?.call(req);
    });
    return req;
  }
}

globalThis.indexedDB=new MemoryIndexedDB();
const {saveAttachmentBytes,loadAttachmentBytes,clearAttachmentBytes}=await import('../attachments.js');

function file(contents,name='same.pdf'){
  return new File([contents],name,{type:'application/pdf'});
}

async function text(map){
  const stored=map.get('tickets')?.[0];
  return stored?(stored.blob||stored).text():null;
}

test('attachment bytes are isolated between regional drafts with the same filename',async()=>{
  await saveAttachmentBytes(new Map([['tickets',[file('wallonia bytes')]]]),'wallonia');
  await saveAttachmentBytes(new Map([['tickets',[file('flanders bytes')]]]),'flanders');
  assert.equal(await text(await loadAttachmentBytes('wallonia')),'wallonia bytes');
  assert.equal(await text(await loadAttachmentBytes('flanders')),'flanders bytes');
});

test('clearing one regional draft preserves attachment bytes for the others',async()=>{
  await saveAttachmentBytes(new Map([['tickets',[file('wallonia bytes')]]]),'wallonia');
  await saveAttachmentBytes(new Map([['tickets',[file('brussels bytes')]]]),'brussels');
  await clearAttachmentBytes('wallonia');
  assert.equal(await text(await loadAttachmentBytes('wallonia')),null);
  assert.equal(await text(await loadAttachmentBytes('brussels')),'brussels bytes');
});

test('clearing a regional draft removes legacy unscoped bytes',async()=>{
  indexedDB.database.store.records.set('tickets',[file('legacy bytes')]);
  await saveAttachmentBytes(new Map([['tickets',[file('brussels bytes')]]]),'brussels');
  await clearAttachmentBytes('wallonia');
  assert.equal(indexedDB.database.store.records.has('tickets'),false);
  assert.equal(await text(await loadAttachmentBytes('brussels')),'brussels bytes');
});

test('unscoped attachment operations retain their clear-all behavior',async()=>{
  await saveAttachmentBytes(new Map([['tickets',[file('default bytes')]]]));
  assert.equal(await text(await loadAttachmentBytes()),'default bytes');
  await clearAttachmentBytes();
  assert.equal(await text(await loadAttachmentBytes()),null);
});
