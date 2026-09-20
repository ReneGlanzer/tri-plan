/* Offline-Cache (App-Shell). Bei Änderungen an Dateien CACHE hochzählen. */
const CACHE = 'tri70-v5';
const FILES = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'js/data.js', 'js/de.js', 'js/util.js', 'js/zones.js', 'js/engine.js', 'js/fit.js', 'js/charts.js', 'js/views.js', 'js/app.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});


