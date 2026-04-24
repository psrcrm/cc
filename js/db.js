'use strict';
// ── Unified Data Layer ────────────────────────────────────────────────────────
// Tries Firebase first. Falls back to LocalDB (IndexedDB) if not configured.
// All app code calls Data.xxx() — never accesses FB or LocalDB directly.

// ── LocalDB (IndexedDB) — always available as fallback / offline cache ────────
const LOCAL_DB_NAME = 'apartmentcare';
const LOCAL_DB_VER  = 3;
let _localDb;

const LocalDB = {
  open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VER);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        const stores = {
          workers:     { keyPath:'id', indexes:[{name:'mobile',unique:true}] },
          templates:   { keyPath:'id', indexes:[] },
          tasks:       { keyPath:'id', indexes:[{name:'workerId_date',keyPath:['workerId','date']},{name:'workerId',unique:false},{name:'date',unique:false}] },
          tickets:     { keyPath:'id', indexes:[{name:'assignedTo',unique:false},{name:'status',unique:false},{name:'date',unique:false}] },
          submissions: { keyPath:'recordId', indexes:[{name:'workerId',unique:false},{name:'synced',unique:false}] },
          queue:       { keyPath:'recordId', indexes:[] },
          settings:    { keyPath:'key', indexes:[] },
          notifications:{ keyPath:'id', indexes:[{name:'toUserId',unique:false}] },
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

  async init() {
    await LocalDB.open();
    const ok = await FB.init();
    this._useFirebase = ok;
    console.log('[Data] mode:', ok ? 'Firebase (central)' : 'LocalDB (offline/local)');
    if (!ok) await seedLocalData();
    return ok;
  },

  // ── Helpers ───────────────────────────────────────────────────────────────
  async get(store, id) {
    if (this._useFirebase) {
      const r = await FB.db.collection(store).doc(id).get();
      return r.exists ? { id: r.id, ...r.data() } : null;
    }
    return LocalDB.get(store, id);
  },

  async set(store, data) {
    const id = data.id || data.recordId;
    if (this._useFirebase) {
      await FB.db.collection(store).doc(id).set(data, { merge: true });
    }
    // Always write to local cache
    await LocalDB.put(store, data);
    return data;
  },

  async getAll(store) {
    if (this._useFirebase) {
      const snap = await FB.db.collection(store).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Update local cache
      for (const doc of docs) await LocalDB.put(store, doc).catch(()=>{});
      return docs;
    }
    return LocalDB.getAll(store);
  },

  async delete(store, id) {
    if (this._useFirebase) await FB.db.collection(store).doc(id).delete();
    await LocalDB.delete(store, id).catch(()=>{});
  },

  async query(store, field, op, value) {
    if (this._useFirebase) {
      const snap = await FB.db.collection(store).where(field, op, value).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    // LocalDB fallback — filter in memory
    const all = await LocalDB.getAll(store);
    return all.filter(r => {
      if (op === '==')     return r[field] === value;
      if (op === '!=')     return r[field] !== value;
      if (op === 'in')     return value.includes(r[field]);
      if (op === 'not-in') return !value.includes(r[field]);
      return true;
    });
  },

  async query2(store, f1, v1, f2, v2) {
    if (this._useFirebase) {
      const snap = await FB.db.collection(store).where(f1,'==',v1).where(f2,'==',v2).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    const all = await LocalDB.getAll(store);
    return all.filter(r => r[f1] === v1 && r[f2] === v2);
  },

  getSetting: (key, def)    => LocalDB.getSetting(key, def),
  setSetting: (key, value)  => LocalDB.setSetting(key, value),

  // ── Real-time subscriptions ───────────────────────────────────────────────
  subscribe(collection, query, callback) {
    if (!this._useFirebase) return () => {};
    let ref = FB.db.collection(collection);
    if (query) query.forEach(([f,op,v]) => { ref = ref.where(f,op,v); });
    const unsub = ref.onSnapshot(snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    this._listeners.push(unsub);
    return unsub;
  },

  unsubscribeAll() {
    this._listeners.forEach(u => u());
    this._listeners = [];
  },
};

// ── Keep backward-compat DB alias for older code ──────────────────────────────
const DB = {
  open:        ()           => Promise.resolve(),
  put:         (s, d)       => Data.set(s, d),
  get:         (s, k)       => Data.get(s, k),
  getAll:      (s)          => Data.getAll(s),
  getByIndex:  (s, ix, v)   => Data._useFirebase ? Data.query2(s, ix.split('_')[0], v[0], ix.split('_')[1] || ix, v[1] || v) : LocalDB.getByIndex(s, ix, v),
  delete:      (s, k)       => Data.delete(s, k),
  getSetting:  (k, d)       => LocalDB.getSetting(k, d),
  setSetting:  (k, v)       => LocalDB.setSetting(k, v),
};

window.LocalDB = LocalDB;
window.Data    = Data;
window.DB      = DB;
