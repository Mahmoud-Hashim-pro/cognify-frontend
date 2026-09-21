const CACHE_NAME = 'cognify-v5-cache';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and API/Firebase backend endpoints
  if (request.method !== 'GET' || url.pathname.startsWith('/api/') || url.hostname.includes('firestore') || url.hostname.includes('googleapis')) {
    return;
  }

  // Network-first for navigation requests with offline fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache-first for static immutable assets with strict HTML MIME guard
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        // Self-heal: If cached asset was corrupted with an HTML response, purge it immediately
        if (cached) {
          const contentType = cached.headers.get('content-type') || '';
          if (!contentType.includes('text/html')) {
            return cached;
          }
          const cache = await caches.open(CACHE_NAME);
          await cache.delete(request);
        }

        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const contentType = response.headers.get('content-type') || '';
            // Only cache valid assets, NEVER cache HTML fallback under /assets/
            if (!contentType.includes('text/html')) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
          }
          return response;
        });
      })
    );
    return;
  }

  // Default network-falling-back-to-cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});