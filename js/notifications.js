'use strict';
// ── Notifications — real-time alerts to supervisors/admins ───────────────────
const Notif = {
  _unsub: null,
  _badge: null,
  _count: 0,

  async init(userId) {
    this._badge = document.getElementById('notif-badge');
    if (Data._useFirebase) {
      // Real-time listener for unread notifications
      this._unsub = Data.subscribe('notifications',
        [['toUserId','==',userId],['read','==',false]],
        (notifs) => {
          this._count = notifs.length;
          this.updateBadge();
          if (notifs.length > 0) this.showBanner(notifs[0]);
        }
      );
    }
  },

  updateBadge() {
    if (!this._badge) this._badge = document.getElementById('notif-badge');
    if (this._badge) {
      this._badge.textContent = this._count;
      this._badge.style.display = this._count > 0 ? 'flex' : 'none';
    }
  },

  showBanner(notif) {
    const isEmg = notif.type === 'emergency';
    App.showToast((isEmg ? '🚨 ' : '🔔 ') + notif.title + ' — ' + notif.body, isEmg ? 6000 : 3500);
  },

  // Called when worker escalates or requests parts
  async send({ toUserId, toRole, type, title, body, ticketId, fromName }) {
    const notif = {
      toUserId:  toUserId || '',
      toRole:    toRole   || '',
      type,           // 'escalation' | 'parts_required' | 'emergency' | 'resolved'
      title,
      body,
      ticketId:  ticketId || '',
      fromName:  fromName || Auth.currentUser?.name || '',
      createdAt: new Date().toISOString(),
      read:      false,
    };
    if (Data._useFirebase) {
      // If toRole, fan out to all users with that role
      if (!toUserId && toRole) {
        const all = await Data.getAll('workers');
        const targets = all.filter(w => w.role === toRole || w.role === 'admin');
        for (const t of targets) {
          await FB.db.collection('notifications').add({ ...notif, id: '', toUserId: t.id });
        }
      } else {
        await FB.db.collection('notifications').add(notif);
      }
    } else {
      // LocalDB fallback — just show toast for current user if admin
      if (Auth.currentUser?.role === 'admin' || Auth.currentUser?.role === 'supervisor') {
        App.showToast((type==='emergency'?'🚨 ':'🔔 ') + title);
      }
    }
  },

  stop() { if (this._unsub) { this._unsub(); this._unsub = null; } },
};

window.Notif = Notif;
