'use strict';
const Admin = {
  currentTab: 'dashboard',
  assignState: { step:1, templates:[], workers:[], frequency:'Daily', startDate:'', endDate:'', dueTime:'08:00' },
  _tempFields: [],
  _assignWorkers: [],
  _renderFieldsList: null,

  init() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        this.renderTab(tab.dataset.tab);
      });
    });
    document.getElementById('admin-logout-btn').addEventListener('click', () => {
      Auth.logout(); App.navigate('login');
    });
    this.renderTab('dashboard');
  },

  async renderTab(tab) {
    const content = document.getElementById('admin-content');
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink3)">Loading...</div>';
    switch(tab) {
      case 'dashboard': await this.renderDashboard(); break;
      case 'workers':   await this.renderWorkers();   break;
      case 'templates': await this.renderTemplates(); break;
      case 'assign':    this.startAssignWizard();     break;
      case 'calendar':  await this.renderAdminCalendar(); break;
      case 'tickets':   await this.renderTickets();  break;
      case 'settings':  await this.renderSettings();  break;
    }
  },

  async renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const allTasks = await Data.getAll('tasks');
    const todayTasks = allTasks.filter(t => t.date === today);
    const total   = todayTasks.length;
    const done    = todayTasks.filter(t => t.status === 'completed').length;
    const pending = todayTasks.filter(t => t.status === 'pending').length;
    const missed  = todayTasks.filter(t => t.status === 'missed').length;
    const pct     = total > 0 ? Math.round(done / total * 100) : 0;
    const workers = await Data.getAll('workers');
    const active  = workers.filter(w => w.role !== 'admin' && w.isActive);
    const wStats  = active.map(w => {
      const wt        = todayTasks.filter(t => t.workerId === w.id);
      const completed = wt.filter(t => t.status === 'completed');
      const durations = completed.filter(t => t.durationMins != null).map(t => t.durationMins);
      const avgDur    = durations.length ? Math.round(durations.reduce((a,b)=>a+b,0)/durations.length) : null;
      return { ...w, total: wt.length, done: completed.length, avgDur };
    }).filter(w => w.total > 0);

    document.getElementById('admin-content').innerHTML = `
      <div style="font-size:12px;font-weight:500;color:var(--ink3);margin-bottom:10px">
        Today · ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number" style="color:var(--blue)">${total}</div><div class="stat-label">Assigned</div></div>
        <div class="stat-card"><div class="stat-number" style="color:var(--emerald)">${done}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card"><div class="stat-number" style="color:var(--amber)">${pending}</div><div class="stat-label">Pending</div></div>
        <div class="stat-card"><div class="stat-number" style="color:var(--rose)">${missed}</div><div class="stat-label">Missed</div></div>
      </div>
      <div class="card">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">Completion Rate</div>
        <div class="progress-big-num" style="color:var(--emerald)">${pct}%</div>
        <div class="prog-bar-full"><div class="prog-bar-fill" style="background:var(--emerald);width:${pct}%"></div></div>
        <div class="prog-foot"><span>${done} done</span><span>${total - done} remaining</span></div>
      </div>
      <div class="section-header">Worker Performance</div>
      <div class="rounded" style="background:var(--surface)">
        ${wStats.length === 0
          ? '<div style="padding:16px;text-align:center;color:var(--ink3)">No tasks assigned today</div>'
          : wStats.map(w => {
              const p = w.total > 0 ? Math.round(w.done / w.total * 100) : 0;
              const col = p >= 80 ? 'var(--emerald)' : p >= 50 ? 'var(--amber)' : 'var(--rose)';
              return `<div class="perf-row">
                <div class="worker-avatar" style="width:38px;height:38px;background:${w.avatarBg};color:${w.avatarColor}">${w.initials}</div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:baseline;gap:8px">
                    <div style="font-size:13px;font-weight:600">${w.name}</div>
                    ${w.avgDur != null ? `<div style="font-size:11px;color:var(--blue);font-weight:600">⏱ avg ${w.avgDur}m</div>` : ''}
                  </div>
                  <div class="perf-bar"><div class="perf-fill" style="background:${col};width:${p}%"></div></div>
                </div>
                <div style="font-size:13px;font-weight:700;color:${col}">${w.done}/${w.total}</div>
              </div>`;
            }).join('')}
      </div>`;
  },

  async renderWorkers() {
    const workers = await Data.getAll('workers');
    const list = workers.filter(w => w.role !== 'admin');
    document.getElementById('admin-content').innerHTML = `
      <button class="btn btn-primary btn-sm" id="add-worker-btn" style="margin-bottom:12px">+ Add Worker</button>
      <div class="rounded" style="background:var(--surface)">
        ${list.map(w => `
          <div class="worker-list-item">
            <div class="worker-avatar" style="background:${w.avatarBg};color:${w.avatarColor}">${w.initials}</div>
            <div class="worker-info">
              <div class="worker-name">${w.name}</div>
              <div class="worker-meta">${w.category} · ${w.mobile}</div>
            </div>
            <div class="worker-actions">
              <span class="badge ${w.isActive ? 'badge-done' : 'badge-gray'}">${w.isActive ? 'Active' : 'Inactive'}</span>
              <button class="btn btn-sm btn-ghost" onclick="adminEditWorker('${w.id}')">⋯</button>
            </div>
          </div>`).join('')}
      </div>`;
    document.getElementById('add-worker-btn').addEventListener('click', () => this.showAddWorkerScreen());
  },

  showAddWorkerScreen() {
    document.getElementById('add-worker-body').innerHTML = `
      <div class="card">
        <div class="field"><label class="field-label">Full Name *</label>
          <input type="text" class="field-input" id="aw-name" placeholder="Worker full name"></div>
        <div class="field"><label class="field-label">Mobile Number *</label>
          <input type="tel" class="field-input" id="aw-mobile" placeholder="10-digit mobile" maxlength="10" inputmode="numeric"></div>
        <div class="field"><label class="field-label">Category *</label>
          <select class="field-input" id="aw-cat">
            <option value="Plumbing">Plumbing</option>
            <option value="Electrical">Electrical</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="Security">Security</option>
          </select></div>
        <div class="field"><label class="field-label">Role</label>
          <select class="field-input" id="aw-role">
            <option value="worker">Worker</option>
            <option value="supervisor">Supervisor</option>
          </select></div>
        <div class="field"><label class="field-label">Default PIN * (4–6 digits)</label>
          <input type="password" class="field-input" id="aw-pin" maxlength="6" inputmode="numeric" placeholder="••••"></div>
        <div id="aw-error" class="error-msg"></div>
        <button class="btn btn-success btn-full btn-lg" id="aw-save-btn">Create Worker</button>
      </div>`;
    App.navigate('admin-add-worker');
    document.getElementById('aw-save-btn').addEventListener('click', async () => {
      const name   = document.getElementById('aw-name').value.trim();
      const mobile = document.getElementById('aw-mobile').value.trim();
      const cat    = document.getElementById('aw-cat').value;
      const role   = document.getElementById('aw-role').value;
      const pin    = document.getElementById('aw-pin').value.trim();
      const err    = document.getElementById('aw-error');
      err.textContent = '';
      if (!name)                      { err.textContent = 'Name is required'; return; }
      if (!/^\d{10}$/.test(mobile))   { err.textContent = 'Enter valid 10-digit mobile'; return; }
      if (pin.length < 4)             { err.textContent = 'PIN must be at least 4 digits'; return; }
      const all = await Data.getAll('workers');
      if (all.find(w => w.mobile === mobile)) { err.textContent = 'Mobile already registered'; return; }
      const id       = 'WK-' + String(all.length + 1).padStart(4, '0');
      const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
      const palettes = [['#EBF2FF','#1B6EF3'],['#ECFDF5','#059669'],['#FFF1F2','#E11D48'],['#F5F3FF','#7C3AED'],['#FFFBEB','#D97706']];
      const [bg, fg] = palettes[all.length % palettes.length];
      await Data.set('workers', { id, name, mobile, pinHash: pin, role, category: cat, isActive: true, communityId: 'COMM-001', initials, avatarBg: bg, avatarColor: fg, createdAt: new Date().toISOString() });
      App.showToast(name + ' added!');
      App.navigate('admin-home');
      Admin.renderTab('workers');
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'workers'));
    });
  },

  async editWorker(workerId) {
    const w = await Data.get('workers', workerId);
    if (!w) return;
    App.showDialog(w.name, `Mobile: ${w.mobile} | Category: ${w.category} | ${w.isActive ? 'Active' : 'Inactive'}`, [
      {
        label: w.isActive ? 'Deactivate' : 'Activate', class: 'btn-warn',
        action: async () => { w.isActive = !w.isActive; await Data.set('workers', w); Admin.renderTab('workers'); App.showToast(w.name + (w.isActive ? ' activated' : ' deactivated')); }
      },
      {
        label: 'Reset PIN', class: 'btn-outline',
        action: () => App.showInputDialog('Reset PIN', 'Enter new 4-6 digit PIN for ' + w.name, 'New PIN', async val => {
          if (!val || val.length < 4) { App.showToast('PIN must be at least 4 digits'); return; }
          await Auth.resetPin(workerId, val);
          App.showToast('PIN reset for ' + w.name);
        })
      },
    ]);
  },

  async renderTemplates() {
    const templates = (await Data.getAll('templates')).filter(t => !t.isDeleted);
    const cats = ['Plumbing','Electrical','Housekeeping','Security'];
    let html = `<button class="btn btn-primary btn-sm" id="add-tpl-btn" style="margin-bottom:12px">+ New Template</button>`;
    cats.forEach(cat => {
      const ct = templates.filter(t => t.category === cat);
      if (!ct.length) return;
      html += `<div class="section-header">${cat}</div>`;
      ct.forEach(t => {
        html += `<div class="tpl-card" style="border-left-color:${t.borderColor || '#1B6EF3'}">
          <div class="tpl-name">${t.icon} ${t.name}</div>
          <div class="tpl-meta">${t.fields.length} fields · Active</div>
          <div class="tpl-actions">
            <button class="btn btn-sm btn-ghost" onclick="adminEditTemplate('${t.id}')">Edit</button>
            <button class="btn btn-sm btn-ghost" onclick="adminDupTemplate('${t.id}')">Duplicate</button>
            <button class="btn btn-sm btn-danger" onclick="adminDelTemplate('${t.id}')">Delete</button>
          </div></div>`;
      });
    });
    document.getElementById('admin-content').innerHTML = html;
    document.getElementById('add-tpl-btn').addEventListener('click', () => this.showTemplateEditor(null));
  },

  showTemplateEditor(templateId) {
    document.getElementById('add-tpl-title').textContent = templateId ? 'Edit Template' : 'New Template';
    this._tempFields = [];
    document.getElementById('add-tpl-body').innerHTML = `
      <div class="card">
        <div class="field"><label class="field-label">Template Name *</label>
          <input type="text" class="field-input" id="tpl-name" placeholder="e.g. Pump Room Check"></div>
        <div class="field"><label class="field-label">Category *</label>
          <select class="field-input" id="tpl-cat">
            <option value="Plumbing">Plumbing</option>
            <option value="Electrical">Electrical</option>
            <option value="Housekeeping">Housekeeping</option>
            <option value="Security">Security</option>
          </select></div>
        <div class="field"><label class="field-label">Icon (emoji)</label>
          <input type="text" class="field-input" id="tpl-icon" placeholder="e.g. 🔧" maxlength="4"></div>
      </div>
      <div class="section-header">Form Fields</div>
      <div class="card">
        <div id="fields-list" style="margin-bottom:12px"></div>
        <div class="field-label" style="margin-bottom:8px">Add field type:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <button class="chip" onclick="adminAddField('checkbox')">☑ Checkbox</button>
          <button class="chip" onclick="adminAddField('text')">📝 Text</button>
          <button class="chip" onclick="adminAddField('number')">🔢 Number</button>
          <button class="chip" onclick="adminAddField('dropdown')">▼ Dropdown</button>
          <button class="chip" onclick="adminAddField('image')">📷 Photo</button>
          <button class="chip" onclick="adminAddField('date')">📅 Date</button>
        </div>
      </div>
      <div id="tpl-error" class="error-msg"></div>
      <button class="btn btn-success btn-full btn-lg" id="save-tpl-btn" style="margin-bottom:16px">Save Template</button>`;

    this._renderFieldsList = () => {
      const fl = document.getElementById('fields-list');
      if (!fl) return;
      fl.innerHTML = this._tempFields.length === 0
        ? '<div style="color:var(--ink3);font-size:13px;text-align:center;padding:8px">No fields yet</div>'
        : this._tempFields.map((f, i) => `
            <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface2);border-radius:8px;margin-bottom:6px;border:1px solid var(--line)">
              <div style="flex:1"><div style="font-size:13px;font-weight:600">${f.label}</div><div style="font-size:11px;color:var(--ink3)">${f.type}</div></div>
              <button class="btn btn-sm btn-ghost" onclick="adminRemoveField(${i})">✕</button>
            </div>`).join('');
    };
    this._renderFieldsList();
    App.navigate('admin-add-template');

    document.getElementById('save-tpl-btn').addEventListener('click', async () => {
      const name = document.getElementById('tpl-name').value.trim();
      const cat  = document.getElementById('tpl-cat').value;
      const icon = document.getElementById('tpl-icon').value.trim() || '📋';
      const err  = document.getElementById('tpl-error');
      if (!name) { err.textContent = 'Template name is required'; return; }
      if (!this._tempFields.length) { err.textContent = 'Add at least one field'; return; }
      const borders = { Plumbing:'#1B6EF3', Electrical:'#D97706', Housekeeping:'#059669', Security:'#7C3AED' };
      await Data.set('templates', { id: templateId || ('TPL-' + Date.now()), name, category: cat, icon, borderColor: borders[cat], fields: [...this._tempFields], isDeleted: false, createdAt: new Date().toISOString() });
      App.showToast('Template saved!');
      App.navigate('admin-home');
      Admin.renderTab('templates');
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'templates'));
    });
  },

  addField(type) {
    App.showInputDialog('Add ' + type + ' field', 'Enter the field label:', type + ' label', label => {
      if (!label) return;
      const field = { id: 'f' + Date.now(), type, label: label.trim(), required: false };
      if (type === 'dropdown') {
        App.showInputDialog('Dropdown options', 'Enter options separated by comma:', 'Option 1, Option 2', opts => {
          field.options = (opts || 'Option 1').split(',').map(o => o.trim()).filter(Boolean);
          this._tempFields.push(field);
          this._renderFieldsList && this._renderFieldsList();
        });
        return;
      }
      this._tempFields.push(field);
      this._renderFieldsList && this._renderFieldsList();
    });
  },

  removeField(i) {
    this._tempFields.splice(i, 1);
    this._renderFieldsList && this._renderFieldsList();
  },

  async duplicateTemplate(id) {
    const t = await Data.get('templates', id);
    if (!t) return;
    await Data.set('templates', { ...t, id: 'TPL-' + Date.now(), name: t.name + ' (Copy)', createdAt: new Date().toISOString() });
    App.showToast('Template duplicated!');
    this.renderTab('templates');
  },

  async deleteTemplate(id) {
    App.showDialog('Delete Template?', 'This template will no longer be available for new assignments.', [{
      label: 'Delete', class: 'btn-danger',
      action: async () => { const t = await Data.get('templates', id); if (t) { t.isDeleted = true; await Data.set('templates', t); } App.showToast('Deleted'); Admin.renderTab('templates'); }
    }]);
  },

  startAssignWizard() {
    this.assignState = { step:1, templates:[], workers:[], frequency:'Daily', startDate: new Date().toISOString().split('T')[0], endDate:'', dueTime:'08:00' };
    App.navigate('admin-assign');
    this.renderAssignStep(1);
  },

  renderAssignStep(step) {
    this.assignState.step = step;
    document.getElementById('assign-step-label').textContent = `Step ${step}/4`;
    document.getElementById('assign-steps-ui').innerHTML = [1,2,3,4].map((s, i) =>
      `${i > 0 ? `<div class="step-line ${step > s-1 ? 'done' : ''}"></div>` : ''}
       <div class="step-dot ${step > s ? 'done' : step === s ? 'current' : 'upcoming'}">${step > s ? '✓' : s}</div>`
    ).join('');
    const content = document.getElementById('assign-content');
    const footer  = document.getElementById('assign-footer');
    if (step === 1) this.renderAssignStep1(content, footer);
    else if (step === 2) this.renderAssignStep2(content, footer);
    else if (step === 3) this.renderAssignStep3(content, footer);
    else if (step === 4) this.renderAssignStep4(content, footer);
  },

  async renderAssignStep1(content, footer) {
    const templates = (await Data.getAll('templates')).filter(t => !t.isDeleted);
    const sel = this.assignState.templates;
    content.innerHTML = `
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">Select Templates</div>
      <div style="font-size:12px;color:var(--ink3);margin-bottom:14px">Choose one or more task templates</div>
      <div class="rounded" style="background:var(--surface)">
        ${templates.map(t => `
          <div class="selectable ${sel.includes(t.id) ? 'selected' : ''}" data-tpl-id="${t.id}">
            <input type="checkbox" ${sel.includes(t.id) ? 'checked' : ''}>
            <div style="font-size:18px">${t.icon}</div>
            <div><div style="font-size:13px;font-weight:600">${t.name}</div>
              <div style="font-size:11px;color:var(--ink3)">${t.category} · ${t.fields.length} fields</div></div>
          </div>`).join('')}
      </div>`;
    footer.innerHTML = `
      <div style="font-size:12px;color:var(--ink3);margin-bottom:8px" id="tpl-sel-count">${sel.length} selected</div>
      <button class="btn btn-primary btn-full btn-lg" id="as-next1">Next: Select Workers →</button>`;
    content.querySelectorAll('.selectable').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.tplId, chk = el.querySelector('input');
        chk.checked = !chk.checked;
        chk.checked ? (!sel.includes(id) && sel.push(id), el.classList.add('selected')) : (sel.splice(sel.indexOf(id), 1), el.classList.remove('selected'));
        const c = document.getElementById('tpl-sel-count'); if (c) c.textContent = sel.length + ' selected';
      });
    });
    document.getElementById('as-next1').addEventListener('click', () => {
      if (!sel.length) { App.showToast('Select at least one template'); return; }
      Admin.renderAssignStep(2);
    });
  },

  async renderAssignStep2(content, footer) {
    const workers = (await Data.getAll('workers')).filter(w => w.role !== 'admin' && w.isActive);
    this._assignWorkers = workers;
    const sel = this.assignState.workers;
    content.innerHTML = `
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">Select Workers</div>
      <div style="font-size:12px;color:var(--ink3);margin-bottom:10px">Assign to individuals or teams</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-ghost btn-sm" onclick="adminSelAllWorkers()">All Workers</button>
        <button class="btn btn-ghost btn-sm" onclick="adminSelWorkerGroup('Plumbing')">🚰 Plumbing</button>
        <button class="btn btn-ghost btn-sm" onclick="adminSelWorkerGroup('Electrical')">⚡ Electrical</button>
        <button class="btn btn-ghost btn-sm" onclick="adminSelWorkerGroup('Housekeeping')">🧹 HK</button>
        <button class="btn btn-ghost btn-sm" onclick="adminSelWorkerGroup('Security')">🔒 Security</button>
      </div>
      <div class="rounded" style="background:var(--surface)" id="worker-sel-list">
        ${workers.map(w => `
          <div class="selectable ${sel.includes(w.id) ? 'selected' : ''}" data-worker-id="${w.id}">
            <input type="checkbox" ${sel.includes(w.id) ? 'checked' : ''}>
            <div class="worker-avatar" style="width:34px;height:34px;background:${w.avatarBg};color:${w.avatarColor};font-size:12px">${w.initials}</div>
            <div><div style="font-size:13px;font-weight:600">${w.name}</div>
              <div style="font-size:11px;color:var(--ink3)">${w.category}</div></div>
          </div>`).join('')}
      </div>`;
    footer.innerHTML = `
      <div style="font-size:12px;color:var(--ink3);margin-bottom:8px" id="wk-sel-count">${sel.length} workers selected</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-md" onclick="Admin.renderAssignStep(1)">← Back</button>
        <button class="btn btn-primary btn-md flex-1" id="as-next2">Next: Schedule →</button>
      </div>`;
    content.querySelectorAll('.selectable').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.workerId, chk = el.querySelector('input');
        chk.checked = !chk.checked;
        chk.checked ? (!sel.includes(id) && sel.push(id), el.classList.add('selected')) : (sel.splice(sel.indexOf(id), 1), el.classList.remove('selected'));
        const c = document.getElementById('wk-sel-count'); if (c) c.textContent = sel.length + ' workers selected';
      });
    });
    document.getElementById('as-next2').addEventListener('click', () => {
      if (!sel.length) { App.showToast('Select at least one worker'); return; }
      Admin.renderAssignStep(3);
    });
  },

  selectAllWorkers() {
    this._assignWorkers.forEach(w => { if (!this.assignState.workers.includes(w.id)) this.assignState.workers.push(w.id); });
    document.querySelectorAll('#worker-sel-list .selectable').forEach(el => { el.classList.add('selected'); el.querySelector('input').checked = true; });
    const c = document.getElementById('wk-sel-count'); if (c) c.textContent = this.assignState.workers.length + ' workers selected';
  },

  selectWorkerGroup(cat) {
    this._assignWorkers.filter(w => w.category === cat).forEach(w => {
      if (!this.assignState.workers.includes(w.id)) this.assignState.workers.push(w.id);
      const el = document.querySelector(`[data-worker-id="${w.id}"]`);
      if (el) { el.classList.add('selected'); el.querySelector('input').checked = true; }
    });
    const c = document.getElementById('wk-sel-count'); if (c) c.textContent = this.assignState.workers.length + ' workers selected';
  },

  renderAssignStep3(content, footer) {
    const s = this.assignState;
    content.innerHTML = `
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">Set Schedule</div>
      <div style="font-size:12px;color:var(--ink3);margin-bottom:14px">Choose when tasks should repeat</div>
      <div class="field"><label class="field-label">Frequency</label>
        <div class="freq-grid">
          ${['Daily','Weekly','Monthly','Ad-hoc','Once'].map(f =>
            `<button class="freq-btn ${s.frequency===f?'active':''}" onclick="adminSetFreq('${f}',this)">${f}</button>`
          ).join('')}
        </div></div>
      <div class="field"><label class="field-label">Start Date *</label>
        <input type="date" class="field-input" id="as-start" value="${s.startDate}"></div>
      <div class="field"><label class="field-label">End Date (optional)</label>
        <input type="date" class="field-input" id="as-end" value="${s.endDate}"></div>
      <div class="field"><label class="field-label">Due Time</label>
        <input type="time" class="field-input" id="as-time" value="${s.dueTime}"></div>
      <div class="field"><label class="field-label">Priority</label>
        <select class="field-input"><option>Normal</option><option>High</option><option>Urgent</option></select></div>`;
    footer.innerHTML = `
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-md" onclick="Admin.renderAssignStep(2)">← Back</button>
        <button class="btn btn-primary btn-md flex-1" id="as-next3">Review →</button>
      </div>`;
    document.getElementById('as-next3').addEventListener('click', () => {
      s.startDate = document.getElementById('as-start').value;
      s.endDate   = document.getElementById('as-end').value;
      s.dueTime   = document.getElementById('as-time').value;
      if (!s.startDate) { App.showToast('Start date is required'); return; }
      Admin.renderAssignStep(4);
    });
  },

  setFreq(freq, btn) {
    this.assignState.frequency = freq;
    document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },

  async renderAssignStep4(content, footer) {
    const s = this.assignState;
    const templates = await Promise.all(s.templates.map(id => DB.get('templates', id)));
    const workers   = await Promise.all(s.workers.map(id => DB.get('workers', id)));
    const days  = (s.startDate && s.endDate) ? Math.max(1, Math.ceil((new Date(s.endDate) - new Date(s.startDate)) / 86400000) + 1) : 1;
    const total = s.templates.length * s.workers.length * (s.frequency === 'Daily' ? days : 1);
    content.innerHTML = `
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">Review & Confirm</div>
      <div style="font-size:12px;color:var(--ink3);margin-bottom:14px">Check before creating task instances</div>
      <div class="card" style="background:#ECFDF5;border-color:#6EE7B7">
        <div style="font-size:12px;font-weight:700;color:var(--emerald);margin-bottom:12px">ASSIGNMENT SUMMARY</div>
        <div class="review-row"><span class="review-label">Templates</span><span class="review-value">${s.templates.length}</span></div>
        <div class="review-row"><span class="review-label">Workers</span><span class="review-value">${s.workers.length}</span></div>
        <div class="review-row"><span class="review-label">Frequency</span><span class="review-value">${s.frequency}</span></div>
        <div class="review-row"><span class="review-label">Start</span><span class="review-value">${s.startDate}</span></div>
        <div class="review-row"><span class="review-label">End</span><span class="review-value">${s.endDate || 'Open'}</span></div>
        <div class="review-row"><span class="review-label">Due Time</span><span class="review-value">${s.dueTime}</span></div>
        <div class="review-row" style="border-top:2px solid rgba(5,150,105,.2);padding-top:12px;margin-top:4px">
          <span style="font-weight:600">Total instances</span>
          <span class="review-total">${total}</span>
        </div>
      </div>
      <div class="card">
        <div style="font-size:12px;font-weight:600;margin-bottom:8px">Templates</div>
        ${templates.map(t => t ? `<div style="font-size:13px;padding:5px 0;border-bottom:1px solid var(--line)">${t.icon} ${t.name}</div>` : '').join('')}
      </div>
      <div class="card">
        <div style="font-size:12px;font-weight:600;margin-bottom:8px">Workers</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${workers.map(w => w ? `<span class="badge badge-blue">${w.name}</span>` : '').join('')}</div>
      </div>`;
    footer.innerHTML = `
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-md" onclick="Admin.renderAssignStep(3)">← Back</button>
        <button class="btn btn-success btn-md flex-1" id="as-create">Create ${total} Tasks 🚀</button>
      </div>`;
    document.getElementById('as-create').addEventListener('click', () => Admin.createTaskInstances(templates, workers, days));
  },

  async createTaskInstances(templates, workers, days) {
    const s = this.assignState;
    const btn = document.getElementById('as-create');
    if (btn) { btn.textContent = 'Creating...'; btn.disabled = true; }
    let created = 0;
    const start = new Date(s.startDate + 'T00:00:00');
    const iters = s.frequency === 'Daily' ? days : 1;
    for (let d = 0; d < iters; d++) {
      const dt = new Date(start); dt.setDate(dt.getDate() + d);
      const dateStr = dt.toISOString().split('T')[0];
      for (const tpl of templates) {
        if (!tpl) continue;
        for (const worker of workers) {
          if (!worker) continue;
          const taskId = `${worker.id}-${tpl.id}-${dateStr}`;
          if (await Data.get('tasks', taskId)) continue;
          await Data.set('tasks', { id: taskId, workerId: worker.id, templateId: tpl.id, templateName: tpl.name, templateIcon: tpl.icon, category: tpl.category, date: dateStr, dueTime: s.dueTime, status: 'pending', communityId: worker.communityId || 'COMM-001', assignedAt: new Date().toISOString() });
          created++;
        }
      }
    }
    App.showToast(created + ' tasks created!');
    App.navigate('admin-home');
    Admin.renderTab('dashboard');
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'dashboard'));
  },

  async renderAdminCalendar() {
    const workers = (await Data.getAll('workers')).filter(w => w.role !== 'admin');
    document.getElementById('admin-content').innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <select class="field-input" id="ac-wf" style="flex:1;font-size:12px;padding:8px 10px">
          <option value="">All Workers</option>
          ${workers.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
        </select>
        <select class="field-input" id="ac-cf" style="flex:1;font-size:12px;padding:8px 10px">
          <option value="">All Categories</option>
          <option>Plumbing</option><option>Electrical</option><option>Housekeeping</option><option>Security</option>
        </select>
      </div>
      <div class="card" id="admin-cal-card"></div>
      <div class="admin-cal-legend">
        <span><span class="legend-dot" style="background:var(--emerald)"></span>All done</span>
        <span><span class="legend-dot" style="background:var(--amber)"></span>Pending</span>
        <span><span class="legend-dot" style="background:var(--rose)"></span>Missed</span>
      </div>
      <div class="card" id="admin-drill-down" style="display:none"></div>`;
    const go = () => Cal.renderAdminCalendar(document.getElementById('admin-cal-card'), document.getElementById('ac-wf').value, document.getElementById('ac-cf').value);
    go();
    document.getElementById('ac-wf').addEventListener('change', go);
    document.getElementById('ac-cf').addEventListener('change', go);
  },


  async renderTickets() {
    const allTickets = await Data.getAll('tickets');
    const open     = allTickets.filter(t => t.status === 'open').length;
    const progress = allTickets.filter(t => t.status === 'in_progress').length;
    const parts    = allTickets.filter(t => t.status === 'pending_parts').length;
    const resolved = allTickets.filter(t => t.status === 'resolved').length;
    const emg      = allTickets.filter(t => t.priority === 'emergency' && t.status !== 'closed').length;

    document.getElementById('admin-content').innerHTML = `
      ${emg > 0 ? `<div style="background:#E11D48;color:#fff;padding:12px 14px;border-radius:12px;font-weight:700;font-size:14px;margin-bottom:14px;text-align:center;cursor:pointer" onclick="adminFilterTickets('emergency')">🚨 ${emg} EMERGENCY TICKET${emg>1?'S':''} — TAP TO VIEW</div>` : ''}
      <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
        <button class="chip selected" onclick="adminFilterTickets('all')">All (${allTickets.length})</button>
        <button class="chip" onclick="adminFilterTickets('open')">Open (${open})</button>
        <button class="chip" onclick="adminFilterTickets('in_progress')">In Progress (${progress})</button>
        <button class="chip" onclick="adminFilterTickets('pending_parts')">Parts (${parts})</button>
        <button class="chip" onclick="adminFilterTickets('resolved')">Resolved (${resolved})</button>
      </div>
      <button class="btn btn-primary btn-sm" id="create-ticket-btn" style="margin-bottom:14px;width:100%">+ Create Ticket</button>
      <div id="ticket-list-container"></div>`;

    await Tickets.renderAdminTicketList(document.getElementById('ticket-list-container'), 'all');

    document.getElementById('create-ticket-btn').addEventListener('click', () => {
      const content = document.getElementById('admin-content');
      content.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <button class="back-btn" onclick="Admin.renderTab('tickets')">←</button>
          <div style="font-size:15px;font-weight:700">Create Ticket</div>
        </div>
        <div id="create-ticket-form"></div>`;
      Tickets.renderCreateTicketForm(document.getElementById('create-ticket-form'));
    });
  },

  async renderSettings() {
    const savedUrl   = await LocalDB.getSetting('sheets_url', '');
    const queueItems = (await Data.getAll('queue')).length;
    const allSubs    = await Data.getAll('submissions');
    const syncedSubs = allSubs.filter(s => s.synced).length;

    document.getElementById('admin-content').innerHTML = `
      <!-- Firebase Status (read-only, config is hardcoded) -->
      <div class="section-header" style="margin-top:4px">🔥 Firebase Database</div>
      <div class="card" style="background:${Data._useFirebase ? 'var(--em-pale)' : 'var(--am-pale)'};border-color:${Data._useFirebase ? '#6EE7B7' : '#FCD34D'}">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:28px">🔥</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:${Data._useFirebase ? 'var(--emerald)' : 'var(--amber)'}">
              ${Data._useFirebase ? '✅ Connected — Live central data' : '⚠️ Connecting...'}
            </div>
            <div style="font-size:12px;color:var(--ink3);margin-top:3px">Project: saha-f7605</div>
            <div style="font-size:12px;color:var(--ink3)">All workers, admin and supervisors share the same live data</div>
          </div>
        </div>
      </div>

      <div class="section-header">📊 Google Sheets Integration</div>
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <div style="width:40px;height:40px;border-radius:10px;background:#E8F5E9;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">📊</div>
          <div>
            <div style="font-size:14px;font-weight:600">Apps Script Web App URL</div>
            <div style="font-size:12px;color:var(--ink3);margin-top:2px">Paste your deployed URL here once — never edit code again</div>
          </div>
        </div>
        <div class="field">
          <label class="field-label">Web App URL</label>
          <input type="url" class="field-input" id="sheets-url-input"
            placeholder="https://script.google.com/macros/s/.../exec"
            value="${savedUrl}" style="font-size:12px">
          <div style="font-size:11px;color:var(--ink3);margin-top:5px">
            Get from: Google Sheet → Extensions → Apps Script → Deploy → Copy URL
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-success btn-md flex-1" id="save-sheets-url-btn">💾 Save URL</button>
          <button class="btn btn-ghost btn-md" id="test-sheets-btn">🔌 Test</button>
        </div>
        <div id="sheets-status" style="margin-top:10px;font-size:13px;font-weight:500;min-height:20px"></div>
      </div>

      <div class="section-header">Sync Status</div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-number" style="color:var(--emerald)">${syncedSubs}</div><div class="stat-label">Synced to Sheets</div></div>
        <div class="stat-card"><div class="stat-number" style="color:${queueItems > 0 ? 'var(--amber)' : 'var(--emerald)'}">${queueItems}</div><div class="stat-label">Pending in Queue</div></div>
      </div>
      ${queueItems > 0 ? `
        <div class="card" style="border-left:3px solid var(--amber);border-radius:0 12px 12px 0">
          <div style="font-size:13px;font-weight:600;margin-bottom:6px">⚠️ ${queueItems} submissions waiting to sync</div>
          <div style="font-size:12px;color:var(--ink3);margin-bottom:10px">Will upload automatically once URL is saved and device is online.</div>
          <button class="btn btn-warn btn-md btn-full" id="force-sync-btn">⬆ Sync Now</button>
        </div>` : `
        <div class="card" style="background:var(--em-pale);border-color:#6EE7B7">
          <div style="font-size:13px;font-weight:600;color:var(--emerald)">✅ Queue empty — all submissions synced</div>
        </div>`}

      <div class="section-header">How it works</div>
      <div class="card" style="font-size:13px;line-height:1.9;color:var(--ink2)">
        1. Deploy the Apps Script <b>once</b> from your Google Sheet<br>
        2. Paste the URL above — <b>never touch code again</b><br>
        3. Every task submission appends a row automatically<br>
        4. Offline? Submissions queue locally and sync when online<br>
        5. Each record has a unique ID — <b>no duplicates ever</b>
      </div>

      <div class="section-header">Community</div>
      <div class="card">
        <div class="field"><label class="field-label">Community Name</label>
          <input type="text" class="field-input" id="comm-name-input"
            value="${await LocalDB.getSetting('community_name', 'My Apartment Complex')}"
            placeholder="e.g. Sunrise Apartments"></div>
        <div class="field" style="margin-bottom:0"><label class="field-label">Community ID</label>
          <input type="text" class="field-input" id="comm-id-input"
            value="${await LocalDB.getSetting('community_id', 'COMM-001')}"
            placeholder="COMM-001"></div>
        <button class="btn btn-primary btn-md btn-full" id="save-comm-btn" style="margin-top:12px">Save Community Settings</button>
      </div>

      <div class="section-header">Admin Account</div>
      <div class="card">
        <button class="btn btn-danger btn-md btn-full" id="admin-logout-settings">Sign Out</button>
      </div>`;

    document.getElementById('save-sheets-url-btn').addEventListener('click', async () => {
      const url    = document.getElementById('sheets-url-input').value.trim();
      const status = document.getElementById('sheets-status');
      if (!url) { status.style.color = 'var(--rose)'; status.textContent = '⚠ Please enter a URL'; return; }
      if (!url.startsWith('https://script.google.com')) { status.style.color = 'var(--rose)'; status.textContent = '⚠ URL must start with https://script.google.com'; return; }
      await LocalDB.setSetting('sheets_url', url);
      status.style.color = 'var(--emerald)';
      status.textContent = '✅ URL saved! Submissions will now sync to Google Sheets.';
      App.showToast('Sheets URL saved ✓');
      Sync.processQueue();
    });

    document.getElementById('test-sheets-btn').addEventListener('click', async () => {
      const url    = document.getElementById('sheets-url-input').value.trim();
      const status = document.getElementById('sheets-status');
      if (!url) { status.textContent = 'Enter URL first'; status.style.color = 'var(--rose)'; return; }
      status.style.color = 'var(--ink3)'; status.textContent = '⏳ Testing…';
      await LocalDB.setSetting('sheets_url', url);
      const result = await Sync.testConnection();
      status.style.color = result.ok ? 'var(--emerald)' : 'var(--rose)';
      status.textContent  = result.ok ? '✅ ' + result.msg : '❌ ' + result.msg;
    });

    const syncBtn = document.getElementById('force-sync-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        syncBtn.textContent = '⏳ Syncing…'; syncBtn.disabled = true;
        await Sync.processQueue();
        await Admin.renderSettings();
      });
    }

    document.getElementById('save-comm-btn').addEventListener('click', async () => {
      await LocalDB.setSetting('community_name', document.getElementById('comm-name-input').value.trim());
      await LocalDB.setSetting('community_id',   document.getElementById('comm-id-input').value.trim());
      App.showToast('Community settings saved ✓');
    });

    document.getElementById('admin-logout-settings').addEventListener('click', () => { Auth.logout(); App.navigate('login'); });
  },
};

