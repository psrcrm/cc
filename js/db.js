'use strict';
// ── Unified Data Layer ────────────────────────────────────────────────────────
// Tries Firebase first. Falls back to IndexDB (IndexedDB) if not configured.
// All app code calls Data.xxx() — never accesses FB or IndexDB directly.

// ── IndexDB (IndexedDB) — always available as fallback / offline cache ────────
const LOCAL_DB_NAME = 'apartmentcare';
const LOCAL_DB_VER  = 3;
let _localDb;

const IndexDB = {
  open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VER);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        const stores = {
          workers:      { keyPath:'id',       indexes:[{name:'mobile',unique:true}] },
          templates:    { keyPath:'id',        indexes:[] },
          tasks:        { keyPath:'id',        indexes:[{name:'workerId_date',keyPath:['workerId','date']},{name:'workerId',unique:false},{name:'date',unique:false}] },
          tickets:      { keyPath:'id',        indexes:[{name:'assignedTo',unique:false},{name:'status',unique:false},{name:'date',unique:false}] },
          submissions:  { keyPath:'recordId',  indexes:[{name:'workerId',unique:false},{name:'synced',unique:false}] },
          queue:        { keyPath:'recordId',  indexes:[] },
          settings:     { keyPath:'key',       indexes:[] },
          notifications:{ keyPath:'id',        indexes:[{name:'toUserId',unique:false}] },
        };
        Object.entries(stores).forEach(([name, cfg]) => {
          if (!d.objectStoreNames.contains(name)) {
            const s = d.createObjectStore(name, { keyPath: cfg.keyPath });
            cfg.indexes.forEach(ix => s.createIndex(ix.name, ix.keyPath || ix.name, { unique: !!ix.unique }));
          }
        });
      };
      req.onsuccess = e => { _localDb = e.target.result; res(_localDb); };
      req.onerror   = () => rej(req.error);
    });
  },
  tx(stores, mode='readonly') { return _localDb.transaction(stores, mode); },
  put(store, data) {
    return new Promise((res, rej) => {
      const req = this.tx(store,'readwrite').objectStore(store).put(data);
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  },
  get(store, key) {
    return new Promise((res, rej) => {
      const req = this.tx(store).objectStore(store).get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror   = () => rej(req.error);
    });
  },
  getAll(store) {
    return new Promise((res, rej) => {
      const req = this.tx(store).objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  },
  getByIndex(store, indexName, value) {
    return new Promise((res, rej) => {
      const req = this.tx(store).objectStore(store).index(indexName).getAll(value);
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  },
  delete(store, key) {
    return new Promise((res, rej) => {
      const req = this.tx(store,'readwrite').objectStore(store).delete(key);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },
  getSetting(key, def=null) { return this.get('settings', key).then(r => r ? r.value : def); },
  setSetting(key, value)    { return this.put('settings', { key, value }); },
};

// ── Data — unified API used by all app modules ────────────────────────────────
const Data = {
  _useFirebase: false,
  _listeners:   [],        // active Firestore listeners to unsubscribe on logout
  // FIX: In-memory cache prevents repeated full Firestore reads on every tab switch.
  // Cache is invalidated on any write (set/delete) to that store.
  _cache: {},

  _invalidate(store) {
    delete this._cache[store];
  },

  async init() {
    await IndexDB.open();
    const ok = await FB.init();
    this._useFirebase = ok;
    console.log('[Data] mode:', ok ? 'Firebase (central)' : 'IndexDB (offline/local)');
    if (!ok) await seedLocalData();
    return ok;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────
  async get(store, id) {
    if (this._useFirebase) {
      // FIX: use cache-then-server so UI shows instantly
      const cached = this._cache[store]?.find(r => r.id === id);
      if (cached) return cached;
      const r = await FB.db.collection(store).doc(id).get();
      return r.exists ? { id: r.id, ...r.data() } : null;
    }
    return IndexDB.get(store, id);
  },

  async set(store, data) {
    const id = data.id || data.recordId;
    // Always write to local IndexedDB first — this never fails and makes UI instant
    await IndexDB.put(store, data);
    this._invalidate(store);
    // Then try Firebase in background — if it fails (permissions, offline, etc.)
    // the data is still saved locally and will sync when rules are fixed / connection returns
    if (this._useFirebase) {
      FB.db.collection(store).doc(id).set(data, { merge: true }).catch(e => {
        console.warn(`[Data] Firebase write failed for ${store}/${id} — saved locally only:`, e.message);
      });
    }
    return data;
  },

  async getAll(store) {
    // FIX: Return cached copy if available — avoids 500ms+ Firestore round-trip
    // on every tab switch. Cache is busted on any write to this store.
    if (this._cache[store]) {
      return this._cache[store];
    }

    let docs;
    if (this._useFirebase) {
      // FIX: Use cache-first source — returns from Firestore's local offline cache
      // immediately, then syncs in background. Eliminates the 3-8s loading delay.
      const snap = await FB.db.collection(store).get({ source: 'cache' }).catch(async () => {
        // Cache miss on first load — fetch from server, but only once
        return FB.db.collection(store).get();
      });
      docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Warm up local IndexedDB cache in background
      for (const doc of docs) IndexDB.put(store, doc).catch(()=>{});
    } else {
      docs = await IndexDB.getAll(store);
    }

    this._cache[store] = docs;
    return docs;
  },

  async delete(store, id) {
    if (this._useFirebase) await FB.db.collection(store).doc(id).delete();
    await IndexDB.delete(store, id).catch(()=>{});
    this._invalidate(store);
  },

  async query(store, field, op, value) {
    if (this._useFirebase) {
      // FIX: use getAll (cache-backed) + filter in memory instead of extra Firestore query
      const all = await this.getAll(store);
      return all.filter(r => {
        if (op === '==')     return r[field] === value;
        if (op === '!=')     return r[field] !== value;
        if (op === 'in')     return value.includes(r[field]);
        if (op === 'not-in') return !value.includes(r[field]);
        return true;
      });
    }
    const all = await IndexDB.getAll(store);
    return all.filter(r => {
      if (op === '==')     return r[field] === value;
      if (op === '!=')     return r[field] !== value;
      if (op === 'in')     return value.includes(r[field]);
      if (op === 'not-in') return !value.includes(r[field]);
      return true;
    });
  },

  async query2(store, f1, v1, f2, v2) {
    // FIX: Always filter in memory — avoids Firestore composite index requirement
    // (which was causing the "assign tasks" error: Firestore needs an index for
    //  WHERE workerId == x AND date == y but one wasn't created in console)
    const all = await this.getAll(store);
    return all.filter(r => r[f1] === v1 && r[f2] === v2);
  },

  getSetting: (key, def)    => IndexDB.getSetting(key, def),
  setSetting: (key, value)  => IndexDB.setSetting(key, value),

  // ── Real-time subscriptions ───────────────────────────────────────────────
  subscribe(collection, query, callback) {
    if (!this._useFirebase) return () => {};
    let ref = FB.db.collection(collection);
    if (query) query.forEach(([f,op,v]) => { ref = ref.where(f,op,v); });
    const unsub = ref.onSnapshot(snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Also bust local cache so next Data.getAll() returns fresh data
      this._invalidate(collection);
      this._cache[collection] = docs;
      callback(docs);
    });
    this._listeners.push(unsub);
    return unsub;
  },

  unsubscribeAll() {
    this._listeners.forEach(u => u());
    this._listeners = [];
    this._cache = {};  // clear cache on logout
  },
};

// ── Keep backward-compat DB alias for older code ──────────────────────────────
const Index = {
  open:         ()          => Promise.resolve(),
  put:          (s, d)      => Data.set(s, d),
  get:          (s, k)      => Data.get(s, k),
  getAll:       (s)         => Data.getAll(s),
  getByIndex:   (s, ix, v)  => IndexDB.getByIndex(s, ix, v),
  delete:       (s, k)      => Data.delete(s, k),
  getSetting:   (k, d)      => IndexDB.getSetting(k, d),
  setSetting:   (k, v)      => IndexDB.setSetting(k, v),
  // FIX: queuePut / queueGetAll / queueDelete were missing from DB alias
  // causing Sync.queueSubmission() to throw "Index.queuePut is not a function"
  queuePut:     (item)      => IndexDB.put('queue', item),
  queueGetAll:  ()          => IndexDB.getAll('queue'),
  queueDelete:  (id)        => IndexDB.delete('queue', id),
};

window.IndexDB = IndexDB;
window.Data    = Data;
window.Index   = Index;
