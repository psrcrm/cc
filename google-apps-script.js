// ═══════════════════════════════════════════════════════════════════════════
// ApartmentCare — Google Apps Script
//
// SETUP (one time only):
//  1. Open your Google Sheet
//  2. Extensions → Apps Script → paste this entire file → Save
//  3. Deploy → New deployment → Web app
//     - Execute as: Me
//     - Who has access: Anyone
//  4. Click Deploy → Copy the Web App URL
//  5. Open ApartmentCare app → Admin → Settings → paste URL → Save
//
// That's it. Never touch code again.
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_ID   = SpreadsheetApp.getActiveSpreadsheet().getId(); // auto-detected
const SHEET_NAME = 'WorkLog';

const HEADERS = [
  'record_id','worker_id','worker_name','task_id','task_name',
  'category','date','status','form_data_json','image_urls',
  'submitted_at','community_id','synced_at'
];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1B6EF3')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Handle POST — called when worker submits a task ───────────────────────
function doPost(e) {
  try {
    const raw  = e.postData ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    if (!data.record_id) return respond({ status: 'error', message: 'Missing record_id' });

    const sheet   = getSheet();
    const lastRow = sheet.getLastRow();

    // Duplicate check — append-only, never overwrite
    if (lastRow > 1) {
      const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
      if (ids.includes(data.record_id)) {
        return respond({ status: 'duplicate', record_id: data.record_id });
      }
    }

    sheet.appendRow([
      data.record_id      || '',
      data.worker_id      || '',
      data.worker_name    || '',
      data.task_id        || '',
      data.task_name      || '',
      data.category       || '',
      data.date           || '',
      data.status         || '',
      data.form_data_json || '{}',
      data.image_urls     || '{}',
      data.submitted_at   || new Date().toISOString(),
      data.community_id   || 'COMM-001',
      new Date().toISOString(), // synced_at
    ]);

    return respond({ status: 'ok', record_id: data.record_id });

  } catch (err) {
    Logger.log('doPost error: ' + err);
    return respond({ status: 'error', message: err.toString() });
  }
}

// ── Handle GET — health check & ping from app Settings ───────────────────
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  try {
    const sheet = getSheet();
    const count = Math.max(0, sheet.getLastRow() - 1);
    return respond({
      status:  'ok',
      service: 'ApartmentCare API',
      version: '1.0',
      sheet:   SHEET_NAME,
      rows:    count,
    });
  } catch (err) {
    return respond({ status: 'error', message: err.toString() });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Manual test — run from Apps Script editor to verify ──────────────────
function testAppend() {
  const sheet = getSheet();
  sheet.appendRow([
    'TEST-' + Date.now(), 'WK-0001', 'Test Worker', 'TPL-001',
    'Test Task', 'Plumbing', new Date().toISOString().split('T')[0],
    'completed', '{"test":true}', '{}',
    new Date().toISOString(), 'COMM-001', new Date().toISOString()
  ]);
  Logger.log('Test row added to ' + SHEET_NAME);
}
