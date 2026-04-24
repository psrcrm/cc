'use strict';
// ── Sync ─────────────────────────────────────────────────────────────────────
// Handles: offline queue → Google Sheets, Firebase real-time listeners
// All data writes go through DB which handles Firebase + local in parallel

const Sync = {
  _listeners: [],   // Firebase real-time unsubscribe functions
  _notifCount: 0,

  async getSheetsUrl() { return LocalDB.getSetting('sheets_url', ''); },
  async isConfigured()  { const u = await this.getSheetsUrl(); return !!(u && u.startsWith('https://script.google.com')); },

  // ── Queue offline submissions ──────────────────────────────────────────────
  async queueSubmission(submission) {
    await DB.queuePut({ recordId: submission.recordId, ...submission });
  },

  // ── Push one submission to Sheets ─────────────────────────────────────────
  async pushToSheets(payload, sheetParam) {
    const url = await this.getSheetsUrl();
    if (!url) return false;
    const param = sheetParam ? url + '?sheet=' + sheetParam : url;
    await fetch(param, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
    });
    return true;
  },

  // ── Sync task submission ───────────────────────────────────────────────────
  async syncSubmission(submission) {
    if (!navigator.onLine) { await this.queueSubmission(submission); return false; }
    const url = await this.getSheetsUrl();
    if (!url) { await this.queueSubmission(submission); return false; }
    try {
      await this.pushToSheets({
        record_id:      submission.recordId,
        type:           'task',
        worker_id:      submission.workerId,
        worker_name:    submission.workerName,
        task_id:        submission.templateId,
        task_name:      submission.taskName,
        category:       submission.category,
        date:           submission.date,
        status:         submission.status,
        form_data_json: JSON.stringify(submission.formData || {}),
        image_urls:     JSON.stringify(submission.imageUrls || {}),
        submitted_at:   submission.submittedAt,
        community_id:   submission.communityId || 'COMM-001',
      });
      const sub = await LocalDB.get('submissions', submission.recordId);
      if (sub) { sub.synced = true; await LocalDB.put('submissions', sub); }
      await DB.queueDelete(submission.recordId).catch(() => {});
      return true;
    } catch(e) {
      await this.queueSubmission(submission);
      return false;
    }
  },

  // ── Sync ticket update to Sheets ───────────────────────────────────────────
  async syncTicket(ticket) {
    if (!navigator.onLine) return;
    try {
      await this.pushToSheets({
        record_id:    ticket.id,
        type:         'ticket',
        resident_name:ticket.residentName,
        tower:        ticket.tower,
        flat_no:      ticket.flatNo,
        phone:        ticket.phone,
        category:     ticket.category,
        priority:     ticket.priority,
        source:       ticket.source,
        description:  ticket.description,
        assigned_to:  ticket.assignedName,
        status:       ticket.status,
        resolution:   ticket.resolution || '',
        parts:        JSON.stringify(ticket.partsRequired || []),
        created_at:   ticket.createdAt,
        updated_at:   new Date().toISOString(),
        community_id: ticket.communityId || 'COMM-001',
      }, 'Tickets');
    } catch(e) { console.warn('Ticket sheet sync failed:', e); }
  },

  // ── Process offline queue ──────────────────────────────────────────────────
  async processQueue() {
    if (!navigator.onLine) return;
    const configured = await this.isConfigured();
    if (!configured) return;
    const queue = await DB.queueGetAll();
    if (!queue.length) return;
    App.showToast(`Syncing ${queue.length} queued item${queue.length > 1 ? 's' : ''}…`);
    for (const item of queue) {
      await this.syncSubmission(item);
    }
    const remaining = await DB.queueGetAll();
    if (!remaining.length) App.showToast('All submissions synced ✓');
  },

  // ── Firebase real-time listeners ───────────────────────────────────────────
  startWorkerListeners(user) {
    if (!FB.isConfigured) return;
    const today = new Date().toISOString().split('T')[0];

    // Listen for ticket changes assigned to this worker
    const unsub1 = FB.onWorkerTickets(user.id, today, tickets => {
      // Check for new escalation responses (parts approved, ticket reassigned back)
      tickets.forEach(t => {
        if (t._notified) return;
        if (t.status === 'pending_parts' && t.partsApproved) {
          App.showToast('🔧 Parts approved for ' + t.id + ' — proceed with repair');
          Notif.showBanner('Parts Approved', 'Parts approved for ' + t.id, 'success');
        }
      });
      // Refresh worker home if visible
      if (App.currentScreen === 'worker-home') Tasks.loadWorkerHome();
    });

    // Listen for my notifications
    const unsub2 = FB.onMyNotifications(user.id, notifs => {
      notifs.forEach(n => {
        Notif.showBanner(n.title, n.body, n.type || 'info');
        FB.markNotificationRead(n.id);
      });
    });

    this._listeners.push(unsub1, unsub2);
  },

  startAdminListeners() {
    if (!FB.isConfigured) return;

    // Listen for escalated / parts-needed tickets — alert admin immediately
    const unsub = FB.onPendingTickets(tickets => {
      const count = tickets.length;
      const badge = document.getElementById('admin-notif-badge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
      // Show toast for newly escalated
      tickets.filter(t => t._isNew).forEach(t => {
        const msg = t.status === 'pending_parts'
          ? `🔧 Parts needed: ${t.id} — ${t.residentName} ${t.tower} ${t.flatNo}`
          : `⬆ Escalated: ${t.id} — ${t.residentName}`;
        App.showToast(msg, 5000);
        Notif.showBanner(
          t.status === 'pending_parts' ? 'Parts Required' : 'Ticket Escalated',
          msg, 'warning'
        );
      });
      // Refresh tickets tab if open
      if (Admin.currentTab === 'tickets') Admin.renderTab('tickets');
    });

    this._listeners.push(unsub);
  },

  stopAllListeners() {
    this._listeners.forEach(fn => { try { fn(); } catch(e) {} });
    this._listeners = [];
  },

  async testConnection() {
    const url = await this.getSheetsUrl();
    if (!url) return { ok: false, msg: 'No URL configured' };
    try {
      const res = await fetch(url + '?action=ping', { method: 'GET', mode: 'cors' });
      if (res.ok) { const d = await res.json().catch(() => ({})); return { ok: true, msg: 'Connected ✓ ' + (d.service || '') }; }
      return { ok: false, msg: 'HTTP ' + res.status };
    } catch(e) { return { ok: true, msg: 'Request sent (no-cors — cannot verify response)' }; }
  },

  init() {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.style.display = navigator.onLine ? 'none' : 'block';
    window.addEventListener('online',  () => { if (banner) banner.style.display = 'none';  this.processQueue(); });
    window.addEventListener('offline', () => { if (banner) banner.style.display = 'block'; });
  },
};

window.Sync = Sync;
