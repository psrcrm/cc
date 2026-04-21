'use strict';
// ── Auth ──────────────────────────────────────────────────────────────────────
const Auth = {
  currentUser: null,
  pinBuffer: '',

  async login(mobile, pin) {
    const all = await DB.getAll('workers');
    const worker = all.find(w => w.mobile === mobile && w.isActive);
    if (!worker) throw new Error('Mobile number not found');
    // In production: bcrypt compare. Here we compare stored hash directly for demo.
    if (worker.pinHash !== pin) throw new Error('Incorrect PIN');
    this.currentUser = worker;
    await DB.setSetting('lastUser', worker.id);
    return worker;
  },

  async autoLogin() {
    const id = await DB.getSetting('lastUser');
    if (!id) return null;
    const w = await DB.get('workers', id);
    if (w && w.isActive) { this.currentUser = w; return w; }
    return null;
  },

  logout() {
    this.currentUser = null;
    DB.setSetting('lastUser', null);
  },

  async changePin(workerId, oldPin, newPin) {
    const w = await DB.get('workers', workerId);
    if (!w) throw new Error('Worker not found');
    if (w.pinHash !== oldPin) throw new Error('Current PIN is incorrect');
    if (newPin.length < 4) throw new Error('PIN must be at least 4 digits');
    w.pinHash = newPin;
    await DB.put('workers', w);
  },

  async resetPin(workerId, newPin) {
    const w = await DB.get('workers', workerId);
    if (!w) throw new Error('Worker not found');
    w.pinHash = newPin;
    await DB.put('workers', w);
  },

  isAdmin() { return this.currentUser?.role === 'admin' || this.currentUser?.role === 'supervisor'; },
  isWorker() { return this.currentUser?.role === 'worker'; },
};

// ── PIN UI ────────────────────────────────────────────────────────────────────
function initPinPad() {
  let pin = '';

  function updateDots() {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById('dot-' + i);
      if (dot) dot.classList.toggle('active', i < pin.length);
    }
  }

  function pressPin(val) {
    if (pin.length >= 4) return;
    pin += val;
    updateDots();
    if (pin.length === 4) {
      setTimeout(tryLogin, 200);
    }
  }

  function delPin() { if (pin.length > 0) { pin = pin.slice(0, -1); updateDots(); } }
  function clearPin() { pin = ''; updateDots(); }

  async function tryLogin() {
    const mobile = document.getElementById('login-mobile').value.trim();
    const errEl = document.getElementById('login-error');
    errEl.textContent = '';
    try {
      const user = await Auth.login(mobile, pin);
      pin = '';
      updateDots();
      if (user.role === 'admin' || user.role === 'supervisor') {
        App.navigate('admin-home');
        Admin.init();
      } else {
        App.navigate('worker-home');
        Tasks.loadWorkerHome();
      }
    } catch (e) {
      errEl.textContent = e.message;
      pin = '';
      updateDots();
      navigator.vibrate && navigator.vibrate([100, 50, 100]);
    }
  }

  document.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.val;
      const action = btn.dataset.action;
      if (val !== undefined) pressPin(val);
      else if (action === 'del') delPin();
      else if (action === 'clear') clearPin();
    });
  });

  document.getElementById('login-btn').addEventListener('click', tryLogin);
}
