// Attachment byte persistence. `File` objects are structured-cloneable, so
// IndexedDB keeps the original bytes and names across reloads. localStorage
// only holds the draft's file names, which is why reloaded drafts previously
// warned about missing tickets.
const DB='attesta-attachments', STORE='files', VERSION=1;
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

export async function saveAttachmentBytes(map){
  await tx('readwrite',store=>{
    // Replace the whole set so removed files do not survive a reload.
    store.clear();
    for(const [key,files] of map){
      if(files&&files.length) store.put(files.map(f=>({name:f.name,type:f.type,size:f.size,blob:f})),key);
    }
  });
}

export async function loadAttachmentBytes(){
  const stored=await tx('readonly',store=>{
    const out=new Map();
    const req=store.openCursor();
    req.onsuccess=()=>{
      const cursor=req.result;
      if(!cursor) return;
      out.set(cursor.key,cursor.value||[]);
      cursor.continue();
    };
    return out;
  });
  // The cursor fills `out` before the transaction's oncomplete resolves.
  return stored;
}

export async function clearAttachmentBytes(){
  await tx('readwrite',store=>store.clear());
}
