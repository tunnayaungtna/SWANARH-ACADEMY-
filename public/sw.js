const CACHE_NAME = 'swanarh-classroom-v5';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
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

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Fast-path: NEVER intercept Vite modules, scripts, styles, or dynamic endpoints.
  // Letting the browser load JS/TS/CSS natively prevents white-screen stalls on app reopen.
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.search.includes('v=') ||
    url.search.includes('import') ||
    url.search.includes('dev-sw')
  ) {
    return;
  }

  // Static PWA icons & manifest: Cache-first with background refresh for instant startup
  if (STATIC_ASSETS.includes(url.pathname)) {
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
    return;
  }

  // HTML Navigation requests when reopening the installed app:
  // Fetch directly from network with credentials, cache valid 200 HTML for offline fallback,
  // and never block or serve stale broken HTML when online.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const contentType = response.headers.get('content-type') || '';
          if (response && response.status === 200 && contentType.includes('text/html')) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', cloned)).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => {
            if (cached) return cached;
            return new Response(
              '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SwanArh Classroom</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;color:#0f172a;text-align:center;padding:20px;"><div><h2 style="color:#059669;margin-bottom:8px;">SwanArh Classroom</h2><p style="color:#475569;font-size:14px;margin-bottom:16px;">အင်တာနက်လိုင်း ချိတ်ဆက်မှုကို စစ်ဆေးပြီး ပြန်လည်ဖွင့်ပေးပါ။</p><button onclick="location.reload()" style="background:#059669;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-weight:bold;cursor:pointer;">ပြန်လည်စတင်ရန် (Retry)</button></div></body></html>',
              { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        })
    );
  }
});
