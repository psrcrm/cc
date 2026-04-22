'use strict';
// ── Tickets Module ────────────────────────────────────────────────────────────
// Ticket statuses: open → in_progress → pending_parts → resolved → closed
// Ticket sources: phone_call | whatsapp | walk_in | web_portal | supervisor

const Tickets = {

  CATEGORIES: [
    { id: 'plumbing',      label: 'Plumbing',          icon: '🚰' },
    { id: 'electrical',    label: 'Electrical',         icon: '⚡' },
    { id: 'lift',          label: 'Lift / Elevator',    icon: '🛗' },
    { id: 'security',      label: 'Security',           icon: '🔒' },
    { id: 'housekeeping',  label: 'Housekeeping',       icon: '🧹' },
    { id: 'structural',    label: 'Structural',         icon: '🏗️' },
    { id: 'gym',           label: 'Gym / Amenities',    icon: '🏋️' },
    { id: 'parking',       label: 'Parking',            icon: '🅿️' },
    { id: 'internet',      label: 'Internet / Intercom',icon: '📡' },
    { id: 'emergency',     label: 'Emergency',          icon: '🚨' },
    { id: 'other',         label: 'Other',              icon: '📋' },
  ],

  PRIORITIES: [
    { id: 'low',       label: 'Low',       color: '#059669', bg: '#ECFDF5' },
    { id: 'medium',    label: 'Medium',    color: '#D97706', bg: '#FFFBEB' },
    { id: 'high',      label: 'High',      color: '#E11D48', bg: '#FFF1F2' },
    { id: 'emergency', label: 'Emergency', color: '#fff',    bg: '#E11D48' },
  ],

  SOURCES: [
    { id: 'phone_call',  label: 'Phone Call',   icon: '📞' },
    { id: 'whatsapp',    label: 'WhatsApp',      icon: '💬' },
    { id: 'walk_in',     label: 'Walk-in',       icon: '🚶' },
    { id: 'web_portal',  label: 'Web Portal',    icon: '🌐' },
    { id: 'supervisor',  label: 'Supervisor',    icon: '👤' },
  ],

  TOWERS: ['Tower A01','Tower A02','Tower A03','Tower A04','Tower A05','Tower A06','Tower A07','Tower A08','Tower A09'],
  FLATS: Array.from({length:6}, (_,i) => String(i+101)),

  buildTicketId() {
    const ts  = new Date().toISOString().replace(/[-:T.Z]/g,'').slice(0,14);
    const rnd = Math.floor(Math.random()*900)+100;
    return `TKT-${ts}-${rnd}`;
  },

  getCategoryMeta(id) {
    return this.CATEGORIES.find(c => c.id === id) || this.CATEGORIES[this.CATEGORIES.length-1];
  },

  getPriorityMeta(id) {
    return this.PRIORITIES.find(p => p.id === id) || this.PRIORITIES[1];
  },

  statusLabel(s) {
    return { open:'Open', in_progress:'In Progress', pending_parts:'Parts Needed', resolved:'Resolved', closed:'Closed', reassigned:'Reassigned' }[s] || s;
  },

  statusBadgeClass(s) {
    return { open:'badge-pending', in_progress:'badge-blue', pending_parts:'badge-violet', resolved:'badge-done', closed:'badge-gray', reassigned:'badge-violet' }[s] || 'badge-gray';
  },

  // ── Load tickets for worker home ──────────────────────────────────────────
  async getWorkerTickets(workerId, date) {
    const all = await DB.getAll('tickets');
    return all.filter(t => t.assignedTo === workerId && t.date === date && t.status !== 'closed');
  },

  async getAllTickets() {
    return await DB.getAll('tickets');
  },

  // ── Create ticket (admin/supervisor) ─────────────────────────────────────
  async createTicket(data) {
    const ticket = {
      id:           this.buildTicketId(),
      residentName: data.residentName || '',
      tower:        data.tower        || '',
      flatNo:       data.flatNo       || '',
      phone:        data.phone        || '',
      category:     data.category     || 'other',
      priority:     data.priority     || 'medium',
      source:       data.source       || 'supervisor',
      description:  data.description  || '',
      photoUrl:     data.photoUrl     || '',
      assignedTo:   data.assignedTo   || '',
      assignedName: data.assignedName || '',
      status:       'open',
      date:         new Date().toISOString().split('T')[0],
      createdAt:    new Date().toISOString(),
      createdBy:    Auth.currentUser?.id || 'admin',
      timeline:     [{ time: new Date().toISOString(), action: 'created', by: Auth.currentUser?.name || 'Admin', note: 'Ticket created' }],
      resolution:   '',
      partsRequired:[],
      escalatedTo:  '',
      communityId:  Auth.currentUser?.communityId || 'COMM-001',
    };
    await DB.put('tickets', ticket);
    return ticket;
  },

  // ── Update ticket status ──────────────────────────────────────────────────
  async updateStatus(ticketId, newStatus, note, extraData) {
    const ticket = await DB.get('tickets', ticketId);
    if (!ticket) return;
    ticket.status = newStatus;
    ticket.updatedAt = new Date().toISOString();
    if (extraData) Object.assign(ticket, extraData);
    ticket.timeline.push({ time: new Date().toISOString(), action: newStatus, by: Auth.currentUser?.name || 'Worker', note: note || '' });
    await DB.put('tickets', ticket);
    // Sync to sheets
    Sync.syncTicket(ticket);
    return ticket;
  },

  // ── Render worker ticket list item ────────────────────────────────────────
  renderTicketListItem(ticket) {
    const cat = this.getCategoryMeta(ticket.category);
    const pri = this.getPriorityMeta(ticket.priority);
    const badge = this.statusBadgeClass(ticket.status);
    const isEmergency = ticket.priority === 'emergency';
    return `
      <div class="task-item ticket-item ${isEmergency ? 'emergency-item' : ''}" data-ticket-id="${ticket.id}">
        <div class="task-icon" style="background:${pri.bg}">${cat.icon}</div>
        <div class="task-info">
          <div class="task-name">${ticket.id}</div>
          <div class="task-meta">${cat.label} · ${ticket.tower} ${ticket.flatNo} · ${ticket.residentName}</div>
          ${isEmergency ? '<div style="font-size:11px;font-weight:700;color:#E11D48;margin-top:2px">🚨 EMERGENCY</div>' : ''}
        </div>
        <div class="badge ${badge}">${this.statusLabel(ticket.status)}</div>
        <div class="task-arrow">›</div>
      </div>`;
  },

  // ── Full ticket detail / action screen for worker ─────────────────────────
  async renderTicketDetail(ticketId) {
    const ticket = await DB.get('tickets', ticketId);
    if (!ticket) return '<div class="empty-state">Ticket not found</div>';
    const cat = this.getCategoryMeta(ticket.category);
    const pri = this.getPriorityMeta(ticket.priority);
    const isEmergency = ticket.priority === 'emergency';

    let actionButtons = '';
    if (ticket.status === 'open') {
      actionButtons = `
        <button class="btn btn-primary btn-full btn-lg" onclick="ticketAction('start','${ticketId}')">▶ Start Working</button>`;
    } else if (ticket.status === 'in_progress') {
      actionButtons = `
        <button class="btn btn-success btn-full btn-lg" onclick="ticketAction('resolve','${ticketId}')">✅ Mark Resolved</button>
        <button class="btn btn-warn btn-full btn-md" style="margin-top:8px" onclick="ticketAction('parts','${ticketId}')">🔧 Parts Required</button>
        <button class="btn btn-outline btn-full btn-md" style="margin-top:8px" onclick="ticketAction('escalate','${ticketId}')">⬆ Escalate to Supervisor</button>`;
    } else if (ticket.status === 'pending_parts') {
      actionButtons = `
        <button class="btn btn-success btn-full btn-lg" onclick="ticketAction('resolve','${ticketId}')">✅ Parts Received — Resolve</button>
        <button class="btn btn-outline btn-full btn-md" style="margin-top:8px" onclick="ticketAction('escalate','${ticketId}')">⬆ Escalate to Supervisor</button>`;
    }

    const timelineHtml = (ticket.timeline || []).map(t => {
      const d = new Date(t.time);
      return `<div class="tl-item">
        <div class="tl-dot ${t.action==='resolved'?'g':t.action==='escalate'?'r':''}"></div>
        <div>
          <div class="tl-t">${d.toLocaleDateString('en-IN')} ${d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} · ${t.by}</div>
          <div class="tl-b">${t.note || t.action}</div>
        </div>
      </div>`;
    }).join('');

    return `
      ${isEmergency ? '<div style="background:#E11D48;color:#fff;padding:10px 14px;border-radius:10px;font-weight:700;font-size:14px;margin-bottom:14px;text-align:center">🚨 EMERGENCY TICKET — IMMEDIATE ACTION REQUIRED</div>' : ''}

      <div class="card" style="${isEmergency ? 'border-color:#E11D48;border-width:2px' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-family:var(--fm);font-size:12px;color:var(--ink3);margin-bottom:3px">${ticket.id}</div>
            <div style="font-size:18px;font-weight:700">${cat.icon} ${cat.label}</div>
          </div>
          <div style="text-align:right">
            <div class="badge ${this.statusBadgeClass(ticket.status)}" style="margin-bottom:4px">${this.statusLabel(ticket.status)}</div>
            <div class="badge" style="background:${pri.bg};color:${pri.color}">${pri.label}</div>
          </div>
        </div>
        <div style="border-top:1px solid var(--line);padding-top:12px">
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="color:var(--ink3);padding:5px 0;width:110px">Resident</td><td style="font-weight:600">${ticket.residentName}</td></tr>
            <tr><td style="color:var(--ink3);padding:5px 0">Tower / Flat</td><td style="font-weight:600">${ticket.tower} — ${ticket.flatNo}</td></tr>
            <tr><td style="color:var(--ink3);padding:5px 0">Phone</td><td><a href="tel:${ticket.phone}" style="color:var(--blue);font-weight:600">${ticket.phone || '—'}</a></td></tr>
            <tr><td style="color:var(--ink3);padding:5px 0">Source</td><td>${this.SOURCES.find(s=>s.id===ticket.source)?.icon || ''} ${this.SOURCES.find(s=>s.id===ticket.source)?.label || ticket.source}</td></tr>
            <tr><td style="color:var(--ink3);padding:5px 0">Created</td><td>${new Date(ticket.createdAt).toLocaleString('en-IN')}</td></tr>
          </table>
        </div>
      </div>

      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--ink3);margin-bottom:6px">COMPLAINT DESCRIPTION</div>
        <div style="font-size:14px;line-height:1.7;color:var(--ink)">${ticket.description || 'No description provided'}</div>
        ${ticket.photoUrl ? `<img src="${ticket.photoUrl}" style="width:100%;border-radius:8px;margin-top:10px;max-height:200px;object-fit:cover">` : ''}
      </div>

      ${ticket.partsRequired?.length ? `
        <div class="card" style="border-color:var(--amber)">
          <div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:6px">🔧 PARTS REQUIRED</div>
          ${ticket.partsRequired.map(p => `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--line)">${p}</div>`).join('')}
        </div>` : ''}

      ${ticket.resolution ? `
        <div class="card" style="background:var(--em-pale);border-color:#6EE7B7">
          <div style="font-size:12px;font-weight:700;color:var(--emerald);margin-bottom:6px">✅ RESOLUTION</div>
          <div style="font-size:13px;line-height:1.7">${ticket.resolution}</div>
        </div>` : ''}

      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--ink3);margin-bottom:10px">TIMELINE</div>
        <div class="timeline">${timelineHtml}</div>
      </div>

      ${actionButtons ? `<div style="padding-bottom:20px">${actionButtons}</div>` : ''}
    `;
  },

  // ── Admin: Create ticket form ─────────────────────────────────────────────
  async renderCreateTicketForm(container) {
    const workers = (await DB.getAll('workers')).filter(w => w.isActive && w.role !== 'admin');
    container.innerHTML = `
      <div class="card" style="margin-bottom:0">
        <div style="font-size:15px;font-weight:700;letter-spacing:-.02em;margin-bottom:16px">🎫 Create Ticket</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div class="field" style="margin:0"><label class="field-label">Resident Name *</label>
            <input type="text" class="field-input" id="tk-name" placeholder="Full name"></div>
          <div class="field" style="margin:0"><label class="field-label">Phone</label>
            <input type="tel" class="field-input" id="tk-phone" placeholder="+91XXXXX"></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div class="field" style="margin:0"><label class="field-label">Tower *</label>
            <select class="field-input" id="tk-tower">
              <option value="">Select Tower</option>
              ${this.TOWERS.map(t=>`<option value="${t}">${t}</option>`).join('')}
            </select></div>
          <div class="field" style="margin:0"><label class="field-label">Flat No *</label>
            <select class="field-input" id="tk-flat">
              <option value="">Select Flat</option>
              ${this.FLATS.map(f=>`<option value="${f}">${f}</option>`).join('')}
            </select></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div class="field" style="margin:0"><label class="field-label">Issue Category *</label>
            <select class="field-input" id="tk-cat">
              ${this.CATEGORIES.map(c=>`<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
            </select></div>
          <div class="field" style="margin:0"><label class="field-label">Priority *</label>
            <select class="field-input" id="tk-pri">
              ${this.PRIORITIES.map(p=>`<option value="${p.id}">${p.label}</option>`).join('')}
            </select></div>
        </div>

        <div class="field"><label class="field-label">Source / Channel</label>
          <select class="field-input" id="tk-src">
            ${this.SOURCES.map(s=>`<option value="${s.id}">${s.icon} ${s.label}</option>`).join('')}
          </select></div>

        <div class="field"><label class="field-label">Description *</label>
          <textarea class="field-input" id="tk-desc" rows="3" placeholder="Describe the issue in detail..."></textarea></div>

        <div class="field"><label class="field-label">Assign To</label>
          <select class="field-input" id="tk-assign">
            <option value="">Unassigned</option>
            ${workers.map(w=>`<option value="${w.id}" data-name="${w.name}">${w.name} (${w.category})</option>`).join('')}
          </select></div>

        <div class="field" style="margin-bottom:0"><label class="field-label">Photo (Optional)</label>
          <div class="image-upload-area" id="tk-photo-area" onclick="document.getElementById('tk-photo-input').click()">
            <div class="upload-icon">📷</div>
            <div class="upload-label">Tap to attach photo</div>
            <input type="file" id="tk-photo-input" accept="image/*" style="display:none">
          </div></div>

        <div id="tk-error" class="error-msg" style="margin-top:8px"></div>

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-danger btn-md" id="tk-emergency-btn" style="flex:0 0 auto">🚨 Emergency</button>
          <button class="btn btn-primary btn-md flex-1" id="tk-submit-btn">🎫 Create Ticket</button>
        </div>
      </div>`;

    // Photo upload
    let photoDataUrl = '';
    document.getElementById('tk-photo-input').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        photoDataUrl = ev.target.result;
        const area = document.getElementById('tk-photo-area');
        area.classList.add('has-file');
        area.querySelector('.upload-icon').textContent = '🖼️';
        area.querySelector('.upload-label').textContent = file.name;
      };
      reader.readAsDataURL(file);
    });

    // Emergency shortcut
    document.getElementById('tk-emergency-btn').addEventListener('click', () => {
      document.getElementById('tk-pri').value = 'emergency';
    });

    document.getElementById('tk-submit-btn').addEventListener('click', async () => {
      await this.submitCreateForm(photoDataUrl);
    });
  },

  async submitCreateForm(photoDataUrl) {
    const name   = document.getElementById('tk-name').value.trim();
    const tower  = document.getElementById('tk-tower').value;
    const flat   = document.getElementById('tk-flat').value;
    const cat    = document.getElementById('tk-cat').value;
    const pri    = document.getElementById('tk-pri').value;
    const src    = document.getElementById('tk-src').value;
    const desc   = document.getElementById('tk-desc').value.trim();
    const asgSel = document.getElementById('tk-assign');
    const asgId  = asgSel.value;
    const asgName= asgSel.options[asgSel.selectedIndex]?.dataset?.name || '';
    const phone  = document.getElementById('tk-phone').value.trim();
    const err    = document.getElementById('tk-error');
    err.textContent = '';
    if (!name)  { err.textContent = 'Resident name is required'; return; }
    if (!tower) { err.textContent = 'Select tower'; return; }
    if (!flat)  { err.textContent = 'Select flat'; return; }
    if (!desc)  { err.textContent = 'Description is required'; return; }

    const btn = document.getElementById('tk-submit-btn');
    btn.textContent = 'Creating...'; btn.disabled = true;

    const ticket = await this.createTicket({ residentName:name, tower, flatNo:flat, phone, category:cat, priority:pri, source:src, description:desc, assignedTo:asgId, assignedName:asgName, photoUrl:photoDataUrl });
    App.showToast(`Ticket ${ticket.id} created!`);
    Admin.renderTab('tickets');
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'tickets'));
  },

  // ── Admin: Ticket list ─────────────────────────────────────────────────────
  async renderAdminTicketList(container, filter, emergencyOnly) {
    let tickets = await DB.getAll('tickets');
    if (emergencyOnly) tickets = tickets.filter(t => t.priority === 'emergency' && t.status !== 'closed');
    else if (filter && filter !== 'all') tickets = tickets.filter(t => t.status === filter);
    tickets.sort((a,b) => {
      if (a.priority === 'emergency' && b.priority !== 'emergency') return -1;
      if (b.priority === 'emergency' && a.priority !== 'emergency') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (!tickets.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎫</div><div class="empty-state-title">No tickets</div></div>';
      return;
    }

    container.innerHTML = tickets.map(t => {
      const cat = this.getCategoryMeta(t.category);
      const pri = this.getPriorityMeta(t.priority);
      const isEmg = t.priority === 'emergency';
      return `<div class="task-item ticket-item ${isEmg?'emergency-item':''}" onclick="adminOpenTicket('${t.id}')" style="cursor:pointer">
        <div class="task-icon" style="background:${pri.bg};font-size:18px">${cat.icon}</div>
        <div class="task-info">
          <div class="task-name" style="font-size:12px;font-family:var(--fm)">${t.id}</div>
          <div style="font-size:13px;font-weight:600">${t.residentName} — ${t.tower} ${t.flatNo}</div>
          <div class="task-meta">${cat.label} · ${t.assignedName || 'Unassigned'}</div>
        </div>
        <div>
          <div class="badge ${this.statusBadgeClass(t.status)}" style="margin-bottom:4px;display:block">${this.statusLabel(t.status)}</div>
          <div class="badge" style="background:${pri.bg};color:${pri.color};display:block">${pri.label}</div>
        </div>
      </div>`;
    }).join('');
  },

  // ── Admin: Ticket detail/edit ─────────────────────────────────────────────
  async renderAdminTicketDetail(ticketId, container) {
    const ticket = await DB.get('tickets', ticketId);
    if (!ticket) return;
    const cat = this.getCategoryMeta(ticket.category);
    const pri = this.getPriorityMeta(ticket.priority);
    const workers = (await DB.getAll('workers')).filter(w => w.isActive && w.role !== 'admin');

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <button class="back-btn" onclick="Admin.renderTab('tickets')">←</button>
        <div>
          <div style="font-family:var(--fm);font-size:11px;color:var(--ink3)">${ticket.id}</div>
          <div style="font-size:16px;font-weight:700">${cat.icon} ${cat.label}</div>
        </div>
        <div style="margin-left:auto">
          <div class="badge ${this.statusBadgeClass(ticket.status)}">${this.statusLabel(ticket.status)}</div>
        </div>
      </div>

      <div class="card">
        <table style="width:100%;font-size:13px;border-collapse:collapse">
          <tr><td style="color:var(--ink3);padding:6px 0;width:110px">Resident</td><td style="font-weight:600">${ticket.residentName}</td></tr>
          <tr><td style="color:var(--ink3);padding:6px 0">Tower / Flat</td><td style="font-weight:600">${ticket.tower} — ${ticket.flatNo}</td></tr>
          <tr><td style="color:var(--ink3);padding:6px 0">Phone</td><td><a href="tel:${ticket.phone}" style="color:var(--blue);font-weight:600">${ticket.phone||'—'}</a></td></tr>
          <tr><td style="color:var(--ink3);padding:6px 0">Priority</td><td><span class="badge" style="background:${pri.bg};color:${pri.color}">${pri.label}</span></td></tr>
          <tr><td style="color:var(--ink3);padding:6px 0">Source</td><td>${this.SOURCES.find(s=>s.id===ticket.source)?.icon||''} ${this.SOURCES.find(s=>s.id===ticket.source)?.label||''}</td></tr>
          <tr><td style="color:var(--ink3);padding:6px 0">Created</td><td>${new Date(ticket.createdAt).toLocaleString('en-IN')}</td></tr>
        </table>
      </div>

      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--ink3);margin-bottom:6px">DESCRIPTION</div>
        <div style="font-size:14px;line-height:1.7">${ticket.description}</div>
        ${ticket.photoUrl?`<img src="${ticket.photoUrl}" style="width:100%;border-radius:8px;margin-top:10px;max-height:180px;object-fit:cover">`: ''}
      </div>

      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--ink3);margin-bottom:10px">REASSIGN WORKER</div>
        <select class="field-input" id="admin-tk-reassign">
          <option value="">Unassigned</option>
          ${workers.map(w=>`<option value="${w.id}" data-name="${w.name}" ${ticket.assignedTo===w.id?'selected':''}>${w.name} (${w.category})</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-md btn-full" style="margin-top:10px" onclick="adminReassignTicket('${ticketId}')">Reassign</button>
      </div>

      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--ink3);margin-bottom:10px">UPDATE STATUS</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="adminUpdateTicketStatus('${ticketId}','in_progress')">▶ In Progress</button>
          <button class="btn btn-warn btn-sm" onclick="adminUpdateTicketStatus('${ticketId}','pending_parts')">🔧 Parts Needed</button>
          <button class="btn btn-success btn-sm" onclick="adminUpdateTicketStatus('${ticketId}','resolved')">✅ Resolved</button>
          <button class="btn btn-ghost btn-sm" onclick="adminUpdateTicketStatus('${ticketId}','closed')">🔒 Close</button>
        </div>
        <div class="field" style="margin-top:12px;margin-bottom:0">
          <label class="field-label">Note / Resolution</label>
          <textarea class="field-input" id="admin-tk-note" rows="2" placeholder="Add note..."></textarea>
        </div>
      </div>

      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--ink3);margin-bottom:8px">PARTS REQUIRED</div>
        <input type="text" class="field-input" id="admin-tk-part" placeholder="Part name / description">
        <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="adminAddPart('${ticketId}')">+ Add Part</button>
        <div id="parts-list" style="margin-top:10px">
          ${(ticket.partsRequired||[]).map(p=>`<div style="font-size:13px;padding:5px 0;border-bottom:1px solid var(--line)">${p}</div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div style="font-size:12px;font-weight:700;color:var(--ink3);margin-bottom:10px">TIMELINE</div>
        <div class="timeline">
          ${(ticket.timeline||[]).map(t=>{
            const d = new Date(t.time);
            return `<div class="tl-item"><div class="tl-dot ${t.action==='resolved'?'g':t.action==='escalate'?'r':''}"></div>
              <div><div class="tl-t">${d.toLocaleDateString('en-IN')} ${d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} · ${t.by}</div>
              <div class="tl-b">${t.note||t.action}</div></div></div>`;
          }).join('')}
        </div>
      </div>`;
  },
};

