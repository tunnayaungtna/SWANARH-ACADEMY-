// Self-healing replacement for any previously registered /dev-sw.js?dev-sw
const CACHE_NAME = 'swanarh-classroom-v5';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      ),
    ])
  );
});

self.addEventListener('fetch', () => {
  // Pass through all requests directly to browser network stack
  return;
});