// ── Global bridges for onclick= in innerHTML ──────────────────────────────────
window.adminEditWorker      = id      => Admin.editWorker(id);
window.adminEditTemplate    = id      => Admin.showTemplateEditor(id);
window.adminDupTemplate     = id      => Admin.duplicateTemplate(id);
window.adminDelTemplate     = id      => Admin.deleteTemplate(id);
window.adminAddField        = type    => Admin.addField(type);
window.adminRemoveField     = i       => Admin.removeField(i);
window.adminSelAllWorkers   = ()      => Admin.selectAllWorkers();
window.adminSelWorkerGroup  = cat     => Admin.selectWorkerGroup(cat);
window.adminSetFreq         = (f,btn) => Admin.setFreq(f, btn);

window.adminFilterTickets = async (filter) => {
  document.querySelectorAll('#admin-content .chip').forEach(c => {
    c.classList.remove('selected');
  });
  // Mark active chip
  document.querySelectorAll('#admin-content .chip').forEach(c => {
    if (filter === 'all' && c.textContent.startsWith('All')) c.classList.add('selected');
    else if (c.textContent.toLowerCase().includes(filter.replace('_',' '))) c.classList.add('selected');
  });
  const container = document.getElementById('ticket-list-container');
  if (!container) return;
  // For emergency filter, show all open emergency tickets
  const actualFilter = filter === 'emergency' ? 'all' : filter;
  await Tickets.renderAdminTicketList(container, actualFilter, filter === 'emergency');
};