// ── Global bridges ────────────────────────────────────────────────────────────
window.ticketAction = async (action, ticketId) => {
  if (action === 'start') {
    await Tickets.updateStatus(ticketId, 'in_progress', 'Worker started working on ticket');
    App.showToast('Ticket started');
  } else if (action === 'resolve') {
    App.showInputDialog('Resolution', 'Describe what was done to fix the issue:', 'Resolution details', async note => {
      await Tickets.updateStatus(ticketId, 'resolved', note, { resolution: note });
      App.showToast('Ticket resolved ✓');
      App.navigate('worker-home'); Tasks.loadWorkerHome();
    });
  } else if (action === 'parts') {
    App.showInputDialog('Parts Required', 'List the parts you need:', 'e.g. PVC pipe 2 inch, elbow joint', async note => {
      const parts = note.split(',').map(p => p.trim()).filter(Boolean);
      await Tickets.updateStatus(ticketId, 'pending_parts', 'Parts required: ' + note, { partsRequired: parts });
      App.showToast('Supervisor notified about parts');
    });
  } else if (action === 'escalate') {
    App.showInputDialog('Escalate Ticket', 'Why are you escalating this ticket?', 'Reason for escalation', async note => {
      await Tickets.updateStatus(ticketId, 'reassigned', 'Escalated: ' + note, { escalatedTo: 'supervisor' });
      App.showToast('Ticket escalated to supervisor');
      App.navigate('worker-home'); Tasks.loadWorkerHome();
    });
  }
  // Refresh the ticket detail
  const body = document.getElementById('task-form-body');
  if (body) body.innerHTML = await Tickets.renderTicketDetail(ticketId);
};

