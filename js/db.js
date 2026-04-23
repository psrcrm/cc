'use strict';
// ── IndexedDB wrapper ──────────────────────────────────────────────────────────
const DB_NAME = 'apartmentcare';
const DB_VERSION = 2;
let db;

const DB = {
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('workers')) {
          const ws = d.createObjectStore('workers', { keyPath: 'id' });
          ws.createIndex('mobile', 'mobile', { unique: true });
        }
        if (!d.objectStoreNames.contains('templates')) {
          d.createObjectStore('templates', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('tasks')) {
          const ts = d.createObjectStore('tasks', { keyPath: 'id' });
          ts.createIndex('workerId_date', ['workerId', 'date']);
          ts.createIndex('workerId', 'workerId');
          ts.createIndex('date', 'date');
        }
        if (!d.objectStoreNames.contains('submissions')) {
          const ss = d.createObjectStore('submissions', { keyPath: 'recordId' });
          ss.createIndex('taskId', 'taskId');
          ss.createIndex('synced', 'synced');
        }
        if (!d.objectStoreNames.contains('queue')) {
          d.createObjectStore('queue', { keyPath: 'recordId' });
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        if (!d.objectStoreNames.contains('tickets')) {
          const tks = d.createObjectStore('tickets', { keyPath: 'id' });
          tks.createIndex('assignedTo', 'assignedTo');
          tks.createIndex('status', 'status');
          tks.createIndex('date', 'date');
        }
        }
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  },

  tx(stores, mode = 'readonly') {
    return db.transaction(stores, mode);
  },

  put(store, data) {
    return new Promise((resolve, reject) => {
      const tx = this.tx(store, 'readwrite');
      const req = tx.objectStore(store).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  get(store, key) {
    return new Promise((resolve, reject) => {
      const req = this.tx(store).objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  getAll(store) {
    return new Promise((resolve, reject) => {
      const req = this.tx(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  getByIndex(store, indexName, value) {
    return new Promise((resolve, reject) => {
      const req = this.tx(store).objectStore(store).index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  delete(store, key) {
    return new Promise((resolve, reject) => {
      const tx = this.tx(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  getSetting(key, def = null) {
    return this.get('settings', key).then(r => r ? r.value : def);
  },
  setSetting(key, value) {
    return this.put('settings', { key, value });
  }
};

// ── Seed default data ──────────────────────────────────────────────────────────
async function seedData() {
  const existing = await DB.getAll('workers');
  if (existing.length > 0) return;

  const workers = [
    { id: 'WK-0001', name: 'Rajan Kumar', mobile: '9876543210', pinHash: '1234', role: 'worker', category: 'Plumbing', isActive: true, communityId: 'COMM-001', initials: 'RK', avatarBg: '#EBF2FF', avatarColor: '#1B6EF3', createdAt: new Date().toISOString() },
    { id: 'WK-0002', name: 'Mani Shankar', mobile: '9988776655', pinHash: '2222', role: 'worker', category: 'Electrical', isActive: true, communityId: 'COMM-001', initials: 'MS', avatarBg: '#ECFDF5', avatarColor: '#059669', createdAt: new Date().toISOString() },
    { id: 'WK-0003', name: 'Priya Teja', mobile: '9123456789', pinHash: '3333', role: 'worker', category: 'Housekeeping', isActive: true, communityId: 'COMM-001', initials: 'PT', avatarBg: '#FFF1F2', avatarColor: '#E11D48', createdAt: new Date().toISOString() },
    { id: 'WK-0004', name: 'Suresh Reddy', mobile: '9765432109', pinHash: '4444', role: 'worker', category: 'Security', isActive: true, communityId: 'COMM-001', initials: 'SR', avatarBg: '#F5F3FF', avatarColor: '#7C3AED', createdAt: new Date().toISOString() },
    { id: 'WK-0005', name: 'Kavitha Prasad', mobile: '9000011122', pinHash: '5555', role: 'worker', category: 'Housekeeping', isActive: true, communityId: 'COMM-001', initials: 'KP', avatarBg: '#FFFBEB', avatarColor: '#D97706', createdAt: new Date().toISOString() },
    { id: 'ADMIN-01', name: 'Community Admin', mobile: '0000000000', pinHash: '9999', role: 'admin', category: 'Admin', isActive: true, communityId: 'COMM-001', initials: 'CA', avatarBg: '#EBF2FF', avatarColor: '#1B6EF3', createdAt: new Date().toISOString() },
  ];
  for (const w of workers) await DB.put('workers', w);

  const templates = [
    {
      id: 'TPL-001', name: 'Overhead Tank Check', category: 'Plumbing', icon: '🚰',
      borderColor: '#1B6EF3', isDeleted: false, createdAt: new Date().toISOString(),
      fields: [
        { id: 'f1', type: 'dropdown', label: 'Water Level', options: ['Full','3/4','Half','Low','Empty'], required: true },
        { id: 'f2', type: 'checkbox', label: 'Motor Working', required: false },
        { id: 'f3', type: 'checkbox', label: 'Leakage Found', required: false },
        { id: 'f4', type: 'image', label: 'Upload Photo', required: false },
      ]
    },
    {
      id: 'TPL-002', name: 'Leakage Inspection', category: 'Plumbing', icon: '💧',
      borderColor: '#1B6EF3', isDeleted: false, createdAt: new Date().toISOString(),
      fields: [
        { id: 'f1', type: 'checkbox', label: 'Leakage Found', required: true },
        { id: 'f2', type: 'text', label: 'Location', placeholder: 'Describe location', required: false },
        { id: 'f3', type: 'dropdown', label: 'Severity', options: ['Minor','Moderate','Severe'], required: false },
        { id: 'f4', type: 'image', label: 'Upload Photo', required: false },
      ]
    },
    {
      id: 'TPL-003', name: 'Generator Check', category: 'Electrical', icon: '⚡',
      borderColor: '#D97706', isDeleted: false, createdAt: new Date().toISOString(),
      fields: [
        { id: 'f1', type: 'number', label: 'Fuel Level (%)', placeholder: '0-100', required: true },
        { id: 'f2', type: 'dropdown', label: 'Oil Level', options: ['Full','Half','Low','Empty'], required: true },
        { id: 'f3', type: 'checkbox', label: 'Generator Running', required: false },
        { id: 'f4', type: 'text', label: 'Issue Notes', placeholder: 'Any issues?', required: false },
        { id: 'f5', type: 'image', label: 'Upload Photo', required: false },
      ]
    },
    {
      id: 'TPL-004', name: 'Common Area Lights', category: 'Electrical', icon: '💡',
      borderColor: '#D97706', isDeleted: false, createdAt: new Date().toISOString(),
      fields: [
        { id: 'f1', type: 'checkbox', label: 'All Lights Working', required: false },
        { id: 'f2', type: 'text', label: 'Fault Locations', placeholder: 'List faulty areas', required: false },
        { id: 'f3', type: 'image', label: 'Upload Photo', required: false },
      ]
    },
    {
      id: 'TPL-005', name: 'Floor Cleaning Checklist', category: 'Housekeeping', icon: '🧹',
      borderColor: '#059669', isDeleted: false, createdAt: new Date().toISOString(),
      fields: [
        { id: 'f1', type: 'checkbox', label: 'Area Cleaned', required: true },
        { id: 'f2', type: 'dropdown', label: 'Cleaning Quality', options: ['Excellent','Good','Average','Poor'], required: true },
        { id: 'f3', type: 'text', label: 'Remarks', placeholder: 'Any remarks?', required: false },
      ]
    },
    {
      id: 'TPL-006', name: 'Garbage Collection', category: 'Housekeeping', icon: '🗑️',
      borderColor: '#059669', isDeleted: false, createdAt: new Date().toISOString(),
      fields: [
        { id: 'f1', type: 'checkbox', label: 'Garbage Collected', required: true },
        { id: 'f2', type: 'dropdown', label: 'Bin Status', options: ['Empty','Half','Full','Overflowing'], required: false },
        { id: 'f3', type: 'image', label: 'Upload Photo', required: false },
      ]
    },
    {
      id: 'TPL-007', name: 'Night Patrol Check', category: 'Security', icon: '🌙',
      borderColor: '#7C3AED', isDeleted: false, createdAt: new Date().toISOString(),
      fields: [
        { id: 'f1', type: 'checkbox', label: 'Patrol Completed', required: true },
        { id: 'f2', type: 'text', label: 'Issues Found', placeholder: 'Describe any issues', required: false },
        { id: 'f3', type: 'image', label: 'Upload Photo', required: false },
      ]
    },
    {
      id: 'TPL-008', name: 'CCTV Status Check', category: 'Security', icon: '📹',
      borderColor: '#7C3AED', isDeleted: false, createdAt: new Date().toISOString(),
      fields: [
        { id: 'f1', type: 'checkbox', label: 'All Cameras Working', required: false },
        { id: 'f2', type: 'text', label: 'Fault Cameras', placeholder: 'List camera IDs', required: false },
        { id: 'f3', type: 'image', label: 'Screenshot / Photo', required: false },
      ]
    },
  ];
  for (const t of templates) await DB.put('templates', t);

  // Seed tasks for today and past days
  const today = new Date();
  const taskDefs = [
    { workerId: 'WK-0001', templateId: 'TPL-001', time: '07:00' },
    { workerId: 'WK-0001', templateId: 'TPL-003', time: '08:30' },
    { workerId: 'WK-0001', templateId: 'TPL-004', time: '09:00' },
    { workerId: 'WK-0001', templateId: 'TPL-005', time: '10:00' },
    { workerId: 'WK-0001', templateId: 'TPL-006', time: '11:00' },
    { workerId: 'WK-0001', templateId: 'TPL-008', time: '12:00' },
    { workerId: 'WK-0001', templateId: 'TPL-002', time: '14:00' },
    { workerId: 'WK-0001', templateId: 'TPL-007', time: '23:00' },
    { workerId: 'WK-0002', templateId: 'TPL-003', time: '08:00' },
    { workerId: 'WK-0002', templateId: 'TPL-004', time: '09:00' },
    { workerId: 'WK-0002', templateId: 'TPL-008', time: '10:00' },
    { workerId: 'WK-0003', templateId: 'TPL-005', time: '07:00' },
    { workerId: 'WK-0003', templateId: 'TPL-006', time: '09:00' },
    { workerId: 'WK-0004', templateId: 'TPL-007', time: '22:00' },
    { workerId: 'WK-0004', templateId: 'TPL-008', time: '08:00' },
  ];

  const statuses = ['completed', 'completed', 'pending', 'completed', 'completed', 'pending', 'completed', 'missed'];

  for (let dayOffset = -5; dayOffset <= 0; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    const dateStr = d.toISOString().split('T')[0];

    for (const def of taskDefs) {
      const tpl = templates.find(t => t.id === def.templateId);
      if (!tpl) continue;
      const taskId = `${def.workerId}-${def.templateId}-${dateStr}`;
      let status = 'pending';
      if (dayOffset < 0) {
        const r = Math.random();
        status = r < 0.7 ? 'completed' : r < 0.85 ? 'missed' : 'pending';
      } else {
        // today: mix
        const idx = taskDefs.indexOf(def);
        status = statuses[idx % statuses.length] || 'pending';
      }
      await DB.put('tasks', {
        id: taskId,
        workerId: def.workerId,
        templateId: def.templateId,
        templateName: tpl.name,
        templateIcon: tpl.icon,
        category: tpl.category,
        date: dateStr,
        dueTime: def.time,
        status,
        communityId: 'COMM-001',
        assignedAt: new Date().toISOString(),
      });
    }
  }

  // Seed demo tickets
  const existingTickets = await DB.getAll('tickets');
  if (existingTickets.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    const demoTickets = [
      { id:'TKT-DEMO-001', residentName:'Ramesh Kumar', tower:'Tower B', flatNo:'401', phone:'9876543210', category:'plumbing', priority:'high', source:'phone_call', description:'Water pipe burst in bathroom — water leaking into bedroom. Urgent fix required.', photoUrl:'', assignedTo:'WK-0001', assignedName:'Rajan Kumar', status:'open', date:today, createdAt:new Date().toISOString(), createdBy:'ADMIN-01', timeline:[{time:new Date().toISOString(),action:'created',by:'Admin',note:'Ticket created via phone call'}], resolution:'', partsRequired:[], escalatedTo:'', communityId:'COMM-001' },
      { id:'TKT-DEMO-002', residentName:'Priya Sharma', tower:'Tower D', flatNo:'202', phone:'9123456789', category:'electrical', priority:'medium', source:'whatsapp', description:'Lift not working since morning. Residents on higher floors unable to use elevator.', photoUrl:'', assignedTo:'WK-0002', assignedName:'Mani Shankar', status:'in_progress', date:today, createdAt:new Date().toISOString(), createdBy:'ADMIN-01', timeline:[{time:new Date().toISOString(),action:'created',by:'Admin',note:'Auto-ticketed via WhatsApp'},{time:new Date().toISOString(),action:'in_progress',by:'Mani Shankar',note:'Worker started working'}], resolution:'', partsRequired:[], escalatedTo:'', communityId:'COMM-001' },
      { id:'TKT-DEMO-003', residentName:'Srinivas Rao', tower:'Tower A', flatNo:'105', phone:'9000011122', category:'security', priority:'emergency', source:'phone_call', description:'Unauthorized person seen near parking area. Immediate security check needed.', photoUrl:'', assignedTo:'WK-0004', assignedName:'Suresh Reddy', status:'open', date:today, createdAt:new Date().toISOString(), createdBy:'ADMIN-01', timeline:[{time:new Date().toISOString(),action:'created',by:'Admin',note:'Emergency call received'}], resolution:'', partsRequired:[], escalatedTo:'', communityId:'COMM-001' },
    ];
    for (const t of demoTickets) await DB.put('tickets', t);
  }

  await DB.setSetting('seeded', true);
  console.log('Database seeded');
}
