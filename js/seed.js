'use strict';
// ── Seed initial data ─────────────────────────────────────────────────────────
async function seedLocalData() {
  const existing = await LocalDB.getAll('workers');
  if (existing.length > 0) return;

  const workers = [
    { id:'WK-0001', name:'Rajan Kumar',     mobile:'9876543210', pinHash:'1234', role:'worker',     category:'Plumbing',     isActive:true, communityId:'COMM-001', initials:'RK', avatarBg:'#EBF2FF', avatarColor:'#1B6EF3', createdAt:new Date().toISOString() },
    { id:'WK-0002', name:'Mani Shankar',    mobile:'9988776655', pinHash:'2222', role:'worker',     category:'Electrical',   isActive:true, communityId:'COMM-001', initials:'MS', avatarBg:'#ECFDF5', avatarColor:'#059669', createdAt:new Date().toISOString() },
    { id:'WK-0003', name:'Priya Teja',      mobile:'9123456789', pinHash:'3333', role:'worker',     category:'Housekeeping', isActive:true, communityId:'COMM-001', initials:'PT', avatarBg:'#FFF1F2', avatarColor:'#E11D48', createdAt:new Date().toISOString() },
    { id:'WK-0004', name:'Suresh Reddy',    mobile:'9765432109', pinHash:'4444', role:'worker',     category:'Security',     isActive:true, communityId:'COMM-001', initials:'SR', avatarBg:'#F5F3FF', avatarColor:'#7C3AED', createdAt:new Date().toISOString() },
    { id:'WK-0005', name:'Kavitha Prasad',  mobile:'9000011122', pinHash:'5555', role:'worker',     category:'Housekeeping', isActive:true, communityId:'COMM-001', initials:'KP', avatarBg:'#FFFBEB', avatarColor:'#D97706', createdAt:new Date().toISOString() },
    { id:'SUP-0001', name:'Rajesh Nair',    mobile:'9111122223', pinHash:'6666', role:'supervisor', category:'All',          isActive:true, communityId:'COMM-001', initials:'RN', avatarBg:'#F0F4FF', avatarColor:'#3730A3', createdAt:new Date().toISOString() },
    { id:'ADMIN-01', name:'Community Admin',mobile:'0000000000', pinHash:'9999', role:'admin',      category:'Admin',        isActive:true, communityId:'COMM-001', initials:'CA', avatarBg:'#EBF2FF', avatarColor:'#1B6EF3', createdAt:new Date().toISOString() },
  ];
  for (const w of workers) await LocalDB.put('workers', w);

  const templates = [
    { id:'TPL-001', name:'Overhead Tank Check',     category:'Plumbing',    icon:'🚰', borderColor:'#1B6EF3', isDeleted:false, createdAt:new Date().toISOString(), fields:[{id:'f1',type:'dropdown',label:'Water Level',options:['Full','3/4','Half','Low','Empty'],required:true},{id:'f2',type:'checkbox',label:'Motor Working'},{id:'f3',type:'checkbox',label:'Leakage Found'},{id:'f4',type:'image',label:'Upload Photo'}] },
    { id:'TPL-002', name:'Leakage Inspection',      category:'Plumbing',    icon:'💧', borderColor:'#1B6EF3', isDeleted:false, createdAt:new Date().toISOString(), fields:[{id:'f1',type:'checkbox',label:'Leakage Found',required:true},{id:'f2',type:'text',label:'Location',placeholder:'Describe location'},{id:'f3',type:'dropdown',label:'Severity',options:['Minor','Moderate','Severe']},{id:'f4',type:'image',label:'Upload Photo'}] },
    { id:'TPL-003', name:'Generator Check',         category:'Electrical',  icon:'⚡', borderColor:'#D97706', isDeleted:false, createdAt:new Date().toISOString(), fields:[{id:'f1',type:'number',label:'Fuel Level (%)',placeholder:'0-100',required:true},{id:'f2',type:'dropdown',label:'Oil Level',options:['Full','Half','Low','Empty'],required:true},{id:'f3',type:'checkbox',label:'Generator Running'},{id:'f4',type:'text',label:'Issue Notes',placeholder:'Any issues?'},{id:'f5',type:'image',label:'Upload Photo'}] },
    { id:'TPL-004', name:'Common Area Lights',      category:'Electrical',  icon:'💡', borderColor:'#D97706', isDeleted:false, createdAt:new Date().toISOString(), fields:[{id:'f1',type:'checkbox',label:'All Lights Working'},{id:'f2',type:'text',label:'Fault Locations',placeholder:'List faulty areas'},{id:'f3',type:'image',label:'Upload Photo'}] },
    { id:'TPL-005', name:'Floor Cleaning Checklist',category:'Housekeeping',icon:'🧹', borderColor:'#059669', isDeleted:false, createdAt:new Date().toISOString(), fields:[{id:'f1',type:'checkbox',label:'Area Cleaned',required:true},{id:'f2',type:'dropdown',label:'Cleaning Quality',options:['Excellent','Good','Average','Poor'],required:true},{id:'f3',type:'text',label:'Remarks',placeholder:'Any remarks?'}] },
    { id:'TPL-006', name:'Garbage Collection',      category:'Housekeeping',icon:'🗑️', borderColor:'#059669', isDeleted:false, createdAt:new Date().toISOString(), fields:[{id:'f1',type:'checkbox',label:'Garbage Collected',required:true},{id:'f2',type:'dropdown',label:'Bin Status',options:['Empty','Half','Full','Overflowing']},{id:'f3',type:'image',label:'Upload Photo'}] },
    { id:'TPL-007', name:'Night Patrol Check',      category:'Security',    icon:'🌙', borderColor:'#7C3AED', isDeleted:false, createdAt:new Date().toISOString(), fields:[{id:'f1',type:'checkbox',label:'Patrol Completed',required:true},{id:'f2',type:'text',label:'Issues Found',placeholder:'Describe any issues'},{id:'f3',type:'image',label:'Upload Photo'}] },
    { id:'TPL-008', name:'CCTV Status Check',       category:'Security',    icon:'📹', borderColor:'#7C3AED', isDeleted:false, createdAt:new Date().toISOString(), fields:[{id:'f1',type:'checkbox',label:'All Cameras Working'},{id:'f2',type:'text',label:'Fault Cameras',placeholder:'List camera IDs'},{id:'f3',type:'image',label:'Screenshot / Photo'}] },
  ];
  for (const t of templates) await LocalDB.put('templates', t);

  // Seed today's tasks
  const today = new Date().toISOString().split('T')[0];
  const taskDefs = [
    {workerId:'WK-0001',templateId:'TPL-001',time:'07:00'},{workerId:'WK-0001',templateId:'TPL-003',time:'08:30'},
    {workerId:'WK-0001',templateId:'TPL-004',time:'09:00'},{workerId:'WK-0001',templateId:'TPL-005',time:'10:00'},
    {workerId:'WK-0001',templateId:'TPL-006',time:'11:00'},{workerId:'WK-0001',templateId:'TPL-008',time:'12:00'},
    {workerId:'WK-0001',templateId:'TPL-002',time:'14:00'},{workerId:'WK-0001',templateId:'TPL-007',time:'23:00'},
    {workerId:'WK-0002',templateId:'TPL-003',time:'08:00'},{workerId:'WK-0002',templateId:'TPL-004',time:'09:00'},
    {workerId:'WK-0003',templateId:'TPL-005',time:'07:00'},{workerId:'WK-0003',templateId:'TPL-006',time:'09:00'},
    {workerId:'WK-0004',templateId:'TPL-007',time:'22:00'},{workerId:'WK-0004',templateId:'TPL-008',time:'08:00'},
  ];
  const statusCycle = ['completed','completed','pending','completed','completed','pending','completed','missed'];
  for (let d = -4; d <= 0; d++) {
    const dt = new Date(); dt.setDate(dt.getDate()+d);
    const dateStr = dt.toISOString().split('T')[0];
    for (let i=0; i<taskDefs.length; i++) {
      const def = taskDefs[i];
      const tpl = templates.find(t => t.id === def.templateId);
      if (!tpl) continue;
      const status = d < 0 ? (Math.random()<0.7?'completed':Math.random()<0.5?'missed':'pending') : statusCycle[i%statusCycle.length];
      await LocalDB.put('tasks', { id:`${def.workerId}-${def.templateId}-${dateStr}`, workerId:def.workerId, templateId:def.templateId, templateName:tpl.name, templateIcon:tpl.icon, category:tpl.category, date:dateStr, dueTime:def.time, status, communityId:'COMM-001', assignedAt:new Date().toISOString() });
    }
  }

  // Demo tickets
  const demoTickets = [
    { id:'TKT-DEMO-001', residentName:'Ramesh Kumar', tower:'Tower A01', flatNo:'401', phone:'9876543210', category:'plumbing', priority:'high', source:'phone_call', description:'Water pipe burst in bathroom — water leaking into bedroom.', photoUrl:'', assignedTo:'WK-0001', assignedName:'Rajan Kumar', status:'open', date:today, createdAt:new Date().toISOString(), createdBy:'ADMIN-01', timeline:[{time:new Date().toISOString(),action:'created',by:'Admin',note:'Ticket created via phone call'}], resolution:'', partsRequired:[], escalatedTo:'', communityId:'COMM-001' },
    { id:'TKT-DEMO-002', residentName:'Priya Sharma',  tower:'Tower A04', flatNo:'202', phone:'9123456789', category:'lift',     priority:'medium',source:'whatsapp',   description:'Lift not working since morning. Residents on higher floors unable to use elevator.', photoUrl:'', assignedTo:'WK-0002', assignedName:'Mani Shankar', status:'in_progress', date:today, createdAt:new Date().toISOString(), createdBy:'ADMIN-01', timeline:[{time:new Date().toISOString(),action:'created',by:'Admin',note:'WhatsApp complaint'},{time:new Date().toISOString(),action:'in_progress',by:'Mani Shankar',note:'Worker started'}], resolution:'', partsRequired:[], escalatedTo:'', communityId:'COMM-001' },
    { id:'TKT-DEMO-003', residentName:'Srinivas Rao',  tower:'Tower A01', flatNo:'105', phone:'9000011122', category:'security', priority:'emergency', source:'phone_call', description:'Unauthorized person near parking. Immediate security check needed.', photoUrl:'', assignedTo:'WK-0004', assignedName:'Suresh Reddy', status:'open', date:today, createdAt:new Date().toISOString(), createdBy:'ADMIN-01', timeline:[{time:new Date().toISOString(),action:'created',by:'Admin',note:'Emergency call received'}], resolution:'', partsRequired:[], escalatedTo:'', communityId:'COMM-001' },
  ];
  for (const t of demoTickets) await LocalDB.put('tickets', t);

  await LocalDB.setSetting('seeded', true);
  console.log('[Seed] Local data seeded');
}

// ── Push local seed data up to Firebase (called once after FB connects) ───────
async function syncSeedToFirebase() {
  const already = await FB.db.collection('settings').doc('seeded').get();
  if (already.exists) return; // already seeded in Firebase

  console.log('[Seed] Pushing seed data to Firebase...');
  const stores = ['workers','templates'];
  for (const store of stores) {
    const items = await LocalDB.getAll(store);
    for (const item of items) {
      await FB.db.collection(store).doc(item.id).set(item);
    }
  }
  // Push today's tasks
  const tasks = await LocalDB.getAll('tasks');
  for (const task of tasks) await FB.db.collection('tasks').doc(task.id).set(task);
  // Push demo tickets
  const tickets = await LocalDB.getAll('tickets');
  for (const ticket of tickets) await FB.db.collection('tickets').doc(ticket.id).set(ticket);

  await FB.db.collection('settings').doc('seeded').set({ key:'seeded', value: true });
  console.log('[Seed] Firebase seeded successfully');
}

window.seedLocalData      = seedLocalData;
window.syncSeedToFirebase = syncSeedToFirebase;
