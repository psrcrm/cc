# ApartmentCare — Workforce Management PWA

## 🚀 How to Run

### Option A: Local (easiest)
```
# Python
python3 -m http.server 8080 --directory apartmentcare

# Node.js
npx serve apartmentcare
```
Open http://localhost:8080

### Option B: Deploy (free)
- **Netlify**: Drag & drop the `apartmentcare/` folder at app.netlify.com
- **Vercel**: `npx vercel apartmentcare/`
- **GitHub Pages**: Push to repo → Settings → Pages → Deploy

---

## 👤 Demo Accounts

| Role   | Mobile       | PIN  |
|--------|-------------|------|
| Worker | 9876543210  | 1234 |
| Worker | 9988776655  | 2222 |
| Worker | 9123456789  | 3333 |
| Admin  | 0000000000  | 9999 |

---

## 📱 Install as PWA (Add to Home Screen)

### Android (Chrome)
1. Open in Chrome browser
2. Tap ⋮ menu → "Add to Home screen"

### iOS (Safari)
1. Open in Safari
2. Tap Share → "Add to Home Screen"

---

## 📊 Google Sheets Integration

### Step 1: Create Google Sheet
Create a sheet named `ApartmentCare_WorkLog` with these columns:
`record_id | worker_id | worker_name | task_id | task_name | category | date | status | form_data_json | image_urls | submitted_at | community_id`

### Step 2: Deploy Apps Script

In your Google Sheet, go to **Extensions → Apps Script** and paste:

```javascript
const SHEET_ID = 'YOUR_SHEET_ID_HERE';
const FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID_HERE';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
    
    // Duplicate check — never overwrite
    const ids = sheet.getRange('A:A').getValues().flat();
    if (ids.includes(data.record_id)) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'duplicate' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Append row — NEVER update existing
    sheet.appendRow([
      data.record_id,
      data.worker_id,
      data.worker_name,
      data.task_id,
      data.task_name,
      data.category,
      data.date,
      data.status,
      data.form_data_json,
      data.image_urls || '',
      data.submitted_at,
      data.community_id,
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput('ApartmentCare API active');
}
```

### Step 3: Deploy as Web App
- Click **Deploy → New deployment**
- Type: **Web app**
- Execute as: **Me**
- Access: **Anyone**
- Click Deploy → Copy the Web App URL

### Step 4: Set URL in app
In `js/sync.js`, set:
```javascript
SHEETS_URL: 'https://script.google.com/macros/s/YOUR_ID/exec',
```

---

## 🗄️ Data Model

### Record ID Format
```
WK-0001-TPL-003-20250411-143022
│          │         │        └── HH:MM:SS timestamp
│          │         └────────── Date YYYYMMDD
│          └──────────────────── Template ID
└─────────────────────────────── Worker ID
```

### IndexedDB Stores
| Store | Key | Purpose |
|-------|-----|---------|
| workers | id | User accounts & PIN hashes |
| templates | id | Reusable task templates |
| tasks | id | Task instances per worker per day |
| submissions | recordId | Completed form data (append-only) |
| queue | recordId | Offline sync queue |
| settings | key | App settings |

---

## 🔐 Security Notes

- PINs stored as plain text in this demo. In production: use **bcrypt** (Node.js) or **Web Crypto API** (browser)
- All data in local IndexedDB; submissions sync to Google Sheets
- Submissions are append-only; existing records never overwritten
- JWT tokens for production: 8-hour expiry (one shift)

---

## 📂 File Structure

```
apartmentcare/
├── index.html          # App shell
├── manifest.json       # PWA manifest
├── sw.js               # Service worker (offline)
├── css/
│   └── app.css         # Full stylesheet
├── js/
│   ├── db.js           # IndexedDB + seed data
│   ├── auth.js         # PIN login/logout
│   ├── tasks.js        # Worker task flow
│   ├── admin.js        # Admin panel
│   ├── calendar.js     # Calendar views
│   ├── sync.js         # Offline queue & Sheets sync
│   └── app.js          # App controller & routing
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

---

## 🔮 Next Steps
1. Replace plain-text PIN with bcrypt (add bcryptjs CDN)
2. Set Google Sheets & Drive IDs in sync.js
3. Add push notifications via Firebase Cloud Messaging
4. Add multi-community support (COMM-001, COMM-002...)
5. Add WhatsApp alerts via Twilio / WATI API
