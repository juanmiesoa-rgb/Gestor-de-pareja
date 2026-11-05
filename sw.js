// Service Worker básico para permitir la instalación de la PWA
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Dejamos que las peticiones vayan a la red normalmente
  e.respondWith(fetch(e.request).catch(() => {}));
});
