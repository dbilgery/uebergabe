const CACHE = 'uebergabe-v3';
const LOCAL_ASSETS = ['./styles.css', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(LOCAL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = new URL(request.url);

  // Always prefer the network for page navigations so GitHub Pages updates
  // are visible immediately. Fall back to a cached page only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./', clone));
          return response;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  // Local assets: stale-while-revalidate. Users get a fast response while
  // the latest version is fetched and stored for the next request.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request, { cache: 'no-store' })
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
