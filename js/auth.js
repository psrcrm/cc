'use strict';
const Auth = {
  currentUser: null,

  async login(mobile, pin) {
    let worker = null;

    // 1. Try Firebase first (if configured and online)
    if (Data._useFirebase) {
      try {
        const snap = await FB.db.collection('workers')
          .where('mobile','==',mobile).limit(1)
          .get({ source: 'default' });          // tries server, falls back to cache
        if (!snap.empty) {
          worker = { id: snap.docs[0].id, ...snap.docs[0].data() };
          // Cache locally for offline use
          await LocalDB.put('workers', worker);
        }
      } catch(e) {
        console.warn('[Auth] Firebase query failed, trying local cache:', e.message);
      }
    }

    // 2. Always fall back to LocalDB (offline / first load / Firestore not enabled yet)
    if (!worker) {
      const all = await LocalDB.getAll('workers');
      worker = all.find(w => w.mobile === mobile) || null;
    }

    if (!worker)          throw new Error('Mobile number not found');
    if (!worker.isActive) throw new Error('Account is inactive');
    if (worker.pinHash !== pin) throw new Error('Incorrect PIN');

    this.currentUser = worker;
    await LocalDB.setSetting('lastUserId',   worker.id);
    await LocalDB.setSetting('lastUserData', JSON.stringify(worker));

    // Push worker to Firebase in background (so other devices see them)
    if (Data._useFirebase) {
      FB.db.collection('workers').doc(worker.id).set(worker, { merge:true }).catch(()=>{});
    }

    return worker;
  },

  async autoLogin() {
    const id  = await LocalDB.getSetting('lastUserId',   null);
    const raw = await LocalDB.getSetting('lastUserData', null);
    if (!id || !raw) return null;
    try {
      const cached = JSON.parse(raw);
      this.currentUser = cached;
      // Refresh from Firebase in background
      if (Data._useFirebase) {
        FB.db.collection('workers').doc(id).get().then(doc => {
          if (doc.exists) {
            const fresh = { id: doc.id, ...doc.data() };
            this.currentUser = fresh;
            LocalDB.put('workers', fresh);
            LocalDB.setSetting('lastUserData', JSON.stringify(fresh));
          }
        }).catch(()=>{});
      }
      return cached;
    } catch { return null; }
  },

  logout() {
    this.currentUser = null;
    if (typeof Notif !== 'undefined') Notif.stop();
    if (typeof Data  !== 'undefined') Data.unsubscribeAll();
    LocalDB.setSetting('lastUserId',   null);
    LocalDB.setSetting('lastUserData', null);
  },

  async changePin(workerId, oldPin, newPin) {
    const w = await this._getWorker(workerId);
    if (!w)                   throw new Error('Worker not found');
    if (w.pinHash !== oldPin) throw new Error('Current PIN is incorrect');
    if (newPin.length < 4)    throw new Error('PIN must be at least 4 digits');
    w.pinHash = newPin;
    await LocalDB.put('workers', w);
    if (Data._useFirebase) FB.db.collection('workers').doc(w.id).set(w,{merge:true}).catch(()=>{});
  },

  async resetPin(workerId, newPin) {
    const w = await this._getWorker(workerId);
    if (!w) throw new Error('Worker not found');
    w.pinHash = newPin;
    await LocalDB.put('workers', w);
    if (Data._useFirebase) FB.db.collection('workers').doc(w.id).set(w,{merge:true}).catch(()=>{});
  },

  async _getWorker(id) {
    let w = null;
    if (Data._useFirebase) {
      try {
        const doc = await FB.db.collection('workers').doc(id).get();
        if (doc.exists) w = { id: doc.id, ...doc.data() };
      } catch(e) {}
    }
    return w || await LocalDB.get('workers', id);
  },

  isAdmin()      { return ['admin','supervisor'].includes(this.currentUser?.role); },
  isWorker()     { return this.currentUser?.role === 'worker'; },
  isSupervisor() { return this.currentUser?.role === 'supervisor'; },
};

function initPinPad() {
  let pin = '';
  function updateDots() {
    for (let i=0; i<4; i++) {
      const d = document.getElementById('dot-'+i);
      if (d) d.classList.toggle('active', i < pin.length);
    }
  }
  async function tryLogin() {
    const mobile = document.getElementById('login-mobile').value.trim();
    const errEl  = document.getElementById('login-error');
    errEl.textContent = '';
    if (!mobile) { errEl.textContent = 'Enter your mobile number'; pin=''; updateDots(); return; }
    try {
      const user = await Auth.login(mobile, pin);
      pin = ''; updateDots();
      if (typeof Notif !== 'undefined') await Notif.init(user.id);
      if (Auth.isAdmin()) { App.navigate('admin-home'); Admin.init(); }
      else                { App.navigate('worker-home'); Tasks.loadWorkerHome(); }
    } catch(e) {
      errEl.textContent = e.message;
      pin = ''; updateDots();
      navigator.vibrate && navigator.vibrate([100,50,100]);
    }
  }
  document.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.val, a = btn.dataset.action;
      if (v !== undefined && pin.length < 4) {
        pin += v; updateDots();
        if (pin.length === 4) setTimeout(tryLogin, 150);
      } else if (a==='del')   { pin=pin.slice(0,-1); updateDots(); }
        else if (a==='clear') { pin=''; updateDots(); }
    });
  });
  document.getElementById('login-btn').addEventListener('click', tryLogin);
}

window.Auth = Auth;
