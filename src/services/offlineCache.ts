const DB_NAME='yhct-hiu-offline-v2';
const STORE='kv';
const VERSION=1;

type CacheRecord<T>={key:string;value:T;expiresAt:number;updatedAt:number};

function openDb():Promise<IDBDatabase|null>{
  if(typeof indexedDB==='undefined')return Promise.resolve(null);
  return new Promise(resolve=>{
    const request=indexedDB.open(DB_NAME,VERSION);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'})};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>resolve(null);
    request.onblocked=()=>resolve(null);
  });
}

export async function cachePut<T>(key:string,value:T,ttlMs:number){
  const db=await openDb();if(!db)return;
  await new Promise<void>(resolve=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put({key,value,expiresAt:Date.now()+Math.max(1,ttlMs),updatedAt:Date.now()} satisfies CacheRecord<T>);
    tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();
  });
  db.close();
}

export async function cacheGet<T>(key:string,{allowStale=false}:{allowStale?:boolean}={}):Promise<T|null>{
  const db=await openDb();if(!db)return null;
  return new Promise(resolve=>{
    const tx=db.transaction(STORE,'readonly');
    const request=tx.objectStore(STORE).get(key);
    request.onsuccess=()=>{
      const record=request.result as CacheRecord<T>|undefined;
      db.close();
      if(!record)return resolve(null);
      if(!allowStale&&record.expiresAt<Date.now())return resolve(null);
      resolve(record.value);
    };
    request.onerror=()=>{db.close();resolve(null)};
  });
}

export async function cacheDelete(key:string){
  const db=await openDb();if(!db)return;
  await new Promise<void>(resolve=>{
    const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);
    tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();tx.onabort=()=>resolve();
  });
  db.close();
}
