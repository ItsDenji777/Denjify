// Minimal service worker – required for PWA installability
// Does nothing, no caching.
self.addEventListener('install', () => {
  // Skip waiting so the new service worker activates immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through – don't cache anything
  event.respondWith(fetch(event.request));
});