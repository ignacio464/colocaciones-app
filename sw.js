/* Service worker: guarda en caché SOLO los archivos de la aplicación. Nunca datos del usuario. */
const CACHE = 'colocaciones-app-v1';
const ARCHIVOS = ['./', 'index.html', 'manifest.json', 'style.css', 'core.js', 'vault.js', 'ui.js', 'app.js', 'screens1.js', 'screens2.js', 'screens3.js', 'boot.js', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const base = new URL('./', self.location).pathname;
  const rel = url.pathname.slice(base.length);
  if (!ARCHIVOS.includes(rel === '' ? './' : rel)) return; // lo que no es archivo de la app no se toca
  e.respondWith(fetch(req).then((r) => {
    if (r && r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
    return r;
  }).catch(() => caches.match(req)));
});
