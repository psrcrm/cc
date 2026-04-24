'use strict';
// ── Firebase Wrapper ──────────────────────────────────────────────────────────
// Config is loaded from js/config.js (gitignored)
// firebase.js itself contains NO secrets — safe to commit.

let _db         = null;
let _storage    = null;
let _configured = false;

const FB = {
  get db()           { return _db; },
  get storage()      { return _storage; },
  get isConfigured() { return _configured; },

  async init() {
    // Read config from window.APP_CONFIG (set by config.js)
    const cfg = window.APP_CONFIG?.firebase;
    if (!cfg || !cfg.projectId) {
      console.warn('[FB] No Firebase config found — running in local mode');
      return false;
    }
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      _db      = firebase.firestore();
      _storage = firebase.storage();

      // Offline persistence — keeps PWA working without internet
      await _db.enablePersistence({ synchronizeTabs: true }).catch(e => {
        if (e.code === 'failed-precondition') console.warn('[FB] Multiple tabs — one tab gets persistence');
        if (e.code === 'unimplemented')       console.warn('[FB] Offline persistence not supported');
      });

      _configured = true;
      console.log('[FB] Connected:', cfg.projectId);
      return true;
    } catch (e) {
      console.error('[FB] Init failed:', e);
      return false;
    }
  },
};

window.FB = FB;
