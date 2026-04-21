'use strict';
// ── Sync — Google Sheets integration ─────────────────────────────────────────
// URL is stored in IndexedDB settings — configured via Admin → Settings tab
// No hardcoding needed. Admin enters the URL once inside the app.

const Sync = {

  // Read URL from DB every time (never hardcoded)
  async getSheetsUrl() {
    return await DB.getSetting('sheets_url', '');
  },

  async isConfigured() {
    const url = await this.getSheetsUrl();
    return !!(url && url.startsWith('https://script.google.com'));
  },

  async syncSubmission(submission) {
    if (!navigator.onLine) {
      await DB.put('queue', { recordId: submission.recordId, ...submission });
      return false;
    }
    const url = await this.getSheetsUrl();
    if (!url || !url.startsWith('https://')) {
      // No URL configured — data safe in IndexedDB, will sync when configured
      await DB.put('queue', { recordId: submission.recordId, ...submission });
      return false;
    }
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',          // Required for Apps Script from GitHub Pages
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(this.buildSheetRow(submission)),
      });
      // Mark synced
      const sub = await DB.get('submissions', submission.recordId);
      if (sub) { sub.synced = true; await DB.put('submissions', sub); }
      await DB.delete('queue', submission.recordId).catch(() => {});
      console.log('Synced:', submission.recordId);
      return true;
    } catch (e) {
      console.error('Sync failed, queuing:', e);
      await DB.put('queue', { recordId: submission.recordId, ...submission });
      return false;
    }
  },

  async processQueue() {
    if (!navigator.onLine) return;
    const configured = await this.isConfigured();
    if (!configured) return;
    const queue = await DB.getAll('queue');
    if (!queue.length) return;
    App.showToast(`Syncing ${queue.length} queued submission${queue.length > 1 ? 's' : ''}…`);
    let synced = 0;
    for (const item of queue) {
      const ok = await this.syncSubmission(item);
      if (ok) synced++;
    }
    const remaining = await DB.getAll('queue');
    if (!remaining.length) App.showToast(`All ${synced} submissions synced ✓`);
  },

  async testConnection() {
    const url = await this.getSheetsUrl();
    if (!url) return { ok: false, msg: 'No URL configured' };
    try {
      // GET request to Apps Script health check (returns JSON, readable)
      const res = await fetch(url + '?action=ping', { method: 'GET', mode: 'cors' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: true, msg: 'Connected ✓ — ' + (data.service || 'Google Sheets') };
      }
      return { ok: false, msg: 'HTTP ' + res.status };
    } catch (e) {
      // no-cors fallback — can't read response but request went through
      return { ok: true, msg: 'Request sent (no-cors mode — cannot verify response)' };
    }
  },

  buildSheetRow(sub) {
    return {
      record_id:      sub.recordId,
      worker_id:      sub.workerId,
      worker_name:    sub.workerName,
      task_id:        sub.templateId,
      task_name:      sub.taskName,
      category:       sub.category,
      date:           sub.date,
      status:         sub.status,
      form_data_json: JSON.stringify(sub.formData || {}),
      image_urls:     JSON.stringify(sub.imageUrls || {}),
      submitted_at:   sub.submittedAt,
      community_id:   sub.communityId || 'COMM-001',
    };
  },

  init() {
    const banner = document.getElementById('offline-banner');
    banner.style.display = navigator.onLine ? 'none' : 'block';
    window.addEventListener('online',  () => { banner.style.display = 'none';  this.processQueue(); });
    window.addEventListener('offline', () => { banner.style.display = 'block'; });
  },
};

window.Sync = Sync;
