// Attachment byte persistence. `File` objects are structured-cloneable, so
// IndexedDB keeps the original bytes and names across reloads. localStorage
// only holds the draft's file names, which is why reloaded drafts previously
// warned about missing tickets.
const DB='attesta-attachments', STORE='files', VERSION=1;
const DEFAULT_SCOPE='default';
const scopePrefix=scope=>`${scope||DEFAULT_SCOPE}:`;
const storageKey=(scope,key)=>`${scopePrefix(scope)}${key}`;
// Before scopes existed, keys were stored bare (for example `tickets`). They
// cannot be assigned safely to a region, but an explicit clear must remove them.
const isLegacyKey=key=>typeof key==='string' && !key.includes(':');
let dbPromise=null;

function open(){
  if(dbPromise) return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){ reject(new Error('indexedDB unavailable')); return; }
    const req=indexedDB.open(DB,VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('indexedDB open failed'));
  }).catch(e=>{ dbPromise=null; throw e; });
  return dbPromise;
}

function tx(mode,fn){
  return open().then(db=>new Promise((resolve,reject)=>{
    const t=db.transaction(STORE,mode);
    const store=t.objectStore(STORE);
    let result;
    try{ result=fn(store); }catch(e){ reject(e); return; }
    t.oncomplete=()=>resolve(result);
    t.onerror=()=>reject(t.error||new Error('indexedDB transaction failed'));
    t.onabort=()=>reject(t.error||new Error('indexedDB transaction aborted'));
  }));
}

export async function saveAttachmentBytes(map,scope=DEFAULT_SCOPE){
  await tx('readwrite',store=>{
    // Replace only this draft's set. Another regional draft may have a file
    // with the same name, and its bytes must not be deleted or reused.
    const prefix=scopePrefix(scope);
    const keys=store.getAllKeys();
    keys.onsuccess=()=>{
      for(const key of keys.result){
        if(typeof key==='string' && key.startsWith(prefix)) store.delete(key);
      }
      for(const [key,files] of map){
        if(files&&files.length) store.put(files.map(f=>({name:f.name,type:f.type,size:f.size,blob:f})),storageKey(scope,key));
      }
    };
  });
}

export async function loadAttachmentBytes(scope=DEFAULT_SCOPE){
  const stored=await tx('readonly',store=>{
    const out=new Map();
    const prefix=scopePrefix(scope);
    const req=store.openCursor();
    req.onsuccess=()=>{
      const cursor=req.result;
      if(!cursor) return;
      if(typeof cursor.key==='string' && cursor.key.startsWith(prefix))
        out.set(cursor.key.slice(prefix.length),cursor.value||[]);
      cursor.continue();
    };
    return out;
  });
  // The cursor fills `out` before the transaction's oncomplete resolves.
  return stored;
}

export async function clearAttachmentBytes(scope){
  await tx('readwrite',store=>{
    if(scope==null){ store.clear(); return; }
    const prefix=scopePrefix(scope);
    const req=store.openCursor();
    req.onsuccess=()=>{
      const cursor=req.result;
      if(!cursor) return;
      if(typeof cursor.key==='string' && (cursor.key.startsWith(prefix) || isLegacyKey(cursor.key)))
        store.delete(cursor.key);
      cursor.continue();
    };
  });
}
