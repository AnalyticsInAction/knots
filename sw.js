// Offline support. Online: always fetch the latest files. Offline or slow signal: use the saved copy.
const CACHE = 'knots-v12';
const FILES = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const TIMEOUT = 3000;

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's own HTTP cache so a stale app.js is never saved
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const own = new URL(e.request.url).origin === location.origin;
  const saved = caches.match(e.request, { ignoreSearch: true });
  const save = res => {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  };
  // Fonts and other third-party files never change: saved copy first
  if (!own) { e.respondWith(saved.then(r => r || fetch(e.request).then(save))); return; }
  // App files: network first, falling back to the saved copy if offline or slower than TIMEOUT
  const fresh = fetch(e.request, { cache: 'no-cache' }).then(save);
  e.respondWith(Promise.race([
    fresh,
    new Promise((_, no) => setTimeout(no, TIMEOUT)),
  ]).catch(() => saved.then(r => r || fresh)));
});
