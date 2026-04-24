/* ApartmentCare Service Worker — v20250424 */
const CACHE = 'ac-20250424';
const BASE  = '/wfm';

const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/css/app.css',
  BASE + '/js/config.js',
  BASE + '/js/db.js',
  BASE + '/js/firebase.js',
  BASE + '/js/seed.js',
  BASE + '/js/auth.js',
  BASE + '/js/notifications.js',
  BASE + '/js/tickets.js',
  BASE + '/js/tasks.js',
  BASE + '/js/admin.js',
  BASE + '/js/calendar.js',
  BASE + '/js/sync.js',
  BASE + '/js/app.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(url => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

/* Wipe ALL old caches on activate */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      })))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Let Firebase, Google APIs go straight to network
  if (e.request.url.includes('firestore.googleapis.com')) return;
  if (e.request.url.includes('firebase'))  return;
  if (e.request.url.includes('gstatic'))   return;
  if (e.request.url.includes('googleapis')) return;
  if (e.request.url.includes('script.google.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => null);
      return cached || net || caches.match(BASE + '/index.html');
    })
  );
});
