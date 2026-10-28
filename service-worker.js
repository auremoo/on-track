// On Track — Auteur : Aurélien Moote - Moo - 2026 — Licence MIT
// SW version — bump this to force cache clear on all clients
const SW_VERSION = '1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Force network (no HTTP cache) for app files — prevents stale JS/CSS on iOS PWA
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isAppFile = url.origin === self.location.origin &&
    (url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.html') ||
     url.pathname === '/' ||
     url.pathname.endsWith('/'));

  if (isAppFile) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
  }
});
