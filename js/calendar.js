'use strict';
const Cal = {
  workerYear: new Date().getFullYear(),
  workerMonth: new Date().getMonth(),

  async renderWorkerCalendar() {
    const user = Auth.currentUser;
    const year = this.workerYear;
    const month = this.workerMonth;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    document.getElementById('wcal-month').textContent = `${monthNames[month]} ${year}`;

    const allTasks = await DB.getByIndex('tasks', 'workerId', user.id);
    const grid = document.getElementById('wcal-grid');
    const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    grid.innerHTML = days.map(d => `<div class="cal-day-hdr">${d}</div>`).join('');

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (let i = 0; i < firstDay; i++) {
      grid.innerHTML += '<div class="cal-cell"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayTasks = allTasks.filter(t => t.date === dateStr);
      const isToday = dateStr === todayStr;
      const done = dayTasks.filter(t => t.status === 'completed').length;
      const missed = dayTasks.filter(t => t.status === 'missed').length;
      const pending = dayTasks.filter(t => t.status === 'pending').length;
      let dotClass = '';
      if (dayTasks.length > 0) {
        if (missed > 0) dotClass = 'missed';
        else if (pending > 0) dotClass = 'pending';
        else dotClass = 'done';
      }

      const cell = document.createElement('div');
      cell.className = 'cal-cell' + (isToday ? ' today' : '');
      cell.innerHTML = `<span class="cal-num">${d}</span>${dayTasks.length > 0 ? `<div class="cal-dot ${isToday ? 'today' : dotClass}"></div>` : ''}`;
      cell.addEventListener('click', () => this.showWorkerDayDetail(dateStr, dayTasks));
      grid.appendChild(cell);
    }
  },

  showWorkerDayDetail(dateStr, tasks) {
    const detail = document.getElementById('wcal-day-detail');
    detail.style.display = 'block';
    const done = tasks.filter(t => t.status === 'completed').length;
    const missed = tasks.filter(t => t.status === 'missed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const d = new Date(dateStr + 'T12:00:00');
    detail.innerHTML = `
      <div class="cal-day-title">${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} · ${tasks.length} tasks</div>
      <div class="cal-day-stats">
        <div class="cal-day-stat"><div class="cal-day-stat-n" style="color:var(--emerald)">${done}</div><div class="cal-day-stat-l">Done</div></div>
        <div class="cal-day-stat"><div class="cal-day-stat-n" style="color:var(--amber)">${pending}</div><div class="cal-day-stat-l">Pending</div></div>
        <div class="cal-day-stat"><div class="cal-day-stat-n" style="color:var(--rose)">${missed}</div><div class="cal-day-stat-l">Missed</div></div>
      </div>
      <div style="border-top:1px solid var(--line);padding-top:10px">
        ${tasks.length === 0 ? '<div style="color:var(--ink3);font-size:13px;text-align:center">No tasks this day</div>' :
          tasks.map(t => `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)">
            <span>${t.templateIcon || '📋'}</span>
            <span style="flex:1;font-size:13px;font-weight:500">${t.templateName}</span>
            <span class="badge badge-${t.status}">${t.status.charAt(0).toUpperCase() + t.status.slice(1)}</span>
          </div>`).join('')}
      </div>
    `;
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  async renderAdminCalendar(container, workerFilter, catFilter) {
    const year = new Date().getFullYear();
    const month = new Date().getMonth();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    let allTasks = await DB.getAll('tasks');
    if (workerFilter) allTasks = allTasks.filter(t => t.workerId === workerFilter);
    if (catFilter) allTasks = allTasks.filter(t => t.category === catFilter);

    const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    let html = `
      <div class="cal-header">
        <button class="cal-nav-btn">‹</button>
        <div class="cal-month-title">${monthNames[month]} ${year}</div>
        <button class="cal-nav-btn">›</button>
      </div>
      <div class="cal-grid">
        ${days.map(d => `<div class="cal-day-hdr">${d}</div>`).join('')}
        ${Array(firstDay).fill('<div class="cal-cell"></div>').join('')}
    `;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayTasks = allTasks.filter(t => t.date === dateStr);
      const isToday = dateStr === todayStr;
      const done = dayTasks.filter(t => t.status === 'completed').length;
      const missed = dayTasks.filter(t => t.status === 'missed').length;
      const pending = dayTasks.filter(t => t.status === 'pending').length;

      let bg = '', dotClass = '';
      if (!isToday && dayTasks.length > 0) {
        if (missed > 0) { bg = 'background:rgba(225,29,72,.08);'; dotClass = 'missed'; }
        else if (pending > 0) { bg = 'background:rgba(217,119,6,.08);'; dotClass = 'pending'; }
        else if (done > 0) { bg = 'background:rgba(5,150,105,.08);'; dotClass = 'done'; }
      }

      html += `<div class="cal-cell ${isToday ? 'today' : ''}" style="${bg}" onclick="Cal.showAdminDayDrill('${dateStr}','${workerFilter}','${catFilter}')">
        <span class="cal-num">${d}</span>
        ${dayTasks.length > 0 ? `<div class="cal-dot ${isToday ? 'today' : dotClass}"></div>` : ''}
      </div>`;
    }

    html += '</div>';
    container.innerHTML = html;
  },

  async showAdminDayDrill(dateStr, workerFilter, catFilter) {
    let tasks = await DB.getAll('tasks');
    tasks = tasks.filter(t => t.date === dateStr);
    if (workerFilter) tasks = tasks.filter(t => t.workerId === workerFilter);
    if (catFilter) tasks = tasks.filter(t => t.category === catFilter);

    const workers = await DB.getAll('workers');
    const activeWorkers = workers.filter(w => w.role !== 'admin');
    const d = new Date(dateStr + 'T12:00:00');

    const drill = document.getElementById('admin-drill-down');
    drill.style.display = 'block';
    drill.innerHTML = `
      <div style="font-size:14px;font-weight:600;margin-bottom:10px">${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} — ${tasks.length} tasks</div>
      ${activeWorkers.map(w => {
        const wTasks = tasks.filter(t => t.workerId === w.id);
        if (wTasks.length === 0) return '';
        const done = wTasks.filter(t => t.status === 'completed').length;
        const pct = Math.round(done / wTasks.length * 100);
        return `<div class="drill-row">
          <div class="worker-avatar" style="width:32px;height:32px;background:${w.avatarBg};color:${w.avatarColor};font-size:11px">${w.initials}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600">${w.name}</div>
            <div style="font-size:11px;color:var(--ink3)">${w.category}</div>
          </div>
          <span class="badge badge-${pct === 100 ? 'done' : pct > 50 ? 'pending' : 'missed'}">${done}/${wTasks.length}</span>
        </div>`;
      }).join('')}
    `;
    drill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
};

// Expose Cal globally for onclick= in innerHTML
window.Cal = Cal;
