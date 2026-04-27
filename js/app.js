'use strict';
const App = {
  currentScreen: 'splash',
  history: [],
  _toastTimer: null,

  navigate(screenId) {
    const oldEl = document.getElementById('screen-' + this.currentScreen);
    const newEl = document.getElementById('screen-' + screenId);
    if (!newEl) { console.warn('Screen not found:', screenId); return; }
    if (oldEl && this.currentScreen !== 'splash') {
      oldEl.classList.add('prev');
      setTimeout(() => oldEl.classList.remove('active','prev'), 300);
    } else if (oldEl) {
      oldEl.classList.remove('active');
    }
    newEl.classList.add('active');
    if (this.currentScreen !== 'splash') this.history.push(this.currentScreen);
    this.currentScreen = screenId;
    const scroll = newEl.querySelector('.scroll-area');
    if (scroll) scroll.scrollTop = 0;
  },

  goBack() { const p = this.history.pop(); if (p) this.navigate(p); },

  showToast(msg, duration=3000) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('visible'), duration);
  },

  showDialog(title, body, actions) {
    document.querySelector('.dialog-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box">
        <div class="dialog-title">${title}</div>
        <div class="dialog-body">${body}</div>
        <div class="dialog-actions">
          <button class="btn btn-outline btn-md flex-1" id="dlg-cancel">Cancel</button>
          ${actions.map((a,i) => `<button class="btn ${a.class} btn-md flex-1" id="dlg-act-${i}">${a.label}</button>`).join('')}
        </div>
      </div>`;
    document.getElementById('app').appendChild(overlay);
    overlay.querySelector('#dlg-cancel').addEventListener('click', () => overlay.remove());
    actions.forEach((a,i) => overlay.querySelector('#dlg-act-'+i).addEventListener('click', () => { overlay.remove(); a.action(); }));
    overlay.addEventListener('click', e => { if (e.target===overlay) overlay.remove(); });
  },

  showInputDialog(title, subtitle, placeholder, callback) {
    document.querySelector('.dialog-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box">
        <div class="dialog-title">${title}</div>
        <div class="dialog-body" style="margin-bottom:12px">${subtitle}</div>
        <input type="text" class="field-input" id="dlg-input" placeholder="${placeholder}" style="margin-bottom:16px">
        <div class="dialog-actions">
          <button class="btn btn-outline btn-md flex-1" id="dlg-cancel">Cancel</button>
          <button class="btn btn-primary btn-md flex-1" id="dlg-ok">OK</button>
        </div>
      </div>`;
    document.getElementById('app').appendChild(overlay);
    const input = overlay.querySelector('#dlg-input');
    setTimeout(() => input.focus(), 100);
    const confirm = () => { const v = input.value.trim(); overlay.remove(); if (v) callback(v); };
    overlay.querySelector('#dlg-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#dlg-ok').addEventListener('click', confirm);
    input.addEventListener('keydown', e => { if (e.key==='Enter') confirm(); });
  },

  // ── Button loading state helpers ────────────────────────────────────────────
  // Prevents double-clicks on async CTAs. Call setLoading(btn, true) before
  // await, setLoading(btn, false) in finally {}.
  setLoading(btn, loading, loadingText = 'Saving...') {
    if (!btn) return;
    if (loading) {
      btn._origText = btn.textContent;
      btn.textContent = loadingText;
      btn.disabled = true;
      btn.style.opacity = '0.7';
    } else {
      btn.textContent = btn._origText || btn.textContent;
      btn.disabled = false;
      btn.style.opacity = '';
    }
  },

  initNavigation() {
    document.querySelectorAll('#worker-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.screen; if (!s) return;
        document.querySelectorAll('#worker-nav .nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (s==='worker-home')         { App.navigate('worker-home'); Tasks.loadWorkerHome(); }
        else if (s==='worker-calendar'){ App.navigate('worker-calendar'); Cal.workerYear=new Date().getFullYear(); Cal.workerMonth=new Date().getMonth(); Cal.renderWorkerCalendar(); }
        else if (s==='worker-history') { App.navigate('worker-history'); Tasks.loadHistory(); }
        else if (s==='worker-settings'){ App.navigate('worker-settings'); Tasks.renderWorkerSettings(); }
      });
    });
    document.querySelectorAll('.screen:not(#screen-worker-home) .nav-item[data-screen]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = btn.dataset.screen;
        if (s==='worker-home')         { App.navigate('worker-home'); Tasks.loadWorkerHome(); }
        else if (s==='worker-calendar'){ App.navigate('worker-calendar'); Cal.renderWorkerCalendar(); }
        else if (s==='worker-history') { App.navigate('worker-history'); Tasks.loadHistory(); }
        else if (s==='worker-settings'){ App.navigate('worker-settings'); Tasks.renderWorkerSettings(); }
      });
    });
    document.getElementById('task-back').addEventListener('click',       () => { Tasks._stopElapsedTimer?.(); App.navigate('worker-home'); Tasks.loadWorkerHome(); });
    document.getElementById('wcal-back').addEventListener('click',       () => { App.navigate('worker-home'); Tasks.loadWorkerHome(); });
    document.getElementById('whist-back').addEventListener('click',      () => { App.navigate('worker-home'); Tasks.loadWorkerHome(); });
    document.getElementById('wset-back').addEventListener('click',       () => { App.navigate('worker-home'); Tasks.loadWorkerHome(); });
    document.getElementById('add-worker-back').addEventListener('click', () => App.navigate('admin-home'));
    document.getElementById('add-tpl-back').addEventListener('click',    () => App.navigate('admin-home'));
    document.getElementById('assign-back').addEventListener('click',     () => App.navigate('admin-home'));
    document.getElementById('wcal-prev').addEventListener('click', () => {
      Cal.workerMonth--; if (Cal.workerMonth<0){Cal.workerMonth=11;Cal.workerYear--;} Cal.renderWorkerCalendar();
    });
    document.getElementById('wcal-next').addEventListener('click', () => {
      Cal.workerMonth++; if (Cal.workerMonth>11){Cal.workerMonth=0;Cal.workerYear++;} Cal.renderWorkerCalendar();
    });
    document.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', () => Tasks.applyFilter(btn.dataset.filter));
    });
  },

  // FIX: SW was registering at wrong path '/wfm/sw.js' — now uses relative path
  // which works for GitHub Pages subfolders like /cc/
  async registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      // Use relative path so it works regardless of subfolder deployment
      const swPath = './sw.js';
      const reg = await navigator.serviceWorker.register(swPath);
      if (reg.waiting) reg.waiting.postMessage({ type:'SKIP_WAITING' });
      reg.addEventListener('updatefound', () => {
        const n = reg.installing;
        n.addEventListener('statechange', () => {
          if (n.state==='installed' && navigator.serviceWorker.controller) n.postMessage({type:'SKIP_WAITING'});
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing=true; window.location.reload(); }
      });
    } catch(e) {
      // SW failure is non-fatal — app works without it
      console.warn('[SW] Registration skipped:', e.message);
    }
  },

  async init() {
    // 1. Open IndexDB first — always works, no network needed
    await IndexDB.open();

    // 2. Seed local data immediately so login works offline
    await seedLocalData();

    // 3. Try Firebase in parallel (don't block UI on it)
    FB.init().then(fbOk => {
      Data._useFirebase = fbOk;
      if (fbOk) {
        console.log('[App] Firebase active — syncing seed data');
        syncSeedToFirebase().catch(e => console.warn('[App] Seed sync skipped:', e.message));
      } else {
        console.log('[App] Running in local mode');
      }
    }).catch(e => {
      console.warn('[App] Firebase init error:', e.message);
      Data._useFirebase = false;
    });

    // 4. Init sync + navigation (doesn't need Firebase)
    Sync.init();
    initPinPad();
    this.initNavigation();

    // 5. Auto-login from cached session
    const user = await Auth.autoLogin();
    if (user) {
      Notif.init(user.id).catch(()=>{});
      setTimeout(() => {
        if (Auth.isAdmin()) {
          App.navigate('admin-home');
          Admin.init();              // Admin.init() now calls startLiveSync internally
        } else {
          App.navigate('worker-home');
          Tasks.loadWorkerHome();
          Tasks.startLiveTaskSync(user.id);   // worker sees new task assignments live
        }
      }, 600);
    } else {
      setTimeout(() => App.navigate('login'), 600);
    }

    this.registerSW();
  },
};

// Globals
window.App   = App;
window.Admin = Admin;
window.Cal   = Cal;
window.Tasks = Tasks;
window.Auth  = Auth;
window.Sync  = Sync;

document.addEventListener('DOMContentLoaded', () => App.init());
