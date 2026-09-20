/* Offline-Cache (App-Shell). Bei Änderungen an Dateien CACHE hochzählen. */
const CACHE = 'tri70-v7';
const FILES = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'data.js', 'de.js', 'util.js', 'zones.js', 'engine.js', 'fit.js', 'charts.js', 'views.js', 'app.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});