window.adminOpenTicket = async (ticketId) => {
  const content = document.getElementById('admin-content');
  await Tickets.renderAdminTicketDetail(ticketId, content);
};

window.adminReassignTicket = async (ticketId) => {
  const sel    = document.getElementById('admin-tk-reassign');
  const wId    = sel.value;
  const wName  = sel.options[sel.selectedIndex]?.dataset?.name || 'Unassigned';
  const note   = document.getElementById('admin-tk-note').value.trim() || 'Reassigned by admin';
  const ticket = await DB.get('tickets', ticketId);
  if (!ticket) return;
  ticket.assignedTo   = wId;
  ticket.assignedName = wName;
  ticket.timeline.push({ time: new Date().toISOString(), action: 'reassigned', by: Auth.currentUser?.name || 'Admin', note });
  await DB.put('tickets', ticket);
  App.showToast('Ticket reassigned to ' + wName);
};

window.adminUpdateTicketStatus = async (ticketId, status) => {
  const note = document.getElementById('admin-tk-note')?.value.trim() || '';
  await Tickets.updateStatus(ticketId, status, note || ('Status updated to ' + status));
  App.showToast('Status updated: ' + Tickets.statusLabel(status));
  adminOpenTicket(ticketId);
};

window.adminAddPart = async (ticketId) => {
  const input = document.getElementById('admin-tk-part');
  const part  = input.value.trim();
  if (!part) return;
  const ticket = await DB.get('tickets', ticketId);
  if (!ticket) return;
  ticket.partsRequired = ticket.partsRequired || [];
  ticket.partsRequired.push(part);
  ticket.timeline.push({ time: new Date().toISOString(), action: 'part_added', by: Auth.currentUser?.name || 'Admin', note: 'Part required: ' + part });
  await DB.put('tickets', ticket);
  input.value = '';
  const list = document.getElementById('parts-list');
  if (list) list.innerHTML = ticket.partsRequired.map(p => `<div style="font-size:13px;padding:5px 0;border-bottom:1px solid var(--line)">${p}</div>`).join('');
  App.showToast('Part added');
};

window.Tickets = Tickets;
