'use strict';
// ── Firebase Configuration ────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBEBPUAHTKj-EPPQCzDiPryWA-qCAwEJNU",
  authDomain:        "saha-f7605.firebaseapp.com",
  projectId:         "saha-f7605",
  storageBucket:     "saha-f7605.firebasestorage.app",
  messagingSenderId: "296291661176",
  appId:             "1:296291661176:web:c3ca32b8fb988be997848d"
};

let _db       = null;
let _storage  = null;
let _configured = false;

const FB = {
  get db()           { return _db; },
  get storage()      { return _storage; },
  get isConfigured() { return _configured; },

  async init() {
    try {
      // Use compat SDK loaded from CDN in index.html
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      _db      = firebase.firestore();
      _storage = firebase.storage();

      // Offline persistence so PWA works without internet
      await _db.enablePersistence({ synchronizeTabs: true }).catch(e => {
        if (e.code === 'failed-precondition') {
          console.warn('[FB] Multiple tabs open — offline persistence disabled');
        } else if (e.code === 'unimplemented') {
          console.warn('[FB] Browser does not support offline persistence');
        }
      });

      _configured = true;
      console.log('[FB] Connected to project:', FIREBASE_CONFIG.projectId);
      return true;
    } catch (e) {
      console.error('[FB] Init failed:', e);
      _configured = false;
      return false;
    }
  },
};

window.FB = FB;
