'use strict';
const Auth = {
  currentUser: null,

  async login(mobile, pin) {
    let worker = null;
    if (Data._useFirebase) {
      // Query Firebase
      const snap = await FB.db.collection('workers').where('mobile','==',mobile).limit(1).get();
      if (!snap.empty) worker = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } else {
      const all = await LocalDB.getAll('workers');
      worker = all.find(w => w.mobile === mobile) || null;
    }
    if (!worker || !worker.isActive) throw new Error('Mobile number not found');
    if (worker.pinHash !== pin)      throw new Error('Incorrect PIN');
    this.currentUser = worker;
    await LocalDB.setSetting('lastUserId', worker.id);
    await LocalDB.setSetting('lastUserData', JSON.stringify(worker));
    return worker;
  },

  async autoLogin() {
    const id   = await LocalDB.getSetting('lastUserId', null);
    const raw  = await LocalDB.getSetting('lastUserData', null);
    if (!id || !raw) return null;
    try {
      const cached = JSON.parse(raw);
      this.currentUser = cached;
      // Refresh from source in background
      setTimeout(async () => {
        const fresh = Data._useFirebase
          ? await Data.get('workers', id)
          : await LocalDB.get('workers', id);
        if (fresh) {
          this.currentUser = fresh;
          await LocalDB.setSetting('lastUserData', JSON.stringify(fresh));
        }
      }, 1000);
      return cached;
    } catch { return null; }
  },

  logout() {
    this.currentUser = null;
    Notif.stop();
    Data.unsubscribeAll();
    LocalDB.setSetting('lastUserId', null);
    LocalDB.setSetting('lastUserData', null);
  },

  async changePin(workerId, oldPin, newPin) {
    const w = await Data.get('workers', workerId);
    if (!w)               throw new Error('Worker not found');
    if (w.pinHash !== oldPin) throw new Error('Current PIN is incorrect');
    if (newPin.length < 4)    throw new Error('PIN must be at least 4 digits');
    w.pinHash = newPin;
    await Data.set('workers', w);
  },

  async resetPin(workerId, newPin) {
    const w = await Data.get('workers', workerId);
    if (!w) throw new Error('Worker not found');
    w.pinHash = newPin;
    await Data.set('workers', w);
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
    try {
      const user = await Auth.login(mobile, pin);
      pin = ''; updateDots();
      // Start notifications for this user
      await Notif.init(user.id);
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
      if (v !== undefined && pin.length < 4) { pin += v; updateDots(); if (pin.length === 4) setTimeout(tryLogin, 150); }
      else if (a === 'del')   { pin = pin.slice(0,-1); updateDots(); }
      else if (a === 'clear') { pin = ''; updateDots(); }
    });
  });
  document.getElementById('login-btn').addEventListener('click', tryLogin);
}

window.Auth = Auth;
