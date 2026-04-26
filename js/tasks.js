'use strict';
// ── Tasks ─────────────────────────────────────────────────────────────────────
const Tasks = {
  currentTask: null,
  currentTemplate: null,
  formData: {},
  capturedImages: {},
  activeFilter: 'all',
  taskStartedAt: null,   // timestamp when worker taps Start

  getToday() {
    return new Date().toISOString().split('T')[0];
  },

  buildRecordId(workerId, templateId, date) {
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const tCode = templateId.replace('TPL-', '').padStart(3, '0');
    return `${workerId}-T${tCode}-${date.replace(/-/g, '')}-${ts}`;
  },

  getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  },

  async loadWorkerHome() {
    const user  = Auth.currentUser;
    const today = this.getToday();

    // Load both tasks AND tickets
    let tasks   = await Data.query2('tasks', 'workerId', user.id, 'date', today);
    const tickets = (await Data.getAll('tickets')).filter(t => t.assignedTo === user.id && t.date === today && t.status !== 'closed');

    // FIX 1: Auto-mark missed — any pending task whose dueTime has passed gets marked missed
    const nowTime = new Date().toTimeString().slice(0, 5); // 'HH:MM'
    for (const t of tasks) {
      if (t.status === 'pending' && t.dueTime && t.dueTime < nowTime) {
        t.status = 'missed';
        Data.set('tasks', t).catch(() => {}); // fire-and-forget, don't block render
      }
    }

    tasks.sort((a, b) => a.dueTime.localeCompare(b.dueTime));
    // Emergency tickets first
    tickets.sort((a, b) => (a.priority === 'emergency' ? -1 : b.priority === 'emergency' ? 1 : 0));

    // Store for "next task" feature
    this._todayTasks = tasks;

    const totalTasks   = tasks.length;
    const doneTasks    = tasks.filter(t => t.status === 'completed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const missedTasks  = tasks.filter(t => t.status === 'missed').length;
    const overdueCount = tasks.filter(t => t.status === 'pending' && t.dueTime && t.dueTime < nowTime).length;
    const openTickets  = tickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'pending_parts').length;
    const doneTickets  = tickets.filter(t => t.status === 'resolved').length;
    const totalAll     = totalTasks + tickets.length;
    const doneAll      = doneTasks + doneTickets;
    const pct          = totalAll > 0 ? Math.round(doneAll / totalAll * 100) : 0;

    document.getElementById('hero-greeting').textContent = this.getGreeting();
    document.getElementById('hero-name').textContent = user.name;
    document.getElementById('hero-pct').textContent = pct + '%';
    document.getElementById('hero-fill').style.width = pct + '%';
    document.getElementById('hero-stats').innerHTML = `
      <div class="hero-stat"><div class="hero-stat-n">${totalTasks}</div><div class="hero-stat-l">TASKS</div></div>
      <div class="hero-stat"><div class="hero-stat-n" style="color:#6EE7B7">${doneTasks}</div><div class="hero-stat-l">DONE</div></div>
      <div class="hero-stat"><div class="hero-stat-n" style="color:#FCD34D">${pendingTasks}</div><div class="hero-stat-l">PENDING</div></div>
      <div class="hero-stat"><div class="hero-stat-n" style="color:#FCA5A5">${openTickets}</div><div class="hero-stat-l">TICKETS</div></div>
    `;

    // Render combined list
    this.renderCombinedList(tasks, tickets, nowTime);
    this.activeFilter = 'all';
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
  },

  renderCombinedList(tasks, tickets, nowTime) {
    nowTime = nowTime || new Date().toTimeString().slice(0, 5);
    const list = document.getElementById('task-list');
    const catColors = { Plumbing:'#EBF2FF', Electrical:'#FFFBEB', Housekeeping:'#ECFDF5', Security:'#F5F3FF' };
    let html = '';

    // FIX 3: Summary pill above the list
    const pending  = tasks.filter(t => t.status === 'pending').length;
    const overdue  = tasks.filter(t => t.status === 'pending' && t.dueTime && t.dueTime < nowTime).length;
    const missed   = tasks.filter(t => t.status === 'missed').length;
    const done     = tasks.filter(t => t.status === 'completed').length;
    if (tasks.length > 0) {
      html += `<div style="display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px 2px">
        ${done    > 0 ? `<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:#ECFDF5;color:#059669">${done} done</span>` : ''}
        ${pending > 0 ? `<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:#FFFBEB;color:#D97706">${pending} pending</span>` : ''}
        ${overdue > 0 ? `<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:#FFF1F2;color:#E11D48">${overdue} overdue</span>` : ''}
        ${missed  > 0 ? `<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:#F5F3FF;color:#7C3AED">${missed} missed</span>` : ''}
      </div>`;
    }

    // Section: Tickets (if any)
    if (tickets.length > 0) {
      html += `<div class="task-group-header">🎫 Complaints & Tickets (${tickets.length})</div>
               <div style="background:var(--surface)">`;
      tickets.forEach(t => {
        html += (typeof Tickets !== 'undefined') ? Tickets.renderTicketListItem(t) : '';
      });
      html += '</div>';
    }

    // Section: Tasks
    if (tasks.length > 0) {
      html += `<div class="task-group-header">📋 Regular Tasks (${tasks.length})</div>
               <div style="background:var(--surface)">`;
      tasks.forEach(t => {
        // FIX 2: Overdue = pending task whose dueTime has passed → red accent
        const isOverdue = t.status === 'pending' && t.dueTime && t.dueTime < nowTime;
        const overdueStyle = isOverdue ? 'border-left:3px solid #E11D48;' : '';
        const metaExtra    = isOverdue ? `<span style="color:#E11D48;font-weight:700;margin-left:6px">⚠ Overdue</span>` : '';
        html += `<div class="task-item" data-task-id="${t.id}" data-filter="${t.status}" style="${overdueStyle}">
          <div class="task-icon" style="background:${catColors[t.category]||'#F6F7F9'}">${t.templateIcon||'📋'}</div>
          <div class="task-info">
            <div class="task-name">${t.templateName}</div>
            <div class="task-meta">${t.category} · ${t.dueTime}${metaExtra}</div>
          </div>
          <div class="badge badge-${t.status}">${t.status.charAt(0).toUpperCase()+t.status.slice(1)}</div>
          <div class="task-arrow">›</div>
        </div>`;
      });
      html += '</div>';
    }

    if (tasks.length === 0 && tickets.length === 0) {
      html = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No tasks or tickets today</div><div>Enjoy your day!</div></div>`;
    }

    list.innerHTML = html;

    // Task click handlers
    list.querySelectorAll('[data-task-id]').forEach(item => {
      item.addEventListener('click', () => Tasks.openTask(item.dataset.taskId));
    });
    // Ticket click handlers
    list.querySelectorAll('[data-ticket-id]').forEach(item => {
      item.addEventListener('click', () => Tasks.openTicketDetail(item.dataset.ticketId));
    });
  },

  applyFilter(filter) {
    this.activeFilter = filter;
    document.querySelectorAll('.task-item, .ticket-item').forEach(item => {
      if (filter === 'all') { item.classList.remove('hidden'); return; }
      if (item.dataset.taskId)   item.classList.toggle('hidden', item.dataset.filter !== filter);
      if (item.dataset.ticketId) item.classList.toggle('hidden', filter !== 'pending');
    });
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
  },

  async openTicketDetail(ticketId) {
    document.getElementById('task-form-title').textContent = 'Ticket Detail';
    document.getElementById('task-form-badge').className = 'badge badge-blue';
    document.getElementById('task-form-badge').textContent = ticketId;
    document.getElementById('task-form-body').innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink3)">Loading...</div>';
    document.getElementById('task-form-footer').innerHTML = '';
    App.navigate('task-form');
    if (typeof Tickets !== 'undefined') {
      document.getElementById('task-form-body').innerHTML = await Tickets.renderTicketDetail(ticketId);
    } else {
      document.getElementById('task-form-body').innerHTML = '<div class="empty-state">Ticket module not loaded</div>';
    }
  },


  async openTask(taskId) {
    const task = await Data.get('tasks', taskId);
    if (!task) return;
    const template = await Data.get('templates', task.templateId);
    if (!template) return;

    this.currentTask     = task;
    this.currentTemplate = template;
    this.formData        = {};
    this.capturedImages  = {};
    this.taskStartedAt   = null;   // reset on each open

    document.getElementById('task-form-title').textContent = template.name;
    const badge = document.getElementById('task-form-badge');
    badge.className  = 'badge badge-' + task.status;
    badge.textContent = task.status.charAt(0).toUpperCase() + task.status.slice(1);

    const body      = document.getElementById('task-form-body');
    const footer    = document.getElementById('task-form-footer');
    const catColors = { Plumbing:'#EBF2FF', Electrical:'#FFFBEB', Housekeeping:'#ECFDF5', Security:'#F5F3FF' };

    // ── Missed — allow late submission ───────────────────────────────────────
    if (task.status === 'missed') {
      // Treat exactly like pending — worker can still fill & submit
      // The submission will record the actual time and note it was late
      task.status = 'pending'; // reset locally so the form renders normally
      // Show a late banner at top of form
      body.innerHTML = `
        <div style="background:#FFF1F2;border:1.5px solid #E11D48;border-radius:12px;padding:10px 14px;margin-bottom:2px;display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">⚠️</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#E11D48">Submitting late</div>
            <div style="font-size:12px;color:#9F1239;margin-top:2px">This task was past its due time. You can still submit it now.</div>
          </div>
        </div>`;
      // Fall through to normal pending rendering below (appending to body)
      const lateNote = body.innerHTML;
      body.innerHTML = '';
      // We'll prepend lateNote after building formHtml — use a flag
      this._lateBannerHtml = lateNote;
    } else {
      this._lateBannerHtml = '';
    }

    // ── Already completed — show read-only summary ────────────────────────────
    if (task.status === 'completed') {
      const existing = await Data.getAll('submissions');
      const sub = existing.find(s => s.taskId === task.id);
      body.innerHTML = `
        <div class="task-header-info" style="background:${catColors[task.category] || '#F6F7F9'}">
          <div class="task-header-icon">${template.icon}</div>
          <div class="task-header-meta">
            <div class="cat">${task.category} · Due ${task.dueTime}</div>
            <div class="time">Task completed</div>
          </div>
        </div>
        ${sub ? `
        <div class="card" style="background:var(--em-pale);border-color:#6EE7B7">
          <div style="font-size:12px;font-weight:700;color:var(--emerald);margin-bottom:10px">✅ SUBMISSION RECORD</div>
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="color:var(--ink3);padding:5px 0;width:110px">Record ID</td><td style="font-family:var(--fm);font-size:11px">${sub.recordId}</td></tr>
            <tr><td style="color:var(--ink3);padding:5px 0">Start time</td><td style="font-weight:600">${sub.startedAt ? new Date(sub.startedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—'}</td></tr>
            <tr><td style="color:var(--ink3);padding:5px 0">End time</td><td style="font-weight:600">${new Date(sub.submittedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</td></tr>
            <tr><td style="color:var(--ink3);padding:5px 0">Duration</td><td style="font-weight:700;color:var(--blue)">${sub.durationMins != null ? sub.durationMins + ' min' : '—'}</td></tr>
            <tr><td style="color:var(--ink3);padding:5px 0">Submitted</td><td>${new Date(sub.submittedAt).toLocaleString('en-IN')}</td></tr>
          </table>
        </div>` : ''}`;
      footer.innerHTML = `<div style="text-align:center;color:var(--emerald);font-weight:600;padding:4px 0">✅ Task already submitted</div>`;
      App.navigate('task-form');
      return;
    }

    // ── Pending / in-progress — show Start button first ───────────────────────
    const alreadyStarted = !!task.startedAt;
    if (alreadyStarted) {
      // Worker opened task before but didn't submit yet — restore start time
      this.taskStartedAt = task.startedAt;
    }

    let formHtml = `
      <div class="task-header-info" style="background:${catColors[task.category] || '#F6F7F9'}">
        <div class="task-header-icon">${template.icon}</div>
        <div class="task-header-meta">
          <div class="cat">${task.category} · Due ${task.dueTime}</div>
          <div class="time" id="task-timer-label">${alreadyStarted ? '▶ In progress — fill the form and submit' : 'Tap Start to begin this task'}</div>
        </div>
      </div>`;

    // Time tracker bar
    formHtml += `
      <div class="card" id="task-time-card" style="padding:12px 14px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--ink3);letter-spacing:.05em">START TIME</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--fm);color:var(--ink)" id="start-time-display">
              ${alreadyStarted ? new Date(task.startedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—'}
            </div>
          </div>
          <div style="font-size:24px;color:var(--ink3)" id="task-arrow-ico">→</div>
          <div style="text-align:right">
            <div style="font-size:11px;font-weight:700;color:var(--ink3);letter-spacing:.05em">END TIME</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--fm);color:var(--ink)" id="end-time-display">—</div>
          </div>
          <div style="text-align:right;margin-left:16px">
            <div style="font-size:11px;font-weight:700;color:var(--ink3);letter-spacing:.05em">ELAPSED</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--fm);color:var(--blue)" id="elapsed-display">
              ${alreadyStarted ? '…' : '0:00'}
            </div>
          </div>
        </div>
      </div>`;

    // Form fields (disabled until started)
    formHtml += `<div class="card" id="task-fields-card" style="${!alreadyStarted ? 'opacity:.45;pointer-events:none' : ''}">`;
    template.fields.forEach(field => { formHtml += this.renderField(field, false); });
    formHtml += '</div>';

    body.innerHTML = (this._lateBannerHtml || '') + formHtml;
    this.attachFieldListeners(template.fields);

    // Start elapsed timer if already started
    if (alreadyStarted) {
      this._startElapsedTimer();
    }

    // ── Footer buttons ─────────────────────────────────────────────────────────
    if (!alreadyStarted) {
      footer.innerHTML = `<button id="start-task-btn" class="btn btn-primary btn-full btn-lg">▶  Start Task</button>`;
      document.getElementById('start-task-btn').addEventListener('click', () => this.startTask());
    } else {
      footer.innerHTML = `<button id="submit-task-btn" class="btn btn-success btn-full btn-lg">✅  Submit Task</button>`;
      document.getElementById('submit-task-btn').addEventListener('click', () => this.submitTask());
    }

    App.navigate('task-form');
  },

  // ── Start task — record start time ─────────────────────────────────────────
  async startTask() {
    const now  = new Date();
    const task = this.currentTask;
    this.taskStartedAt  = now.toISOString();
    task.startedAt      = this.taskStartedAt;
    task.status         = 'in_progress';
    await Data.set('tasks', task);

    // Update UI
    document.getElementById('start-time-display').textContent =
      now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    document.getElementById('task-timer-label').textContent = '▶ In progress — fill the form and submit';
    const fields = document.getElementById('task-fields-card');
    if (fields) { fields.style.opacity='1'; fields.style.pointerEvents='auto'; }

    // Swap footer button
    document.getElementById('task-form-footer').innerHTML =
      `<button id="submit-task-btn" class="btn btn-success btn-full btn-lg">✅  Submit Task</button>`;
    document.getElementById('submit-task-btn').addEventListener('click', () => this.submitTask());

    // Update badge
    const badge = document.getElementById('task-form-badge');
    badge.className  = 'badge badge-blue';
    badge.textContent = 'In Progress';

    this._startElapsedTimer();
    App.showToast('Task started — timer running');
  },

  // ── Live elapsed timer ─────────────────────────────────────────────────────
  _timerInterval: null,
  _startElapsedTimer() {
    clearInterval(this._timerInterval);
    const start = new Date(this.taskStartedAt || this.currentTask?.startedAt);
    this._timerInterval = setInterval(() => {
      const el = document.getElementById('elapsed-display');
      if (!el) { clearInterval(this._timerInterval); return; }
      const diff = Math.floor((Date.now() - start.getTime()) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      el.textContent = m + ':' + String(s).padStart(2,'0');
    }, 1000);
  },
  _stopElapsedTimer() { clearInterval(this._timerInterval); this._timerInterval = null; },

  renderField(field, disabled = false) {
    const dis = disabled ? 'disabled' : '';
    switch (field.type) {
      case 'text':
        return `<div class="field"><label class="field-label">${field.label}${field.required ? ' *' : ''}</label>
          <input type="text" class="field-input form-field" data-id="${field.id}" placeholder="${field.placeholder || ''}" ${dis}></div>`;
      case 'number':
        return `<div class="field"><label class="field-label">${field.label}${field.required ? ' *' : ''}</label>
          <input type="number" class="field-input form-field" data-id="${field.id}" placeholder="${field.placeholder || ''}" ${dis}></div>`;
      case 'dropdown':
        const opts = ['<option value="">Select...</option>', ...(field.options || []).map(o => `<option value="${o}">${o}</option>`)].join('');
        return `<div class="field"><label class="field-label">${field.label}${field.required ? ' *' : ''}</label>
          <select class="field-input form-field" data-id="${field.id}" ${dis}>${opts}</select></div>`;
      case 'checkbox':
        return `<div class="field"><div style="border:1.5px solid var(--line);border-radius:12px;overflow:hidden">
          <div class="checkbox-row"><input type="checkbox" class="checkbox form-field" data-id="${field.id}" id="chk-${field.id}" ${dis}>
          <label for="chk-${field.id}">${field.label}</label></div></div></div>`;
      case 'image':
        return `<div class="field"><label class="field-label">${field.label}</label>
          <div class="image-upload-area" data-field-id="${field.id}" id="imgup-${field.id}">
            <div class="upload-icon">📷</div>
            <div class="upload-label">Tap to capture or upload</div>
            <div class="upload-hint">JPG, PNG up to 10MB</div>
            <input type="file" accept="image/*" capture="environment" style="display:none" id="file-${field.id}">
          </div></div>`;
      case 'date':
        return `<div class="field"><label class="field-label">${field.label}${field.required ? ' *' : ''}</label>
          <input type="date" class="field-input form-field" data-id="${field.id}" ${dis}></div>`;
      case 'time':
        return `<div class="field"><label class="field-label">${field.label}${field.required ? ' *' : ''}</label>
          <input type="time" class="field-input form-field" data-id="${field.id}" ${dis}></div>`;
      default:
        return '';
    }
  },

  attachFieldListeners(fields) {
    document.querySelectorAll('.form-field').forEach(el => {
      el.addEventListener('change', () => {
        const id = el.dataset.id;
        if (el.type === 'checkbox') this.formData[id] = el.checked;
        else this.formData[id] = el.value;
      });
      el.addEventListener('input', () => {
        if (el.type !== 'checkbox') this.formData[el.dataset.id] = el.value;
      });
    });

    // Image uploads
    fields.filter(f => f.type === 'image').forEach(field => {
      const area = document.getElementById('imgup-' + field.id);
      const input = document.getElementById('file-' + field.id);
      if (!area || !input) return;
      area.addEventListener('click', () => input.click());
      input.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          this.capturedImages[field.id] = { dataUrl: ev.target.result, name: file.name, type: file.type };
          area.classList.add('has-file');
          area.querySelector('.upload-icon').textContent = '🖼️';
          area.querySelector('.upload-label').textContent = file.name;
          area.querySelector('.upload-hint').textContent = `${(file.size / 1024).toFixed(0)} KB · Tap to change`;
        };
        reader.readAsDataURL(file);
      });
    });
  },

  validateForm() {
    if (!this.currentTemplate) return true;
    for (const field of this.currentTemplate.fields) {
      if (field.required && field.type !== 'checkbox' && field.type !== 'image') {
        const val = this.formData[field.id];
        if (!val || val.trim() === '') {
          App.showToast(`Please fill: ${field.label}`);
          return false;
        }
      }
    }
    return true;
  },

  async submitTask() {
    if (!this.validateForm()) return;
    const task = this.currentTask;
    const user = Auth.currentUser;
    const btn  = document.getElementById('submit-task-btn');
    if (btn) { btn.textContent = 'Submitting...'; btn.disabled = true; }

    // ── Time tracking ─────────────────────────────────────────────────────────
    const endedAt    = new Date().toISOString();
    const startedAt  = this.taskStartedAt || task.startedAt || null;
    const durationMins = startedAt
      ? Math.round((new Date(endedAt) - new Date(startedAt)) / 60000)
      : null;

    // Update end-time display before navigate away
    const endEl = document.getElementById('end-time-display');
    if (endEl) endEl.textContent = new Date(endedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    this._stopElapsedTimer();

    const recordId  = this.buildRecordId(user.id, task.templateId, task.date);
    const imageUrls = {};
    for (const [fieldId, img] of Object.entries(this.capturedImages)) {
      imageUrls[fieldId] = img.dataUrl;
    }

    const submission = {
      recordId,
      taskId:       task.id,
      workerId:     user.id,
      workerName:   user.name,
      templateId:   task.templateId,
      taskName:     task.templateName,
      category:     task.category,
      date:         task.date,
      status:       'completed',
      formData:     { ...this.formData },
      imageUrls,
      startedAt,              // ← task start time
      submittedAt:  endedAt,  // ← task end time
      durationMins,           // ← calculated duration in minutes
      synced:       navigator.onLine,
      communityId:  user.communityId,
    };

    await Data.set('submissions', submission);

    // Update task with all time fields
    task.status       = 'completed';
    task.startedAt    = startedAt;
    task.completedAt  = endedAt;
    task.durationMins = durationMins;
    await Data.set('tasks', task);

    if (!navigator.onLine) {
      await Data.set('queue', { recordId, ...submission });
      App.showToast('Saved locally — will sync when online');
    } else {
      Sync.syncSubmission(submission);
      App.showToast('Submitted & synced ✓');
    }

    this.showSuccess(recordId, submission.synced, startedAt, endedAt, durationMins);
  },

  showSuccess(recordId, synced, startedAt, endedAt, durationMins) {
    const body = document.getElementById('task-form-body');
    const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
    const durLabel = durationMins != null
      ? (durationMins < 60
          ? durationMins + ' min'
          : Math.floor(durationMins/60) + 'h ' + (durationMins%60) + 'm')
      : '—';

    body.innerHTML = `
      <div class="success-screen">
        <div class="success-icon">✅</div>
        <div class="success-title">Task Submitted!</div>
        <div class="success-sub">${this.currentTemplate?.name || 'Task'} · Saved successfully</div>
        <div class="record-id">${recordId}</div>

        <div style="background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;width:100%;margin-bottom:12px;text-align:left">
          <div style="font-size:11px;font-weight:700;color:var(--ink3);letter-spacing:.06em;margin-bottom:10px">TIME RECORD</div>
          <div style="display:flex;justify-content:space-around;text-align:center">
            <div>
              <div style="font-size:11px;color:var(--ink3);font-weight:600;margin-bottom:4px">STARTED</div>
              <div style="font-size:16px;font-weight:700;font-family:var(--fm);color:var(--ink)">${fmtTime(startedAt)}</div>
            </div>
            <div style="color:var(--ink3);font-size:20px;padding-top:8px">→</div>
            <div>
              <div style="font-size:11px;color:var(--ink3);font-weight:600;margin-bottom:4px">ENDED</div>
              <div style="font-size:16px;font-weight:700;font-family:var(--fm);color:var(--ink)">${fmtTime(endedAt)}</div>
            </div>
            <div style="border-left:1px solid var(--line);padding-left:16px">
              <div style="font-size:11px;color:var(--ink3);font-weight:600;margin-bottom:4px">DURATION</div>
              <div style="font-size:16px;font-weight:700;font-family:var(--fm);color:var(--blue)">${durLabel}</div>
            </div>
          </div>
        </div>

        <div class="sync-status ${synced ? 'online' : 'offline'}" style="margin-bottom:20px">
          ${synced ? '✓ Synced to Google Sheets' : '📶 Saved offline — will sync when online'}
        </div>
        <div style="display:flex;gap:8px;width:100%">
          <button class="btn btn-outline btn-md flex-1" id="back-after-submit">← Home</button>
          <button class="btn btn-primary btn-md flex-1" id="next-task-btn" style="display:none">Next Task →</button>
        </div>
      </div>
    `;
    document.getElementById('task-form-footer').innerHTML = '';
    document.getElementById('task-form-badge').className  = 'badge badge-completed';
    document.getElementById('task-form-badge').textContent = 'Completed';

    // FIX 5: Show "Next Task" button if there's a pending task remaining today
    const remaining = (Tasks._todayTasks || []).filter(t => t.status === 'pending' && t.id !== (Tasks.currentTask?.id));
    const nextTask  = remaining[0];
    if (nextTask) {
      const nextBtn = document.getElementById('next-task-btn');
      if (nextBtn) {
        nextBtn.style.display = 'block';
        nextBtn.textContent   = 'Next: ' + nextTask.templateName.slice(0, 18) + (nextTask.templateName.length > 18 ? '…' : '') + ' →';
        nextBtn.addEventListener('click', () => Tasks.openTask(nextTask.id));
      }
    }

    document.getElementById('back-after-submit').addEventListener('click', () => {
      App.navigate('worker-home');
      Tasks.loadWorkerHome();
    });
  },

  async loadHistory() {
    const user = Auth.currentUser;
    const allTasks = await Data.getAll('tasks').then(a=>a.filter(t=>t.workerId===user.id));
    const today = this.getToday();
    const past = allTasks.filter(t => t.date <= today).sort((a, b) => b.date.localeCompare(a.date) || a.dueTime.localeCompare(b.dueTime));

    const list = document.getElementById('worker-history-list');
    if (past.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No history yet</div></div>`;
      return;
    }

    // FIX 6: Stats summary at the top of history
    const weekAgo    = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr    = weekAgo.toISOString().split('T')[0];
    const weekTasks  = past.filter(t => t.date >= weekStr);
    const weekDone   = weekTasks.filter(t => t.status === 'completed').length;
    const weekTotal  = weekTasks.length;
    const weekPct    = weekTotal > 0 ? Math.round(weekDone / weekTotal * 100) : 0;
    const durations  = past.filter(t => t.durationMins != null).map(t => t.durationMins);
    const avgDur     = durations.length ? Math.round(durations.reduce((a,b) => a+b, 0) / durations.length) : null;
    const allDone    = past.filter(t => t.status === 'completed').length;
    const allTotal   = past.length;
    const allPct     = allTotal > 0 ? Math.round(allDone / allTotal * 100) : 0;

    list.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:12px 14px 4px">
        <div style="background:var(--surface);border-radius:12px;padding:10px 12px;text-align:center;border:1px solid var(--line)">
          <div style="font-size:20px;font-weight:700;color:var(--emerald)">${weekPct}%</div>
          <div style="font-size:10px;color:var(--ink3);font-weight:600;margin-top:2px">THIS WEEK</div>
        </div>
        <div style="background:var(--surface);border-radius:12px;padding:10px 12px;text-align:center;border:1px solid var(--line)">
          <div style="font-size:20px;font-weight:700;color:var(--blue)">${avgDur != null ? avgDur + 'm' : '—'}</div>
          <div style="font-size:10px;color:var(--ink3);font-weight:600;margin-top:2px">AVG TIME</div>
        </div>
        <div style="background:var(--surface);border-radius:12px;padding:10px 12px;text-align:center;border:1px solid var(--line)">
          <div style="font-size:20px;font-weight:700;color:var(--ink)">${allPct}%</div>
          <div style="font-size:10px;color:var(--ink3);font-weight:600;margin-top:2px">ALL TIME</div>
        </div>
      </div>`;

    // Group by date
    const grouped = {};
    past.forEach(t => { if (!grouped[t.date]) grouped[t.date] = []; grouped[t.date].push(t); });

    let html = '';
    const catColors = { Plumbing: '#EBF2FF', Electrical: '#FFFBEB', Housekeeping: '#ECFDF5', Security: '#F5F3FF' };
    for (const [date, tasks] of Object.entries(grouped)) {
      const d = new Date(date + 'T12:00:00');
      html += `<div class="task-group-header">${date === today ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>`;
      html += `<div style="background:var(--surface);border-top:1px solid var(--line)">`;
      tasks.forEach(t => {
        const icons    = { completed:'✅', missed:'❌', pending:'⏳' };
        const durLabel = t.durationMins != null
          ? (t.durationMins < 60 ? t.durationMins+'m' : Math.floor(t.durationMins/60)+'h '+(t.durationMins%60)+'m')
          : '';
        html += `<div class="history-item">
          <div class="hist-icon" style="background:${catColors[t.category] || '#F6F7F9'}">${t.templateIcon || icons[t.status]}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.templateName}</div>
            <div style="font-size:12px;color:var(--ink3);margin-top:2px">${t.category} · ${t.dueTime}
              ${durLabel ? `<span style="margin-left:8px;color:var(--blue);font-weight:600">⏱ ${durLabel}</span>` : ''}
            </div>
          </div>
          <div class="badge badge-${t.status}">${t.status.charAt(0).toUpperCase() + t.status.slice(1)}</div>
        </div>`;
      });
      html += `</div>`;
    }
    list.innerHTML += html;
  },

  renderWorkerSettings() {
    const user = Auth.currentUser;
    const body = document.getElementById('worker-settings-body');
    const lang = localStorage.getItem('ac_lang') || 'en';
    body.innerHTML = `
      <div class="card profile-card">
        <div class="profile-avatar" style="background:${user.avatarBg};color:${user.avatarColor}">${user.initials}</div>
        <div>
          <div class="profile-name">${user.name}</div>
          <div class="profile-role">${user.role.charAt(0).toUpperCase() + user.role.slice(1)} · ${user.category} · ${user.id}</div>
        </div>
      </div>

      <div class="section-header">Language / భాష</div>
      <div class="card">
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="chip ${lang === 'en' ? 'selected' : ''}" id="lang-en">🇮🇳 English</button>
          <button class="chip ${lang === 'te' ? 'selected' : ''}" id="lang-te" style="font-family:var(--ft)">తెలుగు</button>
        </div>
        <div class="lang-preview-box" id="lang-preview">
          <div style="font-size:14px;font-weight:600" id="lp-title">${lang === 'te' ? 'నేటి పనులు' : "Today's tasks"}</div>
          <div style="font-size:12px;color:var(--ink3);margin-top:4px" id="lp-sub">${lang === 'te' ? 'పని సమర్పించు · పెండింగ్ · పూర్తయింది' : 'Submit task · Pending · Completed'}</div>
        </div>
      </div>

      <div class="section-header">Security</div>
      <div class="card" id="pin-section">
        <button class="btn btn-outline btn-full btn-md" id="change-pin-toggle">🔑 Change PIN</button>
        <div id="pin-change-form" style="display:none;margin-top:14px">
          <div class="field"><label class="field-label">Current PIN</label><input type="password" class="field-input" id="old-pin" maxlength="6" inputmode="numeric" placeholder="••••"></div>
          <div class="field"><label class="field-label">New PIN</label><input type="password" class="field-input" id="new-pin" maxlength="6" inputmode="numeric" placeholder="••••"></div>
          <div class="field"><label class="field-label">Confirm New PIN</label><input type="password" class="field-input" id="confirm-pin" maxlength="6" inputmode="numeric" placeholder="••••"></div>
          <div id="pin-change-error" class="error-msg"></div>
          <button class="btn btn-primary btn-full btn-md" id="save-pin-btn">Update PIN</button>
        </div>
      </div>

      <div class="section-header">Notifications</div>
      <div class="card">
        <div class="settings-item">
          <span class="settings-item-label">Task reminders</span>
          <button class="toggle ${localStorage.getItem('ac_notif') !== 'off' ? 'on' : ''}" id="notif-toggle"></button>
        </div>
        <div class="settings-item" style="border:none">
          <span class="settings-item-label">Missed task alerts</span>
          <button class="toggle on" id="missed-toggle"></button>
        </div>
      </div>

      <div class="section-header">Account</div>
      <div class="card">
        <button class="btn btn-danger btn-full btn-md" id="logout-btn">Sign Out</button>
      </div>
    `;

    // Lang switch
    document.getElementById('lang-en').addEventListener('click', () => {
      localStorage.setItem('ac_lang', 'en');
      document.getElementById('lang-en').classList.add('selected');
      document.getElementById('lang-te').classList.remove('selected');
      document.getElementById('lp-title').textContent = "Today's tasks";
      document.getElementById('lp-sub').textContent = 'Submit task · Pending · Completed';
    });
    document.getElementById('lang-te').addEventListener('click', () => {
      localStorage.setItem('ac_lang', 'te');
      document.getElementById('lang-te').classList.add('selected');
      document.getElementById('lang-en').classList.remove('selected');
      document.getElementById('lp-title').textContent = 'నేటి పనులు';
      document.getElementById('lp-title').style.fontFamily = 'var(--ft)';
      document.getElementById('lp-sub').textContent = 'పని సమర్పించు · పెండింగ్ · పూర్తయింది';
      document.getElementById('lp-sub').style.fontFamily = 'var(--ft)';
    });

    // PIN change
    document.getElementById('change-pin-toggle').addEventListener('click', () => {
      const form = document.getElementById('pin-change-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('save-pin-btn').addEventListener('click', async () => {
      const old = document.getElementById('old-pin').value;
      const nw = document.getElementById('new-pin').value;
      const cf = document.getElementById('confirm-pin').value;
      const err = document.getElementById('pin-change-error');
      err.textContent = '';
      if (nw !== cf) { err.textContent = 'PINs do not match'; return; }
      try {
        await Auth.changePin(user.id, old, nw);
        App.showToast('PIN updated successfully!');
        document.getElementById('pin-change-form').style.display = 'none';
      } catch (e) { err.textContent = e.message; }
    });

    // Toggles
    document.getElementById('notif-toggle').addEventListener('click', function() {
      this.classList.toggle('on');
      localStorage.setItem('ac_notif', this.classList.contains('on') ? 'on' : 'off');
    });
    document.getElementById('missed-toggle').addEventListener('click', function() {
      this.classList.toggle('on');
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
      Auth.logout();
      App.navigate('login');
    });
  },
};
