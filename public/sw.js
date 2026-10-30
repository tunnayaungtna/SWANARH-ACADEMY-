const CACHE_NAME = 'swanarh-classroom-v7';
const RELATIVE_ICON_ASSETS = [
  './pwa-192x192.png',
  './pwa-512x512.png',
  './pwa-maskable-512x512.png',
  './apple-touch-icon.png',
  './icon.svg',
];

function getScopedIconAssets() {
  const base = (self.registration && self.registration.scope) || self.location.origin + '/';
  return RELATIVE_ICON_ASSETS.map((rel) => {
    try {
      return new URL(rel, base).pathname;
    } catch {
      return rel.replace(/^\./, '');
    }
  });
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(getScopedIconAssets()).catch(() => {});
    })
  );
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

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_CACHES') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // NEVER intercept HTML document navigation, scripts, or stylesheets.
  // This ensures that when reopening the installed app 2-3 hours later,
  // Cloud Run / AI Studio session refreshes and JS chunks always load directly from the network.
  if (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style'
  ) {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const scopedIcons = getScopedIconAssets();
  if (scopedIcons.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const cloned = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned)).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});

